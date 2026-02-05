/**
 * 视频处理 IPC 处理器
 * 扩展现有的视频处理功能, 支持 VideoMaster 的所有视频模式
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { runFfmpeg } = require('../ffmpeg/ffmpegCmd');
const { TaskQueue } = require('../ffmpeg/queue');
const os = require('os');

// 创建任务队列 (复用现有逻辑)
const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

/**
 * 横屏合成处理
 * 使用现有的 A+B 拼接逻辑
 */
async function handleHorizontalMerge(event, { aVideos, bVideos, bgImage, outputDir, concurrency }) {
  if (!bVideos.length) {
    throw new Error('主视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  // 如果没有 A 面视频，则只处理主视频（复制到输出目录）
  if (!aVideos.length) {
    aVideos = bVideos; // 自拼接模式
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

      try {
        await runFfmpeg({ aPath: a, bPath: b, outPath, orientation: 'landscape' }, (log) => {
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

  // 如果没有 A 面视频，则只处理主视频
  if (!aVideos || !aVideos.length) {
    aVideos = mainVideos; // 自拼接模式
  }

  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = mainVideos.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'vertical', concurrency: queue.concurrency });

  const tasks = mainVideos.map((mainVideo, index) => {
    return queue.push(async () => {
      const aVideo = aVideos[index % aVideos.length];
      const aName = path.parse(aVideo).name;
      const bName = path.parse(mainVideo).name;
      const outName = `${aName}__${bName}__${String(index + 1).padStart(4, '0')}_vertical.mp4`;
      const outPath = path.join(outputDir, outName);

      try {
        await runFfmpeg({ aPath: aVideo, bPath: mainVideo, outPath, orientation: 'portrait' }, (log) => {
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
 * 暂时使用简单的 resize 实现
 */
async function handleResize(event, { videos, mode, blurAmount, outputDir, concurrency }) {
  if (!videos.length) {
    throw new Error('视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  // TODO: 实现智能改尺寸
  throw new Error('智能改尺寸功能尚未实现，敬请期待');
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
