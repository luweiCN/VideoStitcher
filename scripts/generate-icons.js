/**
 * 图标生成脚本
 * 从 build/logo.png 生成各平台所需的图标格式
 *
 * 功能：
 * 1. 生产模式：使用 logo.png 生成图标
 * 2. 开发模式（--dev 参数）：使用 dev-logo.png 生成图标
 * 3. 自动添加圆角（macOS 风格）
 *
 * 使用方法：
 * - npm run build:icons      # 生成正式版图标
 * - npm run build:icons:dev  # 生成开发版图标（带 DEV 标签）
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// 配置
const BUILD_DIR = path.join(__dirname, '..', 'build');
const SOURCE_FILE = path.join(BUILD_DIR, 'logo.png');
const DEV_SOURCE_FILE = path.join(BUILD_DIR, 'dev-logo.png');
const IS_DEV = process.argv.includes('--dev');

// 圆角半径比例（相对于图标尺寸）
// macOS 图标圆角约为 22.37%（1024px 图标约 229px 圆角）
const CORNER_RADIUS_RATIO = 0.2237;

/**
 * 给图片添加圆角
 * @param {string|Buffer} input - 输入图片
 * @param {number} size - 输出尺寸
 * @returns {Promise<Buffer>} - 带圆角的图片 Buffer
 */
async function addRoundedCorners(input, size) {
  const radius = Math.round(size * CORNER_RADIUS_RATIO);

  // 创建圆角矩形遮罩
  const maskSvg = `
    <svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>
  `;

  // 缩放原图
  const resized = await sharp(input)
    .resize(size, size)
    .toBuffer();

  // 应用圆角遮罩
  const mask = await sharp(Buffer.from(maskSvg))
    .resize(size, size)
    .toBuffer();

  return await sharp(resized)
    .composite([{
      input: mask,
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();
}

/**
 * 生成 PNG 图标
 * @param {number} size - 尺寸
 * @param {string} filename - 文件名
 */
async function generatePng(size, filename) {
  const outputPath = path.join(BUILD_DIR, filename);
  const sourceFile = IS_DEV ? DEV_SOURCE_FILE : SOURCE_FILE;

  const buffer = await addRoundedCorners(sourceFile, size);
  await sharp(buffer).toFile(outputPath);

  console.log(`✅ 生成 PNG: ${filename} (${size}x${size})`);
}

/**
 * 生成 ICO 图标（Windows）
 * electron-builder 会自动将 PNG 转换为 ICO
 */
async function generateIco() {
  const sourceFile = IS_DEV ? DEV_SOURCE_FILE : SOURCE_FILE;
  const outputPath = path.join(BUILD_DIR, 'icon.png');

  const buffer = await addRoundedCorners(sourceFile, 256);
  await sharp(buffer).toFile(outputPath);

  console.log(`✅ 生成 ICO 源文件: icon.png (256x256)`);
}

/**
 * 生成 ICNS 图标（macOS）
 * ICNS 文件包含多个尺寸的图标
 */
async function generateIcns() {
  // macOS 需要特定尺寸：16, 32, 64, 128, 256, 512, 1024
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  const iconsetDir = path.join(BUILD_DIR, 'icon.iconset');
  const sourceFile = IS_DEV ? DEV_SOURCE_FILE : SOURCE_FILE;

  // 创建 iconset 目录
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  // 生成各尺寸图标
  for (const size of sizes) {
    const filename = `icon_${size}x${size}.png`;
    const outputPath = path.join(iconsetDir, filename);

    const buffer = await addRoundedCorners(sourceFile, size);
    await sharp(buffer).toFile(outputPath);

    // 生成 @2x 版本（Retina）
    if (size <= 512) {
      const retinaSize = size * 2;
      const retinaFilename = `icon_${size}x${size}@2x.png`;
      const retinaOutputPath = path.join(iconsetDir, retinaFilename);

      const retinaBuffer = await addRoundedCorners(sourceFile, retinaSize);
      await sharp(retinaBuffer).toFile(retinaOutputPath);
    }
  }

  console.log(`✅ 生成 ICNS 源文件: icon.iconset/`);
}

/**
 * 主函数
 */
async function main() {
  const sourceFile = IS_DEV ? DEV_SOURCE_FILE : SOURCE_FILE;

  console.log('🚀 开始生成图标...');
  console.log(`📁 源文件: ${sourceFile}`);
  console.log(`🔧 模式: ${IS_DEV ? '开发版（带 DEV 标签）' : '正式版'}`);
  console.log('');

  // 检查源文件是否存在
  if (!fs.existsSync(sourceFile)) {
    const filename = IS_DEV ? 'dev-logo.png' : 'logo.png';
    console.error(`❌ 错误: 找不到源文件 build/${filename}`);
    process.exit(1);
  }

  // 生成各类图标
  await generatePng(256, 'icon.png');
  await generatePng(512, 'icon@2x.png');

  // 生成平台特定图标
  await generateIco();
  await generateIcns();

  console.log('');
  console.log('✨ 图标生成完成！');
}

main().catch(err => {
  console.error('❌ 图标生成失败:', err);
  process.exit(1);
});
