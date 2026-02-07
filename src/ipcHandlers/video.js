/**
 * 视频处理 IPC 处理器
 * 扩展现有的视频处理功能, 支持 VideoMaster 的所有视频模式
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { runFfmpeg } = require('../ffmpeg/runFfmpeg');
const { buildArgs } = require('../ffmpeg/videoMerge');
const { TaskQueue } = require('../ffmpeg/queue');
const { generatePreviews, cleanupPreviews } = require('../ffmpeg/videoResize');
const os = require('os');
const { spawn } = require('child_process');
const app = require('electron').app ?? require('@electron/remote');

// 创建任务队列 (复用现有逻辑)
const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

/**
 * 获取视频元数据（尺寸、时长等）
 * 使用 ffprobe 获取视频信息
 */
async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = require('ffmpeg-static').replace('ffmpeg', 'ffprobe');

    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration',
      '-of', 'json',
      filePath
    ];

    const process = spawn(ffprobePath, args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
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
            duration: stream.duration ? parseFloat(stream.duration) : 0
          });
        } else {
          reject(new Error('无法解析视频元数据'));
        }
      } catch (err) {
        reject(new Error(`解析 ffprobe 输出失败: ${err.message}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`ffprobe 执行失败: ${err.message}`));
    });
  });
}

/**
 * 横屏合成处理
 * 使用现有的 A+B 拼接逻辑
 *
 * @param {Object} params - 参数对象
 * @param {string[]} params.aVideos - A面视频列表
 * @param {string[]} params.bVideos - B面视频列表（主视频）
 * @param {string} [params.bgImage] - 背景图路径
 * @param {string[]} [params.coverImages] - 封面图列表（支持批量，每个任务随机选择）
 * @param {string} params.outputDir - 输出目录
 * @param {number} [params.concurrency] - 并发数
 * @param {Object} [params.aPosition] - A面视频位置 {x, y, width, height}
 * @param {Object} [params.bPosition] - B面视频位置 {x, y, width, height}（默认位置，用于所有视频）
 * @param {Object[]} [params.bPositions] - 每个B面视频的独立位置数组（可选，优先级高于 bPosition）
 * @param {Object} [params.bgPosition] - 背景图位置 {x, y, width, height}
 * @param {Object} [params.coverPosition] - 封面图位置 {x, y, width, height}
 */
async function handleHorizontalMerge(event, { aVideos, bVideos, bgImage, coverImages, outputDir, concurrency, aPosition, bPosition, bPositions, bgPosition, coverPosition }) {
  if (!bVideos.length) {
    throw new Error('主视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  // 如果没有 A 面视频，则不传 aPath，buildArgs 会处理
  const hasAVideos = aVideos && aVideos.length > 0;

  // 设置并发数
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = bVideos.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'horizontal', concurrency: queue.concurrency });

  // --- 全局 A 面视频分配策略 ---
  const globalASideAssignments = [];
  if (hasAVideos) {
    let pool = [...aVideos];
    pool.sort(() => 0.5 - Math.random());

    for (let k = 0; k < total; k++) {
      if (pool.length === 0) {
        pool = [...aVideos];
        pool.sort(() => 0.5 - Math.random());
      }
      globalASideAssignments.push(pool.pop());
    }
  } else {
    // 明确设置为 undefined
    for (let k = 0; k < total; k++) {
      globalASideAssignments.push(undefined);
    }
  }

  // --- 全局封面图分配策略 ---
  const globalCoverAssignments = [];
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
      // 使用预分配的 A 面视频和封面图
      const selectedAVideo = globalASideAssignments[index];
      const selectedCoverImage = globalCoverAssignments[index];

      const bName = path.parse(b).name;
      let outName;
      if (selectedAVideo) {
        const aName = path.parse(selectedAVideo).name;
        outName = `${aName}__${bName}__${String(index + 1).padStart(4, '0')}_horizontal.mp4`;
      } else {
        outName = `${bName}__${String(index + 1).padStart(4, '0')}_horizontal.mp4`;
      }
      const outPath = path.join(outputDir, outName);

      try {
        // 获取当前 B 视频的位置（如果有独立位置配置）
        const currentBPosition = (bPositions && bPositions[index]) || bPosition;

        // 使用统一拼接模块构建命令
        const args = buildArgs({
          aPath: selectedAVideo,
          bPath: b,
          outPath,
          bgImage,
          coverImage: selectedCoverImage,
          aPosition,
          bPosition: currentBPosition,
          bgPosition,
          coverPosition,
          orientation: 'horizontal'
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
 * @param {string[]} [params.coverImages] - 封面图列表（支持批量，每个任务随机选择）
 * @param {string} params.outputDir - 输出目录
 * @param {number} [params.concurrency] - 并发数
 * @param {Object} [params.aPosition] - A面视频位置 {x, y, width, height}
 * @param {Object} [params.bPosition] - B面视频位置 {x, y, width, height}（默认位置，用于所有视频）
 * @param {Object[]} [params.bPositions] - 每个B面视频的独立位置数组（可选，优先级高于 bPosition）
 * @param {Object} [params.bgPosition] - 背景图位置 {x, y, width, height}
 * @param {Object} [params.coverPosition] - 封面图位置 {x, y, width, height}
 */
async function handleVerticalMerge(event, { mainVideos, bgImage, aVideos, coverImages, outputDir, concurrency, aPosition, bPosition, bPositions, bgPosition, coverPosition }) {
  if (!mainVideos.length) {
    throw new Error('主视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

    // 如果没有 A 面视频，则不传 aPath，buildArgs 会处理

    const hasAVideos = aVideos && aVideos.length > 0;

  

    queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  

    const total = mainVideos.length;

    let done = 0;

    let failed = 0;

  

    event.sender.send('video-start', { total, mode: 'vertical', concurrency: queue.concurrency });

  

    // --- 全局 A 面视频分配策略 ---

    const globalASideAssignments = [];

    if (hasAVideos) {

      let pool = [...aVideos];

      pool.sort(() => 0.5 - Math.random());

  

      for (let k = 0; k < total; k++) {

        if (pool.length === 0) {

          pool = [...aVideos];

          pool.sort(() => 0.5 - Math.random());

        }

        globalASideAssignments.push(pool.pop());

      }

    } else {

      for (let k = 0; k < total; k++) {

        globalASideAssignments.push(undefined);

      }

    }

  

  // --- 全局封面图分配策略 ---
  const globalCoverAssignments = [];
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
      // 使用预分配的 A 面视频和封面图
      const selectedAVideo = globalASideAssignments[index];
      const selectedCoverImage = globalCoverAssignments[index];

      const bName = path.parse(mainVideo).name;
      let outName;
      if (selectedAVideo) {
        const aName = path.parse(selectedAVideo).name;
        outName = `${aName}__${bName}__${String(index + 1).padStart(4, '0')}_vertical.mp4`;
      } else {
        outName = `${bName}__${String(index + 1).padStart(4, '0')}_vertical.mp4`;
      }
      const outPath = path.join(outputDir, outName);

      try {
        // 获取当前 B 视频的位置（如果有独立位置配置）
        const currentBPosition = (bPositions && bPositions[index]) || bPosition;

        // 使用统一拼接模块构建命令
        const args = buildArgs({
          aPath: selectedAVideo,
          bPath: mainVideo,
          outPath,
          bgImage,
          coverImage: selectedCoverImage,
          aPosition,
          bPosition: currentBPosition,
          bgPosition,
          coverPosition,
          orientation: 'vertical'
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
 * 为每个视频生成指定模式的输出视频
 */
async function handleResize(event, { videos, mode, blurAmount, outputDir, concurrency }) {
  if (!videos.length) {
    throw new Error('视频库为空');
  }
  if (!outputDir) {
    throw new Error('未选择输出目录');
  }

  const { buildArgs: buildResizeArgs, RESIZE_CONFIGS } = require('../ffmpeg/videoResize');
  const configs = RESIZE_CONFIGS[mode];
  if (!configs) {
    throw new Error(`无效的模式: ${mode}`);
  }

  // 设置并发数
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  // 计算总任务数：每个视频可能生成多个输出
  const total = videos.length * configs.length;
  let done = 0;
  let failed = 0;

  event.sender.send('video-start', { total, mode: 'resize', concurrency: queue.concurrency });

  const tasks = [];

  for (let i = 0; i < videos.length; i++) {
    const videoPath = videos[i];
    const fileName = path.parse(videoPath).name;

    for (let j = 0; j < configs.length; j++) {
      const config = configs[j];
      const suffix = config.suffix;
      const outName = `${fileName}${suffix}.mp4`;
      const outPath = path.join(outputDir, outName);

      tasks.push(queue.push(async () => {
        const index = i * configs.length + j;

        try {
          console.log(`[handleResize] 处理任务 ${index}: ${videoPath}, 目标: ${config.width}x${config.height}, 模糊: ${blurAmount}`);

          const args = buildResizeArgs({
            inputPath: videoPath,
            outputPath: outPath,
            width: config.width,
            height: config.height,
            blurAmount,
            // 每个任务使用全部 CPU 核心数，提高单个任务速度
            threads: os.cpus().length,
          });

          console.log(`[handleResize] FFmpeg 命令:`, JSON.stringify(args.filter(a => a.startsWith('[') || a === '-filter_complex'), null, 2));

          await runFfmpeg(args, (log) => {
            event.sender.send('video-log', { index, message: log });
          });

          done++;
          event.sender.send('video-progress', { done, failed, total, index, outputPath: outPath });
        } catch (err) {
          failed++;
          event.sender.send('video-failed', { done, failed, total, index, error: err.message });
        }
      }));
    }
  }

  await Promise.allSettled(tasks);
  event.sender.send('video-finish', { done, failed, total });

  return { done, failed, total };
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

  // 如果没有 A 面视频，则设为 undefined，buildArgs 会处理
  const finalAVideo = aVideo;

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
    // 使用统一拼接模块构建命令
    const args = buildArgs({
      aPath: finalAVideo,
      bPath: bVideo,
      outPath: previewPath,
      bgImage,
      coverImage,
      orientation: 'horizontal'
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

  // 如果没有 A 面视频，则设为 undefined，buildArgs 会处理
  const finalAVideo = aVideo;

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
    // 使用统一拼接模块构建命令
    const args = buildArgs({
      aPath: finalAVideo,
      bPath: mainVideo,
      outPath: previewPath,
      bgImage,
      coverImage,
      orientation: 'vertical'
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
 * 智能改尺寸预览处理
 * 生成真实的预览视频文件
 *
 * @param {Object} event - IPC 事件对象
 * @param {Object} params - 参数对象
 * @param {string} params.videoPath - 视频文件路径
 * @param {string} params.mode - 模式 (siya | fishing | unify_h | unify_v)
 * @param {number} params.blurAmount - 模糊程度
 * @returns {Promise<Object>} 预览结果
 */
async function handleGenerateResizePreviews(event, { videoPath, mode, blurAmount }) {
  const os = require('os');
  const path = require('path');

  const tempDir = path.join(os.tmpdir(), 'videostitcher-preview');

  try {
    event.sender.send('preview-start', { mode });

    const previews = await generatePreviews({
      inputPath: videoPath,
      tempDir,
      mode,
      blurAmount,
      threads: os.cpus().length,  // 预览也使用全部 CPU 核心
      onProgress: (progress) => {
        event.sender.send('preview-log', { message: `处理进度: ${Math.floor(progress)}%` });
      },
      onLog: (log) => {
        event.sender.send('preview-log', { message: log });
      },
    });

    event.sender.send('preview-complete', { previewPaths: previews.map(p => p.path) });

    return { success: true, previews };
  } catch (err) {
    event.sender.send('preview-error', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * 清理指定的智能改尺寸预览文件
 *
 * @param {Object} event - IPC 事件对象
 * @param {Object} params - 参数对象
 * @param {string[]} params.previewPaths - 预览文件路径数组
 * @returns {Promise<Object>} 清理结果
 */
async function handleClearResizePreviews(event, { previewPaths }) {
  try {
    cleanupPreviews(previewPaths);
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

  // 智能改尺寸预览
  ipcMain.handle('generate-resize-previews', async (event, config) => {
    return handleGenerateResizePreviews(event, config);
  });

  // 清理智能改尺寸预览
  ipcMain.handle('clear-resize-previews', async (event, config) => {
    return handleClearResizePreviews(event, config);
  });

  // 获取视频元数据
  ipcMain.handle('video-get-metadata', async (event, filePath) => {
    return getVideoMetadata(filePath);
  });
}

module.exports = {
  registerVideoHandlers,
  handleHorizontalMerge,
  handleVerticalMerge,
  handleResize,
  handleHorizontalPreview,
  handleVerticalPreview,
  handleClearPreviews,
  handleGenerateResizePreviews,
  handleClearResizePreviews,
  getVideoMetadata
};
