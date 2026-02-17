/**
 * 统一视频合成模块 - FFmpeg 命令构建
 */

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BuildArgsConfig {
  aPath?: string;
  bPath: string;
  outPath: string;
  bgImage?: string;
  coverImage?: string;
  aPosition?: Position;
  bPosition?: Position;
  bgPosition?: Position;
  coverPosition?: Position;
  orientation?: 'horizontal' | 'vertical';
}

interface PreviewConfig {
  width?: number;
  height?: number;
  crf?: number;
}

interface TrimConfig {
  aStart?: number;
  aDuration?: number;
  bStart?: number;
  bDuration?: number;
}

interface BuildPreviewArgsConfig extends BuildArgsConfig {
  preview?: PreviewConfig | null;
  trim?: TrimConfig | null;
  coverDuration?: number;
}

/**
 * 构建视频合成的 FFmpeg 命令行参数（正式合成）
 */
export function buildArgs(config: BuildArgsConfig): string[] {
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
    orientation = 'horizontal'
  } = config;

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
  const cvPos = coverPosition || defaultBgPosition;

  // 构建输入文件列表和索引管理
  const inputs: string[] = [];
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
  const filters: string[] = [];

  // 音频处理
  const audioFormat = 'aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS';
  if (aIndex >= 0) {
    filters.push(`[${aIndex}:a]${audioFormat}[a0];`);
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

  // 复制背景给 A面 和 B面
  if (aIndex >= 0) {
    filters.push('[canvas_with_bg]split=2[bg_for_a][bg_for_b];');
    filters.push(`[${aIndex}:v]scale=${aPos.width}:${aPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a_scaled];`);
    filters.push(`[bg_for_a][a_scaled]overlay=${aPos.x}:${aPos.y}:shortest=1[v_a_temp];`);
    filters.push('[v_a_temp]settb=1/30,setpts=N/30/TB[v_a];');
  } else {
    filters.push('[canvas_with_bg]null[bg_for_b];');
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
    filters.push('[cover_final_v]loop=2:size=1:start=0[cover_v];');
    filters.push('anullsrc=r=48000:cl=stereo,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[cover_silent];');
    filters.push('[cover_silent]atrim=0:0.1,asetpts=PTS-STARTPTS[cover_a];');
  }

  // 最终拼接
  const concatSegments: Array<{ v: string; a: string }> = [];
  if (coverIndex >= 0) {
    concatSegments.push({ v: '[cover_v]', a: '[cover_a]' });
  }
  if (aIndex >= 0) {
    concatSegments.push({ v: '[v_a]', a: '[a0]' });
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
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", useConcat ? "[final_v]" : "[v_b]",
    "-map", useConcat ? "[final_a]" : "[a1]",
    "-r", "30",
    "-vsync", "cfr",
    "-c:v", "libx264",
    "-preset", "superfast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-pix_fmt", "yuv420p",
    outPath
  ];
  return args;
}

/**
 * 构建预览视频的 FFmpeg 命令行参数
 */
export function buildPreviewArgs(config: BuildPreviewArgsConfig): string[] {
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
    preview = null,
    trim = null,
    coverDuration = 0.1,
  } = config;

  // 预览模式：使用指定分辨率
  const W = preview?.width || (orientation === 'horizontal' ? 1920 : 1080);
  const H = preview?.height || (orientation === 'horizontal' ? 1080 : 1920);
  const crf = preview?.crf || 23;

  // 计算位置缩放比例
  const baseW = orientation === 'horizontal' ? 1920 : 1080;
  const baseH = orientation === 'horizontal' ? 1080 : 1920;
  const scaleX = W / baseW;
  const scaleY = H / baseH;

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

  const aPos = scalePosition(aPosition || defaultBPosition)!;
  const bPos = scalePosition(bPosition || defaultBPosition)!;
  const bgPos = scalePosition(bgPosition || defaultBgPosition)!;
  const cvPos = scalePosition(coverPosition || defaultBgPosition)!;

  // 构建输入文件列表
  const inputs: string[] = [];
  let nextIndex = 0;

  // A 面视频（支持截取）
  const aIndex = aPath ? nextIndex++ : -1;
  if (aPath) {
    if (trim?.aStart !== undefined) {
      inputs.push("-ss", String(trim.aStart));
    }
    if (trim?.aDuration !== undefined) {
      inputs.push("-t", String(trim.aDuration));
    }
    inputs.push("-i", aPath);
  }

  // B 面视频（支持截取）
  const bIndex = nextIndex++;
  if (trim?.bStart !== undefined) {
    inputs.push("-ss", String(trim.bStart));
  }
  if (trim?.bDuration !== undefined) {
    inputs.push("-t", String(trim.bDuration));
  }
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
    filters.push('[canvas_with_bg]split=2[bg_for_a][bg_for_b];');
    filters.push(`[${aIndex}:v]scale=${aPos.width}:${aPos.height}:flags=bicubic,setsar=1:1,fps=30,format=yuv420p[a_scaled];`);
    filters.push(`[bg_for_a][a_scaled]overlay=${aPos.x}:${aPos.y}:shortest=1[v_a_temp];`);
    filters.push('[v_a_temp]settb=1/30,setpts=N/30/TB[v_a];');
  } else {
    filters.push('[canvas_with_bg]null[bg_for_b];');
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
    const coverFrames = Math.max(1, Math.round(coverDuration * 30) - 1);
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
  concatSegments.push({ v: '[v_b]', a: '[a1]' });

  const useConcat = concatSegments.length > 1;
  if (useConcat) {
    const concatInputs = concatSegments.map(s => s.v + s.a).join('');
    filters.push(`${concatInputs}concat=n=${concatSegments.length}:v=1:a=1[final_v][final_a];`);
  }

  const filterComplex = filters.join('');

  const preset = preview ? 'ultrafast' : 'superfast';
  const audioBitrate = preview ? '48k' : '128k';

  const args = [
    "-y",
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
