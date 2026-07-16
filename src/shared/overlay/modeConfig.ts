/** 贴片生成器内部模板模式。 */
export type OverlayTemplateMode = 'portrait' | 'landscape';

export type OverlayMovementAxis = 'x' | 'y';
export type OverlayRegionKey = 'first' | 'second';

export interface OverlayModeConfig {
  mode: OverlayTemplateMode;
  label: string;
  canvasWidth: number;
  canvasHeight: number;
  windowWidth: number;
  windowHeight: number;
  movementAxis: OverlayMovementAxis;
  axisLabel: 'X' | 'Y';
  firstLabel: string;
  secondLabel: string;
  transparentLabel: string;
  outputSuffix: string;
  maxPosition: number;
  centerPosition: number;
}

export const OVERLAY_MODE_CONFIGS: Record<OverlayTemplateMode, OverlayModeConfig> = {
  portrait: {
    mode: 'portrait',
    label: '竖版贴片',
    canvasWidth: 1080,
    canvasHeight: 1920,
    windowWidth: 1080,
    windowHeight: 608,
    movementAxis: 'y',
    axisLabel: 'Y',
    firstLabel: '上半部分',
    secondLabel: '下半部分',
    transparentLabel: '横版视频区域',
    outputSuffix: '竖版贴片',
    maxPosition: 1312,
    centerPosition: 656,
  },
  landscape: {
    mode: 'landscape',
    label: '横版贴片',
    canvasWidth: 1920,
    canvasHeight: 1080,
    windowWidth: 608,
    windowHeight: 1080,
    movementAxis: 'x',
    axisLabel: 'X',
    firstLabel: '左半部分',
    secondLabel: '右半部分',
    transparentLabel: '竖版视频区域',
    outputSuffix: '横版贴片',
    maxPosition: 1312,
    centerPosition: 656,
  },
};

/** 未携带模式的历史任务一律按竖版贴片处理。 */
export function getOverlayModeConfig(mode?: OverlayTemplateMode): OverlayModeConfig {
  return OVERLAY_MODE_CONFIGS[mode === 'landscape' ? 'landscape' : 'portrait'];
}

/** 将透明窗口位置限制在当前模板的合法范围内。 */
export function clampOverlayPosition(value: number, mode?: OverlayTemplateMode): number {
  const config = getOverlayModeConfig(mode);
  if (!Number.isFinite(value)) return config.centerPosition;
  return Math.round(Math.min(config.maxPosition, Math.max(0, value)));
}

export interface OverlayRegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 获取透明窗口两侧任一区域在输出画布中的矩形。 */
export function getOverlayRegionRect(
  position: number,
  region: OverlayRegionKey,
  mode?: OverlayTemplateMode,
): OverlayRegionRect {
  const config = getOverlayModeConfig(mode);
  const safePosition = clampOverlayPosition(position, config.mode);

  if (config.movementAxis === 'y') {
    return region === 'first'
      ? { x: 0, y: 0, width: config.canvasWidth, height: safePosition }
      : {
          x: 0,
          y: safePosition + config.windowHeight,
          width: config.canvasWidth,
          height: config.canvasHeight - safePosition - config.windowHeight,
        };
  }

  return region === 'first'
    ? { x: 0, y: 0, width: safePosition, height: config.canvasHeight }
    : {
        x: safePosition + config.windowWidth,
        y: 0,
        width: config.canvasWidth - safePosition - config.windowWidth,
        height: config.canvasHeight,
      };
}

/** 获取透明视频窗口在输出画布中的矩形。 */
export function getOverlayWindowRect(
  position: number,
  mode?: OverlayTemplateMode,
): OverlayRegionRect {
  const config = getOverlayModeConfig(mode);
  const safePosition = clampOverlayPosition(position, config.mode);
  return config.movementAxis === 'y'
    ? { x: 0, y: safePosition, width: config.windowWidth, height: config.windowHeight }
    : { x: safePosition, y: 0, width: config.windowWidth, height: config.windowHeight };
}
