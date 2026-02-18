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

    const logoSizeOn800 = Math.floor(logoOriginalSize * logoScale);
    const finalLogoSize = Math.min(logoSizeOn800, SHARP_CONSTANTS.MAX_LOGO_SIZE) * 3;

    logoMasterPath = path.join(masterTmpDir, `${inputBaseName}_master_logo.png`);

    // 判断是否使用自定义位置
    const useCustomPosition = logoPosition &&
      (logoPosition.x !== SHARP_CONSTANTS.DEFAULT_LOGO_POSITION.x ||
       logoPosition.y !== SHARP_CONSTANTS.DEFAULT_LOGO_POSITION.y);

    const logoBuffer = await sharp(logoPath)
      .resize(finalLogoSize, finalLogoSize, { fit: 'inside' })
      .toBuffer();

    const compositeOptions = useCustomPosition
      ? {
          input: logoBuffer,
          left: Math.round(logoPosition!.x * 3),
          top: Math.round(logoPosition!.y * 3),
          blend: 'over' as const,
        }
      : {
          input: logoBuffer,
          gravity: 'southeast' as const,
          blend: 'over' as const,
        };

    await sharp(masterPath)
      .composite([compositeOptions])
      .png()
      .toFile(logoMasterPath);
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
