/**
 * 视频处理 IPC 处理器
 * 扩展现有的视频处理功能, 支持 VideoMaster 的所有视频模式
 */

import { ipcMain, IpcMainInvokeEvent, app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile, spawn } from 'child_process';
import crypto from 'crypto';
import { runFfmpeg, getFfmpegPath, buildStitchCommand, buildMergeCommand, TaskQueue, generatePreviews, cleanupPreviews, buildArgs as buildResizeArgs, RESIZE_CONFIGS } from '@shared/ffmpeg';
import { generateFileName } from '@shared/utils/fileNameHelper';
import { SafeOutput } from '@shared/utils/safeOutput';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

interface VideoDimensions {
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait' | 'square';
  aspectRatio: string;
  duration: number;
}

interface VideoFullInfo {
  success: boolean;
  path: string;
  name: string;
  thumbnail: string | null;
  previewUrl: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  orientation: string | null;
  aspectRatio: string | null;
  error?: string;
}

interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TaskFile {
  path: string;
  index: number;
  category: string;
  category_name: string;
}

interface Task {
  id: string;
  status: string;
  files: TaskFile[];
  config: { orientation: string; aPosition?: Position; bPosition?: Position; bgPosition?: Position; coverPosition?: Position };
  outputDir: string;
  concurrency: number;
}

interface HorizontalMergeConfig {
  aVideos?: string[];
  bVideos: string[];
  bgImage?: string;
  coverImages?: string[];
  outputDir: string;
  concurrency?: number;
  aPosition?: Position;
  bPosition?: Position;
  bPositions?: Position[];
  bgPosition?: Position;
  coverPosition?: Position;
}

interface VerticalMergeConfig {
  mainVideos: string[];
  bgImage?: string;
  aVideos?: string[];
  coverImages?: string[];
  outputDir: string;
  concurrency?: number;
  aPosition?: Position;
  bPosition?: Position;
  bPositions?: Position[];
  bgPosition?: Position;
  coverPosition?: Position;
}

interface ResizeConfig {
  videos: Array<{ path: string; id: string }>;
  mode: string;
  blurAmount: number;
  outputDir: string;
  concurrency?: number;
}

/**
 * 获取 FFprobe 可执行文件路径
 * 打包后需要特殊处理路径
 */
function getFfprobePath(): string {
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath;
    const platform = process.platform;
    const arch = process.arch;
    let subdir: string;
    if (platform === 'win32') {
      subdir = 'win32-x64';
    } else if (platform === 'darwin') {
      subdir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    } else {
      subdir = 'linux-x64';
    }

    const unpackedPath = path.join(
      resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@ffprobe-installer',
      subdir,
    );

    const ffprobeBin = platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    return path.join(unpackedPath, ffprobeBin);
  }

  return ffprobeInstaller.path;
}

// 创建任务队列
const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

/**
 * 根据用户规则生成输出文件名
 */
function getSmartMergedBaseName(bName: string, index: number, suffix: string, aName?: string): string {
  const separator = '-';
  const parts = bName.split(separator);

  if (parts.length > 7) {
    const newParts = [...parts];
    newParts[1] = 'D';
    newParts[7] = '软件合成' + newParts[7];
    newParts[newParts.length - 2] = suffix === 'vertical' ? '竖' : '横';
    return newParts.join(separator) + `_${String(index + 1).padStart(4, '0')}`;
  }

  if (aName) {
    return `${aName}__${bName}__${String(index + 1).padStart(4, '0')}_${suffix}`;
  } else {
    return `${bName}__${String(index + 1).padStart(4, '0')}_${suffix}`;
  }
}

/**
 * 获取视频元数据（尺寸、时长等）
 */
async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration',
      '-of', 'json',
      filePath,
    ];

    const proc = spawn(getFfprobePath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exit code=${code}: ${stderr}`));
      }

      try {
        const output = JSON.parse(stdout);
        if (output.streams && output.streams.length > 0) {
          const stream = output.streams[0];
          resolve({
            width: stream.width,
            height: stream.height,
            duration: stream.duration ? parseFloat(stream.duration) : 0,
          });
        } else {
          reject(new Error('无法解析视频元数据'));
        }
      } catch (err) {
        reject(new Error(`解析 ffprobe 输出失败: ${(err as Error).message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffprobe 执行失败: ${err.message}`));
    });
  });
}

/**
 * 获取视频尺寸信息
 */
export async function getVideoDimensions(filePath: string): Promise<VideoDimensions | null> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.m4v'];

    if (!validExtensions.includes(ext)) {
      return null;
    }

    const metadata = await getVideoMetadata(filePath);
    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) {
      return null;
    }

    let orientation: 'landscape' | 'portrait' | 'square' = 'landscape';
    if (width === height) {
      orientation = 'square';
    } else if (height > width) {
      orientation = 'portrait';
    }

    const ratio = width / height;
    let aspectRatio = '16:9';
    if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = '16:9';
    else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = '9:16';
    else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = '4:3';
    else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = '3:4';
    else if (Math.abs(ratio - 1) < 0.05) aspectRatio = '1:1';
    else aspectRatio = `${Math.round(ratio * 10) / 10}:1`;

    const duration = metadata.duration || 0;

    return { width, height, orientation, aspectRatio, duration };
  } catch (error) {
    console.error(`[获取视频尺寸] 失败: ${filePath} - ${(error as Error).message}`);
    return null;
  }
}

/**
 * 计算长宽比字符串
 */
function calculateAspectRatio(width: number, height: number): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16';
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3';
  if (Math.abs(ratio - 3 / 4) < 0.1) return '3:4';
  if (Math.abs(ratio - 1) < 0.05) return '1:1';
  return `${Math.round(ratio * 10) / 10}:1`;
}

/**
 * 获取视频完整信息
 */
export async function getVideoFullInfo(
  filePath: string,
  options: { thumbnailMaxSize?: number } = {}
): Promise<VideoFullInfo> {
  const { thumbnailMaxSize = 64 } = options;
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const result: VideoFullInfo = {
    success: true,
    path: filePath,
    name: fileName,
    thumbnail: null,
    previewUrl: `preview://${encodeURIComponent(filePath)}`,
    fileSize: null,
    width: null,
    height: null,
    duration: null,
    orientation: null,
    aspectRatio: null,
  };

  try {
    if (!fs.existsSync(filePath)) {
      return { ...result, success: false, error: '文件不存在' };
    }

    const ffmpeg = getFfmpegPath();

    const [thumbnailResult, statsResult, metadataResult] = await Promise.allSettled([
      new Promise<string>((resolve, reject) => {
        const tmpDir = path.join(os.tmpdir(), 'videostitcher-temp');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const outputPath = path.join(tmpDir, `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);

        const args = [
          '-ss', '0', '-i', filePath, '-vframes', '1',
          '-vf', `scale=${thumbnailMaxSize}:-1`, '-y', outputPath,
        ];

        execFile(ffmpeg as string, args, { timeout: 10000 }, (err) => {
          if (err) {
            reject(err);
          } else if (fs.existsSync(outputPath)) {
            const thumbnailBase64 = fs.readFileSync(outputPath, { encoding: 'base64' });
            fs.unlinkSync(outputPath);
            resolve(`data:image/png;base64,${thumbnailBase64}`);
          } else {
            reject(new Error('缩略图生成失败'));
          }
        });
      }),
      new Promise<number>((resolve, reject) => {
        fs.stat(filePath, (err, stats) => {
          if (err) reject(err);
          else resolve(stats.size);
        });
      }),
      getVideoMetadata(filePath).then((metadata) => ({
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration,
        orientation: metadata.width > metadata.height ? 'landscape' : metadata.width < metadata.height ? 'portrait' : 'square',
        aspectRatio: calculateAspectRatio(metadata.width, metadata.height),
      })),
    ]);

    if (thumbnailResult.status === 'fulfilled') {
      result.thumbnail = thumbnailResult.value;
    }
    if (statsResult.status === 'fulfilled') {
      result.fileSize = statsResult.value;
    }
    if (metadataResult.status === 'fulfilled') {
      const meta = metadataResult.value;
      result.width = meta.width;
      result.height = meta.height;
      result.duration = meta.duration;
      result.orientation = meta.orientation;
      result.aspectRatio = meta.aspectRatio;
    }
  } catch (error) {
    console.error(`[获取视频完整信息] 失败: ${fileName} - ${(error as Error).message}`);
    result.success = false;
    result.error = (error as Error).message;
  }

  return result;
}

/**
 * 统一视频合成处理
 */
export async function handleVideoMerge(event: IpcMainInvokeEvent, tasks: Task[]): Promise<{ done: number; failed: number; total: number; elapsed: string }> {
  console.log('handleVideoMerge received:', tasks);
  if (!tasks || tasks.length === 0) {
    throw new Error('任务列表为空');
  }

  const startTime = Date.now();
  const firstConfig = tasks[0]?.config || {};
  const orientation = firstConfig.orientation || 'horizontal';

  for (let i = 0; i < tasks.length; i++) {
    if (!tasks[i].outputDir) {
      throw new Error(`任务 ${i + 1}: 未设置输出目录`);
    }
  }

  const concurrency = tasks[0]?.concurrency || Math.max(1, os.cpus().length - 1);
  queue.setConcurrency(concurrency);

  const total = tasks.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: orientation, concurrency: queue.concurrency });

  const ffmpegTasks = tasks.map((task, index) => {
    return queue.push(async () => {
      const taskStartTime = Date.now();
      event.sender.send('video-task-start', { index });

      const { config, outputDir } = task || {};
      const taskOrientation = config?.orientation || orientation;

      const aFile = task.files?.find(f => f.category === 'A');
      const bFile = task.files?.find(f => f.category === 'B');
      const coverFile = task.files?.find(f => f.category === 'cover');
      const bgFile = task.files?.find(f => f.category === 'bg');

      if (!bFile) {
        throw new Error(`任务 ${index + 1}: 缺少B面视频`);
      }

      const aPath = aFile?.path;
      const bPath = bFile.path;
      const coverImage = coverFile?.path;
      const bgImage = bgFile?.path;

      const aPosition = config?.aPosition;
      const bPosition = config?.bPosition;
      const bgPosition = config?.bgPosition;
      const coverPosition = config?.coverPosition;

      const bName = path.parse(bPath).name;
      const aName = aPath ? path.parse(aPath).name : undefined;
      const suffix = taskOrientation === 'vertical' ? '竖' : '横';
      const rawBaseName = aName ? `${aName}__${bName}_${suffix}` : `${bName}_${suffix}`;

      const safeBaseName = generateFileName(outputDir, rawBaseName, { extension: '.mp4', reserveSuffixSpace: 5 });
      const safeOutput = new SafeOutput(outputDir, 'merge');
      const tempPath = safeOutput.getTempOutputPath(safeBaseName, index);

      try {
        const args = buildMergeCommand({
          aPath, bPath, outPath: tempPath, bgImage, coverImage,
          aPosition, bPosition, bgPosition, coverPosition, orientation: taskOrientation as 'horizontal' | 'vertical',
        });

        await runFfmpeg(args, (log: string) => {
          event.sender.send('video-log', { index, message: log });
        });

        const result = safeOutput.commitSync(tempPath);
        safeOutput.cleanup(index);

        if (!result.success) {
          throw new Error(result.error || '移动文件失败');
        }

        const taskElapsed = ((Date.now() - taskStartTime) / 1000).toFixed(1);
        done++;
        event.sender.send('video-progress', { done, failed, total, index, outputPath: result.finalPath, elapsed: taskElapsed });
      } catch (err) {
        safeOutput.cleanup(index);
        failed++;
        event.sender.send('video-failed', { done, failed, total, index, error: (err as Error).message });
      }
    });
  });

  await Promise.allSettled(ffmpegTasks);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[转换] 完成，成功: ${done}, 失败: ${failed}, 总耗时: ${totalElapsed}秒`);
  event.sender.send('video-finish', { done, failed, total, elapsed: totalElapsed });

  return { done, failed, total, elapsed: totalElapsed };
}

/**
 * 横屏合成处理
 */
export async function handleHorizontalMerge(
  event: IpcMainInvokeEvent,
  config: HorizontalMergeConfig
): Promise<{ done: number; failed: number; total: number }> {
  const { aVideos, bVideos, bgImage, coverImages, outputDir, concurrency, aPosition, bPosition, bPositions, bgPosition, coverPosition } = config;

  if (!bVideos.length) {
    throw new Error('主视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  const hasAVideos = aVideos && aVideos.length > 0;
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = bVideos.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'horizontal', concurrency: queue.concurrency });

  // A 面视频分配
  const globalASideAssignments: (string | undefined)[] = [];
  if (hasAVideos) {
    let pool = [...aVideos!];
    pool.sort(() => 0.5 - Math.random());
    for (let k = 0; k < total; k++) {
      if (pool.length === 0) {
        pool = [...aVideos!];
        pool.sort(() => 0.5 - Math.random());
      }
      globalASideAssignments.push(pool.pop());
    }
  } else {
    for (let k = 0; k < total; k++) {
      globalASideAssignments.push(undefined);
    }
  }

  // 封面图分配
  const globalCoverAssignments: (string | undefined)[] = [];
  if (coverImages && coverImages.length > 0) {
    let pool = [...coverImages];
    pool.sort(() => 0.5 - Math.random());
    for (let k = 0; k < total; k++) {
      if (pool.length === 0) {
        pool = [...coverImages];
        pool.sort(() => 0.5 - Math.random());
      }
      globalCoverAssignments.push(pool.pop());
    }
  } else {
    for (let k = 0; k < total; k++) {
      globalCoverAssignments.push(undefined);
    }
  }

  const tasks = bVideos.map((b, index) => {
    return queue.push(async () => {
      event.sender.send('video-task-start', { index });

      const selectedAVideo = globalASideAssignments[index];
      const selectedCoverImage = globalCoverAssignments[index];

      const bName = path.parse(b).name;
      const aName = selectedAVideo ? path.parse(selectedAVideo).name : undefined;
      const baseName = getSmartMergedBaseName(bName, index, 'horizontal', aName);
      const outName = generateFileName(outputDir, baseName, { extension: '.mp4', reserveSuffixSpace: 5 });
      const outPath = path.join(outputDir, outName);

      try {
        const currentBPosition = (bPositions && bPositions[index]) || bPosition;

        const args = buildMergeCommand({
          aPath: selectedAVideo, bPath: b, outPath, bgImage, coverImage: selectedCoverImage,
          aPosition, bPosition: currentBPosition, bgPosition, coverPosition, orientation: 'horizontal',
        });

        await runFfmpeg(args, (log: string) => {
          event.sender.send('video-log', { index, message: log });
        });

        done++;
        event.sender.send('video-progress', { done, failed, total, index, outputPath: outPath });
      } catch (err) {
        failed++;
        event.sender.send('video-failed', { done, failed, total, index, error: (err as Error).message });
      }
    });
  });

  await Promise.allSettled(tasks);
  event.sender.send('video-finish', { done, failed, total });

  return { done, failed, total };
}

/**
 * 竖屏合成处理
 */
export async function handleVerticalMerge(
  event: IpcMainInvokeEvent,
  config: VerticalMergeConfig
): Promise<{ done: number; failed: number; total: number }> {
  const { mainVideos, bgImage, aVideos, coverImages, outputDir, concurrency, aPosition, bPosition, bPositions, bgPosition, coverPosition } = config;

  if (!mainVideos.length) {
    throw new Error('主视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  const hasAVideos = aVideos && aVideos.length > 0;
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = mainVideos.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'vertical', concurrency: queue.concurrency });

  // A 面视频分配
  const globalASideAssignments: (string | undefined)[] = [];
  if (hasAVideos) {
    let pool = [...aVideos!];
    pool.sort(() => 0.5 - Math.random());
    for (let k = 0; k < total; k++) {
      if (pool.length === 0) {
        pool = [...aVideos!];
        pool.sort(() => 0.5 - Math.random());
      }
      globalASideAssignments.push(pool.pop());
    }
  } else {
    for (let k = 0; k < total; k++) {
      globalASideAssignments.push(undefined);
    }
  }

  // 封面图分配
  const globalCoverAssignments: (string | undefined)[] = [];
  if (coverImages && coverImages.length > 0) {
    let pool = [...coverImages];
    pool.sort(() => 0.5 - Math.random());
    for (let k = 0; k < total; k++) {
      if (pool.length === 0) {
        pool = [...coverImages];
        pool.sort(() => 0.5 - Math.random());
      }
      globalCoverAssignments.push(pool.pop());
    }
  } else {
    for (let k = 0; k < total; k++) {
      globalCoverAssignments.push(undefined);
    }
  }

  const tasks = mainVideos.map((mainVideo, index) => {
    return queue.push(async () => {
      event.sender.send('video-task-start', { index });

      const selectedAVideo = globalASideAssignments[index];
      const selectedCoverImage = globalCoverAssignments[index];

      const bName = path.parse(mainVideo).name;
      const aName = selectedAVideo ? path.parse(selectedAVideo).name : undefined;
      const baseName = getSmartMergedBaseName(bName, index, 'vertical', aName);
      const outName = generateFileName(outputDir, baseName, { extension: '.mp4', reserveSuffixSpace: 5 });
      const outPath = path.join(outputDir, outName);

      try {
        const currentBPosition = (bPositions && bPositions[index]) || bPosition;

        const args = buildMergeCommand({
          aPath: selectedAVideo, bPath: mainVideo, outPath, bgImage, coverImage: selectedCoverImage,
          aPosition, bPosition: currentBPosition, bgPosition, coverPosition, orientation: 'vertical',
        });

        await runFfmpeg(args, (log: string) => {
          event.sender.send('video-log', { index, message: log });
        });

        done++;
        event.sender.send('video-progress', { done, failed, total, index, outputPath: outPath });
      } catch (err) {
        failed++;
        event.sender.send('video-failed', { done, failed, total, index, error: (err as Error).message });
      }
    });
  });

  await Promise.allSettled(tasks);
  event.sender.send('video-finish', { done, failed, total });

  return { done, failed, total };
}

/**
 * 智能改尺寸处理
 */
export async function handleResize(
  event: IpcMainInvokeEvent,
  config: ResizeConfig
): Promise<{ done: number; failed: number; total: number }> {
  const { videos, mode, blurAmount, outputDir, concurrency } = config;

  if (!videos.length) {
    throw new Error('视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  const configs = RESIZE_CONFIGS[mode];
  if (!configs) {
    throw new Error(`无效的模式: ${mode}`);
  }

  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = videos.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'resize', concurrency: queue.concurrency });

  const tasks: (() => Promise<void>)[] = [];
  const videoCompletionCount = new Array(videos.length).fill(0);
  const videoFailed = new Array(videos.length).fill(false);
  const videoOutputs: (string | null)[][] = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const videoPath = video.path;
    const fileName = path.parse(videoPath).name;
    videoOutputs[i] = [];

    for (let j = 0; j < configs.length; j++) {
      const resizeConfig = configs[j];
      const suffix = resizeConfig.suffix;
      videoOutputs[i].push(null);

      (tasks as any).push(
        queue.push(async () => {
          const index = i * configs.length + j;
          const outName = generateFileName(outputDir, fileName, { suffix, extension: '.mp4', reserveSuffixSpace: 5 });
          const outPath = path.join(outputDir, outName);
          videoOutputs[i][j] = outPath;

          event.sender.send('video-task-start', { index, videoIndex: i });

          try {
            const args = buildResizeArgs({
              inputPath: videoPath, outputPath: outPath,
              width: resizeConfig.width, height: resizeConfig.height, blurAmount,
              threads: os.cpus().length,
            });

            await runFfmpeg(args, (log: string) => {
              event.sender.send('video-log', { index, message: log });
            });

            videoCompletionCount[i]++;

            if (videoCompletionCount[i] === configs.length) {
              if (!videoFailed[i]) {
                done++;
              }
              event.sender.send('video-progress', { done, failed, total, index: i, outputs: videoOutputs[i] });
            }
          } catch (err) {
            videoFailed[i] = true;
            videoCompletionCount[i]++;

            if (videoCompletionCount[i] === configs.length) {
              failed++;
              event.sender.send('video-progress', { done, failed, total, index: i, outputs: videoOutputs[i] });
            }
          }
        })
      );
    }
  }

  await Promise.allSettled(tasks.map(t => t()));
  event.sender.send('video-finish', { done, failed, total });

  return { done, failed, total };
}

/**
 * 横屏合成预览
 */
async function handleHorizontalPreview(
  event: IpcMainInvokeEvent,
  config: { aVideo?: string; bVideo: string; bgImage?: string; coverImage?: string }
): Promise<{ success: boolean; previewPath?: string; error?: string }> {
  const { aVideo, bVideo, bgImage, coverImage } = config;

  if (!bVideo) {
    throw new Error('缺少主视频');
  }

  const tmpDir = path.join(os.tmpdir(), 'videostitcher-preview');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const timestamp = Date.now();
  const previewFileName = `preview_horizontal_${timestamp}.mp4`;
  const previewPath = path.join(tmpDir, previewFileName);

  event.sender.send('preview-start', { mode: 'horizontal' });

  try {
    const args = buildMergeCommand({
      aPath: aVideo, bPath: bVideo, outPath: previewPath, bgImage, coverImage, orientation: 'horizontal',
    });

    await runFfmpeg(args, (log: string) => {
      event.sender.send('preview-log', { message: log });
    });

    event.sender.send('preview-complete', { previewPath });
    return { success: true, previewPath };
  } catch (err) {
    event.sender.send('preview-error', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 竖屏合成预览
 */
async function handleVerticalPreview(
  event: IpcMainInvokeEvent,
  config: { mainVideo: string; bgImage?: string; aVideo?: string; coverImage?: string }
): Promise<{ success: boolean; previewPath?: string; error?: string }> {
  const { mainVideo, bgImage, aVideo, coverImage } = config;

  if (!mainVideo) {
    throw new Error('缺少主视频');
  }

  const tmpDir = path.join(os.tmpdir(), 'videostitcher-preview');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const timestamp = Date.now();
  const previewFileName = `preview_vertical_${timestamp}.mp4`;
  const previewPath = path.join(tmpDir, previewFileName);

  event.sender.send('preview-start', { mode: 'vertical' });

  try {
    const args = buildMergeCommand({
      aPath: aVideo, bPath: mainVideo, outPath: previewPath, bgImage, coverImage, orientation: 'vertical',
      preview: { width: 720, height: 1280, crf: 28 }
    });

    await runFfmpeg(args, (log: string) => {
      event.sender.send('preview-log', { message: log });
    });

    event.sender.send('preview-complete', { previewPath });
    return { success: true, previewPath };
  } catch (err) {
    event.sender.send('preview-error', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 极速合成预览
 */
async function handleMergePreviewFast(
  event: IpcMainInvokeEvent,
  config: { bVideo: string; aVideo?: string; bgImage?: string; coverImage?: string; orientation: string; aPosition?: Position; bPosition?: Position; coverPosition?: Position }
): Promise<{ success: boolean; previewPath?: string; elapsed?: string; error?: string }> {
  const { bVideo, aVideo, bgImage, coverImage, orientation, aPosition, bPosition, coverPosition } = config;
  const tempDir = path.join(os.tmpdir(), 'videostitcher-preview');

  if (!bVideo) {
    return { success: false, error: '缺少主视频' };
  }

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const previewPath = path.join(tempDir, `preview_merge_${timestamp}.mp4`);

  event.sender.send('preview-start', { mode: 'merge-fast' });

  const startTime = Date.now();

  try {
    const getVideoDuration = async (videoPath?: string): Promise<number> => {
      if (!videoPath) return 0;
      try {
        const metadata = await getVideoMetadata(videoPath);
        return metadata?.duration || 0;
      } catch {
        return 0;
      }
    };

    const aDuration = await getVideoDuration(aVideo);
    const bDuration = await getVideoDuration(bVideo);

    console.log('[预览] A面时长:', aDuration, 'B面时长:', bDuration);

    // 极速预览的截取逻辑：
    // - 封面：取开头 0.1 秒
    // - A面：
    //   - 不足5秒：取全部（不截取）
    //   - 5-10秒：取前5秒（只取一段）
    //   - 10秒以上：取前5秒 + 后5秒（两段拼接）
    // - B面：取开头5秒（不足5秒则取全部）
    const CLIP_DURATION = 5;
    const trim: { aStart?: number; aDuration?: number; a2Start?: number; a2Duration?: number; bStart?: number; bDuration?: number } = {};

    // A面截取策略：
    // - 无封面：A后5秒 + B前5秒
    // - 有封面 + A >= 10秒：A前5秒 + A后5秒 + B前5秒
    // - 有封面 + A < 10秒：A完整 + B前5秒
    const hasCover = !!coverImage;
    if (aVideo && aDuration > 0) {
      if (!hasCover) {
        // 无封面：A后5秒 + B前5秒
        if (aDuration >= CLIP_DURATION) {
          trim.aStart = aDuration - CLIP_DURATION;
          trim.aDuration = CLIP_DURATION;
        }
        // A < 5秒：不截取，使用全部
      } else {
        // 有封面：展示排序效果
        if (aDuration >= CLIP_DURATION * 2) {
          // A >= 10秒：截取前后各5秒
          trim.aStart = 0;
          trim.aDuration = CLIP_DURATION;
          trim.a2Start = aDuration - CLIP_DURATION;
          trim.a2Duration = CLIP_DURATION;
        }
        // A < 10秒：不截取，使用全部
      }
    }

    // B面截取：只在大等于5秒时才截取开头5秒
    if (bDuration >= CLIP_DURATION) {
      trim.bStart = 0;
      trim.bDuration = CLIP_DURATION;
    } else if (bDuration > 0) {
      // B < 5秒：取全部
      trim.bStart = 0;
      trim.bDuration = bDuration;
    }

    const previewConfig = orientation === 'horizontal'
      ? { width: 1280, height: 720, crf: 28 }
      : { width: 720, height: 1280, crf: 28 };

    const args = buildMergeCommand({
      aPath: aVideo, bPath: bVideo, outPath: previewPath, bgImage, coverImage,
      aPosition, bPosition, coverPosition, orientation: orientation as 'vertical' | 'horizontal',
      preview: previewConfig, trim, coverDuration: 1,
    });

    console.log('[预览] 生成极速合成预览:', previewPath);
    console.log('[预览] 截取参数:', JSON.stringify(trim));

    await runFfmpeg(args, (log: string) => {
      event.sender.send('preview-log', { message: log });
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[预览] 生成完成，耗时: ${elapsed}秒`);

    event.sender.send('preview-complete', { previewPath, elapsed });
    return { success: true, previewPath, elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error('[预览] 生成失败:', err, `耗时: ${elapsed}秒`);
    const errorMsg = (err as Error).message || '未知错误';
    event.sender.send('preview-error', { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * 清理预览临时文件
 */
async function handleClearPreviews(): Promise<{ success: boolean; error?: string }> {
  const tmpDir = path.join(os.tmpdir(), 'videostitcher-preview');

  try {
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        fs.unlinkSync(filePath);
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 智能改尺寸预览处理
 */
async function handleGenerateResizePreviews(
  event: IpcMainInvokeEvent,
  config: { videoPath: string; mode: string; blurAmount: number }
): Promise<{ success: boolean; previews?: any[]; error?: string }> {
  const { videoPath, mode, blurAmount } = config;
  const tempDir = path.join(os.tmpdir(), 'videostitcher-preview');

  try {
    event.sender.send('preview-start', { mode });

    const previews = await generatePreviews({
      inputPath: videoPath, tempDir, mode, blurAmount,
      threads: os.cpus().length,
      onProgress: (progress: number) => {
        event.sender.send('preview-log', { message: `处理进度: ${Math.floor(progress)}%` });
      },
      onLog: (log: string) => {
        event.sender.send('preview-log', { message: log });
      },
    });

    event.sender.send('preview-complete', { previewPaths: previews.map((p: any) => p.path) });
    return { success: true, previews };
  } catch (err) {
    event.sender.send('preview-error', { error: (err as Error).message });
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 清理智能改尺寸预览
 */
async function handleClearResizePreviews(
  _event: IpcMainInvokeEvent,
  config: { previewPaths: string[] }
): Promise<{ success: boolean; error?: string }> {
  try {
    cleanupPreviews(config.previewPaths);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * A+B 前后拼接处理
 */
export async function handleStitchAB(event: IpcMainInvokeEvent, tasks: Task[]): Promise<{ done: number; failed: number; total: number; elapsed: string }> {
  console.log('handleStitchAB received:', tasks);
  if (!tasks || tasks.length === 0) {
    throw new Error('任务列表为空');
  }

  const startTime = Date.now();
  const firstConfig = tasks[0]?.config || {};
  const orientation = firstConfig.orientation || 'landscape';
  const outputDir = tasks[0]?.outputDir;

  if (!outputDir) {
    throw new Error('未设置输出目录');
  }

  const concurrency = tasks[0]?.concurrency || Math.max(1, os.cpus().length - 1);
  queue.setConcurrency(concurrency);

  const total = tasks.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: orientation, concurrency: queue.concurrency });

  const ffmpegTasks = tasks.map((task, index) => {
    return queue.push(async () => {
      const taskStartTime = Date.now();
      event.sender.send('video-task-start', { index });

      const aFile = task.files?.find(f => f.category === 'A');
      const bFile = task.files?.find(f => f.category === 'B');

      if (!aFile || !bFile) {
        throw new Error(`任务 ${index + 1}: 缺少A面或B面视频`);
      }

      const aPath = aFile.path;
      const bPath = bFile.path;
      const taskOrientation = task.config?.orientation || orientation;

      const aName = path.parse(aPath).name;
      const bName = path.parse(bPath).name;
      const rawBaseName = `${aName}__${bName}`;

      const safeBaseName = generateFileName(outputDir, rawBaseName, { extension: '.mp4', reserveSuffixSpace: 5 });
      const safeOutput = new SafeOutput(outputDir, 'stitch');
      const tempPath = safeOutput.getTempOutputPath(safeBaseName, index);

      try {
        const payload = { aPath, bPath, outPath: tempPath, orientation: taskOrientation };

        await runFfmpeg(payload as any, (log: string) => {
          event.sender.send('video-log', { index, message: log });
        });

        const result = safeOutput.commitSync(tempPath);
        safeOutput.cleanup(index);

        if (!result.success) {
          throw new Error(result.error || '移动文件失败');
        }

        const taskElapsed = ((Date.now() - taskStartTime) / 1000).toFixed(1);
        done++;
        event.sender.send('video-progress', { done, failed, total, index, outputPath: result.finalPath, elapsed: taskElapsed });
      } catch (err) {
        safeOutput.cleanup(index);
        failed++;
        event.sender.send('video-failed', { done, failed, total, index, error: (err as Error).message });
      }
    });
  });

  await Promise.allSettled(ffmpegTasks);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[A+B拼接] 完成，成功: ${done}, 失败: ${failed}, 总耗时: ${totalElapsed}秒`);
  event.sender.send('video-finish', { done, failed, total, elapsed: totalElapsed });

  return { done, failed, total, elapsed: totalElapsed };
}

/**
 * 获取视频缩略图
 */
async function handleGetVideoThumbnail(
  filePath: string,
  options: { timeOffset?: number; maxSize?: number } = {}
): Promise<{ success: boolean; thumbnail?: string; duration?: number; actualTimeOffset?: number; error?: string }> {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }

    const { timeOffset = 0, maxSize = 200 } = options;

    // 获取视频时长
    const duration = await new Promise<number>((resolve) => {
      const args = ['-i', filePath, '-hide_banner'];
      execFile(getFfprobePath(), args, { timeout: 5000 }, (_err, _stdout, stderr) => {
        const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (match) {
          const hours = parseInt(match[1]);
          const mins = parseInt(match[2]);
          const secs = parseInt(match[3]);
          const centisecs = parseInt(match[4]);
          resolve(hours * 3600 + mins * 60 + secs + centisecs / 100);
        } else {
          resolve(0);
        }
      });
    });

    const actualTimeOffset = duration > 0 ? Math.min(timeOffset, duration * 0.9) : timeOffset;

    const tmpDir = path.join(os.tmpdir(), 'videostitcher-temp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const outputPath = path.join(tmpDir, `thumb_${Date.now()}.png`);

    await new Promise<void>((resolve, reject) => {
      const args = [
        '-ss', String(actualTimeOffset), '-i', filePath, '-vframes', '1',
        '-vf', `scale=${maxSize}:-1`, '-y', outputPath,
      ];

      execFile(getFfmpegPath() as string, args, { timeout: 10000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!fs.existsSync(outputPath)) {
      return { success: false, error: '截取失败，输出文件不存在' };
    }

    const buffer = fs.readFileSync(outputPath);
    const base64 = buffer.toString('base64');
    fs.unlinkSync(outputPath);

    return { success: true, thumbnail: `data:image/png;base64,${base64}`, duration, actualTimeOffset };
  } catch (err) {
    console.error('[视频缩略图] 失败:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 生成 A+B 拼接预览视频
 *
 * @param config.aPath A 视频路径
 * @param config.bPath B 视频路径
 * @param config.orientation 方向
 * @param config.trim 可选的裁剪配置（精确控制截取位置和时长）
 * @param config.aDuration A 视频总时长（秒），用于自动计算截取末尾5秒
 * @param config.bDuration B 视频总时长（秒），用于自动计算截取开头5秒
 */
async function handleGenerateStitchPreview(
  event: IpcMainInvokeEvent,
  config: {
    aPath: string;
    bPath: string;
    orientation: 'landscape' | 'portrait';
    trim?: {
      aStart?: number;
      aDuration?: number;
      bStart?: number;
      bDuration?: number;
    };
    // 扁平参数：视频总时长，用于自动计算截取位置
    aDuration?: number;
    bDuration?: number;
  }
): Promise<{ success: boolean; tempPath?: string; elapsed?: string; error?: string }> {
  const startTime = Date.now();

  try {
    const tempDir = os.tmpdir();
    const tempId = crypto.randomBytes(8).toString('hex');
    const CLIP_DURATION = 5;
    const MIN_DURATION_FOR_TRIM = 10; // 至少需要10秒才截取拼接

    // 判断是否有精确的 trim 参数
    const hasNestedParams = config.trim && (
      config.trim.aStart !== undefined ||
      config.trim.bStart !== undefined ||
      config.trim.aDuration !== undefined ||
      config.trim.bDuration !== undefined
    );

    // 计算截取参数
    let finalTrim: {
      aStart: number;
      aDuration: number;
      bStart: number;
      bDuration: number;
    } | null = null;

    // 决定是否需要截取拼接
    const aDuration = config.aDuration ?? 0;
    const bDuration = config.bDuration ?? 0;
    const totalDuration = aDuration + bDuration;

    // 情况1：有精确 trim 参数，使用 trim 参数
    if (hasNestedParams) {
      finalTrim = {
        aStart: config.trim?.aStart ?? 0,
        aDuration: config.trim?.aDuration ?? CLIP_DURATION,
        bStart: config.trim?.bStart ?? 0,
        bDuration: config.trim?.bDuration ?? CLIP_DURATION,
      };
    }
    // 情况2：有总时长信息，且总时长 >= 10秒，才进行截取拼接
    else if (totalDuration > 0 && totalDuration >= MIN_DURATION_FOR_TRIM) {
      // A 取末尾5秒，B 取开头5秒
      finalTrim = {
        aStart: Math.max(0, aDuration - CLIP_DURATION),
        aDuration: CLIP_DURATION,
        bStart: 0,
        bDuration: CLIP_DURATION,
      };
    }
    // 情况3：视频太短，不截取不拼接（直接用原视频）

    // 生成输出路径
    const useTrim = finalTrim !== null;
    const tempPath = path.join(tempDir, `preview_${useTrim ? 'fast_' : ''}${config.orientation}_${tempId}.mp4`);

    let args: string[];

    if (useTrim && finalTrim) {
      // 需要截取拼接
      args = buildStitchCommand({
        aPath: config.aPath,
        bPath: config.bPath,
        outPath: tempPath,
        orientation: config.orientation,
        trim: finalTrim,
        preview: { crf: 35 }
      });
    } else {
      // 视频太短，不截取，直接拼接原视频
      console.log(`[预览生成] 视频总时长 ${totalDuration.toFixed(1)}s < 10s，跳过截取拼接`);
      args = buildStitchCommand({
        aPath: config.aPath,
        bPath: config.bPath,
        outPath: tempPath,
        orientation: config.orientation,
        preview: { crf: 35 }
      });
    }

    if (useTrim && finalTrim) {
      console.log(`[预览生成] A: 截取 ${finalTrim.aStart}s 开始的 ${finalTrim.aDuration}s`);
      console.log(`[预览生成] B: 截取 ${finalTrim.bStart}s 开始的 ${finalTrim.bDuration}s`);
    } else {
      console.log(`[预览生成] 视频太短，使用完整视频拼接`);
    }
    console.log('[预览生成] 开始生成...');

    await runFfmpeg(args, (log: string) => {
      console.log('[预览生成]', log);
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[预览生成] 完成，耗时: ${elapsed}秒，临时文件: ${tempPath}`);

    return { success: true, tempPath, elapsed };
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[预览生成] 失败，耗时: ${elapsed}秒:`, err);
    return { success: false, error: (err as Error).message, elapsed };
  }
}

/**
 * 删除临时预览文件
 */
async function handleDeleteTempPreview(tempPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log('[预览清理] 已删除临时文件:', tempPath);
    }
    return { success: true };
  } catch (err) {
    console.error('[预览清理] 删除失败:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 注册所有视频处理 IPC 处理器
 */
export function registerVideoHandlers(): void {
  // A+B 前后拼接
  ipcMain.handle('video-stitch-ab', async (event, config: Task[]) => {
    return handleStitchAB(event, config);
  });

  // 视频合成（统一接口）
  ipcMain.handle('video-merge', async (event, tasks: Task[]) => {
    return handleVideoMerge(event, tasks);
  });

  // 横屏合成
  ipcMain.handle('video-horizontal-merge', async (event, config: HorizontalMergeConfig) => {
    return handleHorizontalMerge(event, config);
  });

  // 竖屏合成
  ipcMain.handle('video-vertical-merge', async (event, config: VerticalMergeConfig) => {
    return handleVerticalMerge(event, config);
  });

  // 智能改尺寸
  ipcMain.handle('video-resize', async (event, config: ResizeConfig) => {
    return handleResize(event, config);
  });

  // 横屏合成预览
  ipcMain.handle('preview-horizontal', async (event, config) => {
    return handleHorizontalPreview(event, config);
  });

  // 竖屏合成预览
  ipcMain.handle('preview-vertical', async (event, config) => {
    return handleVerticalPreview(event, config);
  });

  // 极速合成快速预览
  ipcMain.handle('preview-merge-fast', async (event, config) => {
    return handleMergePreviewFast(event, config);
  });

  // 清理预览文件
  ipcMain.handle('clear-previews', async () => {
    return handleClearPreviews();
  });

  // 智能改尺寸预览
  ipcMain.handle('generate-resize-previews', async (event, config) => {
    return handleGenerateResizePreviews(event, config);
  });

  // 清理智能改尺寸预览
  ipcMain.handle('clear-resize-previews', async (event, config) => {
    return handleClearResizePreviews(event, config);
  });

  // 获取视频元数据
  ipcMain.handle('video-get-metadata', async (_event, filePath: string) => {
    return getVideoMetadata(filePath);
  });

  // 获取视频尺寸
  ipcMain.handle('video:get-dimensions', async (_event, filePath: string) => {
    return getVideoDimensions(filePath);
  });

  // 获取视频完整信息
  ipcMain.handle('video:get-full-info', async (_event, filePath: string, options?: { thumbnailMaxSize?: number }) => {
    return getVideoFullInfo(filePath, options);
  });

  // 获取视频缩略图
  ipcMain.handle('get-video-thumbnail', async (_event, filePath: string, options?: { timeOffset?: number; maxSize?: number }) => {
    return handleGetVideoThumbnail(filePath, options);
  });

  // 生成 A+B 拼接预览视频
  ipcMain.handle('generate-stitch-preview', async (event, config) => {
    return handleGenerateStitchPreview(event, config);
  });

  // 删除临时预览文件
  ipcMain.handle('delete-temp-preview', async (_event, tempPath: string) => {
    return handleDeleteTempPreview(tempPath);
  });
}

export {
  getVideoMetadata,
  handleGetVideoThumbnail,
  handleGenerateStitchPreview,
  handleDeleteTempPreview,
};
