/**
 * 视频处理 IPC 处理器
 * 扩展现有的视频处理功能, 支持 VideoMaster 的所有视频模式
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { runFfmpeg } = require('../ffmpeg/runFfmpeg');
const { buildArgs: buildHorizontalArgs } = require('../ffmpeg/horizontalMerge');
const { buildArgs: buildVerticalArgs } = require('../ffmpeg/verticalMerge');
const { TaskQueue } = require('../ffmpeg/queue');
const os = require('os');

// 创建任务队列 (复用现有逻辑)
const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

/**
 * 横屏合成处理
 * 使用现有的 A+B 拼接逻辑
 *
 * @param {Object} params - 参数对象
 * @param {string[]} params.aVideos - A面视频列表
 * @param {string[]} params.bVideos - B面视频列表（主视频）
 * @param {string} [params.bgImage] - 背景图路径
 * @param {string} [params.coverImage] - 封面图路径
 * @param {string} params.outputDir - 输出目录
 * @param {number} [params.concurrency] - 并发数
 */
async function handleHorizontalMerge(event, { aVideos, bVideos, bgImage, coverImage, outputDir, concurrency }) {
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
        // 使用横屏拼接模块构建命令
        const args = buildHorizontalArgs({
          aPath: a,
          bPath: b,
          outPath,
          bgImage,
          coverImage
        });

        // 执行 FFmpeg 命令
        await runFfmpeg(args, (log) => {
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
 *
 * @param {Object} params - 参数对象
 * @param {string[]} params.mainVideos - 主视频列表（B面）
 * @param {string} [params.bgImage] - 背景图路径
 * @param {string[]} [params.aVideos] - A面视频列表
 * @param {string} [params.coverImage] - 封面图路径
 * @param {string} params.outputDir - 输出目录
 * @param {number} [params.concurrency] - 并发数
 */
async function handleVerticalMerge(event, { mainVideos, bgImage, aVideos, coverImage, outputDir, concurrency }) {
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
        // 使用竖屏拼接模块构建命令
        const args = buildVerticalArgs({
          aPath: aVideo,
          bPath: mainVideo,
          outPath,
          bgImage,
          coverImage
        });

        // 执行 FFmpeg 命令
        await runFfmpeg(args, (log) => {
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
 * 横屏合成预览
 * 生成单个合成视频的预览，输出到临时目录
 */
async function handleHorizontalPreview(event, { aVideo, bVideo, bgImage, coverImage }) {
  const os = require('os');
  const fs = require('fs');

  if (!bVideo) {
    throw new Error('缺少主视频');
  }

  // 如果没有 A 面视频，使用主视频
  const finalAVideo = aVideo || bVideo;

  // 创建临时预览目录
  const tmpDir = path.join(os.tmpdir(), 'videostitcher-preview');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 生成预览文件名
  const timestamp = Date.now();
  const previewFileName = `preview_horizontal_${timestamp}.mp4`;
  const previewPath = path.join(tmpDir, previewFileName);

  // 发送预览开始事件
  event.sender.send('preview-start', { mode: 'horizontal' });

  try {
    // 使用横屏拼接模块构建命令
    const args = buildHorizontalArgs({
      aPath: finalAVideo,
      bPath: bVideo,
      outPath: previewPath,
      bgImage,
      coverImage
    });

    // 调试：输出命令
    console.log('[DEBUG 预览命令]', JSON.stringify(args.filter(a => a.startsWith('[') || a === '-filter_complex'), null, 2));

    // 执行 FFmpeg 命令
    await runFfmpeg(args, (log) => {
      event.sender.send('preview-log', { message: log });
    });

    // 发送预览完成事件，返回预览文件路径
    event.sender.send('preview-complete', { previewPath });

    return { success: true, previewPath };
  } catch (err) {
    event.sender.send('preview-error', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * 竖屏合成预览
 */
async function handleVerticalPreview(event, { mainVideo, bgImage, aVideo, coverImage }) {
  const os = require('os');
  const fs = require('fs');

  if (!mainVideo) {
    throw new Error('缺少主视频');
  }

  // 如果没有 A 面视频，使用主视频
  const finalAVideo = aVideo || mainVideo;

  // 创建临时预览目录
  const tmpDir = path.join(os.tmpdir(), 'videostitcher-preview');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 生成预览文件名
  const timestamp = Date.now();
  const previewFileName = `preview_vertical_${timestamp}.mp4`;
  const previewPath = path.join(tmpDir, previewFileName);

  // 发送预览开始事件
  event.sender.send('preview-start', { mode: 'vertical' });

  try {
    // 使用竖屏拼接模块构建命令
    const args = buildVerticalArgs({
      aPath: finalAVideo,
      bPath: mainVideo,
      outPath: previewPath,
      bgImage,
      coverImage
    });

    // 执行 FFmpeg 命令
    await runFfmpeg(args, (log) => {
      event.sender.send('preview-log', { message: log });
    });

    // 发送预览完成事件
    event.sender.send('preview-complete', { previewPath });

    return { success: true, previewPath };
  } catch (err) {
    event.sender.send('preview-error', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * 清理预览临时文件
 */
async function handleClearPreviews() {
  const os = require('os');
  const fs = require('fs');

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
    return { success: false, error: err.message };
  }
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

  // 横屏合成预览
  ipcMain.handle('preview-horizontal', async (event, config) => {
    return handleHorizontalPreview(event, config);
  });

  // 竖屏合成预览
  ipcMain.handle('preview-vertical', async (event, config) => {
    return handleVerticalPreview(event, config);
  });

  // 清理预览文件
  ipcMain.handle('clear-previews', async () => {
    return handleClearPreviews();
  });
}

module.exports = {
  registerVideoHandlers,
  handleHorizontalMerge,
  handleVerticalMerge,
  handleResize,
  handleHorizontalPreview,
  handleVerticalPreview,
  handleClearPreviews
};
