export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoFile {
  id: string;
  file: File;
  name: string;
  originalName?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  url?: string;
  blobUrl?: string;
  blobUrls?: string[];
}

export interface ComposerState {
  bgImage: string | null;
  videos: VideoFile[];
  overlayPos: Position;
  isBatchProcessing: boolean;
}

export interface ProcessProgress {
  current: number;
  total: number;
  message: string;
}

export interface ProcessResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

/**
 * 素材图层 ID 类型
 */
export type LayerId = 'aVideo' | 'bVideo' | 'bgImage' | 'coverImage';

/**
 * 素材位置映射
 * 用于统一管理所有素材在画布上的位置
 */
export interface MaterialPositions {
  aVideo: Position;    // A面视频位置
  bVideo: Position;    // B面视频位置
  bgImage: Position;   // 背景图位置
  coverImage: Position;// 封面图位置
}

/**
 * 素材图层配置
 */
export interface LayerConfig {
  id: LayerId;
  label: string;
  colorClass: string;
  bgClass: string;
  visible: boolean;
  locked: boolean;
  z_index: number;
}

/**
 * 画布方向
 */
export type CanvasOrientation = 'horizontal' | 'vertical';

/**
 * 画布配置
 */
export interface CanvasConfig {
  width: number;
  height: number;
  videoAspect: number;  // 默认视频宽高比（用于 B 面视频计算）
}
