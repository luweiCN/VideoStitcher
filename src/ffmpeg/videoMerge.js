/**
 * 统一视频合成模块 - FFmpeg 命令构建
 *
 * 功能：
 * 1. A面视频 + B面视频顺序拼接（A在前，B在后）
 * 2. 背景图填充：素材保持比例自动适配画布，留白处用背景图填充
 * 3. 封面图作为第一帧（静音，0.5秒），同样自动适配画布
 *
 * 支持横屏（1920x1080）和竖屏（1080x1920）
 */

/**
 * 构建视频合成的 FFmpeg 命令行参数
 *
 * @param {Object} config - 配置对象
 * @param {string} config.aPath - A面视频路径
 * @param {string} config.bPath - B面视频路径
 * @param {string} config.outPath - 输出路径
 * @param {string} [config.bgImage] - 背景图路径（可选）
 * @param {string} [config.coverImage] - 封面图路径（可选）
 * @param {Object} [config.bPosition] - B面视频位置 {x, y, width, height}
 * @param {Object} [config.bgPosition] - 背景图位置 {x, y, width, height}
 * @param {'horizontal'|'vertical'} config.orientation - 画布方向
 * @returns {string[]} FFmpeg 命令行参数数组
 */
function buildArgs({
  aPath,
  bPath,
  outPath,
  bgImage,
  coverImage,
  aPosition,
  bPosition,
  bgPosition,
  coverPosition,
  orientation = 'horizontal'
}) {
  // 根据方向设置画布尺寸
  const W = orientation === 'horizontal' ? 1920 : 1080;
  const H = orientation === 'horizontal' ? 1080 : 1920;

  // 默认位置计算
  const defaultBPosition = orientation === 'horizontal'
    ? { x: (W - H * 9 / 16) / 2, y: 0, width: H * 9 / 16, height: H }
    : { x: 0, y: (H - W * 16 / 9) / 2, width: W, height: W * 16 / 9 };
  const defaultBgPosition = { x: 0, y: 0, width: W, height: H };

  const aPos = aPosition || defaultBgPosition;
  const bPos = bPosition || defaultBPosition;
  const bgPos = bgPosition || defaultBgPosition;
  const cvPos = coverPosition || defaultBgPosition; // 修正：默认封面也应该是全屏

  // 构建输入文件列表和索引管理
  let inputs = [];
  let nextIndex = 0;

  const aIndex = aPath ? nextIndex++ : -1;
  if (aPath) inputs.push("-i", aPath);

  const bIndex = nextIndex++;
  inputs.push("-i", bPath);

  const bgIndex = bgImage ? nextIndex++ : -1;
  if (bgImage) inputs.push("-i", bgImage);

  const coverIndex = coverImage ? nextIndex++ : -1;
  if (coverImage) inputs.push("-i", coverImage);

  // 构建 filter_complex 滤镜链
  let filters = [];

  // ==================== 音频处理 ====================
  if (aIndex >= 0) {
    filters.push(`[${aIndex}:a]aresample=48000,asetpts=PTS-STARTPTS[a0];`);
  }
  filters.push(`[${bIndex}:a]aresample=48000,asetpts=PTS-STARTPTS[a1];`);

  // ==================== 视频段处理 ====================

  // 生成画布背景
  if (bgIndex >= 0) {
    // 1. 背景图：铺满 bgPos 指定的区域，如果 bgPos 不是全屏，则底层还有黑色
    const centerX = '(iw-' + bgPos.width + ')/2';
    const centerY = '(ih-' + bgPos.height + ')/2';
    // 修正：增加 loop=-1 让背景图无限循环，配合后面的 shortest=1 使用
    filters.push(`[${bgIndex}:v]loop=-1:size=1:start=0,scale=${bgPos.width}:${bgPos.height}:force_original_aspect_ratio=increase,crop=${bgPos.width}:${bgPos.height}:${centerX}:${centerY},setsar=1:1,fps=30,format=yuv420p[bg_processed];`);

    filters.push(`color=black:s=${W}x${H}:r=30,format=yuv420p[canvas_bg];`);
    filters.push(`[canvas_bg][bg_processed]overlay=${bgPos.x}:${bgPos.y}[canvas_with_bg];`);
  } else {
    filters.push(`color=black:s=${W}x${H}:r=30,format=yuv420p[canvas_with_bg];`);
  }

  // 复制背景给 A面 和 B面
  if (aIndex >= 0) {
    filters.push('[canvas_with_bg]split=2[bg_for_a][bg_for_b];');

    // A视频段处理：根据 aPos 缩放并叠加
    filters.push(`[${aIndex}:v]scale=${aPos.width}:${aPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a_scaled];`);
    // 修正：增加 shortest=1 确保 A 面视频结束时该段即结束
    filters.push(`[bg_for_a][a_scaled]overlay=${aPos.x}:${aPos.y}:shortest=1[v_a];`);
  } else {
    filters.push('[canvas_with_bg]null[bg_for_b];');
  }

  // B视频段处理：根据 bPos 缩放并叠加
  filters.push(`[${bIndex}:v]scale=${bPos.width}:${bPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[b_scaled];`);
  // 修正：增加 shortest=1 确保 B 面视频结束时该段即结束
  filters.push(`[bg_for_b][b_scaled]overlay=${bPos.x}:${bPos.y}:shortest=1[v_b];`);

  // ==================== 封面图处理 ====================
  if (coverIndex >= 0) {
    // 封面图：根据 cvPos 指定的大小和位置，叠加在黑色背景上
    // 修正：使用填充模式缩放，避免拉伸，并确保高质量
    const cvCenterX = '(iw-' + cvPos.width + ')/2';
    const cvCenterY = '(ih-' + cvPos.height + ')/2';
    filters.push(`[${coverIndex}:v]scale=${cvPos.width}:${cvPos.height}:force_original_aspect_ratio=increase,crop=${cvPos.width}:${cvPos.height}:${cvCenterX}:${cvCenterY},setsar=1:1,fps=30,format=yuv420p[cv_scaled];`);
    
    filters.push(`color=black:s=${W}x${H}:r=30,format=yuv420p[cv_bg];`);
    // 修正：增加 shortest=1 确保封面叠加层不会无限延长
    filters.push(`[cv_bg][cv_scaled]overlay=${cvPos.x}:${cvPos.y}:shortest=1[cover_final_v];`);

    // 修正：0.1秒在30fps下是3帧，所以循环2次（1张原图+2次循环=3帧）
    filters.push('[cover_final_v]loop=2:size=1:start=0[cover_v];');
    filters.push('anullsrc=r=48000:cl=stereo[cover_silent];');
    // 修正：音频同步裁剪为 0.1 秒
    filters.push('[cover_silent]atrim=0:0.1,asetpts=PTS-STARTPTS[cover_a];');
  }

  // ==================== 最终拼接 ====================
  let concatV = [];
  let concatA = [];

  if (coverIndex >= 0) {
    concatV.push('[cover_v]');
    concatA.push('[cover_a]');
  }
  if (aIndex >= 0) {
    concatV.push('[v_a]');
    concatA.push('[a0]');
  }
  concatV.push('[v_b]');
  concatA.push('[a1]');

  const useConcat = concatV.length > 1;
  if (useConcat) {
    filters.push(`${concatV.join('')}concat=n=${concatV.length}:v=1:a=0[final_v];`);
    filters.push(`${concatA.join('')}concat=n=${concatA.length}:v=0:a=1[final_a];`);
  }

  const filterComplex = filters.join('');
  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", useConcat ? "[final_v]" : "[v_b]",
    "-map", useConcat ? "[final_a]" : "[a1]",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "superfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    outPath
  ];
  return args;
}

module.exports = { buildArgs };
