/**
 * FFmpeg 命令构建模块
 * 将 VideoMaster 的浏览器 API 视频处理功能转换为 FFmpeg 命令
 */

const path = require('path');

/**
 * 横屏合成 (1920x1080)
 * A面视频 + 主视频 + 背景
 *
 * VideoMaster 原逻辑:
 * - A面视频: scale 到 1920x1080, 全屏显示
 * - 主视频: scale 保持 1080:1920 比例 (~607x1080), 居中显示
 * - 背景: 可选, 如果有则绘制在主视频下方
 * - 封面: 可选, 静态图片显示指定时长
 *
 * FFmpeg 实现:
 * 1. 如果有封面: 先用 loop + duration 创建封面视频段
 * 2. A面视频: scale=1920:1080
 * 3. 主视频: scale=607:1080, 居中 overlay
 * 4. 背景: 作为底层, 主视频 overlay 在上面
 * 5. concat 连接所有段
 */
function buildHorizontalCommand({ aVideo, mainVideo, bgImage, coverImage, coverDuration, output }) {
  const filters = [];
  const inputs = [];

  // 添加输入文件
  inputs.push('-i', aVideo);
  inputs.push('-i', mainVideo);

  if (bgImage) {
    inputs.push('-i', bgImage);
  }

  if (coverImage) {
    inputs.push('-i', coverImage);
  }

  // 构建滤镜链
  let filterIndex = 0;

  // [0:v] A面视频缩放到 1920x1080
  filters.push(`[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v0]`);
  filterIndex++;

  // 主视频缩放到 607x1080 (保持 9:16 比例)
  const mainVideoIndex = bgImage ? 2 : 1; // 如果有背景图, 主视频是 [2:v]
  filters.push(`[${mainVideoIndex}:v]scale=607:1080[v1]`);
  filterIndex++;

  // 如果有背景图, 先放置背景, 再 overlay 主视频
  if (bgImage) {
    // [1:v] 背景图缩放到 1920x1080
    filters.push(`[1:v]scale=1920:1080[bg]`);
    filterIndex++;
    // 背景上 overlay 主视频居中
    filters.push(`[bg][v1]overlay=(W-w)/2:(H-h)/2[v2]`);
    filterIndex++;
    // A面 + 主视频段
    filters.push(`[v0][v2]concat=n=2:v=1[audio]`);
  } else {
    // 无背景图, 直接 concat
    filters.push(`[v0][v1]concat=n=2:v=1[vout]`);
  }

  // 添加音频处理
  inputs.push('-map', '[audio]'); // 使用连接后的视频流
  inputs.push('-c:v', 'libx264');
  inputs.push('-preset', 'fast');
  inputs.push('-crf', '23');
  inputs.push('-r', '30');
  inputs.push('-c:a', 'aac');
  inputs.push('-b:a', '128k');
  inputs.push('-shortest');

  return {
    inputs,
    filters: filters.join(';'),
    output
  };
}

/**
 * 竖屏合成 (1080x1920)
 * 主视频 + 背景 + 可选 A 面
 */
function buildVerticalCommand({ mainVideo, bgImage, aVideo, coverImage, coverDuration, output }) {
  const inputs = ['-i', mainVideo];

  if (bgImage) {
    inputs.push('-i', bgImage);
  }

  if (aVideo) {
    inputs.push('-i', aVideo);
  }

  const filters = [];

  // 主视频缩放到 1080x1920 (保持 16:9 比例 => 1080x607.5 ≈ 1080x608)
  if (bgImage) {
    // 有背景图的情况
    filters.push('[0:v]scale=1080:608[v0]');
    filters.push('[1:v]scale=1080:1920[bg]');
    filters.push('[bg][v0]overlay=0:(H-h)/2[vout]');
    if (aVideo) {
      // A 面视频全屏显示在最前面
      filters.push('[2:v]scale=1080:1920[a]');
      filters.push('[vout][a]concat=n=2:v=1[vfinal]');
    }
  } else {
    // 无背景图, 直接缩放填充
    filters.push('[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[vout]');
    if (aVideo) {
      filters.push('[1:v]scale=1080:1920[a]');
      filters.push('[vout][a]concat=n=2:v=1[vfinal]');
    }
  }

  return {
    inputs,
    filters: filters.join(';'),
    output,
    videoMap: aVideo || bgImage ? '[vfinal]' : '[vout]'
  };
}

/**
 * 智能改尺寸
 * Siya 模式: 1920x1080 + 1920x1920
 * 海外捕鱼: 1080x1920 + 1920x1920
 * 统一横版: 1920x1080
 * 统一竖版: 1080x1920
 */
function buildResizeCommand({ input, mode, blurAmount = 20, output }) {
  const targets = {
    siya: [
      { width: 1920, height: 1080, suffix: '_1920x1080' },
      { width: 1920, height: 1920, suffix: '_1920x1920' }
    ],
    fishing: [
      { width: 1080, height: 1920, suffix: '_1080x1920' },
      { width: 1920, height: 1920, suffix: '_1920x1920' }
    ],
    unify_h: [{ width: 1920, height: 1080, suffix: '_1920x1080' }],
    unify_v: [{ width: 1080, height: 1920, suffix: '_1080x1920' }]
  };

  const targetSizes = targets[mode];
  if (!targetSizes) {
    throw new Error(`Unknown resize mode: ${mode}`);
  }

  // 返回多个输出配置
  return targetSizes.map(target => {
    const { width, height, suffix } = target;
    const outputFile = output.replace(/\.[^/.]+$/, `${suffix}.mp4`);

    // FFmpeg 模糊背景填充滤镜
    const filters = [
      // 缩小到 10% 用于模糊背景
      `[0:v]scale=${width * 0.1}:${height * 0.1}[small]`,
      // 模糊处理
      `[small]boxblur=${blurAmount}[blurred]`,
      // 放大回原尺寸
      `[blurred]scale=${width}:${height}[bg]`,
      // 原视频等比缩放并居中
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg]`,
      // 背景上叠加前景, 添加半透明黑色遮罩
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[vout]`
    ];

    return {
      input,
      filters: filters.join(';'),
      output: outputFile,
      codecOptions: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'copy']
    };
  });
}

/**
 * 构建完整的 FFmpeg 命令行参数
 */
function buildFFmpegArgs(config) {
  const { inputs, filters, output, videoMap = '[vout]', codecOptions = [] } = config;

  const args = [];

  // 添加输入
  if (Array.isArray(inputs)) {
    args.push(...inputs);
  }

  // 添加滤镜复杂度
  if (filters) {
    args.push('-filter_complex', filters);
  }

  // 映射视频流
  args.push('-map', videoMap);

  // 映射音频流 (如果有)
  args.push('-map', '0:a?');

  // 添加编码选项
  if (Array.isArray(codecOptions) && codecOptions.length > 0) {
    args.push(...codecOptions);
  } else {
    // 默认编码选项
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
  }

  // 输出文件
  args.push(output);

  return args;
}

module.exports = {
  buildHorizontalCommand,
  buildVerticalCommand,
  buildResizeCommand,
  buildFFmpegArgs
};
