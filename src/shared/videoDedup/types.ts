export type VideoDedupElementType = 'image' | 'gif' | 'green_video';

export type VideoDedupScheduleMode = 'slots' | 'random';

export type VideoDedupPosition = 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';

export interface GreenScreenRecipe {
  keyColor: string;
  similarity: number;
  edgeSoftness: number;
  spillSuppression: number;
}

export interface VideoDedupElement {
  path: string;
  name: string;
  type: VideoDedupElementType;
  size: number;
  modifiedAt: number;
  recipe?: GreenScreenRecipe;
}

export interface VideoDedupLibraryScanResult {
  success: boolean;
  rootDir: string;
  elements: VideoDedupElement[];
  counts: Record<VideoDedupElementType, number>;
  missingRecipes: number;
  errors: Array<{ path: string; error: string }>;
  error?: string;
}

export interface VideoDedupScheduleConfig {
  eventCount: number;
  minDuration: number;
  maxDuration: number;
  skipHead: number;
  skipTail: number;
  minimumGap: number;
  scheduleMode: VideoDedupScheduleMode;
  positions: VideoDedupPosition[];
  randomSeed: number;
}

export interface VideoDedupEvent {
  index: number;
  elementPath: string;
  elementType: VideoDedupElementType;
  start: number;
  duration: number;
  end: number;
  position: VideoDedupPosition;
  /** 画布中的横向中心点比例，范围 0～1；未设置时按 position 兼容旧任务。 */
  x?: number;
  /** 画布中的纵向中心点比例，范围 0～1；未设置时按 position 兼容旧任务。 */
  y?: number;
  /** 单个变体相对原视频宽度的占比；未设置时使用任务全局 elementScale。 */
  scale?: number;
  recipe?: GreenScreenRecipe;
}

export interface VideoDedupTaskConfig extends VideoDedupScheduleConfig {
  elements: VideoDedupElement[];
  events?: VideoDedupEvent[];
  variantIndex: number;
  elementScale: number;
  previewMode?: boolean;
}

export interface VideoDedupExecutionResult {
  success: boolean;
  outputPath?: string;
  events?: VideoDedupEvent[];
  error?: string;
}

export const DEFAULT_GREEN_SCREEN_RECIPE: GreenScreenRecipe = {
  keyColor: '#00FF00',
  similarity: 12,
  edgeSoftness: 5,
  spillSuppression: 20,
};

export const DEFAULT_VIDEO_DEDUP_POSITIONS: VideoDedupPosition[] = [
  'top_left',
  'top_right',
  'bottom_left',
  'bottom_right',
];
