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
 * 图片压缩处理
 */
async function handleImageCompress(event, { images, targetSizeKB, outputDir }) {
  const results = [];
  const total = images.length;
  let done = 0;
  let failed = 0;

  event.sender.send('image-start', { total, mode: 'compress' });

  for (const imagePath of images) {
    try {
      // 检查文件扩展名
      const ext = path.extname(imagePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

      if (!validExtensions.includes(ext)) {
        throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
      }

      const result = await compressImage(imagePath, targetSizeKB);
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
 * 封面格式转换处理
 */
async function handleCoverFormat(event, { images, quality, outputDir }) {
  const results = [];
  const total = images.length;
  let done = 0;
  let failed = 0;

  event.sender.send('image-start', { total, mode: 'coverFormat' });

  for (const imagePath of images) {
    try {
      // 检查文件扩展名
      const ext = path.extname(imagePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

      if (!validExtensions.includes(ext)) {
        throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
      }

      const result = await convertCoverFormat(imagePath, quality);
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

  for (const imagePath of images) {
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
 * 图片素材处理 (Logo + 九宫格 + 预览)
 */
async function handleImageMaterial(event, { images, logoPath, outputDir, previewSize = 'cover' }) {
  const results = [];
  const total = images.length;
  let done = 0;
  let failed = 0;

  event.sender.send('image-start', { total, mode: 'material' });

  for (const imagePath of images) {
    try {
      // 检查文件扩展名
      const ext = path.extname(imagePath).toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

      if (!validExtensions.includes(ext)) {
        throw new Error(`不支持的文件格式: ${ext}。请选择图片文件 (jpg, png, webp 等)`);
      }

      const result = await processImageMaterial(imagePath, logoPath, outputDir, previewSize);
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
}

module.exports = {
  registerImageHandlers,
  handleImageCompress,
  handleCoverFormat,
  handleGridImage,
  handleImageMaterial
};
