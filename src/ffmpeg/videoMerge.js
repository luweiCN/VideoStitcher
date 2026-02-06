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
  bPosition,
  bgPosition,
  orientation = 'horizontal'
}) {
  // 根据方向设置画布尺寸
  const W = orientation === 'horizontal' ? 1920 : 1080;
  const H = orientation === 'horizontal' ? 1080 : 1920;
  const canvasAspect = W / H;

  // 默认B面位置（居中，默认大小）
  const defaultBPosition = orientation === 'horizontal'
    ? { x: (W - H * 9 / 16) / 2, y: 0, width: H * 9 / 16, height: H }
    : { x: 0, y: (H - W * 16 / 9) / 2, width: W, height: W * 16 / 9 };
  const defaultBgPosition = { x: 0, y: 0, width: W, height: H };

  const bPos = bPosition || defaultBPosition;
  const bgPos = bgPosition || defaultBgPosition;

  // 构建输入文件列表
  let inputs = ["-i", aPath, "-i", bPath];

  if (bgImage) {
    inputs.push("-i", bgImage);
  }

  if (coverImage) {
    inputs.push("-i", coverImage);
  }

  // 输入索引
  const bgIndex = bgImage ? 2 : -1;
  const coverIndex = coverImage ? (bgImage ? 3 : 2) : -1;

  // 构建 filter_complex 滤镜链
  let filters = [];

  // 计算居中位置（用具体数值，避免 FFmpeg 表达式解析问题）
  // 横屏：背景1920x1080，视频按高度缩放后约为607宽，居中 x≈656
  // 竖屏：背景1080x1920，视频按宽度缩放后约为607高，居中 y≈236
  const HA_CENTER_X = 656;   // 横屏 A面居中 x
  const HA_CENTER_Y = 0;     // 横屏 A面居中 y（按高度缩放）
  const VA_CENTER_X = 0;     // 竖屏 A面居中 x（按宽度缩放）
  const VA_CENTER_Y = 236;   // 竖屏 A面居中 y

  // ==================== 音频处理 ====================
  filters.push('[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0];');
  filters.push('[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];');

  // ==================== 视频段处理 ====================
  // 核心逻辑：素材自动适配画布，保持比例，留白处用背景图填充

  if (bgImage) {
    // 背景图只需要复制给 A面 和 B面 使用（封面图独立处理，不需要背景图副本）
    // 1. 背景图：等比缩放撑满画布（object-fit: cover），裁剪超出部分
    // 使用 FFmpeg 的 scale 和 crop 配合实现
    // scale 的 force_original_aspect_ratio=increase 确保缩放后覆盖目标尺寸
    // 然后 crop 精确裁剪到目标尺寸，用 (iw-W)/2 计算居中位置
    const centerX = '(iw-' + W + ')/2';
    const centerY = '(ih-' + H + ')/2';
    filters.push(`[${bgIndex}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:${centerX}:${centerY},setsar=1:1,fps=30,format=yuv420p[bg_scaled];`);
    filters.push('[bg_scaled]split=2[bg_for_a][bg_for_b];');

    // 2. A视频段：只缩放不padding，居中叠加到背景图上
    if (orientation === 'horizontal') {
      filters.push(`[0:v]scale=-1:${H}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a_scaled];`);
    } else {
      filters.push(`[0:v]scale=${W}:-1:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a_scaled];`);
    }
    // 居中叠加：画布中心 - 视频尺寸的一半。用表达式自动计算居中位置
    const overlayX = orientation === 'horizontal' ? '(W-w)/2' : '0';
    const overlayY = orientation === 'horizontal' ? '0' : '(H-h)/2';
    filters.push(`[bg_for_a][a_scaled]overlay=${overlayX}:${overlayY}[v_a];`);

    // 3. B视频段：按用户指定的精确位置和大小
    filters.push(`[1:v]scale=${bPos.width}:${bPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[b_scaled];`);
    filters.push(`[bg_for_b][b_scaled]overlay=${bPos.x}:${bPos.y}[v_b];`);

  } else {
    // 无背景图：A和B视频各自填充画布（黑色背景）

    // 1. A视频段：自动适配画布，保持比例，留黑边
    filters.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1,fps=30,format=yuv420p[v_a];`);

    // 2. B视频段：按用户指定的精确位置和大小
    filters.push(`[1:v]scale=${bPos.width}:${bPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[b_scaled];`);
    filters.push(`color=black:s=${W}x${H},format=yuv420p[black_bg_b];`);
    filters.push(`[black_bg_b][b_scaled]overlay=${bPos.x}:${bPos.y}[v_b];`);
  }

  // ==================== 封面图处理和最终拼接 ====================
  if (coverIndex >= 0) {
    // 封面图独立处理，不使用背景图，直接 pad 到画布尺寸
    if (orientation === 'horizontal') {
      filters.push(`[${coverIndex}:v]scale=-1:${H}:flags=bicubic,setsar=1:1,fps=30[cover_temp];`);
    } else {
      filters.push(`[${coverIndex}:v]scale=${W}:-1:flags=bicubic,setsar=1:1,fps=30[cover_temp];`);
    }
    filters.push(`[cover_temp]pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1,fps=30[cover_scaled];`);
    filters.push('[cover_scaled]loop=15:size=1:start=0[cover_v];');

    // 生成封面静音音频（0.5秒）
    filters.push('anullsrc=r=48000:cl=stereo[cover_silent];');
    filters.push('[cover_silent]atrim=0:0.5,asetpts=PTS-STARTPTS[cover_a];');

    // 拼接三个视频段：封面 + A视频 + B视频
    filters.push('[cover_v][v_a][v_b]concat=n=3:v=1:a=0[final_v];');
    // 拼接三个音频段：静音 + A音频 + B音频
    filters.push('[cover_a][a0][a1]concat=n=3:v=0:a=1[final_a];');

  } else {
    // 无封面图：A视频 + B视频
    filters.push('[v_a][v_b]concat=n=2:v=1:a=0[final_v];');
    filters.push('[a0][a1]concat=n=2:v=0:a=1[final_a];');
  }

  const filterComplex = filters.join('');
  console.log(`[DEBUG videoMerge ${orientation}] 有背景图:`, !!bgImage, '有封面图:', coverIndex >= 0);
  console.log(`[DEBUG videoMerge ${orientation}] filter_complex:`, filterComplex);

  const args = [
    "-y",
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", "[final_v]",
    "-map", "[final_a]",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "28",
    "-c:a", "aac",
    "-b:a", "128k",
    outPath
  ];
  return args;
}

module.exports = { buildArgs };
