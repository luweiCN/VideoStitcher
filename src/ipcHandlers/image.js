/**
 * 图片处理 IPC 处理器
 * 使用 Sharp 处理图片相关功能
 */

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const {
  compressImage,
  convertCoverFormat,
  createGridImage,
  processImageMaterial
} = require('../sharp');

/**
 * 图片压缩处理（支持多进程并行）
 */
async function handleImageCompress(event, { images, targetSizeKB, outputDir, concurrency }) {
  const results = [];
  const total = images.length;

  // 默认并发数：CPU 核心数 - 1，至少为 1
  const os = require('os');
  const cpuCount = os.cpus().length;
  const defaultConcurrency = Math.max(1, cpuCount - 1);
  // 实际并发数：用户指定的值，或者使用默认值
  // 注意：不设置上限，让用户根据自己机器性能决定
  const actualConcurrency = concurrency || defaultConcurrency;

  event.sender.send('image-start', { total, mode: 'compress', concurrency: actualConcurrency });

  // 创建处理任务
  const tasks = images.map((imagePath, index) => {
    // 返回一个函数，调用时才执行处理并发送开始事件
    return async () => {
      // 发送任务开始事件（任务真正开始处理时才发送）
      event.sender.send('image-task-start', { index });

      try {
        // 检查文件扩展名
        const ext = path.extname(imagePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

      if (!validExtensions.includes(ext)) {
        throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
      }

        // 传递 outputDir 参数
        const result = await compressImage(imagePath, targetSizeKB, outputDir);
        return { success: true, imagePath, result };
      } catch (err) {
        return {
          success: false,
          error: err.message,
          imagePath
        };
      }
    };
  });

  // 并行执行所有任务（使用动态并发数）
  let done = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i += actualConcurrency) {
    const batch = tasks.slice(i, i + actualConcurrency);
    // 执行批次中的任务函数（每个函数会发送 image-task-start 事件）
    const batchResults = await Promise.all(batch.map(task => task()));

    for (const item of batchResults) {
      if (item.success) {
        done++;
        results.push(item.result);
        event.sender.send('image-progress', {
          done,
          failed,
          total,
          current: item.imagePath,
          result: item.result
        });
        // 发送单个任务完成事件（带索引）
        event.sender.send('image-task-finish', {
          index: done - 1  // 当前已完成数量作为索引（从1开始）
        });
      } else {
        failed++;
        results.push({
          success: false,
          error: item.error,
          imagePath: item.imagePath
        });
        event.sender.send('image-failed', {
          done,
          failed,
          total,
          current: item.imagePath,
          error: item.error
        });
      }
    }
  }

  event.sender.send('image-finish', { done, failed, total });

  return { done, failed, total, results };
}

/**
 * 封面格式转换处理（支持多进程并行）
 */
async function handleCoverFormat(event, { images, quality, outputDir, concurrency }) {
  const results = [];
  const total = images.length;

  // 默认并发数：CPU 核心数 - 1，至少为 1
  const os = require('os');
  const cpuCount = os.cpus().length;
  const defaultConcurrency = Math.max(1, cpuCount - 1);
  const actualConcurrency = concurrency || defaultConcurrency;

  event.sender.send('image-start', { total, mode: 'coverFormat', concurrency: actualConcurrency });

  // 创建处理任务
  const tasks = images.map((imagePath, index) => {
    return async () => {
      // 发送任务开始事件（任务真正开始处理时才发送）
      event.sender.send('image-task-start', { index });

      try {
        // 检查文件扩展名
        const ext = path.extname(imagePath).toLowerCase();
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

        if (!validExtensions.includes(ext)) {
          throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
        }

        const result = await convertCoverFormat(imagePath, quality, outputDir);
        return { success: true, imagePath, result, index };
      } catch (err) {
        return {
          success: false,
          error: err.message,
          imagePath,
          index
        };
      }
    };
  });

  // 并行执行所有任务
  let done = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i += actualConcurrency) {
    const batch = tasks.slice(i, i + actualConcurrency);
    // 执行批次中的任务函数（每个函数会发送 image-task-start 事件）
    const batchResults = await Promise.all(batch.map(task => task()));

    for (const item of batchResults) {
      if (item.success) {
        done++;
        results.push(item.result);
        event.sender.send('image-progress', {
          done,
          failed,
          total,
          current: item.imagePath,
          result: item.result
        });
        // 发送单个任务完成事件（带索引）
        event.sender.send('image-task-finish', { index: item.index });
      } else {
        failed++;
        results.push({
          success: false,
          error: item.error,
          imagePath: item.imagePath
        });
        event.sender.send('image-failed', {
          done,
          failed,
          total,
          current: item.imagePath,
          error: item.error
        });
      }
    }
  }

  event.sender.send('image-finish', { done, failed, total });

  return { done, failed, total, results };
}

/**
 * 九宫格切割处理（支持多进程并行）
 */
async function handleGridImage(event, { images, outputDir, concurrency }) {
  const results = [];
  const total = images.length;

  // 默认并发数：CPU 核心数 - 1，至少为 1
  const os = require('os');
  const cpuCount = os.cpus().length;
  const defaultConcurrency = Math.max(1, cpuCount - 1);
  const actualConcurrency = concurrency || defaultConcurrency;

  event.sender.send('image-start', { total, mode: 'grid', concurrency: actualConcurrency });

  // 创建处理任务
  const tasks = images.map((imagePath, index) => {
    return async () => {
      // 发送任务开始事件（任务真正开始处理时才发送）
      event.sender.send('image-task-start', { index });

      try {
        // 检查文件扩展名
        const ext = path.extname(imagePath).toLowerCase();
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

        if (!validExtensions.includes(ext)) {
          throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
        }

        const result = await createGridImage(imagePath, outputDir);
        return { success: true, imagePath, result, index };
      } catch (err) {
        return {
          success: false,
          error: err.message,
          imagePath,
          index
        };
      }
    };
  });

  // 并行执行所有任务
  let done = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i += actualConcurrency) {
    const batch = tasks.slice(i, i + actualConcurrency);
    // 执行批次中的任务函数（每个函数会发送 image-task-start 事件）
    const batchResults = await Promise.all(batch.map(task => task()));

    for (const item of batchResults) {
      if (item.success) {
        done++;
        results.push(item.result);
        event.sender.send('image-progress', {
          done,
          failed,
          total,
          current: item.imagePath,
          result: item.result
        });
        // 发送单个任务完成事件（带索引）
        event.sender.send('image-task-finish', { index: item.index });
      } else {
        failed++;
        results.push({
          success: false,
          error: item.error,
          imagePath: item.imagePath
        });
        event.sender.send('image-failed', {
          done,
          failed,
          total,
          current: item.imagePath,
          error: item.error
        });
      }
    }
  }

  event.sender.send('image-finish', { done, failed, total });

  return { done, failed, total, results };
}

/**
 * 获取图片尺寸和元数据
 * 使用 sharp 获取图片的宽度、高度、方向和长宽比
 *
 * @param {string} filePath - 图片文件路径
 * @returns {Promise<Object|null>} 尺寸信息 { width, height, orientation, aspectRatio } 或 null
 */
async function getImageDimensions(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.avif'];

    if (!validExtensions.includes(ext)) {
      return null;
    }

    const metadata = await sharp(filePath).metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) {
      return null;
    }

    // 计算方向
    let orientation = 'landscape';
    if (width === height) {
      orientation = 'square';
    } else if (height > width) {
      orientation = 'portrait';
    }

    // 计算长宽比，简化为常用比例
    const ratio = width / height;
    let aspectRatio = '16:9';
    if (Math.abs(ratio - 16/9) < 0.1) aspectRatio = '16:9';
    else if (Math.abs(ratio - 9/16) < 0.1) aspectRatio = '9:16';
    else if (Math.abs(ratio - 4/3) < 0.1) aspectRatio = '4:3';
    else if (Math.abs(ratio - 3/4) < 0.1) aspectRatio = '3:4';
    else if (Math.abs(ratio - 1) < 0.05) aspectRatio = '1:1';
    else aspectRatio = `${Math.round(ratio * 10) / 10}:1`;

    return {
      width,
      height,
      orientation,
      aspectRatio
    };
  } catch (error) {
    console.error(`[获取图片尺寸] 失败: ${filePath} - ${error.message}`);
    return null;
  }
}

/**
 * 获取图片完整信息（缩略图 + 尺寸 + 文件大小）
 * 类似于视频的 getVideoFullInfo
 *
 * @param {string} filePath - 图片路径
 * @param {Object} options - 选项
 * @param {number} [options.thumbnailMaxSize=200] - 缩略图最大尺寸
 * @returns {Promise<Object>} 完整信息对象
 */
async function getImageFullInfo(filePath, options = {}) {
  const { thumbnailMaxSize = 200 } = options;

  const result = {
    success: true,
    path: filePath,
    name: path.basename(filePath),
    thumbnail: null,
    previewUrl: `preview://${encodeURIComponent(filePath)}`,
    width: null,
    height: null,
    orientation: null,
    aspectRatio: null,
    fileSize: null,
  };

  try {
    if (!fs.existsSync(filePath)) {
      return { ...result, success: false, error: '文件不存在' };
    }

    // 并行获取：文件大小、尺寸、缩略图
    const [stats, dimensions, thumbnailResult] = await Promise.all([
      // 文件大小
      fs.promises.stat(filePath).then(s => s.size).catch(() => null),
      // 尺寸信息
      getImageDimensions(filePath),
      // 缩略图
      (async () => {
        try {
          const metadata = await sharp(filePath).metadata();
          const size = typeof thumbnailMaxSize === 'number' && thumbnailMaxSize > 0 ? thumbnailMaxSize : 200;
          const sourceMax = Math.max(metadata.width, metadata.height);
          const scale = sourceMax > size ? size / sourceMax : 1;

          const resized = await sharp(filePath)
            .resize(size, size, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();

          const base64 = resized.toString('base64');
          return {
            thumbnail: `data:image/png;base64,${base64}`,
            width: Math.round(metadata.width * scale),
            height: Math.round(metadata.height * scale),
          };
        } catch {
          return null;
        }
      })(),
    ]);

    // 填充结果
    result.fileSize = stats;
    if (dimensions) {
      result.width = dimensions.width;
      result.height = dimensions.height;
      result.orientation = dimensions.orientation;
      result.aspectRatio = dimensions.aspectRatio;
    }
    if (thumbnailResult) {
      result.thumbnail = thumbnailResult.thumbnail;
    }
  } catch (error) {
    console.error(`[getImageFullInfo] 失败: ${filePath} - ${error.message}`);
    result.success = false;
    result.error = error.message;
  }

  return result;
}

/**
 * 图片素材处理预览
 * 生成预览效果（不保存到输出目录，而是保存到临时目录）
 */
async function handleImageMaterialPreview(event, {
  imagePath,
  logoPath,
  previewSize = 'cover',
  logoPosition = null,
  logoScale = 1
}) {
  console.log('[预览] 开始生成预览:', { imagePath, logoPath, previewSize, logoPosition, logoScale });

  const os = require('os');

  // 创建临时预览目录
  const tmpDir = path.join(os.tmpdir(), 'videostitcher-preview', `material-${Date.now()}`);
  await require('fs').promises.mkdir(tmpDir, { recursive: true });

  console.log('[预览] 临时目录:', tmpDir);

  // 调用处理函数，使用临时目录，默认导出所有内容
  const result = await processImageMaterial(
    imagePath,
    logoPath,
    tmpDir,
    previewSize,
    logoPosition,
    logoScale,
    { single: true, grid: true } // 预览时总是生成所有内容
  );

  console.log('[预览] 处理完成:', result.results);

  return {
    success: true,
    previewDir: tmpDir,
    ...result.results
  };
}

/**
 * 图片素材处理 (Logo + 九宫格 + 预览) - 支持并发处理
 */
async function handleImageMaterial(event, {
  images,
  logoPath,
  outputDir,
  previewSize = 'cover',
  logoPosition = null,
  logoScale = 1,
  exportOptions = { single: true, grid: true },
  concurrency
}) {
  const results = [];
  const total = images.length;

  // 默认并发数：CPU 核心数 - 1，至少为 1
  const os = require('os');
  const cpuCount = os.cpus().length;
  const defaultConcurrency = Math.max(1, cpuCount - 1);
  const actualConcurrency = concurrency || defaultConcurrency;

  event.sender.send('image-start', { total, mode: 'material', concurrency: actualConcurrency });

  // 创建处理任务
  const tasks = images.map((imagePath, index) => {
    return async () => {
      // 发送任务开始事件
      event.sender.send('image-task-start', { index });

      try {
        // 检查文件扩展名
        const ext = path.extname(imagePath).toLowerCase();
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

        if (!validExtensions.includes(ext)) {
          throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
        }

        const result = await processImageMaterial(
          imagePath,
          logoPath,
          outputDir,
          previewSize,
          logoPosition,
          logoScale,
          exportOptions
        );
        return { success: true, imagePath, result, index };
      } catch (err) {
        return {
          success: false,
          error: err.message,
          imagePath,
          index
        };
      }
    };
  });

  // 并行执行所有任务
  let done = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i += actualConcurrency) {
    const batch = tasks.slice(i, i + actualConcurrency);
    const batchResults = await Promise.all(batch.map(task => task()));

    for (const item of batchResults) {
      if (item.success) {
        done++;
        results.push(item.result);
        // 发送单个任务完成事件
        event.sender.send('image-task-finish', { index: item.index });
        event.sender.send('image-progress', {
          done,
          failed,
          total,
          current: item.imagePath,
          result: item.result
        });
      } else {
        failed++;
        results.push({
          success: false,
          error: item.error,
          imagePath: item.imagePath
        });
        event.sender.send('image-failed', {
          done,
          failed,
          total,
          current: item.imagePath,
          error: item.error
        });
      }
    }
  }

  event.sender.send('image-finish', { done, failed, total });

  return { done, failed, total, results };
}

/**
 * 注册所有图片处理 IPC 处理器
 */
function registerImageHandlers() {
  // 获取 CPU 核心数
  ipcMain.handle('get-cpu-count', async () => {
    const os = require('os');
    return {
      success: true,
      cpuCount: os.cpus().length
    };
  });

  // 获取图片尺寸
  ipcMain.handle('image:get-dimensions', async (event, filePath) => {
    return getImageDimensions(filePath);
  });

  // 获取图片完整信息（缩略图 + 尺寸 + 文件大小）
  ipcMain.handle('image:get-full-info', async (event, filePath, options) => {
    return getImageFullInfo(filePath, options);
  });

  // 图片压缩
  ipcMain.handle('image-compress', async (event, config) => {
    return handleImageCompress(event, config);
  });

  // 封面格式转换
  ipcMain.handle('image-cover-format', async (event, config) => {
    return handleCoverFormat(event, config);
  });

  // 九宫格切割
  ipcMain.handle('image-grid', async (event, config) => {
    return handleGridImage(event, config);
  });

  // 图片素材处理
  ipcMain.handle('image-material', async (event, config) => {
    return handleImageMaterial(event, config);
  });

  // 图片素材处理预览
  ipcMain.handle('preview-image-material', async (event, config) => {
    return handleImageMaterialPreview(event, config);
  });
}

module.exports = {
  registerImageHandlers,
  getImageDimensions,
  getImageFullInfo,
  handleImageCompress,
  handleCoverFormat,
  handleGridImage,
  handleImageMaterial,
  handleImageMaterialPreview
};
