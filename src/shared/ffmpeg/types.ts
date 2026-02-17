/**
 * FFmpeg 模块类型定义
 */

// ============================================
// 常量定义
// ============================================

export const FFMPEG_CONSTANTS = {
  // 视频参数
  TARGET_FPS: 30,
  AUDIO_SAMPLE_RATE: 48000,
  AUDIO_BITRATE: '128k',
  PREVIEW_AUDIO_BITRATE: '48k',
  DEFAULT_CRF: 23,
  PREVIEW_CRF: 28,
  PREVIEW_FPS: 30,

  // 编码预设
  PRESET_FAST: 'fast',
  PRESET_ULTRAFAST: 'ultrafast',
  PRESET_SUPERFAST: 'superfast',

  // 分辨率
  LANDSCAPE_WIDTH: 1920,
  LANDSCAPE_HEIGHT: 1080,
  PORTRAIT_WIDTH: 1080,
  PORTRAIT_HEIGHT: 1920,
  SQUARE_SIZE: 1920,

  // 预览分辨率
  PREVIEW_MAX_DIMENSION: 1080,
} as const;

// ============================================
// 类型定义
// ============================================

/**
 * 视频拼接配置
 */
export interface StitchConfig {
  aPath: string;
  bPath: string;
  outPath: string;
  orientation: 'landscape' | 'portrait';
  /** 预览配置 */
  preview?: StitchPreviewConfig;
  /** 裁剪配置 */
  trim?: StitchTrimConfig;
  /** 画质选项 */
  quality?: StitchQuality;
}

/**
 * 视频拼接预览配置
 */
export interface StitchPreviewConfig {
  /** 预览时长（秒） */
  duration?: number;
  /** CRF 值，越大越模糊文件越小 */
  crf?: number;
}

/**
 * 视频拼接画质选项
 */
export type StitchQuality = 'low' | 'medium' | 'high';

/**
 * 视频拼接裁剪配置
 */
export interface StitchTrimConfig {
  /** A 视频起始时间（秒） */
  aStart?: number;
  /** A 视频持续时间（秒） */
  aDuration?: number;
  /** B 视频起始时间（秒） */
  bStart?: number;
  /** B 视频持续时间（秒） */
  bDuration?: number;
}

/**
 * 视频位置信息
 */
export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 视频合成配置
 */
export interface VideoMergeConfig {
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
  /** 预览模式配置 */
  preview?: PreviewConfig | null;
  /** 裁剪配置 */
  trim?: TrimConfig | null;
  /** 封面图持续时间（秒） */
  coverDuration?: number;
  /** 画质选项 */
  quality?: 'low' | 'medium' | 'high';
}

/**
 * 预览配置
 */
export interface PreviewConfig {
  width?: number;
  height?: number;
  crf?: number;
}

/**
 * 裁剪配置
 * aStart/aDuration: A视频第一段裁剪
 * a2Start/a2Duration: A视频第二段裁剪（用于前后5秒效果）
 */
export interface TrimConfig {
  aStart?: number;
  aDuration?: number;
  a2Start?: number;
  a2Duration?: number;
  bStart?: number;
  bDuration?: number;
}

/**
 * 视频合成预览配置
 */
export interface VideoMergePreviewConfig extends VideoMergeConfig {
  preview?: PreviewConfig | null;
  trim?: TrimConfig | null;
  coverDuration?: number;
}

/**
 * 智能改尺寸配置
 */
export interface ResizeConfig {
  width: number;
  height: number;
  suffix: string;
}

/**
 * 构建智能改尺寸参数配置
 */
export interface BuildResizeArgsConfig {
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  blurAmount: number;
  threads?: number;
  isPreview?: boolean;
}

/**
 * 生成预览配置
 */
export interface GeneratePreviewsConfig {
  inputPath: string;
  tempDir: string;
  mode: string;
  blurAmount: number;
  threads?: number;
  onProgress?: (progress: number) => void;
  onLog?: (log: string) => void;
}

/**
 * 预览结果
 */
export interface PreviewResult {
  path: string;
  width: number;
  height: number;
  label: string;
}

/**
 * FFmpeg 执行结果
 */
export interface FfmpegResult {
  success: boolean;
}

/**
 * FFmpeg 日志回调
 */
export type FfmpegLogCallback = (log: string) => void;
