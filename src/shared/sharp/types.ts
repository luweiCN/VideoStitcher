/**
 * Sharp 模块类型定义和常量
 */

// ============================================
// 常量定义
// ============================================

export const SHARP_CONSTANTS = {
  // 图片尺寸
  GRID_SIZE: 2400,
  SINGLE_SIZE: 800,

  // 质量参数
  DEFAULT_QUALITY: 90,
  MIN_QUALITY: 10,
  MAX_ITERATIONS: 15,

  // 目标文件大小 (KB)
  TARGET_SIZE_KB: 380,
  SINGLE_TARGET_KB: 400,
  GRID_TARGET_KB: 400,

  // Logo 默认位置
  DEFAULT_LOGO_POSITION: { x: 50, y: 50 },
  DEFAULT_LOGO_SCALE: 1,
  MAX_LOGO_SIZE: 400,
} as const;

// ============================================
// 类型定义
// ============================================

export interface CompressResult {
  success: boolean;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
  skipped?: boolean;
  quality?: number;
  scale?: number;
}

export interface ConvertResult {
  success: boolean;
  outputPath: string;
  targetSize: { width: number; height: number };
  originalSize: { width: number; height: number };
}

export interface GridResult {
  success: boolean;
  grid: Array<{
    index: number;
    outputPath: string;
    position: { row: number; col: number };
    size: { width: number; height: number };
    fileSize?: number;
  }>;
  originalSize: { width: number; height: number };
  tileSize: { width: number; height: number };
}

export interface ProcessResult {
  success: boolean;
  results: {
    logo?: string;
    grid?: GridResult;
  };
}

export interface LogoPosition {
  x: number;
  y: number;
}

export interface ExportOptions {
  single?: boolean;
  grid?: boolean;
}

/**
 * 线程配置
 */
export interface ThreadsConfig {
  threads?: number;
}

/**
 * 图片预览模式
 */
export type PreviewFitMode = 'cover' | 'inside' | 'fill' | 'contain' | 'square';
