/**
 * 视频合成模块
 * 支持背景图、封面图、A/B 视频的合成
 */

import { FFMPEG_CONSTANTS, type VideoMergeConfig, type Position, type StitchQuality } from './types';

/**
 * 画质预设配置
 */
const QUALITY_PRESETS: Record<StitchQuality, { crf: number; preset: string; audioBitrate: string }> = {
  low: { crf: 28, preset: 'ultrafast', audioBitrate: '64k' },
  medium: { crf: 23, preset: 'superfast', audioBitrate: '128k' },
  high: { crf: 18, preset: 'slow', audioBitrate: '192k' },
};

/**
 * 构建视频合成的 FFmpeg 命令行参数
 *
 * @param config 合成配置
 * @returns FFmpeg 命令参数数组
 *
 * 配置说明：
 * - preview: 预览模式配置，指定后使用预览参数（低分辨率、低 CRF）
 * - trim: 裁剪配置，支持指定起始位置和持续时间
 * - coverDuration: 封面图持续时间（秒）
 */
export function buildMergeCommand(config: VideoMergeConfig): string[] {
  const {
    aPath,
    bPath,
    outPath,
    bgImage,
    coverImage,
    aPosition,
    bPosition,
    bgPosition,
    coverPosition,
    orientation = 'horizontal',
    preview,
    trim,
    coverDuration = 1,
    quality = 'medium',
    threads,
  } = config;

  // 确定画布尺寸
  const isPreview = !!preview;
  const W = isPreview && preview.width
    ? preview.width
    : (orientation === 'horizontal' ? FFMPEG_CONSTANTS.LANDSCAPE_WIDTH : FFMPEG_CONSTANTS.PORTRAIT_WIDTH);
  const H = isPreview && preview.height
    ? preview.height
    : (orientation === 'horizontal' ? FFMPEG_CONSTANTS.LANDSCAPE_HEIGHT : FFMPEG_CONSTANTS.PORTRAIT_HEIGHT);

  // 编码参数
  const qualitySettings = isPreview
    ? { crf: preview?.crf || 35, preset: 'ultrafast', audioBitrate: '64k' }
    : QUALITY_PRESETS[quality];
  const crf = qualitySettings.crf;
  const preset = qualitySettings.preset;
  const audioBitrate = qualitySettings.audioBitrate;

  // 计算位置缩放比例（预览模式需要缩放位置坐标）
  const baseW = orientation === 'horizontal' ? FFMPEG_CONSTANTS.LANDSCAPE_WIDTH : FFMPEG_CONSTANTS.PORTRAIT_WIDTH;
  const baseH = orientation === 'horizontal' ? FFMPEG_CONSTANTS.LANDSCAPE_HEIGHT : FFMPEG_CONSTANTS.PORTRAIT_HEIGHT;
  const scaleX = isPreview ? W / baseW : 1;
  const scaleY = isPreview ? H / baseH : 1;

  const scalePosition = (pos: Position | undefined): Position | null => {
    if (!pos) return null;
    return {
      x: Math.round(pos.x * scaleX),
      y: Math.round(pos.y * scaleY),
      width: Math.round(pos.width * scaleX),
      height: Math.round(pos.height * scaleY),
    };
  };

  // 默认位置计算
  const defaultBPosition = orientation === 'horizontal'
    ? { x: (baseW - baseH * 9 / 16) / 2, y: 0, width: baseH * 9 / 16, height: baseH }
    : { x: 0, y: (baseH - baseW * 16 / 9) / 2, width: baseW, height: baseW * 16 / 9 };
  const defaultBgPosition = { x: 0, y: 0, width: baseW, height: baseH };

  const aPos = scalePosition(aPosition || defaultBgPosition)!;
  const bPos = scalePosition(bPosition || defaultBPosition)!;
  const bgPos = scalePosition(bgPosition || defaultBgPosition)!;
  const cvPos = scalePosition(coverPosition || defaultBgPosition)!;

  // 构建输入文件列表
  const inputs: string[] = [];
  let nextIndex = 0;

  // A 面视频（支持裁剪）
  const aIndex = aPath ? nextIndex++ : -1;
  if (aPath) {
    if (trim?.aStart !== undefined) inputs.push("-ss", String(trim.aStart));
    if (trim?.aDuration !== undefined) inputs.push("-t", String(trim.aDuration));
    inputs.push("-i", aPath);
  }

  // A 面视频第二段（支持裁剪，用于前后5秒效果）
  const a2Index = aPath && (trim?.a2Start !== undefined || trim?.a2Duration !== undefined) ? nextIndex++ : -1;
  if (a2Index >= 0 && aPath) {
    if (trim?.a2Start !== undefined) inputs.push("-ss", String(trim.a2Start));
    if (trim?.a2Duration !== undefined) inputs.push("-t", String(trim.a2Duration));
    inputs.push("-i", aPath); // 复用同一视频文件
  }

  // B 面视频（支持裁剪）
  const bIndex = nextIndex++;
  if (trim?.bStart !== undefined) inputs.push("-ss", String(trim.bStart));
  if (trim?.bDuration !== undefined) inputs.push("-t", String(trim.bDuration));
  inputs.push("-i", bPath);

  // 背景图
  const bgIndex = bgImage ? nextIndex++ : -1;
  if (bgImage) inputs.push("-i", bgImage);

  // 封面图
  const coverIndex = coverImage ? nextIndex++ : -1;
  if (coverImage) inputs.push("-i", coverImage);

  // 构建 filter_complex 滤镜链
  const filters: string[] = [];

  // 音频处理
  const audioFormat = 'aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS';
  if (aIndex >= 0) {
    filters.push(`[${aIndex}:a]${audioFormat}[a0];`);
  }
  if (a2Index >= 0) {
    filters.push(`[${a2Index}:a]${audioFormat}[a0_2];`);
  }
  filters.push(`[${bIndex}:a]${audioFormat}[a1];`);

  // 生成画布背景
  if (bgIndex >= 0) {
    const centerX = '(iw-' + bgPos.width + ')/2';
    const centerY = '(ih-' + bgPos.height + ')/2';
    filters.push(`[${bgIndex}:v]loop=-1:size=1:start=0,scale=${bgPos.width}:${bgPos.height}:force_original_aspect_ratio=increase,crop=${bgPos.width}:${bgPos.height}:${centerX}:${centerY},setsar=1:1,fps=30,format=yuv420p[bg_processed];`);
    filters.push(`color=black:s=${W}x${H}:r=30,format=yuv420p[canvas_bg];`);
    filters.push(`[canvas_bg][bg_processed]overlay=${bgPos.x}:${bgPos.y}[canvas_with_bg];`);
  } else {
    filters.push(`color=black:s=${W}x${H}:r=30,format=yuv420p[canvas_with_bg];`);
  }

  // A视频段处理
  if (aIndex >= 0) {
    // 当有 A2 时需要 3 路分割，否则只需要 2 路
    if (a2Index >= 0) {
      filters.push('[canvas_with_bg]split=3[bg_for_a1][bg_for_a2][bg_for_b];');
      filters.push(`[${aIndex}:v]scale=${aPos.width}:${aPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a_scaled];`);
      filters.push(`[bg_for_a1][a_scaled]overlay=${aPos.x}:${aPos.y}:shortest=1[v_a_temp];`);
      filters.push('[v_a_temp]settb=1/30,setpts=N/30/TB[v_a];');
    } else {
      filters.push('[canvas_with_bg]split=2[bg_for_a][bg_for_b];');
      filters.push(`[${aIndex}:v]scale=${aPos.width}:${aPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a_scaled];`);
      filters.push(`[bg_for_a][a_scaled]overlay=${aPos.x}:${aPos.y}:shortest=1[v_a_temp];`);
      filters.push('[v_a_temp]settb=1/30,setpts=N/30/TB[v_a];');
    }
  } else {
    filters.push('[canvas_with_bg]null[bg_for_b];');
  }

  // A2视频段处理（第二段A视频，用于前后5秒效果）
  if (a2Index >= 0) {
    filters.push(`[${a2Index}:v]scale=${aPos.width}:${aPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a2_scaled];`);
    filters.push(`[bg_for_a2][a2_scaled]overlay=${aPos.x}:${aPos.y}:shortest=1[v_a2_temp];`);
    filters.push('[v_a2_temp]settb=1/30,setpts=N/30/TB[v_a2];');
  }

  // B视频段处理
  filters.push(`[${bIndex}:v]scale=${bPos.width}:${bPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[b_scaled];`);
  filters.push(`[bg_for_b][b_scaled]overlay=${bPos.x}:${bPos.y}:shortest=1[v_b_temp];`);
  filters.push('[v_b_temp]settb=1/30,setpts=N/30/TB[v_b];');

  // 封面图处理
  if (coverIndex >= 0) {
    const cvCenterX = '(iw-' + cvPos.width + ')/2';
    const cvCenterY = '(ih-' + cvPos.height + ')/2';
    filters.push(`[${coverIndex}:v]scale=${cvPos.width}:${cvPos.height}:force_original_aspect_ratio=increase,crop=${cvPos.width}:${cvPos.height}:${cvCenterX}:${cvCenterY},setsar=1:1,fps=30,format=yuv420p[cv_scaled];`);
    filters.push(`color=black:s=${W}x${H}:r=30,format=yuv420p[cv_bg];`);
    filters.push(`[cv_bg][cv_scaled]overlay=${cvPos.x}:${cvPos.y}:shortest=1[cover_final_v_temp];`);
    filters.push('[cover_final_v_temp]settb=1/30,setpts=N/30/TB[cover_final_v];');

    // 封面持续帧数
    const coverFrames = isPreview
      ? Math.max(1, Math.round(coverDuration * 30) - 1)
      : Math.round(coverDuration * 30);
    filters.push(`[cover_final_v]loop=${coverFrames}:size=1:start=0[cover_v];`);
    filters.push('anullsrc=r=48000:cl=stereo,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[cover_silent];');
    filters.push(`[cover_silent]atrim=0:${coverDuration},asetpts=PTS-STARTPTS[cover_a];`);
  }

  // 最终拼接
  const concatSegments: Array<{ v: string; a: string }> = [];
  if (coverIndex >= 0) {
    concatSegments.push({ v: '[cover_v]', a: '[cover_a]' });
  }
  if (aIndex >= 0) {
    concatSegments.push({ v: '[v_a]', a: '[a0]' });
  }
  if (a2Index >= 0) {
    concatSegments.push({ v: '[v_a2]', a: '[a0_2]' });
  }
  concatSegments.push({ v: '[v_b]', a: '[a1]' });

  const useConcat = concatSegments.length > 1;
  if (useConcat) {
    const concatInputs = concatSegments.map(s => s.v + s.a).join('');
    filters.push(`${concatInputs}concat=n=${concatSegments.length}:v=1:a=1[final_v][final_a];`);
  }

  const filterComplex = filters.join('');

  const args = [
    "-y",
    ...(threads ? ["-threads", String(threads)] : []),
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", useConcat ? "[final_v]" : "[v_b]",
    "-map", useConcat ? "[final_a]" : "[a1]",
    "-r", "30",
    "-vsync", "cfr",
    "-c:v", "libx264",
    "-preset", preset,
    "-crf", String(crf),
    "-c:a", "aac",
    "-b:a", audioBitrate,
    "-pix_fmt", "yuv420p",
    outPath
  ];

  return args;
}
