/**
 * 图片处理 IPC 处理器
 * 使用 Sharp 处理图片相关功能
 */

const { ipcMain } = require('electron');
const path = require('path');
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
  const tasks = images.map(async (imagePath, index) => {
    // 发送任务开始事件
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
  });

  // 并行执行所有任务（使用动态并发数）
  let done = 0;
  let failed = 0;

  for (let i = 0; i < tasks.length; i += actualConcurrency) {
    const batch = tasks.slice(i, i + actualConcurrency);
    const batchResults = await Promise.all(batch);

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
 * 封面格式转换处理
 */
async function handleCoverFormat(event, { images, quality, outputDir }) {
  const results = [];
  const total = images.length;
  let done = 0;
  let failed = 0;

  event.sender.send('image-start', { total, mode: 'coverFormat' });

  for (let index = 0; index < images.length; index++) {
    const imagePath = images[index];

    // 发送任务开始事件
    event.sender.send('image-task-start', { index });

    try {
      // 检查文件扩展名
      const ext = path.extname(imagePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

      if (!validExtensions.includes(ext)) {
        throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
      }

      const result = await convertCoverFormat(imagePath, quality, outputDir);
      results.push(result);
      done++;
      event.sender.send('image-progress', {
        done,
        failed,
        total,
        current: imagePath,
        result
      });
    } catch (err) {
      failed++;
      results.push({
        success: false,
        error: err.message,
        imagePath
      });
      event.sender.send('image-failed', {
        done,
        failed,
        total,
        current: imagePath,
        error: err.message
      });
    }
  }

  event.sender.send('image-finish', { done, failed, total });

  return { done, failed, total, results };
}

/**
 * 九宫格切割处理
 */
async function handleGridImage(event, { images, outputDir }) {
  const results = [];
  const total = images.length;
  let done = 0;
  let failed = 0;

  event.sender.send('image-start', { total, mode: 'grid' });

  for (let index = 0; index < images.length; index++) {
    const imagePath = images[index];

    // 发送任务开始事件
    event.sender.send('image-task-start', { index });

    try {
      // 检查文件扩展名
      const ext = path.extname(imagePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

      if (!validExtensions.includes(ext)) {
        throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
      }

      const result = await createGridImage(imagePath, outputDir);
      results.push(result);
      done++;
      event.sender.send('image-progress', {
        done,
        failed,
        total,
        current: imagePath,
        result
      });
    } catch (err) {
      failed++;
      results.push({
        success: false,
        error: err.message,
        imagePath
      });
      event.sender.send('image-failed', {
        done,
        failed,
        total,
        current: imagePath,
        error: err.message
      });
    }
  }

  event.sender.send('image-finish', { done, failed, total });

  return { done, failed, total, results };
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
 * 图片素材处理 (Logo + 九宫格 + 预览)
 */
async function handleImageMaterial(event, {
  images,
  logoPath,
  outputDir,
  previewSize = 'cover',
  logoPosition = null,
  logoScale = 1,
  exportOptions = { single: true, grid: true }
}) {
  const results = [];
  const total = images.length;
  let done = 0;
  let failed = 0;

  event.sender.send('image-start', { total, mode: 'material' });

  for (let index = 0; index < images.length; index++) {
    const imagePath = images[index];

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
      results.push(result);
      done++;
      event.sender.send('image-progress', {
        done,
        failed,
        total,
        current: imagePath,
        result
      });
    } catch (err) {
      failed++;
      results.push({
        success: false,
        error: err.message,
        imagePath
      });
      event.sender.send('image-failed', {
        done,
        failed,
        total,
        current: imagePath,
        error: err.message
      });
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
  handleImageCompress,
  handleCoverFormat,
  handleGridImage,
  handleImageMaterial,
  handleImageMaterialPreview
};
