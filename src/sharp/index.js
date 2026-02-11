/**
 * Sharp 图片处理服务
 * 将 VideoMaster 的 Canvas 图片处理功能转换为 Sharp 实现
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * 辅助函数：在第 N 个分隔符左侧插入文本
 * 例如: Part1-Part2-Part3-Part4-Part5-Part6-Part7-Part8-Part9
 * 在第8个'-'左侧插入 'NEW' 变为: Part1-Part2-Part3-Part4-Part5-Part6-Part7-Part8NEW-Part9
 * 
 * @param {string} originalName - 原始名称
 * @param {string} insertText - 要插入的文本
 * @param {string} delimiter - 分隔符 (默认 '-')
 * @param {number} targetIndex - 目标分隔符索引 (默认 8)
 */
function getModifiedName(originalName, insertText, delimiter = '-', targetIndex = 8) {
  if (!originalName) return insertText;
  
  const parts = originalName.split(delimiter);
  if (parts.length < targetIndex) {
    // 如果分隔符数量不足，直接加在末尾
    return originalName + insertText;
  }
  
  const prefixParts = parts.slice(0, targetIndex);
  const suffixParts = parts.slice(targetIndex);
  
  const prefix = prefixParts.join(delimiter);
  const suffix = suffixParts.join(delimiter);
  
  return prefix + insertText + (suffix ? delimiter + suffix : '');
}

/**
 * 图片压缩服务
 * 将图片压缩到指定大小 (KB) 以内
 *
 * VideoMaster 原逻辑:
 * - 使用 Canvas toBlob 迭代压缩
 * - 先降低 quality, 再降低尺寸
 *
 * Sharp 实现:
 * - 使用 sharp 的 jpeg({ quality }) 和 resize()
 * - 迭代调整直到满足大小要求
 *
 * @param {string} inputPath - 输入图片路径
 * @param {number} targetSizeKB - 目标大小（KB）
 * @param {string} outputDir - 输出目录（可选，默认为输入文件所在目录）
 */
async function compressImage(inputPath, targetSizeKB = 380, outputDir = null) {
  const targetSizeBytes = targetSizeKB * 1024;
  const stats = await fs.stat(inputPath);

  // 如果文件已经小于目标大小, 直接返回
  if (stats.size <= targetSizeBytes) {
    return {
      success: true,
      outputPath: inputPath,
      originalSize: stats.size,
      compressedSize: stats.size,
      compressed: false
    };
  }

  const inputBaseName = path.parse(inputPath).name;
  // 使用指定的输出目录，如果没有指定则使用输入文件所在目录
  const outputPath = path.join(
    outputDir || path.dirname(inputPath),
    `${inputBaseName}_compressed.jpg`
  );

  let quality = 90;
  let scale = 1.0;
  let buffer;
  let iteration = 0;
  const maxIterations = 15;

  // 获取原始图片尺寸
  const metadata = await sharp(inputPath).metadata();
  let width = metadata.width;
  let height = metadata.height;

  while (iteration < maxIterations) {
    iteration++;

    buffer = await sharp(inputPath)
      .resize(Math.round(width * scale), Math.round(height * scale), {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    if (buffer.length <= targetSizeBytes) {
      break;
    }

    // 调整策略: 先降质量, 再降尺寸
    if (quality > 50) {
      quality -= 10;
    } else {
      scale *= 0.85;
    }
  }

  await fs.writeFile(outputPath, buffer);

  return {
    success: true,
    outputPath,
    originalSize: stats.size,
    compressedSize: buffer.length,
    compressed: true,
    quality,
    scale
  };
}

/**
 * 封面格式转换服务
 * 自动检测画面比例并转换到标准尺寸
 *
 * VideoMaster 原逻辑:
 * - 横版 (宽 > 高): 1920x1080
 * - 竖版 (高 > 宽): 1080x1920
 * - 方形 (比例接近 1:1): 800x800
 *
 * @param {string} inputPath - 输入图片路径
 * @param {number} quality - 输出质量 (60-100)
 * @param {string} outputDir - 输出目录（可选，默认为输入文件所在目录）
 */
async function convertCoverFormat(inputPath, quality = 90, outputDir = null) {
  const metadata = await sharp(inputPath).metadata();
  const ratio = metadata.width / metadata.height;

  let targetWidth, targetHeight, suffix;

  // 检测比例 (容差 ±10%)
  if (ratio >= 0.9 && ratio <= 1.1) {
    // 方形
    targetWidth = 800;
    targetHeight = 800;
    suffix = '_800x800';
  } else if (metadata.width >= metadata.height) {
    // 横版
    targetWidth = 1920;
    targetHeight = 1080;
    suffix = '_1920x1080';
  } else {
    // 竖版
    targetWidth = 1080;
    targetHeight = 1920;
    suffix = '_1080x1920';
  }

  const inputBaseName = path.parse(inputPath).name;
  const inputExt = path.parse(inputPath).ext;
  // 使用指定的输出目录，如果没有指定则使用输入文件所在目录
  const outputPath = path.join(
    outputDir || path.dirname(inputPath),
    `${inputBaseName}${suffix}${inputExt}`
  );

  await sharp(inputPath)
    .resize(targetWidth, targetHeight, {
      fit: 'fill',
      withoutEnlargement: false
    })
    .jpeg({ quality })
    .toFile(outputPath);

  return {
    success: true,
    outputPath,
    targetSize: { width: targetWidth, height: targetHeight },
    originalSize: { width: metadata.width, height: metadata.height }
  };
}

/**
 * 九宫格切割服务
 * 将图片切割成 3x3 的网格
 *
 * VideoMaster 原逻辑:
 * - 使用 Canvas drawImage 提取区域
 * - 导出 9 张单独图片
 * 
 * @param {string} inputPath - 输入图片路径
 * @param {string} outputDir - 输出目录
 * @param {string} baseNameOverride - 可选的原始文件名覆盖（用于保持特殊的命名规则）
 * @param {number} targetTileSize - 目标格子尺寸 (默认 800)，如果原图格子小于此尺寸则放大
 */
async function createGridImage(inputPath, outputDir, baseNameOverride = null, targetTileSize = 800) {
  const metadata = await sharp(inputPath).metadata();
  let { width, height } = metadata;

  let processingInput = inputPath;
  let currentWidth = width;
  let currentHeight = height;
  let isTempFile = false;

  // 如果提供了 targetTileSize，并且当前是正方形比例且尺寸不足，则先整体放大
  // 例如：800x800 的图，想切出 800x800 的九宫格，需要先放大到 2400x2400
  const ratio = width / height;
  const isSquare = ratio >= 0.9 && ratio <= 1.1;

  if (targetTileSize && isSquare && (width < targetTileSize * 3)) {
    const os = require('os');
    const tmpDir = path.join(os.tmpdir(), 'videostitcher-temp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tempPath = path.join(tmpDir, `grid_master_${Date.now()}.png`);
    
    await sharp(inputPath)
      .resize(targetTileSize * 3, targetTileSize * 3, {
        fit: 'fill',
        withoutEnlargement: false
      })
      .png()
      .toFile(tempPath);
    
    processingInput = tempPath;
    currentWidth = targetTileSize * 3;
    currentHeight = targetTileSize * 3;
    isTempFile = true;
  }

  // 计算每个格子的尺寸
  const tileWidth = Math.floor(currentWidth / 3);
  const tileHeight = Math.floor(currentHeight / 3);

  const inputBaseName = baseNameOverride || path.parse(inputPath).name;
  const results = [];

  // 确保输出目录存在
  await fs.mkdir(outputDir, { recursive: true });

  // 切割 3x3 网格
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const left = col * tileWidth;
      const top = row * tileHeight;
      const index = row * 3 + col + 1;
      
      // 使用辅助函数生成符合要求的名称
      const finalName = getModifiedName(inputBaseName, `九宫格${index}`);
      const outputPath = path.join(outputDir, `${finalName}.png`);

      await sharp(processingInput)
        .extract({ left, top, width: tileWidth, height: tileHeight })
        .png()
        .toFile(outputPath);

      results.push({
        index,
        outputPath,
        position: { row: row + 1, col: col + 1 },
        size: { width: tileWidth, height: tileHeight }
      });
    }
  }

  // 清理临时文件
  if (isTempFile) {
    try {
      await fs.unlink(processingInput);
    } catch (e) {
      console.error('清理临时文件失败:', e);
    }
  }

  return {
    success: true,
    grid: results,
    originalSize: { width, height },
    tileSize: { width: tileWidth, height: tileHeight }
  };
}

/**
 * 图片素材处理服务
 * 批量添加 Logo 并导出九宫格和预览图
 *
 * 新增参数:
 * - logoPosition: Logo 位置 {x, y} (相对 800x800 画布)
 * - logoScale: Logo 缩放比例 (1 = 原始大小)
 * - exportOptions: 导出选项 {single: boolean, grid: boolean}
 *
 * 所有模式都生成 800x800 方形预览图，区别在于生成方式：
 * - cover: 裁剪正方形 (取中心区域) -> 800x800
 * - inside: 800x800 正方形，保持比例缩放，留白
 * - fill: 800x800 正方形，强制拉伸（变形）
 * - pad: 800x800 正方形，留白填充（保持原图完整）
 */
async function processImageMaterial(
  inputPath,
  logoPath,
  outputDir,
  previewSize = 'cover',
  logoPosition = null,
  logoScale = 1,
  exportOptions = { single: true, grid: true }
) {
  const inputBaseName = path.parse(inputPath).name;
  const results = {};
  const GRID_SIZE = 2400; // 800 * 3, 确保每张小图也是 800x800
  const SINGLE_SIZE = 800;

  // ========== 步骤 1: 生成高分辨率母图 (2400x2400) 用于九宫格或高质量单图 ==========
  // 即使只导出单图，我们也先按 2400 处理以保证 Logo 质量，最后再缩小
  const masterTmpDir = path.join(require('os').tmpdir(), 'videostitcher-temp');
  await fs.mkdir(masterTmpDir, { recursive: true });
  const masterPath = path.join(masterTmpDir, `${inputBaseName}_master.png`);

  const fitMapping = {
    'cover': 'cover',
    'inside': 'contain',
    'fill': 'fill'
  };

  const masterOptions = {
    width: GRID_SIZE,
    height: GRID_SIZE,
    fit: fitMapping[previewSize] || 'cover'
  };

  if (previewSize === 'inside') {
    masterOptions.background = { r: 255, g: 255, b: 255, alpha: 1 };
  }

  await sharp(inputPath)
    .resize(masterOptions)
    .png() // 使用 PNG 作为中间格式
    .toFile(masterPath);

  // ========== 步骤 2: 在母图上添加 Logo (坐标和尺寸需乘以 3) ==========
  let logoMasterPath = masterPath;
  if (logoPath) {
    const logoMetadata = await sharp(logoPath).metadata();
    const logoOriginalSize = Math.max(logoMetadata.width, logoMetadata.height);
    
    // UI 是基于 800 尺寸设计的，所以在 2400 母图上要乘以 3
    const logoSizeOn800 = Math.floor(logoOriginalSize * logoScale);
    const finalLogoSize = Math.min(logoSizeOn800, 400) * 3; // 扩大3倍

    logoMasterPath = path.join(masterTmpDir, `${inputBaseName}_master_logo.png`);

    if (logoPosition && (logoPosition.x !== 50 || logoPosition.y !== 50)) {
      // 坐标也扩大3倍
      const logoBuffer = await sharp(logoPath)
        .resize(finalLogoSize, finalLogoSize, { fit: 'inside' })
        .toBuffer();

      await sharp(masterPath)
        .composite([{
          input: logoBuffer,
          left: Math.round(logoPosition.x * 3),
          top: Math.round(logoPosition.y * 3),
          blend: 'over'
        }])
        .png()
        .toFile(logoMasterPath);
    } else {
      // 默认右下角
      const logoBuffer = await sharp(logoPath)
        .resize(finalLogoSize, finalLogoSize, { fit: 'inside' })
        .toBuffer();

      await sharp(masterPath)
        .composite([{
          input: logoBuffer,
          gravity: 'southeast',
          blend: 'over'
        }])
        .png()
        .toFile(logoMasterPath);
    }
  }

  // ========== 步骤 3: 导出单张 800x800 图片 ==========
  if (exportOptions.single) {
    const finalName = getModifiedName(inputBaseName, '800尺寸单图');
    const singleOutputPath = path.join(outputDir, 'single', `${finalName}.jpg`);
    await fs.mkdir(path.dirname(singleOutputPath), { recursive: true });

    await sharp(logoMasterPath)
      .resize(SINGLE_SIZE, SINGLE_SIZE)
      .jpeg({ quality: 95 })
      .toFile(singleOutputPath);
    
    results.logo = singleOutputPath; // single 导出的结果
  }

  // ========== 步骤 4: 导出九宫格 (每个小图 800x800) ==========
  if (exportOptions.grid) {
    const gridResult = await createGridImage(
      logoMasterPath,
      path.join(outputDir, 'grid'),
      inputBaseName
    );
    results.grid = gridResult;
  }

  // 清理中间大图 (可选，如果不清理系统会自动清理临时目录)
  try {
    await fs.unlink(masterPath);
    if (logoMasterPath !== masterPath) await fs.unlink(logoMasterPath);
  } catch (e) {}

  return {
    success: true,
    results
  };
}

module.exports = {
  compressImage,
  convertCoverFormat,
  createGridImage,
  processImageMaterial
};
