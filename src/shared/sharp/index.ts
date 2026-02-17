/**
 * Sharp 图片处理服务
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { generateFileName } from '../utils/fileNameHelper';

interface CompressResult {
  success: boolean;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
  skipped?: boolean;
  quality?: number;
  scale?: number;
}

interface ConvertResult {
  success: boolean;
  outputPath: string;
  targetSize: { width: number; height: number };
  originalSize: { width: number; height: number };
}

interface GridResult {
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

interface ProcessResult {
  success: boolean;
  results: {
    logo?: string;
    grid?: GridResult;
  };
}

interface LogoPosition {
  x: number;
  y: number;
}

interface ExportOptions {
  single?: boolean;
  grid?: boolean;
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
 * 图片压缩服务
 */
export async function compressImage(
  inputPath: string,
  targetSizeKB: number = 380,
  outputDir: string | null = null
): Promise<CompressResult> {
  const targetSizeBytes = targetSizeKB * 1024;
  const stats = await fs.stat(inputPath);

  const targetDir = outputDir || path.dirname(inputPath);

  if (stats.size <= targetSizeBytes) {
    const inputBaseName = path.parse(inputPath).name;
    const uniqueFileName = generateFileName(targetDir, inputBaseName, {
      extension: '.jpg',
      reserveSuffixSpace: 5,
    });
    const outputPath = path.join(targetDir, uniqueFileName);

    await fs.copyFile(inputPath, outputPath);

    return {
      success: true,
      outputPath,
      originalSize: stats.size,
      compressedSize: stats.size,
      compressed: false,
      skipped: true,
    };
  }

  const inputBaseName = path.parse(inputPath).name;
  const uniqueFileName = generateFileName(targetDir, inputBaseName, {
    suffix: '_compressed',
    extension: '.jpg',
    reserveSuffixSpace: 5,
  });
  const outputPath = path.join(targetDir, uniqueFileName);

  let quality = 90;
  let scale = 1.0;
  let buffer: Buffer = Buffer.alloc(0);
  let iteration = 0;
  const maxIterations = 15;

  const metadata = await sharp(inputPath).metadata();
  let width = metadata.width || 800;
  let height = metadata.height || 800;

  while (iteration < maxIterations) {
    iteration++;

    buffer = await sharp(inputPath)
      .resize(Math.round(width * scale), Math.round(height * scale), {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    if (buffer.length <= targetSizeBytes) {
      break;
    }

    if (quality > 50) {
      quality -= 10;
    } else {
      scale *= 0.85;
    }
  }

  await fs.writeFile(outputPath, buffer);

  return {
    success: true,
    outputPath,
    originalSize: stats.size,
    compressedSize: buffer.length,
    compressed: true,
    quality,
    scale,
  };
}

/**
 * 封面格式转换服务
 */
export async function convertCoverFormat(
  inputPath: string,
  quality: number = 90,
  outputDir: string | null = null
): Promise<ConvertResult> {
  const metadata = await sharp(inputPath).metadata();
  const ratio = (metadata.width || 1) / (metadata.height || 1);

  let targetWidth: number, targetHeight: number, suffix: string;

  if (ratio >= 0.9 && ratio <= 1.1) {
    targetWidth = 800;
    targetHeight = 800;
    suffix = '_800x800';
  } else if ((metadata.width || 0) >= (metadata.height || 0)) {
    targetWidth = 1920;
    targetHeight = 1080;
    suffix = '_1920x1080';
  } else {
    targetWidth = 1080;
    targetHeight = 1920;
    suffix = '_1080x1920';
  }

  const inputBaseName = path.parse(inputPath).name;
  const inputExt = path.parse(inputPath).ext;
  const targetDir = outputDir || path.dirname(inputPath);
  const uniqueFileName = generateFileName(targetDir, inputBaseName, {
    suffix: suffix,
    extension: inputExt,
    reserveSuffixSpace: 5,
  });
  const outputPath = path.join(targetDir, uniqueFileName);

  await sharp(inputPath)
    .resize(targetWidth, targetHeight, {
      fit: 'fill',
      withoutEnlargement: false,
    })
    .jpeg({ quality })
    .toFile(outputPath);

  return {
    success: true,
    outputPath,
    targetSize: { width: targetWidth, height: targetHeight },
    originalSize: { width: metadata.width || 0, height: metadata.height || 0 },
  };
}

/**
 * 九宫格切割服务
 */
export async function createGridImage(
  inputPath: string,
  outputDir: string,
  baseNameOverride: string | null = null,
  targetTileSize: number = 800,
  maxSizeKB: number = 0
): Promise<GridResult> {
  const metadata = await sharp(inputPath).metadata();
  let { width, height } = metadata;

  let processingInput = inputPath;
  let currentWidth = width || 800;
  let currentHeight = height || 800;
  let isTempFile = false;

  const ratio = (width || 1) / (height || 1);
  const isSquare = ratio >= 0.9 && ratio <= 1.1;

  if (targetTileSize && isSquare && (width || 0) < targetTileSize * 3) {
    const tmpDir = path.join(os.tmpdir(), 'videostitcher-temp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tempPath = path.join(tmpDir, `grid_master_${Date.now()}.png`);

    await sharp(inputPath)
      .resize(targetTileSize * 3, targetTileSize * 3, {
        fit: 'fill',
        withoutEnlargement: false,
      })
      .png()
      .toFile(tempPath);

    processingInput = tempPath;
    currentWidth = targetTileSize * 3;
    currentHeight = targetTileSize * 3;
    isTempFile = true;
  }

  const tileWidth = Math.floor(currentWidth / 3);
  const tileHeight = Math.floor(currentHeight / 3);

  const inputBaseName = baseNameOverride || path.parse(inputPath).name;
  const results: GridResult['grid'] = [];

  await fs.mkdir(outputDir, { recursive: true });

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const left = col * tileWidth;
      const top = row * tileHeight;
      const index = row * 3 + col + 1;

      const rawName = getModifiedName(inputBaseName, `九宫格${index}`);
      const outName = generateFileName(outputDir, rawName, {
        extension: maxSizeKB > 0 ? '.jpg' : '.png',
        reserveSuffixSpace: 5,
      });
      const outputPath = path.join(outputDir, outName);

      if (maxSizeKB > 0) {
        const targetSizeBytes = maxSizeKB * 1024;
        let quality = 90;
        let buffer: Buffer = Buffer.alloc(0);
        let iteration = 0;

        const tileSharp = sharp(processingInput).extract({
          left,
          top,
          width: tileWidth,
          height: tileHeight,
        });

        while (iteration < 15) {
          iteration++;
          buffer = await tileSharp
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

          if (quality < 10) quality = 10;
        }

        await fs.writeFile(outputPath, buffer);

        results.push({
          index,
          outputPath,
          position: { row: row + 1, col: col + 1 },
          size: { width: tileWidth, height: tileHeight },
          fileSize: buffer.length,
        });
      } else {
        await sharp(processingInput)
          .extract({ left, top, width: tileWidth, height: tileHeight })
          .png()
          .toFile(outputPath);

        results.push({
          index,
          outputPath,
          position: { row: row + 1, col: col + 1 },
          size: { width: tileWidth, height: tileHeight },
        });
      }
    }
  }

  if (isTempFile) {
    try {
      await fs.unlink(processingInput);
    } catch (e) {
      console.error('清理临时文件失败:', e);
    }
  }

  return {
    success: true,
    grid: results,
    originalSize: { width: width || 0, height: height || 0 },
    tileSize: { width: tileWidth, height: tileHeight },
  };
}

/**
 * 图片素材处理服务
 */
export async function processImageMaterial(
  inputPath: string,
  logoPath: string | null,
  outputDir: string,
  previewSize: 'cover' | 'inside' | 'fill' = 'cover',
  logoPosition: LogoPosition | null = null,
  logoScale: number = 1,
  exportOptions: ExportOptions = { single: true, grid: true }
): Promise<ProcessResult> {
  const inputBaseName = path.parse(inputPath).name;
  const results: ProcessResult['results'] = {};
  const GRID_SIZE = 2400;
  const SINGLE_SIZE = 800;

  const masterTmpDir = path.join(os.tmpdir(), 'videostitcher-temp');
  await fs.mkdir(masterTmpDir, { recursive: true });
  const masterPath = path.join(masterTmpDir, `${inputBaseName}_master.png`);

  const fitMapping: Record<string, 'cover' | 'contain' | 'fill'> = {
    cover: 'cover',
    inside: 'contain',
    fill: 'fill',
  };

  const masterOptions: sharp.ResizeOptions = {
    width: GRID_SIZE,
    height: GRID_SIZE,
    fit: fitMapping[previewSize] || 'cover',
  };

  if (previewSize === 'inside') {
    masterOptions.background = { r: 255, g: 255, b: 255, alpha: 1 };
  }

  await sharp(inputPath).resize(masterOptions).png().toFile(masterPath);

  let logoMasterPath = masterPath;
  if (logoPath) {
    const logoMetadata = await sharp(logoPath).metadata();
    const logoOriginalSize = Math.max(logoMetadata.width || 0, logoMetadata.height || 0);

    const logoSizeOn800 = Math.floor(logoOriginalSize * logoScale);
    const finalLogoSize = Math.min(logoSizeOn800, 400) * 3;

    logoMasterPath = path.join(masterTmpDir, `${inputBaseName}_master_logo.png`);

    if (logoPosition && (logoPosition.x !== 50 || logoPosition.y !== 50)) {
      const logoBuffer = await sharp(logoPath)
        .resize(finalLogoSize, finalLogoSize, { fit: 'inside' })
        .toBuffer();

      await sharp(masterPath)
        .composite([
          {
            input: logoBuffer,
            left: Math.round(logoPosition.x * 3),
            top: Math.round(logoPosition.y * 3),
            blend: 'over',
          },
        ])
        .png()
        .toFile(logoMasterPath);
    } else {
      const logoBuffer = await sharp(logoPath)
        .resize(finalLogoSize, finalLogoSize, { fit: 'inside' })
        .toBuffer();

      await sharp(masterPath)
        .composite([
          {
            input: logoBuffer,
            gravity: 'southeast',
            blend: 'over',
          },
        ])
        .png()
        .toFile(logoMasterPath);
    }
  }

  if (exportOptions.single) {
    const rawName = getModifiedName(inputBaseName, '800尺寸单图');
    const singleDir = path.join(outputDir, 'single');
    await fs.mkdir(singleDir, { recursive: true });
    const outName = generateFileName(singleDir, rawName, {
      extension: '.jpg',
      reserveSuffixSpace: 5,
    });
    const singleOutputPath = path.join(singleDir, outName);

    const targetSizeBytes = 400 * 1024;
    let quality = 90;
    let buffer: Buffer = Buffer.alloc(0);
    let iteration = 0;

    const singleSharp = sharp(logoMasterPath).resize(SINGLE_SIZE, SINGLE_SIZE);

    while (iteration < 15) {
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
      if (quality < 10) quality = 10;
    }

    await fs.writeFile(singleOutputPath, buffer);

    results.logo = singleOutputPath;
  }

  if (exportOptions.grid) {
    const gridResult = await createGridImage(
      logoMasterPath,
      path.join(outputDir, 'grid'),
      inputBaseName,
      800,
      400
    );
    results.grid = gridResult;
  }

  try {
    await fs.unlink(masterPath);
    if (logoMasterPath !== masterPath) await fs.unlink(logoMasterPath);
  } catch {}

  return {
    success: true,
    results,
  };
}
