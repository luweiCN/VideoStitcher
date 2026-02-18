/**
 * 封面格式转换模块
 * 将图片转换为适合作为封面的尺寸
 */

import sharp from 'sharp';
import path from 'path';
import { SHARP_CONSTANTS, type ConvertResult, type ThreadsConfig } from './types';
import { generateFileName } from '@shared/utils/fileNameHelper';

/**
 * 封面尺寸配置
 */
const COVER_SIZES = {
  square: { width: 800, height: 800, suffix: '_800x800' },
  landscape: { width: 1920, height: 1080, suffix: '_1920x1080' },
  portrait: { width: 1080, height: 1920, suffix: '_1080x1920' },
} as const;

/**
 * 判断图片类型
 */
function getImageType(width?: number, height?: number): 'square' | 'landscape' | 'portrait' {
  const w = width || 1;
  const h = height || 1;
  const ratio = w / h;

  if (ratio >= 0.9 && ratio <= 1.1) {
    return 'square';
  }
  return w >= h ? 'landscape' : 'portrait';
}

/**
 * 封面格式转换服务
 *
 * @param inputPath 输入图片路径
 * @param quality JPEG 质量，默认 90
 * @param outputDir 输出目录，默认原图目录
 * @param threads 线程数，默认自动
 */
export async function convertCoverFormat(
  inputPath: string,
  quality: number = SHARP_CONSTANTS.DEFAULT_QUALITY,
  outputDir: string | null = null,
  threads?: number
): Promise<ConvertResult> {
  // 设置 Sharp 并发数
  if (threads) {
    sharp.concurrency(threads);
  }
  
  const metadata = await sharp(inputPath).metadata();
  const imageType = getImageType(metadata.width, metadata.height);

  const sizeConfig = COVER_SIZES[imageType];
  const { width: targetWidth, height: targetHeight, suffix } = sizeConfig;

  const inputBaseName = path.parse(inputPath).name;
  const inputExt = path.parse(inputPath).ext;
  const targetDir = outputDir || path.dirname(inputPath);

  const uniqueFileName = generateFileName(targetDir, inputBaseName, {
    suffix,
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
