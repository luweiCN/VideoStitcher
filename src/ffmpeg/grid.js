/**
 * 九宫格切片 - FFmpeg 命令构建模块
 *
 * 功能：
 * 将图片裁剪成 3x3 网格，输出为 9 张独立图片
 */

/**
 * 构建九宫格切片的 FFmpeg 命令行参数
 *
 * @param {Object} config - 配置对象
 * @param {string} config.imagePath - 输入图片路径
 * @param {string} config.outPath - 输出路径（支持 %d 占位符）
 * @param {number} [config.cols] - 列数（默认 3）
 * @param {number} [config.rows] - 行数（默认 3）
 * @returns {string[]} FFmpeg 命令行参数数组
 */
function buildArgs({ imagePath, outPath, cols = 3, rows = 3 }) {
  // 计算每个格子的尺寸
  // 假设输入图片是正方形，输出也是正方形
  // 将图片裁剪成 cols x rows 个格子

  // 使用 tile 滤镜将图片分割成网格
  // tile 滤镜的格式：tile=cols x rows
  // 但 FFmpeg 的 tile 滤镜是将多个图片拼成一个，我们需要反向操作

  // 更好的方法是使用 crop 滤镜多次
  // 但这需要多次调用 FFmpeg

  // 另一种方法是使用 select 滤镜配合 crop
  // 但这也很复杂

  // 最简单的方法是生成 9 个独立的 crop 命令

  // 为了简化，我们这里返回单个切片的命令
  // 调用者需要循环调用 9 次

  // 实际上，我们可以使用 FFmpeg 的 split 滤镜配合 crop
  // 但这样会同时输出 9 个流，需要特殊处理

  // 让我们采用更实用的方法：
  // 使用 FFmpeg 的 crop 滤镜，但每次只裁剪一个区域
  // 输出文件名支持 %d 占位符，但我们需要为每个切片单独生成命令

  // 重新设计：这个函数返回单个切片的命令参数
  // 调用者需要指定 gridIndex（0-8）

  throw new Error('使用 buildSingleGridArgs 函数代替，需要指定 gridIndex');
}

/**
 * 构建单个九宫格切片的 FFmpeg 命令行参数
 *
 * @param {Object} config - 配置对象
 * @param {string} config.imagePath - 输入图片路径
 * @param {string} config.outPath - 输出路径
 * @param {number} config.gridIndex - 网格索引（0-8）
 * @param {number} [config.cols] - 列数（默认 3）
 * @param {number} [config.rows] - 行数（默认 3）
 * @param {number} [config.totalWidth] - 图片总宽度（默认 1080）
 * @param {number} [config.totalHeight] - 图片总高度（默认 1080）
 * @returns {string[]} FFmpeg 命令行参数数组
 */
function buildSingleGridArgs({
  imagePath,
  outPath,
  gridIndex,
  cols = 3,
  rows = 3,
  totalWidth = 1080,
  totalHeight = 1080
}) {
  // 计算裁剪区域
  const col = gridIndex % cols;
  const row = Math.floor(gridIndex / cols);

  const cellWidth = Math.floor(totalWidth / cols);
  const cellHeight = Math.floor(totalHeight / rows);
  const x = col * cellWidth;
  const y = row * cellHeight;

  const filters = [`[0:v]crop=${cellWidth}:${cellHeight}:${x}:${y}[v]`;

  const args = [
    "-y",
    "-i", imagePath,
    "-filter_complex", filters.join('\n'),
    "-map", "[v]",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-f", "image2",
    "-frames:v", "1",
    outPath
  ];

  return args;
}

/**
 * 批量生成九宫格切片的配置
 *
 * @param {Object} config - 配置对象
 * @param {string} config.imagePath - 输入图片路径
 * @param {string} config.outputDir - 输出目录
 * @param {number} [config.cols] - 列数（默认 3）
 * @param {number} [config.rows] - 行数（默认 3）
 * @param {number} [config.totalWidth] - 图片总宽度
 * @param {number} [config.totalHeight] - 图片总高度
 * @returns {Array<{args: string[], outputPath: string}>} FFmpeg 命令参数数组
 */
function buildAllGridArgs({
  imagePath,
  outputDir,
  cols = 3,
  rows = 3,
  totalWidth = 1080,
  totalHeight = 1080
}) {
  const path = require('path');
  const results = [];

  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // 生成输出文件名
    const outName = `grid_${row}_${col}.jpg`;
    const outPath = path.join(outputDir, outName);

    const args = buildSingleGridArgs({
      imagePath,
      outPath,
      gridIndex: i,
      cols,
      rows,
      totalWidth,
      totalHeight
    });

    results.push({ args, outputPath: outPath, index: i });
  }

  return results;
}

module.exports = {
  buildArgs,
  buildSingleGridArgs,
  buildAllGridArgs
};
