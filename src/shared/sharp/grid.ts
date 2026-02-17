/**
 * 九宫格切割模块
 * 将图片切割为 3x3 的九宫格
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { SHARP_CONSTANTS, type GridResult } from './types';
import { generateFileName } from '@shared/utils/fileNameHelper';

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
 * 九宫格切割服务
 *
 * @param inputPath 输入图片路径
 * @param outputDir 输出目录
 * @param baseNameOverride 输出文件名基础名，默认使用原文件名
 * @param targetTileSize 单个格子目标尺寸，默认 800
 * @param maxSizeKB 压缩目标大小，0 表示不压缩输出 PNG
 */
export async function createGridImage(
  inputPath: string,
  outputDir: string,
  baseNameOverride: string | null = null,
  targetTileSize: number = SHARP_CONSTANTS.SINGLE_SIZE,
  maxSizeKB: number = 0
): Promise<GridResult> {
  const metadata = await sharp(inputPath).metadata();
  let { width, height } = metadata;

  // 预处理：如果图片太小，先放大到合适尺寸
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
        // 压缩输出
        const targetSizeBytes = maxSizeKB * 1024;
        let quality: number = SHARP_CONSTANTS.DEFAULT_QUALITY;
        let buffer: Buffer = Buffer.alloc(0);
        let iteration = 0;

        const tileSharp = sharp(processingInput).extract({
          left,
          top,
          width: tileWidth,
          height: tileHeight,
        });

        while (iteration < SHARP_CONSTANTS.MAX_ITERATIONS) {
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

          if (quality < SHARP_CONSTANTS.MIN_QUALITY) quality = SHARP_CONSTANTS.MIN_QUALITY;
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
        // PNG 输出（无压缩）
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

  // 清理临时文件
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
