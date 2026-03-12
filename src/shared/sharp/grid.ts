/**
 * 多宫格切割模块
 * 支持自定义横竖线进行无损切割
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
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
 * 多宫格切割服务
 * 
 * 核心逻辑：1:1 像素提取，无缩放，无强制压缩（PNG输出）
 *
 * @param inputPath 输入图片路径
 * @param outputDir 输出目录
 * @param baseNameOverride 输出文件名基础名，默认使用原文件名
 * @param targetTileSize 忽略 (保留接口兼容性)
 * @param maxSizeKB 压缩目标大小，0 表示不压缩输出 PNG
 * @param horizontalLines 横向切割线位置（0-1 归一化）
 * @param verticalLines 纵向切割线位置（0-1 归一化）
 */
export async function createGridImage(
  inputPath: string,
  outputDir: string,
  baseNameOverride: string | null = null,
  _targetTileSize: number = SHARP_CONSTANTS.SINGLE_SIZE,
  maxSizeKB: number = 0,
  horizontalLines: number[] = [1 / 3, 2 / 3],
  verticalLines: number[] = [1 / 3, 2 / 3]
): Promise<GridResult> {
  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('无法读取图片尺寸');
  }

  // 排序并确保线段在有效范围内
  const hLines = [...new Set(horizontalLines)]
    .filter(line => line > 0 && line < 1)
    .sort((a, b) => a - b);
  const vLines = [...new Set(verticalLines)]
    .filter(line => line > 0 && line < 1)
    .sort((a, b) => a - b);

  // 计算切片边界
  const hPoints = [0, ...hLines, 1];
  const vPoints = [0, ...vLines, 1];

  const rows = hPoints.length - 1;
  const cols = vPoints.length - 1;

  const inputBaseName = baseNameOverride || path.parse(inputPath).name;
  const results: GridResult['grid'] = [];

  await fs.mkdir(outputDir, { recursive: true });

  let tileIndex = 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 严格按照比例映射到原图像素坐标
      const top = Math.floor(hPoints[row] * height);
      const bottom = Math.floor(hPoints[row + 1] * height);
      const left = Math.floor(vPoints[col] * width);
      const right = Math.floor(vPoints[col + 1] * width);

      const tileWidth = right - left;
      const tileHeight = bottom - top;

      // 避免无效切片
      if (tileWidth <= 0 || tileHeight <= 0) continue;

      const rawName = `${inputBaseName}_切图${tileIndex}`;
      const outName = generateFileName(outputDir, rawName, {
        extension: maxSizeKB > 0 ? '.jpg' : '.png',
        reserveSuffixSpace: 5,
      });
      const outputPath = path.join(outputDir, outName);

      if (maxSizeKB > 0) {
        // 只有在明确要求限制文件大小时才进行 JPG 压缩
        const targetSizeBytes = maxSizeKB * 1024;
        let quality: number = SHARP_CONSTANTS.DEFAULT_QUALITY;
        let buffer: Buffer = Buffer.alloc(0);
        let iteration = 0;

        const tileSharp = sharp(inputPath).extract({
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
          index: tileIndex,
          outputPath,
          position: { row: row + 1, col: col + 1 },
          size: { width: tileWidth, height: tileHeight },
          fileSize: buffer.length,
        });
      } else {
        // 默认模式：直接 1:1 提取并保存为 PNG (绝对无损)
        await sharp(inputPath)
          .extract({ left, top, width: tileWidth, height: tileHeight })
          .png()
          .toFile(outputPath);

        results.push({
          index: tileIndex,
          outputPath,
          position: { row: row + 1, col: col + 1 },
          size: { width: tileWidth, height: tileHeight },
        });
      }
      
      tileIndex++;
    }
  }

  return {
    success: true,
    grid: results,
    originalSize: { width, height },
    tileSize: { width: 0, height: 0 },
  };
}
