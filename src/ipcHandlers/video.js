/**
 * 视频处理 IPC 处理器
 * 扩展现有的视频处理功能, 支持 VideoMaster 的所有视频模式
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { buildHorizontalCommand, buildVerticalCommand, buildResizeCommand, buildFFmpegArgs } = require('../ffmpeg/commands');
const { runFfmpeg } = require('../ffmpeg/ffmpegCmd');
const { TaskQueue } = require('../ffmpeg/queue');
const os = require('os');

// 创建任务队列 (复用现有逻辑)
const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

/**
 * 横屏合成处理
 */
async function handleHorizontalMerge(event, { aVideos, bVideos, bgImage, outputDir, concurrency }) {
  if (!aVideos.length || !bVideos.length) {
    throw new Error('A面或主视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  // 设置并发数
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  // 构建视频对 (使用现有的 pair.js 逻辑)
  const { buildPairs } = require('../ffmpeg/pair');
  const pairs = buildPairs(aVideos, bVideos);
  const total = pairs.length;

  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'horizontal', concurrency: queue.concurrency });

  const tasks = pairs.map(({ a, b, index }) => {
    return queue.push(async () => {
      const aName = path.parse(a).name;
      const bName = path.parse(b).name;
      const outName = `${aName}__${bName}__${String(index).padStart(4, '0')}_horizontal.mp4`;
      const outPath = path.join(outputDir, outName);

      // 构建 FFmpeg 命令
      const command = buildHorizontalCommand({
        aVideo: a,
        mainVideo: b,
        bgImage,
        output: outPath
      });

      const args = buildFFmpegArgs(command);

      try {
        await runFfmpeg({ args, outputPath: outPath }, (log) => {
          event.sender.send('video-log', { index, message: log });
        });
        done++;
        event.sender.send('video-progress', { done, failed, total, index, outputPath: outPath });
      } catch (err) {
        failed++;
        event.sender.send('video-failed', { done, failed, total, index, error: err.message });
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
async function handleVerticalMerge(event, { mainVideos, bgImage, aVideos, outputDir, concurrency }) {
  if (!mainVideos.length) {
    throw new Error('主视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = mainVideos.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'vertical', concurrency: queue.concurrency });

  const tasks = mainVideos.map((mainVideo, index) => {
    return queue.push(async () => {
      const mainName = path.parse(mainVideo).name;
      const outName = `${mainName}_vertical_${String(index + 1).padStart(4, '0')}.mp4`;
      const outPath = path.join(outputDir, outName);

      // 构建竖屏合成命令
      const command = buildVerticalCommand({
        mainVideo,
        bgImage,
        aVideo: aVideos[index % aVideos.length], // 循环使用 A 面视频
        output: outPath
      });

      const args = buildFFmpegArgs(command);

      try {
        await runFfmpeg({ args, outputPath: outPath }, (log) => {
          event.sender.send('video-log', { index, message: log });
        });
        done++;
        event.sender.send('video-progress', { done, failed, total, index, outputPath: outPath });
      } catch (err) {
        failed++;
        event.sender.send('video-failed', { done, failed, total, index, error: err.message });
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
async function handleResize(event, { videos, mode, blurAmount, outputDir, concurrency }) {
  if (!videos.length) {
    throw new Error('视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  // 每个视频可能输出多个文件 (如 Siya 模式输出 2 个)
  let totalTasks = 0;
  const taskList = [];

  videos.forEach((video, index) => {
    const outputs = buildResizeCommand({
      input: video,
      mode,
      blurAmount,
      output: path.join(outputDir, path.parse(video).name + '.mp4')
    });

    totalTasks += outputs.length;
    outputs.forEach((outputConfig, outputIndex) => {
      taskList.push({ video, index, outputIndex, config: outputConfig });
    });
  });

  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total: totalTasks, mode: 'resize', concurrency: queue.concurrency });

  const tasks = taskList.map(({ video, index, outputIndex, config }) => {
    return queue.push(async () => {
      try {
        const args = buildFFmpegArgs(config);
        await runFfmpeg({ args, outputPath: config.output }, (log) => {
          event.sender.send('video-log', { index, message: log });
        });
        done++;
        event.sender.send('video-progress', {
          done,
          failed,
          total: totalTasks,
          index,
          outputPath: config.output
        });
      } catch (err) {
        failed++;
        event.sender.send('video-failed', {
          done,
          failed,
          total: totalTasks,
          index,
          error: err.message
        });
      }
    });
  });

  await Promise.allSettled(tasks);
  event.sender.send('video-finish', { done, failed, total: totalTasks });

  return { done, failed, total: totalTasks };
}

/**
 * 注册所有视频处理 IPC 处理器
 */
function registerVideoHandlers() {
  // 横屏合成
  ipcMain.handle('video-horizontal-merge', async (event, config) => {
    return handleHorizontalMerge(event, config);
  });

  // 竖屏合成
  ipcMain.handle('video-vertical-merge', async (event, config) => {
    return handleVerticalMerge(event, config);
  });

  // 智能改尺寸
  ipcMain.handle('video-resize', async (event, config) => {
    return handleResize(event, config);
  });
}

module.exports = {
  registerVideoHandlers,
  handleHorizontalMerge,
  handleVerticalMerge,
  handleResize
};
