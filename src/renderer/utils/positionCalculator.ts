/**
 * 位置计算工具
 * 根据画布配置和视频元数据计算各素材的默认位置
 */

import { Position, MaterialPositions, CanvasConfig, CanvasOrientation } from '@/types';

/**
 * 根据画布方向获取默认画布配置
 */
export function getCanvasConfig(orientation: CanvasOrientation): CanvasConfig {
  if (orientation === 'horizontal') {
    return {
      width: 1920,
      height: 1080,
      videoAspect: 9 / 16,  // 竖屏视频宽高比
    };
  } else {
    return {
      width: 1080,
      height: 1920,
      videoAspect: 16 / 9,  // 横屏视频宽高比
    };
  }
}

/**
 * 计算素材的默认位置
 *
 * @param config - 画布配置
 * @param bVideoMetadata - B面视频元数据（可选）
 * @param aVideoMetadata - A面视频元数据（可选）
 * @param coverImageMetadata - 封面图元数据（可选）
 * @returns 素材位置映射
 */
export function getInitialPositions(
  config: CanvasConfig,
  bVideoMetadata?: { width: number; height: number; duration: number },
  aVideoMetadata?: { width: number; height: number; duration: number },
): MaterialPositions {
  const { width, height, videoAspect } = config;

  // 1. 背景图：铺满画布
  const bgImage: Position = {
    x: 0,
    y: 0,
    width,
    height,
  };

  // 2. A面视频：铺满画布（默认行为）
  let aWidth = width;
  let aHeight = height;

  // 如果提供了 A 面视频元数据，根据实际尺寸调整
  if (aVideoMetadata) {
    const aAspect = aVideoMetadata.width / aVideoMetadata.height;
    const canvasAspect = width / height;

    if (aAspect > canvasAspect) {
      // 视频更宽，按宽度适配
      aWidth = width;
      aHeight = width / aAspect;
    } else {
      // 视频更高或接近，按高度适配
      aHeight = height;
      aWidth = height * aAspect;
    }
  }

  const aVideo: Position = {
    x: (width - aWidth) / 2,
    y: (height - aHeight) / 2,
    width: aWidth,
    height: aHeight,
  };

  // 3. B面视频：保持原始比例，并在画布内尽可能铺满
  let bWidth: number;
  let bHeight: number;

  if (bVideoMetadata) {
    const bAspect = bVideoMetadata.width / bVideoMetadata.height;
    const canvasAspect = width / height;

    if (bAspect > canvasAspect) {
      // 视频比画布更宽：宽度铺满，高度按原始比例计算
      bWidth = width;
      bHeight = bWidth / bAspect;
    } else {
      // 视频比画布更窄或比例相同：高度铺满，宽度按原始比例计算
      bHeight = height;
      bWidth = bHeight * bAspect;
    }
  } else {
    // 元数据尚未恢复时，横屏优先使用安全的全屏框，避免回退成 607.5×1080 的竖框
    const isHorizontal = width > height;
    if (isHorizontal) {
      bWidth = width;
      bHeight = height;
    } else {
      bWidth = width;
      bHeight = width / videoAspect;
    }
  }

  const bVideo: Position = {
    x: (width - bWidth) / 2,
    y: (height - bHeight) / 2,
    width: bWidth,
    height: bHeight,
  };

  // 4. 封面图：默认铺满全屏
  const coverWidth = width;
  const coverHeight = height;

  const coverImage: Position = {
    x: 0,
    y: 0,
    width: coverWidth,
    height: coverHeight,
  };

  // 5. C面视频：默认铺满全屏（落版通常是全屏展示）
  const cVideo: Position = {
    x: 0,
    y: 0,
    width,
    height,
  };

  return {
    bgImage,
    aVideo,
    bVideo,
    cVideo,
    coverImage,
  };
}
