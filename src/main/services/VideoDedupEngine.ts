import fs from 'fs';
import path from 'path';
import { getVideoMetadata, runFfmpeg } from '@shared/ffmpeg';
import { generateFileName } from '@shared/utils/fileNameHelper';
import { SafeOutput } from '@shared/utils/safeOutput';
import {
  DEFAULT_GREEN_SCREEN_RECIPE,
  buildVideoDedupSchedule,
  validateVideoDedupSchedule,
  type GreenScreenRecipe,
  type VideoDedupEvent,
  type VideoDedupExecutionResult,
  type VideoDedupPosition,
  type VideoDedupTaskConfig,
} from '@shared/videoDedup';
import type { Task } from '@shared/types/task';

type LogCallback = (message: string) => void;
type PidCallback = (pid: number) => void;
type ProgressCallback = (progress: number, step: string) => void;

const formatNumber = (value: number): string => Number(value.toFixed(3)).toString();

function parseFfmpegTime(log: string): number | null {
  const matches = [...log.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  const match = matches[matches.length - 1];
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function getPositionExpression(event: VideoDedupEvent): { x: string; y: string } {
  if (Number.isFinite(event.x) && Number.isFinite(event.y)) {
    const x = Math.min(1, Math.max(0, event.x as number));
    const y = Math.min(1, Math.max(0, event.y as number));
    return {
      x: `main_w*${formatNumber(x)}-overlay_w/2`,
      y: `main_h*${formatNumber(y)}-overlay_h/2`,
    };
  }

  const position = event.position;
  const marginX = 'main_w*0.035';
  const marginY = 'main_h*0.035';
  switch (position) {
    case 'top_right':
      return { x: `main_w-overlay_w-${marginX}`, y: marginY };
    case 'bottom_left':
      return { x: marginX, y: `main_h-overlay_h-${marginY}` };
    case 'bottom_right':
      return { x: `main_w-overlay_w-${marginX}`, y: `main_h-overlay_h-${marginY}` };
    case 'top_left':
    default:
      return { x: marginX, y: marginY };
  }
}

function colorToFfmpeg(color: string): string {
  return `0x${color.replace('#', '').toUpperCase()}`;
}

function normalizeRecipe(recipe?: GreenScreenRecipe): GreenScreenRecipe {
  return recipe || DEFAULT_GREEN_SCREEN_RECIPE;
}

function buildElementFilter(
  inputIndex: number,
  event: VideoDedupEvent,
  targetWidth: number,
): string {
  const duration = formatNumber(event.duration);
  const start = formatNumber(event.start);
  const commonFilters = [
    `fps=30`,
    `scale=${targetWidth}:-2:force_original_aspect_ratio=decrease`,
    `trim=duration=${duration}`,
    `setpts=PTS-STARTPTS+${start}/TB`,
  ];

  if (event.elementType === 'green_video') {
    const recipe = normalizeRecipe(event.recipe);
    const similarity = Math.max(0.00001, recipe.similarity / 100);
    const blend = Math.max(0, recipe.edgeSoftness / 100);
    const spill = Math.max(0, recipe.spillSuppression / 100);
    return `[${inputIndex}:v]chromakey=${colorToFfmpeg(recipe.keyColor)}:${formatNumber(similarity)}:${formatNumber(blend)},despill=green:mix=${formatNumber(spill)},format=rgba,${commonFilters.join(',')}[element${event.index}]`;
  }

  return `[${inputIndex}:v]format=rgba,${commonFilters.join(',')}[element${event.index}]`;
}

function buildFilterComplex(
  events: VideoDedupEvent[],
  sourceWidth: number,
  elementScale: number,
  previewMode: boolean,
): string {
  const renderWidth = previewMode ? Math.min(960, sourceWidth) : sourceWidth;
  const sourceFilter = previewMode && renderWidth < sourceWidth
    ? `[0:v]scale=${renderWidth}:-2:force_original_aspect_ratio=decrease,setpts=PTS-STARTPTS[base0]`
    : '[0:v]setpts=PTS-STARTPTS[base0]';
  const filters: string[] = [sourceFilter];
  events.forEach((event, index) => {
    const eventScale = event.scale ?? elementScale;
    const targetWidth = Math.max(64, Math.round(
      renderWidth * Math.min(0.5, Math.max(0.05, eventScale)),
    ));
    filters.push(buildElementFilter(index + 1, event, targetWidth));
    const position = getPositionExpression(event);
    const start = formatNumber(event.start);
    const end = formatNumber(event.end);
    filters.push(
      `[base${index}][element${index}]overlay=x=${position.x}:y=${position.y}:enable=between(t\\,${start}\\,${end}):eof_action=pass:repeatlast=0:shortest=0[base${index + 1}]`,
    );
  });

  filters.push(`[base${events.length}]format=yuv420p[outv]`);
  return filters.join(';');
}

function buildInputArgs(sourcePath: string, events: VideoDedupEvent[]): string[] {
  const args = ['-y', '-i', sourcePath];
  for (const event of events) {
    if (event.elementType === 'image') {
      args.push('-loop', '1', '-framerate', '30', '-i', event.elementPath);
    } else {
      // GIF 和绿幕视频在短于素材事件时循环播放，以覆盖完整事件时长。
      args.push('-stream_loop', '-1', '-i', event.elementPath);
    }
  }
  return args;
}

function validateTaskConfig(config: VideoDedupTaskConfig): void {
  const hasPresetEvents = Array.isArray(config?.events) && config.events.length > 0;
  if (!config || (!hasPresetEvents && (!Array.isArray(config.elements) || config.elements.length === 0))) {
    throw new Error('任务中没有可用的变体元素');
  }
  if (!config.positions || config.positions.length === 0) {
    throw new Error('至少需要启用一个画面位置');
  }
  const elementPaths = hasPresetEvents
    ? config.events!.map((event) => event.elementPath)
    : config.elements.map((element) => element.path);
  for (const elementPath of elementPaths) {
    if (!fs.existsSync(elementPath)) {
      throw new Error(`变体元素不存在: ${elementPath}`);
    }
  }
}

export async function executeVideoDedupTask(
  task: Task,
  onLog?: LogCallback,
  onPid?: PidCallback,
  onProgress?: ProgressCallback,
  threads: number = 4,
): Promise<VideoDedupExecutionResult> {
  const sourceFile = task.files?.find((file) => file.category === 'source') || task.files?.[0];
  if (!sourceFile?.path || !fs.existsSync(sourceFile.path)) {
    return { success: false, error: '原视频不存在' };
  }
  if (!task.outputDir) {
    return { success: false, error: '未设置输出目录' };
  }

  const config = task.config as unknown as VideoDedupTaskConfig;
  const safeOutput = new SafeOutput(task.outputDir, 'video_dedup');

  try {
    validateTaskConfig(config);
    fs.mkdirSync(task.outputDir, { recursive: true });
    onProgress?.(2, '读取原视频信息');
    const metadata = await getVideoMetadata(sourceFile.path);
    const events = config.events?.length
      ? config.events
      : buildVideoDedupSchedule(metadata.duration, config.elements, config);
    if (!validateVideoDedupSchedule(events, config.minimumGap)) {
      throw new Error('元素排程未通过单轨防重叠校验');
    }
    const rangeStart = Math.max(0, config.skipHead);
    const rangeEnd = metadata.duration - Math.max(0, config.skipTail);
    if (events.some((event) => event.start < rangeStart - 0.001 || event.end > rangeEnd + 0.001)) {
      throw new Error('元素事件超出允许的有效时间范围');
    }

    const sourceName = path.parse(sourceFile.path).name;
    const variantIndex = Math.max(1, config.variantIndex || 1);
    const outputSuffix = config.previewMode ? `预览_${variantIndex}` : `变体_${variantIndex}`;
    const filename = generateFileName(task.outputDir, `${sourceName}_${outputSuffix}`, {
      extension: '.mp4',
      reserveSuffixSpace: 5,
    });
    const tempPath = safeOutput.getTempOutputPath(filename, task.id);
    const filterComplex = buildFilterComplex(
      events,
      metadata.width,
      config.elementScale || 0.22,
      Boolean(config.previewMode),
    );
    const args = [
      ...buildInputArgs(sourceFile.path, events),
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', config.previewMode ? 'ultrafast' : 'medium',
      '-crf', config.previewMode ? '28' : '18',
      '-threads', String(Math.max(1, threads)),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', formatNumber(metadata.duration),
      '-movflags', '+faststart',
      tempPath,
    ];

    onLog?.(`已生成 ${events.length} 个元素事件，随机种子: ${config.randomSeed}`);
    events.forEach((event) => {
      onLog?.(
        `元素 ${event.index + 1}: ${path.basename(event.elementPath)}，${event.start.toFixed(1)}-${event.end.toFixed(1)} 秒，位置 ${event.position}`,
      );
    });
    onProgress?.(5, '开始合成视频变体');

    let lastProgress = 5;
    await runFfmpeg(
      args,
      (log) => {
        const currentTime = parseFfmpegTime(log);
        if (currentTime !== null && metadata.duration > 0) {
          const progress = Math.min(98, Math.max(5, Math.round((currentTime / metadata.duration) * 93 + 5)));
          if (progress > lastProgress) {
            lastProgress = progress;
            onProgress?.(progress, '正在合成视频变体');
          }
        }
      },
      onPid,
    );

    onProgress?.(99, '正在保存输出文件');
    const commitResult = safeOutput.commitSync(tempPath);
    safeOutput.cleanup(task.id);
    if (!commitResult.success || !commitResult.finalPath) {
      throw new Error(commitResult.error || '保存输出文件失败');
    }

    onProgress?.(100, '处理完成');
    return { success: true, outputPath: commitResult.finalPath, events };
  } catch (error) {
    safeOutput.cleanup(task.id);
    return { success: false, error: (error as Error).message };
  }
}
