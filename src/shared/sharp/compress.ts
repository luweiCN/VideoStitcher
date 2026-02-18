/**
 * 图片压缩模块
 * 将图片压缩到目标大小
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { SHARP_CONSTANTS, type CompressResult, type ThreadsConfig } from './types';
import { generateFileName } from '@shared/utils/fileNameHelper';

/**
 * 辅助函数：生成压缩后的图片缓冲区
 */
async function compressToBuffer(
  inputPath: string,
  width: number,
  height: number,
  quality: number,
  scale: number
): Promise<Buffer> {
  return sharp(inputPath)
    .resize(Math.round(width * scale), Math.round(height * scale), {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, progressive: true })
    .toBuffer();
}

/**
 * 辅助函数：计算最佳压缩参数（二分查找）
 */
async function findOptimalCompression(
  inputPath: string,
  width: number,
  height: number,
  targetSizeBytes: number
): Promise<{ buffer: Buffer; quality: number; scale: number }> {
  let quality = SHARP_CONSTANTS.DEFAULT_QUALITY;
  let scale = 1.0;

  for (let iteration = 0; iteration < SHARP_CONSTANTS.MAX_ITERATIONS; iteration++) {
    const buffer = await compressToBuffer(inputPath, width, height, quality, scale);

    if (buffer.length <= targetSizeBytes) {
      return { buffer, quality, scale };
    }

    // 调整参数
    if (quality > 50) {
      quality -= 10;
    } else {
      scale *= 0.85;
    }
  }

  // 最后一次尝试
  const finalBuffer = await compressToBuffer(inputPath, width, height, quality, scale);
  return { buffer: finalBuffer, quality, scale };
}

/**
 * 图片压缩服务
 *
 * @param inputPath 输入图片路径
 * @param targetSizeKB 目标大小（KB），默认 380KB
 * @param outputDir 输出目录，默认原图目录
 * @param threads 线程数，默认自动
 */
export async function compressImage(
  inputPath: string,
  targetSizeKB: number = SHARP_CONSTANTS.TARGET_SIZE_KB,
  outputDir: string | null = null,
  threads?: number
): Promise<CompressResult> {
  // 设置 Sharp 并发数
  if (threads) {
    sharp.concurrency(threads);
  }
  
  const targetSizeBytes = targetSizeKB * 1024;
  const stats = await fs.stat(inputPath);

  const targetDir = outputDir || path.dirname(inputPath);

  // 文件已经小于目标大小，直接复制
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

  // 需要压缩
  const inputBaseName = path.parse(inputPath).name;
  const uniqueFileName = generateFileName(targetDir, inputBaseName, {
    suffix: '_compressed',
    extension: '.jpg',
    reserveSuffixSpace: 5,
  });
  const outputPath = path.join(targetDir, uniqueFileName);

  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 800;

  const { buffer, quality, scale } = await findOptimalCompression(
    inputPath,
    width,
    height,
    targetSizeBytes
  );

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
