/**
 * 贴片生成器在渲染进程与主进程之间共享的数据结构。
 */

import type { OverlayTemplateMode } from './modeConfig';

export const OVERLAY_CANVAS_WIDTH = 1080;
export const OVERLAY_CANVAS_HEIGHT = 1920;
export const OVERLAY_VIDEO_HEIGHT = 608;
export const OVERLAY_CENTER_Y = (OVERLAY_CANVAS_HEIGHT - OVERLAY_VIDEO_HEIGHT) / 2;
export const OVERLAY_MAX_VIDEO_Y = OVERLAY_CANVAS_HEIGHT - OVERLAY_VIDEO_HEIGHT;

/** 原图在输出区域坐标系中的绘制参数。 */
export interface OverlayCropTransform {
  /** 原图到输出像素的等比缩放值。 */
  scale: number;
  /** 缩放后原图左上角相对裁切区域的 X 坐标。 */
  x: number;
  /** 缩放后原图左上角相对裁切区域的 Y 坐标。 */
  y: number;
  /** 为后续旋转能力预留，第一版固定为 0。 */
  rotation: number;
}

/** 单个上下素材槽在导出时所需的完整信息。 */
export interface OverlayRegionConfig {
  sourcePath: string;
  sourceWidth: number;
  sourceHeight: number;
  cropArea: {
    width: number;
    height: number;
  };
  transform: OverlayCropTransform;
}

/** 贴片导出选项。 */
export interface OverlayExportOptions {
  transparentPng: boolean;
  solidPreview: boolean;
  checkerPreview: boolean;
  topOnly: boolean;
  bottomOnly: boolean;
}

/** 存入任务中心的贴片任务配置。 */
export interface OverlayGeneratorTaskConfig {
  /** 页面内任务 ID，用于把任务中心事件映射回编辑列表。 */
  sourceTaskId: string;
  sameSource: boolean;
  /** 新任务使用的模板模式；历史任务缺失时按竖版处理。 */
  mode?: OverlayTemplateMode;
  /** 新任务使用的通用透明窗口位置。 */
  position?: number;
  /** 新任务使用的通用前后区域。 */
  first?: OverlayRegionConfig;
  second?: OverlayRegionConfig;
  /** 以下字段用于兼容历史竖版任务和便于任务数据排查。 */
  videoY?: number;
  top?: OverlayRegionConfig;
  bottom?: OverlayRegionConfig;
  /** 横版任务的语义化镜像字段。 */
  videoX?: number;
  left?: OverlayRegionConfig;
  right?: OverlayRegionConfig;
  exportOptions: OverlayExportOptions;
}

export const DEFAULT_OVERLAY_EXPORT_OPTIONS: OverlayExportOptions = {
  transparentPng: true,
  solidPreview: false,
  checkerPreview: false,
  topOnly: false,
  bottomOnly: false,
};

/** 将横版透明区域 Y 坐标限制在合法范围内。 */
export function clampOverlayVideoY(value: number): number {
  if (!Number.isFinite(value)) return OVERLAY_CENTER_Y;
  return Math.round(Math.min(OVERLAY_MAX_VIDEO_Y, Math.max(0, value)));
}
