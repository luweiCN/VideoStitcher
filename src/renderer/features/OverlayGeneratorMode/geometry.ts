import {
  getOverlayModeConfig,
  getOverlayRegionRect,
  type OverlayCropTransform,
  type OverlayGeneratorTaskConfig,
  type OverlayRegionKey,
  type OverlayRegionRect,
  type OverlayTemplateMode,
} from '@shared/overlay';
import type { OverlayAsset, OverlayEditorTask } from '@/features/OverlayGeneratorMode/types';

export const EMPTY_OVERLAY_TRANSFORM: OverlayCropTransform = {
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0,
};

/** 获取透明窗口两侧区域的实际尺寸。 */
export function getOverlayRegionSize(
  position: number,
  region: OverlayRegionKey,
  mode: OverlayTemplateMode,
): Pick<OverlayRegionRect, 'width' | 'height'> {
  const { width, height } = getOverlayRegionRect(position, region, mode);
  return { width, height };
}

/** 创建完整覆盖目标区域的居中裁切参数。 */
export function createCoverTransform(
  asset: OverlayAsset,
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
): OverlayCropTransform {
  const scale = Math.max(
    regionSize.width / asset.width,
    regionSize.height / asset.height,
  );
  return {
    scale,
    x: (regionSize.width - asset.width * scale) / 2,
    y: (regionSize.height - asset.height * scale) / 2,
    rotation: 0,
  };
}

/** 创建完整显示原图的适应参数，该模式可能产生空白。 */
export function createContainTransform(
  asset: OverlayAsset,
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
): OverlayCropTransform {
  const scale = Math.min(
    regionSize.width / asset.width,
    regionSize.height / asset.height,
  );
  return {
    scale,
    x: (regionSize.width - asset.width * scale) / 2,
    y: (regionSize.height - asset.height * scale) / 2,
    rotation: 0,
  };
}

/** 保持当前缩放，仅将图片在区域内居中。 */
export function centerTransform(
  asset: OverlayAsset,
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
  transform: OverlayCropTransform,
): OverlayCropTransform {
  return {
    ...transform,
    x: (regionSize.width - asset.width * transform.scale) / 2,
    y: (regionSize.height - asset.height * transform.scale) / 2,
  };
}

/**
 * 以最小改动修复覆盖缺口。
 * 图片尺寸足够时只夹紧产生缺口的坐标轴，不改变另一轴，也不会主动居中。
 */
export function repairCoverageTransform(
  asset: OverlayAsset,
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
  transform: OverlayCropTransform,
): OverlayCropTransform {
  if (regionSize.width <= 0 || regionSize.height <= 0) return transform;
  if (transform.scale <= 0) return createCoverTransform(asset, regionSize);

  const coverScale = createCoverTransform(asset, regionSize).scale;
  const scale = Math.max(transform.scale, coverScale);
  let x = transform.x;
  let y = transform.y;

  // 缩放不足时围绕当前区域中心补足最低覆盖比例，尽量保留当前构图焦点。
  if (scale > transform.scale) {
    const ratio = scale / transform.scale;
    const centerX = regionSize.width / 2;
    const centerY = regionSize.height / 2;
    x = centerX - (centerX - x) * ratio;
    y = centerY - (centerY - y) * ratio;
  }

  const renderedWidth = Math.round(asset.width * scale);
  const renderedHeight = Math.round(asset.height * scale);
  return {
    ...transform,
    scale,
    x: Math.min(0, Math.max(regionSize.width - renderedWidth, x)),
    y: Math.min(0, Math.max(regionSize.height - renderedHeight, y)),
  };
}

/** 判断图片是否完整覆盖对应区域。 */
export function isRegionCovered(
  asset: OverlayAsset | null,
  transform: OverlayCropTransform,
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
): boolean {
  const gaps = getRegionCoverageGaps(asset, transform, regionSize);
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
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
): OverlayCoverageGaps {
  if (!asset || regionSize.width < 0 || regionSize.height < 0 || transform.scale <= 0) {
    return {
      left: Math.max(0, regionSize.width),
      right: Math.max(0, regionSize.width),
      top: Math.max(0, regionSize.height),
      bottom: Math.max(0, regionSize.height),
    };
  }
  if (regionSize.width === 0 || regionSize.height === 0) {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }
  const width = Math.round(asset.width * transform.scale);
  const height = Math.round(asset.height * transform.scale);
  const x = Math.round(transform.x);
  const y = Math.round(transform.y);
  return {
    left: Math.max(0, x),
    right: Math.max(0, regionSize.width - (x + width)),
    top: Math.max(0, y),
    bottom: Math.max(0, regionSize.height - (y + height)),
  };
}

/** 检查任务是否具备可导出条件。 */
export function validateOverlayTask(task: OverlayEditorTask): string | null {
  const config = getOverlayModeConfig(task.mode);
  const firstSize = getOverlayRegionSize(task.position, 'first', task.mode);
  const secondSize = getOverlayRegionSize(task.position, 'second', task.mode);
  if (!task.firstAsset) return `${config.firstLabel}没有素材`;
  if (!task.secondAsset) return `${config.secondLabel}没有素材`;
  if (!isRegionCovered(task.firstAsset, task.firstTransform, firstSize)) {
    return `${config.firstLabel}图片未完全覆盖裁切区域`;
  }
  if (!isRegionCovered(task.secondAsset, task.secondTransform, secondSize)) {
    return `${config.secondLabel}图片未完全覆盖裁切区域`;
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
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
  transform: OverlayCropTransform,
): NormalizedTransform {
  const cover = createCoverTransform(asset, regionSize);
  const renderedWidth = asset.width * transform.scale;
  const renderedHeight = asset.height * transform.scale;
  const overflowX = Math.max(0, renderedWidth - regionSize.width);
  const overflowY = Math.max(0, renderedHeight - regionSize.height);
  return {
    zoom: cover.scale > 0 ? transform.scale / cover.scale : 1,
    focusX: overflowX > 0 ? Math.min(1, Math.max(0, -transform.x / overflowX)) : 0.5,
    focusY: overflowY > 0 ? Math.min(1, Math.max(0, -transform.y / overflowY)) : 0.5,
  };
}

/** 将标准化参数应用到另一张原图。 */
export function denormalizeTransform(
  asset: OverlayAsset,
  regionSize: Pick<OverlayRegionRect, 'width' | 'height'>,
  normalized: NormalizedTransform,
): OverlayCropTransform {
  const cover = createCoverTransform(asset, regionSize);
  const scale = cover.scale * normalized.zoom;
  const renderedWidth = asset.width * scale;
  const renderedHeight = asset.height * scale;
  return {
    scale,
    x: -Math.max(0, renderedWidth - regionSize.width) * normalized.focusX,
    y: -Math.max(0, renderedHeight - regionSize.height) * normalized.focusY,
    rotation: 0,
  };
}

/** 转成任务中心和主进程可直接消费的配置。 */
export function toOverlayGeneratorTaskConfig(task: OverlayEditorTask): OverlayGeneratorTaskConfig {
  if (!task.firstAsset || !task.secondAsset) {
    throw new Error('两侧素材不完整');
  }
  const firstSize = getOverlayRegionSize(task.position, 'first', task.mode);
  const secondSize = getOverlayRegionSize(task.position, 'second', task.mode);
  const first = {
    sourcePath: task.firstAsset.path,
    sourceWidth: task.firstAsset.width,
    sourceHeight: task.firstAsset.height,
    cropArea: firstSize,
    transform: task.firstTransform,
  };
  const second = {
    sourcePath: task.secondAsset.path,
    sourceWidth: task.secondAsset.width,
    sourceHeight: task.secondAsset.height,
    cropArea: secondSize,
    transform: task.secondTransform,
  };
  const result: OverlayGeneratorTaskConfig = {
    sourceTaskId: task.id,
    sameSource: task.sameSource,
    mode: task.mode,
    position: task.position,
    first,
    second,
    exportOptions: task.exportOptions,
  };

  if (task.mode === 'landscape') {
    result.videoX = task.position;
    result.left = first;
    result.right = second;
  } else {
    result.videoY = task.position;
    result.top = first;
    result.bottom = second;
  }
  return result;
}
