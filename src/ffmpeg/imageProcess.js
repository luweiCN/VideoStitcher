/**
 * 图片素材处理 - FFmpeg 命令构建模块
 *
 * 功能：
 * 1. 预览图生成：将原图缩放到目标尺寸
 * 2. 带 Logo：在原图上叠加 Logo
 */

/**
 * 构建图片素材处理的 FFmpeg 命令行参数
 *
 * @param {Object} config - 配置对象
 * @param {string} config.imagePath - 输入图片路径
 * @param {string} config.logoPath - Logo 图片路径（可选）
 * @param {string} config.outPath - 输出路径
 * @param {string} config.mode - 处理模式：'preview' | 'logo'
 * @returns {string[]} FFmpeg 命令行参数数组
 */
function buildArgs({ imagePath, logoPath, outPath, mode }) {
  let inputs = ["-loop", "1", "-i", imagePath];

  // 添加 Logo 输入
  if (logoPath && mode === 'logo') {
    inputs.push("-i", logoPath);
  }

  let filters = [];

  if (mode === 'preview') {
    // 预览图：缩放到目标尺寸（保持宽高比）
    filters.push('[0:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2[v]');

    const args = [
      "-y",
      ...inputs,
      "-filter_complex", filters.join('\n'),
      "-map", "[v]",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-t", "2",  // 输出 2 秒
      "-pix_fmt", "yuv420p",
      "-f", "image2",  // 输出为图片
      "-frames:v", "1",
      outPath
    ];
    return args;

  } else if (mode === 'logo') {
    // 带 Logo：叠加 Logo 到原图
    const logoIndex = 1;
    filters.push('[0:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2[bg];');
    // Logo 缩放到合适大小并叠加到右下角
    filters.push(`[${logoIndex}:v]scale=200:-1[logo];`);
    filters.push('[bg][logo]overlay=W-w-20:H-h-20[v]');

    const args = [
      "-y",
      ...inputs,
      "-filter_complex", filters.join('\n'),
      "-map", "[v]",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-t", "2",
      "-pix_fmt", "yuv420p",
      "-f", "image2",
      "-frames:v", "1",
      outPath
    ];
    return args;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

module.exports = { buildArgs };
