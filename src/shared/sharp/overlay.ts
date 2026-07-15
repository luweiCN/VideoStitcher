/**
 * 贴片生成器高清导出。
 * 所有成品都基于原始文件重新解码和裁切，不使用预览 Canvas 截图。
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  OVERLAY_CANVAS_HEIGHT,
  OVERLAY_CANVAS_WIDTH,
  OVERLAY_VIDEO_HEIGHT,
  clampOverlayVideoY,
  type OverlayGeneratorTaskConfig,
  type OverlayRegionConfig,
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
function createCheckerboardSvg(): Buffer {
  const size = 48;
  return Buffer.from(`
    <svg width="${OVERLAY_CANVAS_WIDTH}" height="${OVERLAY_CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
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

/** 从上下素材文件名生成默认成品基础名。 */
function getOverlayBaseName(config: OverlayGeneratorTaskConfig): string {
  const topName = path.parse(config.top.sourcePath).name;
  const bottomName = path.parse(config.bottom.sourcePath).name;
  return config.sameSource || config.top.sourcePath === config.bottom.sourcePath
    ? topName
    : `${topName}_${bottomName}`;
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

    const videoY = clampOverlayVideoY(config.videoY);
    const bottomHeight = OVERLAY_CANVAS_HEIGHT - videoY - OVERLAY_VIDEO_HEIGHT;
    if (config.top.cropArea.width !== OVERLAY_CANVAS_WIDTH || config.top.cropArea.height !== videoY) {
      throw new Error('上半部分裁切区域与横版区域位置不一致');
    }
    if (config.bottom.cropArea.width !== OVERLAY_CANVAS_WIDTH || config.bottom.cropArea.height !== bottomHeight) {
      throw new Error('下半部分裁切区域与横版区域位置不一致');
    }
    if (!Object.values(config.exportOptions).some(Boolean)) {
      throw new Error('请至少选择一种导出选项');
    }

    onLog?.('正在从原始图片渲染上半部分');
    onProgress?.(10, '渲染上半部分');
    const topBuffer = videoY > 0 ? await renderRegion(config.top) : null;
    if (isCancelled?.()) throw new Error('任务已取消');

    onLog?.('正在从原始图片渲染下半部分');
    onProgress?.(45, '渲染下半部分');
    const bottomBuffer = bottomHeight > 0 ? await renderRegion(config.bottom) : null;
    if (isCancelled?.()) throw new Error('任务已取消');

    const layers: sharp.OverlayOptions[] = [];
    if (topBuffer) layers.push({ input: topBuffer, top: 0, left: 0 });
    if (bottomBuffer) {
      layers.push({
        input: bottomBuffer,
        top: videoY + OVERLAY_VIDEO_HEIGHT,
        left: 0,
      });
    }

    const transparentCanvas = await sharp({
      create: {
        width: OVERLAY_CANVAS_WIDTH,
        height: OVERLAY_CANVAS_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(layers)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    onProgress?.(70, '写入贴片文件');
    const outputs: Array<{ path: string; type: 'image' }> = [];
    const baseName = getOverlayBaseName(config);

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
      await writeOutput('_贴片', transparentCanvas);
    }
    if (config.exportOptions.solidPreview) {
      const solidPreview = await sharp({
        create: {
          width: OVERLAY_CANVAS_WIDTH,
          height: OVERLAY_CANVAS_HEIGHT,
          channels: 4,
          background: { r: 15, g: 23, b: 42, alpha: 1 },
        },
      }).composite([{ input: transparentCanvas, top: 0, left: 0 }]).png().toBuffer();
      await writeOutput('_贴片_纯色预览', solidPreview);
    }
    if (config.exportOptions.checkerPreview) {
      const checkerPreview = await sharp(createCheckerboardSvg())
        .composite([{ input: transparentCanvas, top: 0, left: 0 }])
        .png()
        .toBuffer();
      await writeOutput('_贴片_棋盘格预览', checkerPreview);
    }
    if (config.exportOptions.topOnly && topBuffer) {
      await writeOutput('_贴片_上半部分', topBuffer);
    }
    if (config.exportOptions.bottomOnly && bottomBuffer) {
      await writeOutput('_贴片_下半部分', bottomBuffer);
    }
    if (outputs.length === 0) {
      throw new Error('所选导出区域高度为 0，没有生成任何文件');
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
