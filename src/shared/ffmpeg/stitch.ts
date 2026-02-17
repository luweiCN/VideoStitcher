/**
 * 视频拼接模块
 * 用于简单的 A+B 视频拼接
 */

import { FFMPEG_CONSTANTS } from './types';
import type { StitchConfig, StitchPreviewConfig, StitchQuality } from './types';

export type { StitchConfig, StitchPreviewConfig, StitchQuality };

/**
 * 画质预设配置
 */
const QUALITY_PRESETS: Record<StitchQuality, { crf: number; preset: string; audioBitrate: string }> = {
  low: { crf: 28, preset: 'ultrafast', audioBitrate: '64k' },
  medium: { crf: 23, preset: 'fast', audioBitrate: '128k' },
  high: { crf: 18, preset: 'slow', audioBitrate: '192k' },
};

/**
 * 构建视频拼接的 FFmpeg 命令
 *
 * @param config 拼接配置
 * @returns FFmpeg 命令参数数组
 */
export function buildStitchCommand(config: StitchConfig): string[] {
  const { aPath, bPath, outPath, orientation, preview, trim, quality = 'medium' } = config;

  // 目标分辨率
  const targetWidth = orientation === 'landscape'
    ? FFMPEG_CONSTANTS.LANDSCAPE_WIDTH
    : FFMPEG_CONSTANTS.PORTRAIT_WIDTH;
  const targetHeight = orientation === 'landscape'
    ? FFMPEG_CONSTANTS.LANDSCAPE_HEIGHT
    : FFMPEG_CONSTANTS.PORTRAIT_HEIGHT;
  const targetFps = FFMPEG_CONSTANTS.TARGET_FPS;
  const audioSampleRate = FFMPEG_CONSTANTS.AUDIO_SAMPLE_RATE;

  // 预览模式处理
  const isPreview = !!preview;

  // 画质设置
  const qualitySettings = isPreview
    ? { crf: preview?.crf || 35, preset: 'ultrafast', audioBitrate: '64k' }
    : QUALITY_PRESETS[quality];

  const args: string[] = [];

  // A 视频输入（支持裁剪）
  if (trim?.aStart !== undefined) {
    args.push('-ss', String(trim.aStart));
  }
  if (trim?.aDuration !== undefined) {
    args.push('-t', String(trim.aDuration));
  }
  args.push('-i', aPath);

  // B 视频输入（支持裁剪）
  if (trim?.bStart !== undefined) {
    args.push('-ss', String(trim.bStart));
  }
  if (trim?.bDuration !== undefined) {
    args.push('-t', String(trim.bDuration));
  }
  args.push('-i', bPath);

  // 构建滤镜
  const filters = [
    `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1:1,fps=${targetFps},settb=1/${targetFps},setpts=N/${targetFps}/TB[v0]`,
    `[1:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1:1,fps=${targetFps},settb=1/${targetFps},setpts=N/${targetFps}/TB[v1]`,
    `[0:a]aresample=${audioSampleRate},aformat=sample_fmts=fltp:sample_rates=${audioSampleRate}:channel_layouts=stereo,asetpts=PTS-STARTPTS[a0]`,
    `[1:a]aresample=${audioSampleRate},aformat=sample_fmts=fltp:sample_rates=${audioSampleRate}:channel_layouts=stereo,asetpts=PTS-STARTPTS[a1]`,
    `[v0][a0][v1][a1]concat=n=2:v=1:a=1[final_v][final_a]`
  ];

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', '[final_v]', '-map', '[final_a]');

  // 编码参数
  args.push(
    '-c:v', 'libx264',
    '-preset', qualitySettings.preset,
    '-crf', String(qualitySettings.crf),
    '-r', `${targetFps}`,
    '-vsync', 'cfr',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', qualitySettings.audioBitrate,
    '-shortest',
    '-y',
    outPath
  );

  return args;
}
