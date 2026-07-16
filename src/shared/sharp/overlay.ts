/**
 * 贴片生成器高清导出。
 * 所有成品都基于原始文件重新解码和裁切，不使用预览 Canvas 截图。
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  clampOverlayPosition,
  getOverlayModeConfig,
  getOverlayRegionRect,
  type OverlayGeneratorTaskConfig,
  type OverlayRegionConfig,
  type OverlayTemplateMode,
} from '@shared/overlay';
import { generateFileName } from '@shared/utils/fileNameHelper';
import { SafeOutput } from '@shared/utils/safeOutput';

export interface OverlayRenderResult {
  success: boolean;
  outputs?: Array<{ path: string; type: 'image' }>;
  error?: string;
}

interface OverlayRenderCallbacks {
  onLog?: (message: string) => void;
  onProgress?: (progress: number, step: string) => void;
  isCancelled?: () => boolean;
}

interface ResolvedOverlayGeneratorConfig {
  mode: OverlayTemplateMode;
  position: number;
  first: OverlayRegionConfig;
  second: OverlayRegionConfig;
}

/** 解析新旧任务字段；缺少模式的历史任务固定回退为竖版。 */
export function resolveOverlayGeneratorConfig(
  config: OverlayGeneratorTaskConfig,
): ResolvedOverlayGeneratorConfig {
  const mode: OverlayTemplateMode = config.mode === 'landscape' ? 'landscape' : 'portrait';
  const modeConfig = getOverlayModeConfig(mode);
  const rawPosition = mode === 'landscape'
    ? config.position ?? config.videoX ?? modeConfig.centerPosition
    : config.position ?? config.videoY ?? modeConfig.centerPosition;
  const first = config.first ?? (mode === 'landscape' ? config.left : config.top);
  const second = config.second ?? (mode === 'landscape' ? config.right : config.bottom);

  if (!first || !second) {
    throw new Error(`${modeConfig.firstLabel}或${modeConfig.secondLabel}裁切配置缺失`);
  }

  return {
    mode,
    position: clampOverlayPosition(rawPosition, mode),
    first,
    second,
  };
}

/** 检查缩放后的图片是否完整覆盖裁切区域。 */
export function isOverlayRegionCovered(region: OverlayRegionConfig): boolean {
  const { sourceWidth, sourceHeight, cropArea, transform } = region;
  const renderedWidth = Math.round(sourceWidth * transform.scale);
  const renderedHeight = Math.round(sourceHeight * transform.scale);
  const x = Math.round(transform.x);
  const y = Math.round(transform.y);

  return (
    transform.scale > 0 &&
    cropArea.width > 0 &&
    cropArea.height > 0 &&
    x <= 0 &&
    y <= 0 &&
    x + renderedWidth >= cropArea.width &&
    y + renderedHeight >= cropArea.height
  );
}

/** 根据原图和记录的缩放、位移参数渲染一个裁切区域。 */
async function renderRegion(region: OverlayRegionConfig): Promise<Buffer> {
  if (!fs.existsSync(region.sourcePath)) {
    throw new Error(`素材文件不存在: ${region.sourcePath}`);
  }
  if (!isOverlayRegionCovered(region)) {
    throw new Error('当前图片未完全覆盖裁切区域，请先使用自动填充');
  }

  const renderedWidth = Math.max(1, Math.round(region.sourceWidth * region.transform.scale));
  const renderedHeight = Math.max(1, Math.round(region.sourceHeight * region.transform.scale));
  const extractLeft = Math.max(0, -Math.round(region.transform.x));
  const extractTop = Math.max(0, -Math.round(region.transform.y));

  return sharp(region.sourcePath, { failOn: 'error' })
    .rotate()
    .resize(renderedWidth, renderedHeight, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .extract({
      left: extractLeft,
      top: extractTop,
      width: region.cropArea.width,
      height: region.cropArea.height,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

/** 生成用于预览导出的棋盘格背景。 */
function createCheckerboardSvg(width: number, height: number): Buffer {
  const size = 48;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="checker" width="${size * 2}" height="${size * 2}" patternUnits="userSpaceOnUse">
          <rect width="${size * 2}" height="${size * 2}" fill="#E2E8F0"/>
          <rect width="${size}" height="${size}" fill="#FFFFFF"/>
          <rect x="${size}" y="${size}" width="${size}" height="${size}" fill="#FFFFFF"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#checker)"/>
    </svg>
  `);
}

/** 从透明窗口两侧素材文件名生成默认成品基础名。 */
function getOverlayBaseName(
  config: OverlayGeneratorTaskConfig,
  first: OverlayRegionConfig,
  second: OverlayRegionConfig,
): string {
  const firstName = path.parse(first.sourcePath).name;
  const secondName = path.parse(second.sourcePath).name;
  return config.sameSource || first.sourcePath === second.sourcePath
    ? firstName
    : `${firstName}_${secondName}`;
}

/**
 * 渲染并安全写入一项贴片任务。
 */
export async function renderOverlayGeneratorTask(
  config: OverlayGeneratorTaskConfig,
  outputDir: string,
  callbacks: OverlayRenderCallbacks = {},
): Promise<OverlayRenderResult> {
  const { onLog, onProgress, isCancelled } = callbacks;
  const safeOutput = new SafeOutput(outputDir, 'overlay_generator');

  try {
    if (!outputDir) throw new Error('未设置输出目录');
    if (!fs.existsSync(outputDir)) throw new Error('输出目录不存在');
    await fs.promises.access(outputDir, fs.constants.W_OK);

    const resolved = resolveOverlayGeneratorConfig(config);
    const modeConfig = getOverlayModeConfig(resolved.mode);
    const firstRect = getOverlayRegionRect(resolved.position, 'first', resolved.mode);
    const secondRect = getOverlayRegionRect(resolved.position, 'second', resolved.mode);
    if (
      resolved.first.cropArea.width !== firstRect.width ||
      resolved.first.cropArea.height !== firstRect.height
    ) {
      throw new Error(`${modeConfig.firstLabel}裁切区域与透明窗口位置不一致`);
    }
    if (
      resolved.second.cropArea.width !== secondRect.width ||
      resolved.second.cropArea.height !== secondRect.height
    ) {
      throw new Error(`${modeConfig.secondLabel}裁切区域与透明窗口位置不一致`);
    }
    if (!Object.values(config.exportOptions).some(Boolean)) {
      throw new Error('请至少选择一种导出选项');
    }

    onLog?.(`正在从原始图片渲染${modeConfig.firstLabel}`);
    onProgress?.(10, `渲染${modeConfig.firstLabel}`);
    const firstBuffer = firstRect.width > 0 && firstRect.height > 0
      ? await renderRegion(resolved.first)
      : null;
    if (isCancelled?.()) throw new Error('任务已取消');

    onLog?.(`正在从原始图片渲染${modeConfig.secondLabel}`);
    onProgress?.(45, `渲染${modeConfig.secondLabel}`);
    const secondBuffer = secondRect.width > 0 && secondRect.height > 0
      ? await renderRegion(resolved.second)
      : null;
    if (isCancelled?.()) throw new Error('任务已取消');

    const layers: sharp.OverlayOptions[] = [];
    if (firstBuffer) {
      layers.push({ input: firstBuffer, top: firstRect.y, left: firstRect.x });
    }
    if (secondBuffer) {
      layers.push({
        input: secondBuffer,
        top: secondRect.y,
        left: secondRect.x,
      });
    }

    const transparentCanvas = await sharp({
      create: {
        width: modeConfig.canvasWidth,
        height: modeConfig.canvasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(layers)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    onProgress?.(70, '写入贴片文件');
    const outputs: Array<{ path: string; type: 'image' }> = [];
    const baseName = getOverlayBaseName(config, resolved.first, resolved.second);

    const writeOutput = async (suffix: string, buffer: Buffer) => {
      if (isCancelled?.()) throw new Error('任务已取消');
      const filename = generateFileName(outputDir, baseName, {
        suffix,
        extension: '.png',
        reserveSuffixSpace: 12,
      });
      const tempPath = safeOutput.getTempOutputPath(filename, config.sourceTaskId);
      await fs.promises.writeFile(tempPath, buffer);
      const committed = await safeOutput.commit(tempPath);
      if (!committed.success || !committed.finalPath) {
        throw new Error(committed.error || '写入输出文件失败');
      }
      outputs.push({ path: committed.finalPath, type: 'image' });
    };

    if (config.exportOptions.transparentPng) {
      await writeOutput(`_${modeConfig.outputSuffix}`, transparentCanvas);
    }
    if (config.exportOptions.solidPreview) {
      const solidPreview = await sharp({
        create: {
          width: modeConfig.canvasWidth,
          height: modeConfig.canvasHeight,
          channels: 4,
          background: { r: 15, g: 23, b: 42, alpha: 1 },
        },
      }).composite([{ input: transparentCanvas, top: 0, left: 0 }]).png().toBuffer();
      await writeOutput(`_${modeConfig.outputSuffix}_纯色预览`, solidPreview);
    }
    if (config.exportOptions.checkerPreview) {
      const checkerPreview = await sharp(createCheckerboardSvg(modeConfig.canvasWidth, modeConfig.canvasHeight))
        .composite([{ input: transparentCanvas, top: 0, left: 0 }])
        .png()
        .toBuffer();
      await writeOutput(`_${modeConfig.outputSuffix}_棋盘格预览`, checkerPreview);
    }
    if (config.exportOptions.topOnly && firstBuffer) {
      await writeOutput(`_${modeConfig.outputSuffix}_${modeConfig.firstLabel}`, firstBuffer);
    }
    if (config.exportOptions.bottomOnly && secondBuffer) {
      await writeOutput(`_${modeConfig.outputSuffix}_${modeConfig.secondLabel}`, secondBuffer);
    }
    if (outputs.length === 0) {
      throw new Error('所选导出区域尺寸为 0，没有生成任何文件');
    }

    onProgress?.(100, '处理完成');
    onLog?.(`贴片导出完成，共生成 ${outputs.length} 个文件`);
    return { success: true, outputs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  } finally {
    safeOutput.cleanupAll();
  }
}
