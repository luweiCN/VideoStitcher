import type { Position } from '@shared/ffmpeg/types';

export type MergeOrientation = 'horizontal' | 'vertical';

export interface MergeMediaDimensions {
  width: number;
  height: number;
}

export interface ResolveMergeLayoutConfig {
  requestedOrientation: MergeOrientation;
  hasBackgroundTemplate: boolean;
  videoDimensions: Array<MergeMediaDimensions | null | undefined>;
  aPosition?: Position;
  bPosition?: Position;
  cPosition?: Position;
  bgPosition?: Position;
  coverPosition?: Position;
}

export interface ResolvedMergeLayout {
  orientation: MergeOrientation;
  aPosition?: Position;
  bPosition?: Position;
  cPosition?: Position;
  bgPosition?: Position;
  coverPosition?: Position;
  forcedLandscapeFullscreen: boolean;
}

/**
 * 解析极速合成最终输出布局。
 *
 * 没有视频套图且所有视频均为横版时，横版全屏是业务上的强约束：
 * 即使前端因页面恢复或异步竞态传入了旧竖框，也不能让该框位进入成片。
 */
export function resolveMergeLayout(config: ResolveMergeLayoutConfig): ResolvedMergeLayout {
  const allVideosAreLandscape = config.videoDimensions.length > 0
    && config.videoDimensions.every((dimensions) => (
      !!dimensions
      && dimensions.width > 0
      && dimensions.height > 0
      && dimensions.width >= dimensions.height
    ));

  const forcedLandscapeFullscreen = !config.hasBackgroundTemplate && allVideosAreLandscape;
  if (!forcedLandscapeFullscreen) {
    return {
      orientation: config.requestedOrientation,
      aPosition: config.aPosition,
      bPosition: config.bPosition,
      cPosition: config.cPosition,
      bgPosition: config.bgPosition,
      coverPosition: config.coverPosition,
      forcedLandscapeFullscreen: false,
    };
  }

  const fullscreen: Position = {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
  };

  return {
    orientation: 'horizontal',
    aPosition: { ...fullscreen },
    bPosition: { ...fullscreen },
    cPosition: { ...fullscreen },
    bgPosition: { ...fullscreen },
    coverPosition: { ...fullscreen },
    forcedLandscapeFullscreen: true,
  };
}
