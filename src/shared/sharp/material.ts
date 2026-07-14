/**
 * 图片素材处理模块
 * 生成单图、九宫格等多种规格的图片素材
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { SHARP_CONSTANTS, type ProcessResult, type LogoPosition, type ExportOptions, type PreviewFitMode, type GridResult, type ThreadsConfig } from './types';
import { generateFileName } from '@shared/utils/fileNameHelper';
import { createGridImage } from './grid';

interface OrientedImageSize {
  width: number;
  height: number;
}

interface LogoOverlay {
  input: Buffer;
  left: number;
  top: number;
  blend: 'over';
}

/**
 * 获取图片按 EXIF 方向旋转后的实际宽高
 */
function getOrientedImageSize(metadata: sharp.Metadata): OrientedImageSize {
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const shouldSwap = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;

  return shouldSwap
    ? { width: height, height: width }
    : { width, height };
}

/**
 * 裁出 Logo 位于画面内的可见部分，允许 Logo 跨出任意边缘
 */
async function createVisibleLogoOverlay(
  logoBuffer: Buffer,
  logoSize: OrientedImageSize,
  desiredLeft: number,
  desiredTop: number,
  canvasSize: OrientedImageSize
): Promise<LogoOverlay | null> {
  const sourceLeft = Math.max(0, -desiredLeft);
  const sourceTop = Math.max(0, -desiredTop);
  const targetLeft = Math.max(0, desiredLeft);
  const targetTop = Math.max(0, desiredTop);
  const visibleWidth = Math.min(
    logoSize.width - sourceLeft,
    canvasSize.width - targetLeft
  );
  const visibleHeight = Math.min(
    logoSize.height - sourceTop,
    canvasSize.height - targetTop
  );

  if (visibleWidth <= 0 || visibleHeight <= 0) {
    return null;
  }

  const isFullyVisible = sourceLeft === 0 && sourceTop === 0 &&
    visibleWidth === logoSize.width && visibleHeight === logoSize.height;
  const visibleLogoBuffer = isFullyVisible
    ? logoBuffer
    : await sharp(logoBuffer)
        .extract({
          left: sourceLeft,
          top: sourceTop,
          width: visibleWidth,
          height: visibleHeight,
        })
        .toBuffer();

  return {
    input: visibleLogoBuffer,
    left: targetLeft,
    top: targetTop,
    blend: 'over',
  };
}

/**
 * 处理横版或竖版素材：保留原始宽高，只叠加 Logo，不生成九宫格
 */
async function processOriginalAspectMaterial(
  inputPath: string,
  inputBaseName: string,
  imageSize: OrientedImageSize,
  logoPath: string | null,
  outputDir: string,
  logoPosition: LogoPosition | null,
  logoScale: number
): Promise<ProcessResult> {
  const singleDir = path.join(outputDir, 'single');
  await fs.mkdir(singleDir, { recursive: true });

  const nameSuffix = logoPath ? '原比例Logo图' : '原比例完整图';
  const rawName = getModifiedName(inputBaseName, nameSuffix);
  const outName = generateFileName(singleDir, rawName, {
    extension: '.jpg',
    reserveSuffixSpace: 5,
  });
  const outputPath = path.join(singleDir, outName);
  const imagePipeline = sharp(inputPath).rotate();

  if (logoPath) {
    const logoMetadata = await sharp(logoPath).metadata();
    const logoOriginalSize = Math.max(logoMetadata.width || 0, logoMetadata.height || 0);
    // 前端以最长边 800 像素作为统一坐标系，导出时按原图最长边等比换算
    const coordinateScale = Math.max(imageSize.width, imageSize.height) / SHARP_CONSTANTS.SINGLE_SIZE;
    // 100% 对应 Logo 原始尺寸，不再设置额外的像素上限
    const logoSizeOnPreview = Math.max(1, Math.floor(logoOriginalSize * logoScale));
    const finalLogoSize = Math.max(1, Math.round(logoSizeOnPreview * coordinateScale));
    const { data: logoBuffer, info: logoInfo } = await sharp(logoPath)
      .resize(finalLogoSize, finalLogoSize, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    const useCustomPosition = logoPosition &&
      (logoPosition.x !== SHARP_CONSTANTS.DEFAULT_LOGO_POSITION.x ||
       logoPosition.y !== SHARP_CONSTANTS.DEFAULT_LOGO_POSITION.y);

    const desiredLeft = useCustomPosition
      ? Math.round(logoPosition!.x * coordinateScale)
      : imageSize.width - logoInfo.width;
    const desiredTop = useCustomPosition
      ? Math.round(logoPosition!.y * coordinateScale)
      : imageSize.height - logoInfo.height;
    const visibleOverlay = await createVisibleLogoOverlay(
      logoBuffer,
      { width: logoInfo.width, height: logoInfo.height },
      desiredLeft,
      desiredTop,
      imageSize
    );
    if (visibleOverlay) {
      imagePipeline.composite([visibleOverlay]);
    }
  }

  await imagePipeline
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: SHARP_CONSTANTS.DEFAULT_QUALITY, progressive: true })
    .toFile(outputPath);

  return {
    success: true,
    results: { logo: outputPath },
  };
}

/**
 * 辅助函数：在第 N 个分隔符左侧插入文本
 */
function getModifiedName(
  originalName: string,
  insertText: string,
  delimiter: string = '-',
  targetIndex: number = 8
): string {
  if (!originalName) return insertText;

  const parts = originalName.split(delimiter);
  if (parts.length < targetIndex) {
    return originalName + insertText;
  }

  const prefixParts = parts.slice(0, targetIndex);
  const suffixParts = parts.slice(targetIndex);

  const prefix = prefixParts.join(delimiter);
  const suffix = suffixParts.join(delimiter);

  return prefix + insertText + (suffix ? delimiter + suffix : '');
}

/**
 * 映射 previewSize 到 sharp 支持的 fit 模式
 */
const fitMapping: Record<PreviewFitMode, 'cover' | 'contain' | 'fill'> = {
  cover: 'cover',
  inside: 'contain',
  fill: 'fill',
  contain: 'contain',
  square: 'fill',
};

/**
 * 图片素材处理服务
 *
 * @param inputPath 输入图片路径
 * @param logoPath Logo 图片路径（可选）
 * @param outputDir 输出目录
 * @param previewSize 预览模式，默认 cover
 * @param logoPosition Logo 位置，默认右下角
 * @param logoScale Logo 缩放比例，默认 1
 * @param exportOptions 导出选项，默认同时导出单图和九宫格
 * @param threads 线程数，默认自动
 */
export async function processImageMaterial(
  inputPath: string,
  logoPath: string | null,
  outputDir: string,
  previewSize: PreviewFitMode = 'cover',
  logoPosition: LogoPosition | null = null,
  logoScale: number = SHARP_CONSTANTS.DEFAULT_LOGO_SCALE,
  exportOptions: ExportOptions = { single: true, grid: true },
  threads?: number
): Promise<ProcessResult> {
  // 设置 Sharp 并发数
  if (threads) {
    sharp.concurrency(threads);
  }
  
  const inputBaseName = path.parse(inputPath).name;
  const results: ProcessResult['results'] = {};

  const inputMetadata = await sharp(inputPath).metadata();
  const imageSize = getOrientedImageSize(inputMetadata);
  if (!imageSize.width || !imageSize.height) {
    throw new Error('无法读取素材图片尺寸');
  }

  // 横版和竖版素材只执行原比例加 Logo，不应用方图裁切、缩放或九宫格选项
  if (imageSize.width !== imageSize.height) {
    return processOriginalAspectMaterial(
      inputPath,
      inputBaseName,
      imageSize,
      logoPath,
      outputDir,
      logoPosition,
      logoScale
    );
  }

  const masterTmpDir = path.join(os.tmpdir(), 'videostitcher-temp');
  await fs.mkdir(masterTmpDir, { recursive: true });
  const masterPath = path.join(masterTmpDir, `${inputBaseName}_master.png`);

  // 生成主图（2400x2400）
  const masterOptions: sharp.ResizeOptions = {
    width: SHARP_CONSTANTS.GRID_SIZE,
    height: SHARP_CONSTANTS.GRID_SIZE,
    fit: fitMapping[previewSize] || 'cover',
  };

  if (previewSize === 'inside' || previewSize === 'contain') {
    masterOptions.background = { r: 255, g: 255, b: 255, alpha: 1 };
  }

  await sharp(inputPath).resize(masterOptions).png().toFile(masterPath);

  // 处理 Logo
  let logoMasterPath = masterPath;
  if (logoPath) {
    const logoMetadata = await sharp(logoPath).metadata();
    const logoOriginalSize = Math.max(logoMetadata.width || 0, logoMetadata.height || 0);

    // 100% 对应 Logo 原始尺寸，主图使用 3 倍坐标系
    const logoSizeOn800 = Math.max(1, Math.floor(logoOriginalSize * logoScale));
    const finalLogoSize = logoSizeOn800 * 3;

    logoMasterPath = path.join(masterTmpDir, `${inputBaseName}_master_logo.png`);

    // 判断是否使用自定义位置
    const useCustomPosition = logoPosition &&
      (logoPosition.x !== SHARP_CONSTANTS.DEFAULT_LOGO_POSITION.x ||
       logoPosition.y !== SHARP_CONSTANTS.DEFAULT_LOGO_POSITION.y);

    const { data: logoBuffer, info: logoInfo } = await sharp(logoPath)
      .resize(finalLogoSize, finalLogoSize, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    const masterPipeline = sharp(masterPath);
    const desiredLeft = useCustomPosition
      ? Math.round(logoPosition!.x * 3)
      : SHARP_CONSTANTS.GRID_SIZE - logoInfo.width;
    const desiredTop = useCustomPosition
      ? Math.round(logoPosition!.y * 3)
      : SHARP_CONSTANTS.GRID_SIZE - logoInfo.height;
    const visibleOverlay = await createVisibleLogoOverlay(
      logoBuffer,
      { width: logoInfo.width, height: logoInfo.height },
      desiredLeft,
      desiredTop,
      { width: SHARP_CONSTANTS.GRID_SIZE, height: SHARP_CONSTANTS.GRID_SIZE }
    );
    if (visibleOverlay) {
      masterPipeline.composite([visibleOverlay]);
    }

    await masterPipeline.png().toFile(logoMasterPath);
  }

  // 导出单图
  if (exportOptions.single) {
    const rawName = getModifiedName(inputBaseName, '800尺寸单图');
    const singleDir = path.join(outputDir, 'single');
    await fs.mkdir(singleDir, { recursive: true });
    const outName = generateFileName(singleDir, rawName, {
      extension: '.jpg',
      reserveSuffixSpace: 5,
    });
    const singleOutputPath = path.join(singleDir, outName);

    const targetSizeBytes = SHARP_CONSTANTS.SINGLE_TARGET_KB * 1024;
    let quality: number = SHARP_CONSTANTS.DEFAULT_QUALITY;
    let buffer: Buffer = Buffer.alloc(0);
    let iteration = 0;

    const singleSharp = sharp(logoMasterPath).resize(SHARP_CONSTANTS.SINGLE_SIZE, SHARP_CONSTANTS.SINGLE_SIZE);

    while (iteration < SHARP_CONSTANTS.MAX_ITERATIONS) {
      iteration++;
      buffer = await singleSharp
        .clone()
        .jpeg({ quality, progressive: true })
        .toBuffer();

      if (buffer.length <= targetSizeBytes || quality <= 20) {
        break;
      }

      if (buffer.length > targetSizeBytes * 1.5) {
        quality -= 15;
      } else {
        quality -= 5;
      }
      if (quality < SHARP_CONSTANTS.MIN_QUALITY) quality = SHARP_CONSTANTS.MIN_QUALITY;
    }

    await fs.writeFile(singleOutputPath, buffer);

    results.logo = singleOutputPath;
  }

  // 导出九宫格
  if (exportOptions.grid) {
    const gridResult: GridResult = await createGridImage(
      logoMasterPath,
      path.join(outputDir, 'grid'),
      inputBaseName,
      SHARP_CONSTANTS.SINGLE_SIZE,
      SHARP_CONSTANTS.GRID_TARGET_KB
    );
    results.grid = gridResult;
  }

  // 清理临时文件
  try {
    await fs.unlink(masterPath);
    if (logoMasterPath !== masterPath) await fs.unlink(logoMasterPath);
  } catch { /* 忽略清理错误 */ }

  return {
    success: true,
    results,
  };
}
