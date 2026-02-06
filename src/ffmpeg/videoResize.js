/**
 * 智能改尺寸 FFmpeg 处理模块
 *
 * 功能：
 * - Siya模式：竖屏转横屏/方形，模糊背景填充
 * - Fishing模式：横屏转竖屏/方形，模糊背景填充
 * - unify_h：统一横屏
 * - unify_v：统一竖屏
 */

const { runFfmpeg } = require('./runFfmpeg');

/**
 * 智能改尺寸配置
 */
const RESIZE_CONFIGS = {
  siya: [
    { width: 1920, height: 1080, suffix: '_1920x1080' },  // 横屏
    { width: 1920, height: 1920, suffix: '_1920x1920' },  // 方形
  ],
  fishing: [
    { width: 1080, height: 1920, suffix: '_1080x1920' },  // 竖屏
    { width: 1920, height: 1920, suffix: '_1920x1920' },  // 方形
  ],
  unify_h: [
    { width: 1920, height: 1080, suffix: '_1920x1080' },  // 仅横屏
  ],
  unify_v: [
    { width: 1080, height: 1920, suffix: '_1080x1920' },  // 仅竖屏
  ],
};

/**
 * 构建智能改尺寸的 FFmpeg 命令参数
 *
 * @param {Object} config - 配置对象
 * @param {string} config.inputPath - 输入视频路径
 * @param {string} config.outputPath - 输出视频路径
 * @param {number} config.width - 目标宽度
 * @param {number} config.height - 目标高度
 * @param {number} config.blurAmount - 模糊程度 (0-50)
 * @param {number} [config.threads] - FFmpeg 线程数，默认自动
 * @returns {string[]} FFmpeg 命令行参数数组
 */
function buildArgs({ inputPath, outputPath, width, height, blurAmount, threads }) {
  console.log(`[videoResize] 目标尺寸: ${width}x${height}, 模糊: ${blurAmount}`);

  // 完整版本：背景 + 前景 + 叠加
  // 关键：先用 split 创建两个副本，因为同一输入不能直接用两次
  let filters = `[0:v]split=2[bg_src][fg_src];`;

  // 1. 创建模糊背景（cover 模式：等比缩放撑满，然后裁剪）
  filters += `[bg_src]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2`;
  if (blurAmount > 0) {
    filters += `,boxblur=${blurAmount}:${blurAmount}`;
  }
  filters += `[bg];`;

  // 2. 创建清晰前景（fit 模式：等比缩放到适应尺寸，不 pad）
  // scale 的 force_original_aspect_ratio=decrease 会保持比例，缩放到能适应目标尺寸的最大值
  // 缩放后的尺寸可能小于目标尺寸，但这正是我们想要的 - 用于居中叠加
  filters += `[fg_src]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];`;

  // 3. 叠加：前景居中叠加到背景上
  // (W-w)/2 和 (H-h)/2 计算居中位置，其中 W/H 是背景尺寸，w/h 是前景尺寸
  filters += `[bg][fg]overlay=(W-w)/2:(H-h)/2[out]`;

  console.log(`[videoResize] filter_complex: ${filters}`);

  // 构建参数，添加性能优化选项
  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex', filters,
    '-map', '[out]',
    '-map', '0:a?',
    // 视频编码性能优化
    '-c:v', 'libx264',
    '-preset', 'ultrafast',      // 最快编码预设
    '-tune', 'fastdecode',       // 优化解码速度
    '-crf', '28',                 // 质量控制
    // 线程优化
    ...(threads ? ['-threads', String(threads)] : ['-threads', 'auto']),  // 线程数
    '-x264-params', 'threads=0:lookahead_threads=0',  // x264 内部线程优化
    '-c:a', 'copy',               // 音频直接复制
    outputPath
  ];
  return args;
}

/**
 * 生成预览视频
 *
 * @param {Object} config - 配置对象
 * @param {string} config.inputPath - 输入视频路径
 * @param {string} config.tempDir - 临时目录
 * @param {string} config.mode - 模式 (siya | fishing | unify_h | unify_v)
 * @param {number} config.blurAmount - 模糊程度
 * @param {number} [config.threads] - FFmpeg 线程数
 * @param {function} config.onProgress - 进度回调
 * @param {function} config.onLog - 日志回调
 * @returns {Promise<string[]>} 预览视频路径数组
 */
async function generatePreviews({ inputPath, tempDir, mode, blurAmount, threads, onProgress, onLog }) {
  const configs = RESIZE_CONFIGS[mode];
  if (!configs) {
    throw new Error(`无效的模式: ${mode}`);
  }

  const fs = require('fs');
  const path = require('path');

  // 确保临时目录存在
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const previewPaths = [];

  // 为每个目标尺寸生成预览视频
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const fileName = `preview_${Date.now()}_${i}${config.suffix}.mp4`;
    const outputPath = path.join(tempDir, fileName);

    onLog?.(`生成预览 ${i + 1}/${configs.length}: ${config.width}x${config.height}`);

    const args = buildArgs({
      inputPath,
      outputPath,
      width: config.width,
      height: config.height,
      blurAmount,
      threads,
    });

    await runFfmpeg(args, onLog);
    previewPaths.push({
      path: outputPath,
      width: config.width,
      height: config.height,
      label: `${config.width}x${config.height}`,
    });
  }

  return previewPaths;
}

/**
 * 清理临时预览文件
 *
 * @param {string[]} filePaths - 文件路径数组
 */
function cleanupPreviews(filePaths) {
  const fs = require('fs');
  filePaths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('清理预览文件失败:', filePath, err);
    }
  });
}

module.exports = {
  buildArgs,
  generatePreviews,
  cleanupPreviews,
  RESIZE_CONFIGS,
};
