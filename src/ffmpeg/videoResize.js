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
 * @returns {string[]} FFmpeg 命令行参数数组
 */
function buildArgs({ inputPath, outputPath, width, height, blurAmount }) {
  // 构建 filter_complex
  // 逻辑：
  // 1. 先缩放原图到目标尺寸（保持比例，可能留黑边）
  // 2. 创建模糊背景（将原图缩放到覆盖目标尺寸，然后用 boxblur）
  // 3. 将清晰视频叠加到模糊背景上

  // 前景视频：缩放到目标尺寸内（保持比例），确保偶数
  let filters = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[v_scaled];`;
  filters += `[v_scaled]pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black[v_padded];`;

  if (blurAmount > 0) {
    // 有模糊：创建模糊背景
    // 背景视频缩放到覆盖目标尺寸
    filters += `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase[bg_scaled];`;
    // 裁剪到精确尺寸
    filters += `[bg_scaled]crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2[bg_cropped];`;
    // 应用模糊
    filters += `[bg_cropped]boxblur=${blurAmount}:${blurAmount}:1:1:0:0[bg_blur];`;
    // 叠加清晰视频到模糊背景中心
    filters += `[bg_blur][v_padded]overlay=(W-w)/2:(H-h)/2[final_v];`;
  } else {
    // 无模糊：直接使用缩放后的视频
    filters += `[v_padded]copy[final_v];`;
  }

  // 确保最终输出是偶数（使用 round 确保偶数）
  filters += `[final_v]scale=ceil(iw/2)*2:ceil(ih/2)*2[out_even];`;

  const args = [
    '-y',
    '-i', inputPath,
    '-filter_complex', filters,
    '-map', '[out_even]',
    '-map', '0:a?',  // 包含原始音频（如果有）
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-c:a', 'copy',  // 音频直接复制，不重新编码
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
 * @param {function} config.onProgress - 进度回调
 * @param {function} config.onLog - 日志回调
 * @returns {Promise<string[]>} 预览视频路径数组
 */
async function generatePreviews({ inputPath, tempDir, mode, blurAmount, onProgress, onLog }) {
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
