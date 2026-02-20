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
import { processImageMaterial } from '@shared/sharp';
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
process.on('message', async (task: ImageMaterialTask) => {
  const { taskId, imagePath, logoPath, outputDir, previewSize, logoPosition, logoScale, exportOptions } = task;

  try {
    // 发送开始日志
    sendLog(taskId, 'info', `处理图片: ${imagePath.split('/').pop() || imagePath.split('\\').pop() || imagePath}`);

    // 执行图片处理
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
      
      // 单图输出
      if (result.results.logo) {
        outputs.push({ path: result.results.logo, type: 'image' });
      }
      
      // 九宫格输出
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
});

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
