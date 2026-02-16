/**
 * 位置计算工具
 * 根据画布配置和视频元数据计算各素材的默认位置
 */

import { Position, MaterialPositions, CanvasConfig, CanvasOrientation } from '../types';

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

  // 3. B面视频：根据视频元数据计算位置
  let bWidth: number;
  let bHeight: number;

  if (bVideoMetadata) {
    const bAspect = bVideoMetadata.width / bVideoMetadata.height;
    const canvasAspect = width / height;
    const isHorizontal = width > height;

    if (isHorizontal) {
      // 横屏模式：主视频通常是竖屏（9:16）
      if (bAspect < canvasAspect * 0.8) {
        // 竖屏视频 (9:16 或更高)，高度填满
        bHeight = height;
        bWidth = bHeight * bAspect;
      } else if (bAspect > canvasAspect * 1.2) {
        // 超宽屏视频，宽度填满
        bWidth = width;
        bHeight = bWidth / bAspect;
      } else {
        // 接近画布比例，铺满或稍小
        bWidth = width * 0.9;
        bHeight = bWidth / bAspect;
        if (bHeight > height) {
          bHeight = height;
          bWidth = bHeight * bAspect;
        }
      }
    } else {
      // 竖屏模式：主视频通常是横屏（16:9）
      if (bAspect > canvasAspect * 1.2) {
        // 横屏视频 (16:9 或更宽)，宽度填满
        bWidth = width;
        bHeight = bWidth / bAspect;
      } else if (bAspect < canvasAspect * 0.8) {
        // 竖屏视频，高度填满或接近
        bHeight = height;
        bWidth = bHeight * bAspect;
      } else {
        // 接近画布比例，适当缩放
        bHeight = height * 0.7;
        bWidth = bHeight * bAspect;
        if (bWidth > width) {
          bWidth = width;
          bHeight = bWidth / bAspect;
        }
      }
    }
  } else {
    // 使用默认宽高比
    const isHorizontal = width > height;
    if (isHorizontal) {
      bHeight = height;
      bWidth = height * videoAspect;
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

  return {
    bgImage,
    aVideo,
    bVideo,
    coverImage,
  };
}
