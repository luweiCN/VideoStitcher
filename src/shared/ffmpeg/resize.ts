/**
 * 智能改尺寸 FFmpeg 处理模块
 */

import fs from 'fs';
import path from 'path';
import { runFfmpeg } from './ffmpeg';
import { FFMPEG_CONSTANTS, type ResizeConfig, type BuildResizeArgsConfig, type GeneratePreviewsConfig, type PreviewResult } from './types';

/**
 * 智能改尺寸配置
 */
export const RESIZE_CONFIGS: Record<string, ResizeConfig[]> = {
  siya: [
    { width: 1920, height: 1080, suffix: '_1920x1080' },
    { width: 1920, height: 1920, suffix: '_1920x1920' },
  ],
  fishing: [
    { width: 1080, height: 1920, suffix: '_1080x1920' },
    { width: 1920, height: 1920, suffix: '_1920x1920' },
  ],
  unify_h: [
    { width: 1920, height: 1080, suffix: '_1920x1080' },
  ],
  unify_v: [
    { width: 1080, height: 1920, suffix: '_1080x1920' },
  ],
};

/**
 * 构建智能改尺寸的 FFmpeg 命令参数
 */
export function buildArgs(config: BuildResizeArgsConfig): string[] {
  const { inputPath, outputPath, width, height, blurAmount, threads, isPreview = false } = config;

  let targetWidth = width;
  let targetHeight = height;

  if (isPreview) {
    const maxDimension = FFMPEG_CONSTANTS.PREVIEW_MAX_DIMENSION;
    const aspectRatio = width / height;
    if (width >= height) {
      targetWidth = maxDimension;
      targetHeight = Math.round(maxDimension / aspectRatio);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round(maxDimension * aspectRatio);
    }
  }

  console.log(`[videoResize] 目标尺寸: ${width}x${height}, 实际处理: ${targetWidth}x${targetHeight}, 模糊: ${blurAmount}, 预览: ${isPreview}`);

  let filters = `[0:v]split=2[bg_src][fg_src];`;

  filters += `[bg_src]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}:(iw-${targetWidth})/2:(ih-${targetHeight})/2`;
  if (blurAmount > 0) {
    filters += `,boxblur=${blurAmount}:${blurAmount}`;
  }
  filters += `[bg];`;

  filters += `[fg_src]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease[fg];`;

  filters += `[bg][fg]overlay=(W-w)/2:(H-h)/2[out]`;

  console.log(`[videoResize] filter_complex: ${filters}`);

  const args = [
    '-y',
    '-i', inputPath,
    ...(isPreview ? ['-t', '10'] : []),
    '-filter_complex', filters,
    '-map', '[out]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', FFMPEG_CONSTANTS.PRESET_ULTRAFAST,
    '-tune', 'fastdecode',
    ...(isPreview ? ['-crf', String(FFMPEG_CONSTANTS.PREVIEW_CRF), '-r', String(FFMPEG_CONSTANTS.PREVIEW_FPS)] : ['-crf', String(FFMPEG_CONSTANTS.DEFAULT_CRF)]),
    ...(threads ? ['-threads', String(threads)] : ['-threads', 'auto']),
    '-x264-params', 'threads=0:lookahead_threads=0',
    '-c:a', 'copy',
    outputPath
  ];
  return args;
}

/**
 * 生成预览视频
 */
export async function generatePreviews(config: GeneratePreviewsConfig): Promise<PreviewResult[]> {
  const { inputPath, tempDir, mode, blurAmount, threads, onProgress, onLog } = config;

  const configs = RESIZE_CONFIGS[mode];
  if (!configs) {
    throw new Error(`无效的模式: ${mode}`);
  }

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const previewPaths: PreviewResult[] = [];

  for (let i = 0; i < configs.length; i++) {
    const resizeConfig = configs[i];
    const fileName = `preview_${Date.now()}_${i}${resizeConfig.suffix}.mp4`;
    const outputPath = path.join(tempDir, fileName);

    onLog?.(`生成预览 ${i + 1}/${configs.length}: ${resizeConfig.width}x${resizeConfig.height} (仅前10秒, ~1080p, 30fps)`);

    const args = buildArgs({
      inputPath,
      outputPath,
      width: resizeConfig.width,
      height: resizeConfig.height,
      blurAmount,
      threads,
      isPreview: true,
    });

    await runFfmpeg(args, onLog);
    previewPaths.push({
      path: outputPath,
      width: resizeConfig.width,
      height: resizeConfig.height,
      label: `${resizeConfig.width}x${resizeConfig.height}`,
    });

    onProgress?.((i + 1) / configs.length * 100);
  }

  return previewPaths;
}

/**
 * 清理临时预览文件
 */
export function cleanupPreviews(filePaths: string[]): void {
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
