/**
 * Sharp 图片处理服务
 * 将 VideoMaster 的 Canvas 图片处理功能转换为 Sharp 实现
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

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
 */
async function compressImage(inputPath, targetSizeKB = 380) {
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
  const outputPath = path.join(path.dirname(inputPath), `${inputBaseName}_compressed.jpg`);

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
 */
async function convertCoverFormat(inputPath, quality = 90) {
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
  const outputPath = path.join(
    path.dirname(inputPath),
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
 */
async function createGridImage(inputPath, outputDir) {
  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;

  // 计算每个格子的尺寸
  const tileWidth = Math.floor(width / 3);
  const tileHeight = Math.floor(height / 3);

  const inputBaseName = path.parse(inputPath).name;
  const results = [];

  // 确保输出目录存在
  await fs.mkdir(outputDir, { recursive: true });

  // 切割 3x3 网格
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const left = col * tileWidth;
      const top = row * tileHeight;
      const index = row * 3 + col + 1;
      const outputPath = path.join(outputDir, `${inputBaseName}_${index}.jpg`);

      await sharp(inputPath)
        .extract({ left, top, width: tileWidth, height: tileHeight })
        .jpeg({ quality: 95 })
        .toFile(outputPath);

      results.push({
        index,
        outputPath,
        position: { row: row + 1, col: col + 1 },
        size: { width: tileWidth, height: tileHeight }
      });
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
 * 处理流程:
 * 1. 根据用户选择的模式生成预览图（preview 文件夹）
 * 2. 生成 800x800 正方形图用于九宫格切片（始终裁剪）
 * 3. 添加 Logo 到正方形图
 * 4. 对正方形图进行九宫格切片
 *
 * 预览模式说明:
 * - cover: 裁剪正方形 (取中心区域) -> 800x800
 * - inside: 保持比例缩放到 800x800 以内（不裁剪）
 * - fill: 强制拉伸到 800x800（可能变形）
 * - pad: 800x800 正方形，空白区域填充白色（不裁剪）
 */
async function processImageMaterial(inputPath, logoPath, outputDir, previewSize = 'cover') {
  const inputBaseName = path.parse(inputPath).name;
  const results = {};

  // 获取原图尺寸
  const metadata = await sharp(inputPath).metadata();

  // ========== 步骤 1: 根据用户选择的模式生成预览图 ==========
  let previewPath;

  if (previewSize === 'cover') {
    // 裁剪正方形模式：先裁剪，再缩放到 800x800
    const minSide = Math.min(metadata.width, metadata.height);
    const squarePath = path.join(outputDir, '.temp', `${inputBaseName}_square.jpg`);
    await fs.mkdir(path.dirname(squarePath), { recursive: true });

    await sharp(inputPath)
      .resize(minSide, minSide, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 95 })
      .toFile(squarePath);

    previewPath = path.join(outputDir, 'preview', `${inputBaseName}_preview.jpg`);
    await fs.mkdir(path.dirname(previewPath), { recursive: true });

    await sharp(squarePath)
      .resize(800, 800, {
        fit: 'cover',
        withoutEnlargement: true
      })
      .jpeg({ quality: 90 })
      .toFile(previewPath);

    // 清理临时文件
    await fs.unlink(squarePath).catch(() => {});
    await fs.rmdir(path.dirname(squarePath)).catch(() => {});

  } else if (previewSize === 'pad') {
    // 留白填充模式：800x800 正方形，保持原图完整，空白填白色
    previewPath = path.join(outputDir, 'preview', `${inputBaseName}_preview.jpg`);
    await fs.mkdir(path.dirname(previewPath), { recursive: true });

    await sharp(inputPath)
      .resize(800, 800, {
        fit: 'contain',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 90 })
      .toFile(previewPath);

  } else if (previewSize === 'inside') {
    // 保持比例模式：缩放到 800x800 以内（不一定是正方形）
    previewPath = path.join(outputDir, 'preview', `${inputBaseName}_preview.jpg`);
    await fs.mkdir(path.dirname(previewPath), { recursive: true });

    await sharp(inputPath)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 90 })
      .toFile(previewPath);

  } else {
    // fill 模式：强制拉伸到 800x800
    previewPath = path.join(outputDir, 'preview', `${inputBaseName}_preview.jpg`);
    await fs.mkdir(path.dirname(previewPath), { recursive: true });

    await sharp(inputPath)
      .resize(800, 800, {
        fit: 'fill',
        withoutEnlargement: false
      })
      .jpeg({ quality: 90 })
      .toFile(previewPath);
  }

  results.preview = previewPath;

  // ========== 步骤 2: 生成 800x800 正方形图用于九宫格切片（始终裁剪） ==========
  const minSide = Math.min(metadata.width, metadata.height);
  const squareForGridPath = path.join(outputDir, '.temp', `${inputBaseName}_grid_square.jpg`);
  await fs.mkdir(path.dirname(squareForGridPath), { recursive: true });

  await sharp(inputPath)
    .resize(minSide, minSide, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 95 })
    .toFile(squareForGridPath);

  // 缩放到 800x800
  const gridBasePath = path.join(outputDir, '.temp', `${inputBaseName}_grid_base.jpg`);
  await sharp(squareForGridPath)
    .resize(800, 800, {
      fit: 'cover',
      withoutEnlargement: true
    })
    .jpeg({ quality: 95 })
    .toFile(gridBasePath);

  // ========== 步骤 3: 添加 Logo 到正方形图 ==========
  let logoImagePath = gridBasePath;
  if (logoPath) {
    logoImagePath = path.join(outputDir, 'logo', `${inputBaseName}_logo.jpg`);
    await fs.mkdir(path.dirname(logoImagePath), { recursive: true });

    const logoSize = Math.floor(800 * 0.15); // Logo 为 800x800 的 15% (约120px)

    await sharp(gridBasePath)
      .composite([
        {
          input: await sharp(logoPath)
            .resize(logoSize, logoSize, { fit: 'inside' })
            .toBuffer(),
          gravity: 'southeast',
          blend: 'over'
        }
      ])
      .jpeg({ quality: 95 })
      .toFile(logoImagePath);

    results.logo = logoImagePath;
  }

  // ========== 步骤 4: 对带 Logo 的正方形图进行九宫格切片 ==========
  const gridResult = await createGridImage(
    logoImagePath,
    path.join(outputDir, 'grid')
  );
  results.grid = gridResult;

  // ========== 清理临时文件 ==========
  await fs.unlink(squareForGridPath).catch(() => {});
  await fs.unlink(gridBasePath).catch(() => {});
  await fs.rmdir(path.dirname(squareForGridPath)).catch(() => {});

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
