/**
 * 图片处理子进程
 * 
 * 用于在独立进程中执行 Sharp 图片处理任务
 * 优点：
 * 1. 可以获取独立的 PID 用于监控 CPU/内存
 * 2. 可以通过 kill 取消任务
 * 3. 不阻塞主进程
 */

import sharp from 'sharp';
import { processImageMaterial, convertCoverFormat } from '@shared/sharp';
import type { PreviewFitMode, LogoPosition, ExportOptions } from '@shared/sharp/types';

interface ImageMaterialTask {
  taskId: number;
  imagePath: string;
  logoPath: string | null;
  outputDir: string;
  previewSize: PreviewFitMode;
  logoPosition: LogoPosition | null;
  logoScale: number;
  exportOptions: ExportOptions;
}

interface CoverFormatTask {
  taskType: 'cover_format';
  taskId: number;
  imagePath: string;
  outputDir: string;
  quality: number;
}

type WorkerTask = ImageMaterialTask | CoverFormatTask;

interface TaskResult {
  success: boolean;
  outputs?: { path: string; type: 'image' }[];
  error?: string;
}

// 从环境变量读取线程数配置
const threadsFromEnv = process.env.SHARP_THREADS;
if (threadsFromEnv) {
  const threads = parseInt(threadsFromEnv, 10);
  if (!isNaN(threads) && threads > 0) {
    sharp.concurrency(threads);
    console.log(`[imageWorker] 设置 Sharp 并发数: ${threads}`);
  }
}

// 监听父进程消息
process.on('message', async (task: WorkerTask) => {
  // 封面格式转换任务
  if ('taskType' in task && task.taskType === 'cover_format') {
    await handleCoverFormatTask(task);
    return;
  }

  // 图片素材处理任务
  await handleImageMaterialTask(task as ImageMaterialTask);
});

/**
 * 处理封面格式转换任务
 */
async function handleCoverFormatTask(task: CoverFormatTask): Promise<void> {
  const { taskId, imagePath, outputDir, quality } = task;

  try {
    sendLog(taskId, 'info', `处理图片: ${getFileName(imagePath)}`);

    const result = await convertCoverFormat(imagePath, quality, outputDir);

    if (result.success && result.outputPath) {
      sendResult(taskId, {
        success: true,
        outputs: [{ path: result.outputPath, type: 'image' }],
      });
    } else {
      sendResult(taskId, { success: false, error: '处理失败' });
    }
  } catch (err) {
    const error = err as Error;
    sendResult(taskId, { success: false, error: error.message });
  }
}

/**
 * 处理图片素材任务
 */
async function handleImageMaterialTask(task: ImageMaterialTask): Promise<void> {
  const { taskId, imagePath, logoPath, outputDir, previewSize, logoPosition, logoScale, exportOptions } = task;

  try {
    sendLog(taskId, 'info', `处理图片: ${getFileName(imagePath)}`);

    const result = await processImageMaterial(
      imagePath,
      logoPath,
      outputDir,
      previewSize,
      logoPosition,
      logoScale,
      exportOptions
    );

    if (result.success) {
      const outputs: { path: string; type: 'image' }[] = [];
      
      if (result.results.logo) {
        outputs.push({ path: result.results.logo, type: 'image' });
      }
      
      if (result.results.grid && result.results.grid.grid) {
        for (const tile of result.results.grid.grid) {
          outputs.push({ path: tile.outputPath, type: 'image' });
        }
      }

      sendResult(taskId, { success: true, outputs });
    } else {
      sendResult(taskId, { success: false, error: '处理失败' });
    }
  } catch (err) {
    const error = err as Error;
    sendResult(taskId, { success: false, error: error.message });
  }
}

/**
 * 获取文件名
 */
function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
}

// 发送日志给父进程
function sendLog(taskId: number, level: 'info' | 'error' | 'warn', message: string) {
  if (process.send) {
    process.send({ type: 'log', taskId, level, message });
  }
}

// 发送结果给父进程
function sendResult(taskId: number, result: TaskResult) {
  if (process.send) {
    process.send({ type: 'result', taskId, result });
  }
}

// 通知父进程已准备好
if (process.send) {
  process.send({ type: 'ready' });
}
