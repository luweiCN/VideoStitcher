/**
 * 竖屏极速合成 - FFmpeg 命令构建模块
 *
 * 功能：
 * 1. A面视频 + B面视频拼接（A在前，B在后）
 * 2. 背景图填充（缩放后的视频居中放在背景图上）
 * 3. 封面图作为第一帧（静音）
 *
 * 输出尺寸：1080x1920 @ 30fps
 */

/**
 * 构建竖屏极速合成的 FFmpeg 命令行参数
 *
 * @param {Object} config - 配置对象
 * @param {string} config.aPath - A面视频路径
 * @param {string} config.bPath - B面视频路径
 * @param {string} config.outPath - 输出路径
 * @param {string} [config.bgImage] - 背景图路径（可选）
 * @param {string} [config.coverImage] - 封面图路径（可选）
 * @returns {string[]} FFmpeg 命令行参数数组
 */
function buildArgs({ aPath, bPath, outPath, bgImage, coverImage }) {
  const W = 1080;
  const H = 1920;

  // 构建输入文件列表
  let inputs = ["-i", aPath, "-i", bPath];

  // 添加背景图输入
  if (bgImage) {
    inputs.push("-i", bgImage);
  }

  // 添加封面图输入
  if (coverImage) {
    inputs.push("-i", coverImage);
  }

  // 构建 filter_complex 滤镜链
  let filters = [];

  // 输入索引：
  // [0:v] A面视频, [0:a] A面音频
  // [1:v] B面视频, [1:a] B面音频
  // [2:v] 背景图（如果提供）
  // [3:v] 封面图（如果提供）

  // 计算背景图和封面图的输入索引
  const bgIndex = bgImage ? 2 : -1;
  const coverIndex = coverImage ? (bgImage ? 3 : 2) : -1;

  // 音频处理（重采样到 48kHz）
  filters.push('[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0];');
  filters.push('[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];');

  if (bgImage) {
    // 有背景图：先 overlay 再 concat
    // 1. 缩放背景图并 split 成多份（因为 overlay 会消耗输入流）
    filters.push(`[${bgIndex}:v]scale=${W}:${H}[bg];`);

    if (coverIndex >= 0) {
      // 有封面图：需要 3 份背景（封面、A面、B面）
      filters.push('[bg]split=3[bg1][bg2][bg3];');
    } else {
      // 无封面图：需要 2 份背景（A面、B面）
      filters.push('[bg]split=2[bg1][bg2];');
    }

    // 2. A面视频缩放并 overlay 到背景
    filters.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1:1,fps=30,format=yuv420p[v0_raw];`);
    filters.push('[bg1][v0_raw]overlay=(W-w)/2:(H-h)/2[v0];');

    // 3. B面视频缩放并 overlay 到背景
    filters.push(`[1:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1:1,fps=30,format=yuv420p[v1_raw];`);
    filters.push('[bg2][v1_raw]overlay=(W-w)/2:(H-h)/2[v1];');

    // 4. 处理封面图
    if (coverIndex >= 0) {
      // 封面图也 overlay 到背景上，延展到 0.5 秒
      filters.push(`[${coverIndex}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1:1,fps=30,format=yuv420p[cover_raw];`);
      filters.push('[bg3][cover_raw]overlay=(W-w)/2:(H-h)/2[cover_with_bg];');
      // 使用 loop 延展封面图：loop 15 次（0.5秒 = 15帧）
      filters.push('[cover_with_bg]loop=loop=15:size=1:start=0[cover_v];');
      // 生成静音音频
      filters.push('anullsrc=r=48000:cl=stereo[cover_silent];');
      filters.push('[cover_silent]atrim=0:0.5[cover_a];');
      // 拼接
      filters.push('[cover_v][v0][v1]concat=n=3:v=1:a=0[main_v];');
      filters.push('[cover_a][a0][a1]concat=n=3:v=0:a=1[main_a];');
    } else {
      // 无封面图
      filters.push('[v0][v1]concat=n=2:v=1:a=0[main_v];');
      filters.push('[a0][a1]concat=n=2:v=0:a=1[main_a];');
    }

  } else {
    // 无背景图：加黑边填充
    filters.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1,fps=30,format=yuv420p[v0];`);
    filters.push(`[1:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1,fps=30,format=yuv420p[v1];`);

    if (coverIndex >= 0) {
      // 封面图也加黑边，延展到 0.5 秒
      filters.push(`[${coverIndex}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1,fps=30,format=yuv420p[cover_scaled];`);
      // 使用 loop 延展封面图：loop 15 次（0.5秒 = 15帧）
      filters.push('[cover_scaled]loop=loop=15:size=1:start=0[cover_v];');
      filters.push('anullsrc=r=48000:cl=stereo[cover_silent];');
      filters.push('[cover_silent]atrim=0:0.5[cover_a];');
      filters.push('[cover_v][v0][v1]concat=n=3:v=1:a=0[main_v];');
      filters.push('[cover_a][a0][a1]concat=n=3:v=0:a=1[main_a];');
    } else {
      filters.push('[v0][v1]concat=n=2:v=1:a=0[main_v];');
      filters.push('[a0][a1]concat=n=2:v=0:a=1[main_a];');
    }
  }

  // 最终输出
  filters.push('[main_v]copy[finalv];');

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filters.join('\n'),
    "-map", "[finalv]",
    "-map", "[main_a]",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "192k",
    outPath
  ];
  return args;
}

module.exports = { buildArgs };
