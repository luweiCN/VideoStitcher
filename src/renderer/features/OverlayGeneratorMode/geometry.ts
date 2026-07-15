import {
  OVERLAY_CANVAS_HEIGHT,
  OVERLAY_CANVAS_WIDTH,
  OVERLAY_VIDEO_HEIGHT,
  type OverlayCropTransform,
  type OverlayGeneratorTaskConfig,
} from '@shared/overlay';
import type { OverlayAsset, OverlayEditorTask } from '@/features/OverlayGeneratorMode/types';

export const EMPTY_OVERLAY_TRANSFORM: OverlayCropTransform = {
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
};

/** 获取上下区域的实际高度。 */
export function getOverlayRegionHeight(videoY: number, region: 'top' | 'bottom'): number {
  return region === 'top'
    ? videoY
    : OVERLAY_CANVAS_HEIGHT - videoY - OVERLAY_VIDEO_HEIGHT;
}

/** 创建完整覆盖目标区域的居中裁切参数。 */
export function createCoverTransform(
  asset: OverlayAsset,
  regionHeight: number,
): OverlayCropTransform {
  const scale = Math.max(
    OVERLAY_CANVAS_WIDTH / asset.width,
    regionHeight / asset.height,
  );
  return {
    scale,
    x: (OVERLAY_CANVAS_WIDTH - asset.width * scale) / 2,
    y: (regionHeight - asset.height * scale) / 2,
    rotation: 0,
  };
}

/** 创建完整显示原图的适应参数，该模式可能产生空白。 */
export function createContainTransform(
  asset: OverlayAsset,
  regionHeight: number,
): OverlayCropTransform {
  const scale = Math.min(
    OVERLAY_CANVAS_WIDTH / asset.width,
    regionHeight / asset.height,
  );
  return {
    scale,
    x: (OVERLAY_CANVAS_WIDTH - asset.width * scale) / 2,
    y: (regionHeight - asset.height * scale) / 2,
    rotation: 0,
  };
}

/** 保持当前缩放，仅将图片在区域内居中。 */
export function centerTransform(
  asset: OverlayAsset,
  regionHeight: number,
  transform: OverlayCropTransform,
): OverlayCropTransform {
  return {
    ...transform,
    x: (OVERLAY_CANVAS_WIDTH - asset.width * transform.scale) / 2,
    y: (regionHeight - asset.height * transform.scale) / 2,
  };
}

/** 判断图片是否完整覆盖对应区域。 */
export function isRegionCovered(
  asset: OverlayAsset | null,
  transform: OverlayCropTransform,
  regionHeight: number,
): boolean {
  const gaps = getRegionCoverageGaps(asset, transform, regionHeight);
  return gaps.left === 0 && gaps.right === 0 && gaps.top === 0 && gaps.bottom === 0;
}

export interface OverlayCoverageGaps {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 精确计算裁切区域四条边各缺少多少输出像素。 */
export function getRegionCoverageGaps(
  asset: OverlayAsset | null,
  transform: OverlayCropTransform,
  regionHeight: number,
): OverlayCoverageGaps {
  if (!asset || regionHeight < 0 || transform.scale <= 0) {
    return {
      left: OVERLAY_CANVAS_WIDTH,
      right: OVERLAY_CANVAS_WIDTH,
      top: Math.max(0, regionHeight),
      bottom: Math.max(0, regionHeight),
    };
  }
  if (regionHeight === 0) return { left: 0, right: 0, top: 0, bottom: 0 };
  const width = Math.round(asset.width * transform.scale);
  const height = Math.round(asset.height * transform.scale);
  const x = Math.round(transform.x);
  const y = Math.round(transform.y);
  return {
    left: Math.max(0, x),
    right: Math.max(0, OVERLAY_CANVAS_WIDTH - (x + width)),
    top: Math.max(0, y),
    bottom: Math.max(0, regionHeight - (y + height)),
  };
}

/** 检查任务是否具备可导出条件。 */
export function validateOverlayTask(task: OverlayEditorTask): string | null {
  if (!task.topAsset) return '上半部分没有素材';
  if (!task.bottomAsset) return '下半部分没有素材';
  if (!isRegionCovered(task.topAsset, task.topTransform, getOverlayRegionHeight(task.videoY, 'top'))) {
    return '上半部分图片未完全覆盖裁切区域';
  }
  if (!isRegionCovered(task.bottomAsset, task.bottomTransform, getOverlayRegionHeight(task.videoY, 'bottom'))) {
    return '下半部分图片未完全覆盖裁切区域';
  }
  if (!Object.values(task.exportOptions).some(Boolean)) return '请至少选择一种导出选项';
  return null;
}

interface NormalizedTransform {
  zoom: number;
  focusX: number;
  focusY: number;
}

/** 将裁切参数标准化，便于应用到不同尺寸的图片。 */
export function normalizeTransform(
  asset: OverlayAsset,
  regionHeight: number,
  transform: OverlayCropTransform,
): NormalizedTransform {
  const cover = createCoverTransform(asset, regionHeight);
  const renderedWidth = asset.width * transform.scale;
  const renderedHeight = asset.height * transform.scale;
  const overflowX = Math.max(0, renderedWidth - OVERLAY_CANVAS_WIDTH);
  const overflowY = Math.max(0, renderedHeight - regionHeight);
  return {
    zoom: cover.scale > 0 ? transform.scale / cover.scale : 1,
    focusX: overflowX > 0 ? Math.min(1, Math.max(0, -transform.x / overflowX)) : 0.5,
    focusY: overflowY > 0 ? Math.min(1, Math.max(0, -transform.y / overflowY)) : 0.5,
  };
}

/** 将标准化参数应用到另一张原图。 */
export function denormalizeTransform(
  asset: OverlayAsset,
  regionHeight: number,
  normalized: NormalizedTransform,
): OverlayCropTransform {
  const cover = createCoverTransform(asset, regionHeight);
  const scale = cover.scale * normalized.zoom;
  const renderedWidth = asset.width * scale;
  const renderedHeight = asset.height * scale;
  return {
    scale,
    x: -Math.max(0, renderedWidth - OVERLAY_CANVAS_WIDTH) * normalized.focusX,
    y: -Math.max(0, renderedHeight - regionHeight) * normalized.focusY,
    rotation: 0,
  };
}

/** 转成任务中心和主进程可直接消费的配置。 */
export function toOverlayGeneratorTaskConfig(task: OverlayEditorTask): OverlayGeneratorTaskConfig {
  if (!task.topAsset || !task.bottomAsset) {
    throw new Error('上下素材不完整');
  }
  const topHeight = getOverlayRegionHeight(task.videoY, 'top');
  const bottomHeight = getOverlayRegionHeight(task.videoY, 'bottom');
  return {
    sourceTaskId: task.id,
    sameSource: task.sameSource,
    videoY: task.videoY,
    top: {
      sourcePath: task.topAsset.path,
      sourceWidth: task.topAsset.width,
      sourceHeight: task.topAsset.height,
      cropArea: { width: OVERLAY_CANVAS_WIDTH, height: topHeight },
      transform: task.topTransform,
    },
    bottom: {
      sourcePath: task.bottomAsset.path,
      sourceWidth: task.bottomAsset.width,
      sourceHeight: task.bottomAsset.height,
      cropArea: { width: OVERLAY_CANVAS_WIDTH, height: bottomHeight },
      transform: task.bottomTransform,
    },
    exportOptions: task.exportOptions,
  };
}
