/**
 * 视频处理 IPC 处理器
 * 扩展现有的视频处理功能, 支持 VideoMaster 的所有视频模式
 */

const { ipcMain, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile, spawn } = require("child_process");
const { runFfmpeg, getFfmpegPath } = require("../ffmpeg/runFfmpeg");
const { buildArgs, buildPreviewArgs } = require("../ffmpeg/videoMerge");
const { TaskQueue } = require("../ffmpeg/queue");
const { generatePreviews, cleanupPreviews } = require("../ffmpeg/videoResize");
const app = require("electron").app ?? require("@electron/remote");
const {
  generateFileName,
  generateCombinedFilename,
} = require("../utils/fileNameHelper");
const { SafeOutput } = require("../utils/safeOutput");

/**
 * 获取 FFprobe 可执行文件路径
 * 打包后需要特殊处理路径
 */
function getFfprobePath() {
  if (app.isPackaged) {
    // 打包后：ffprobe 在 app.asar.unpacked/node_modules/@ffprobe-installer/<platform>-<arch>/
    const resourcesPath = process.resourcesPath;
    
    // 根据平台选择正确的子目录
    const platform = process.platform;
    const arch = process.arch;
    let subdir;
    if (platform === "win32") {
      subdir = "win32-x64";
    } else if (platform === "darwin") {
      subdir = arch === "arm64" ? "darwin-arm64" : "darwin-x64";
    } else {
      subdir = "linux-x64";
    }
    
    const unpackedPath = path.join(
      resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "@ffprobe-installer",
      subdir,
    );

    const ffprobeBin = platform === "win32" ? "ffprobe.exe" : "ffprobe";
    return path.join(unpackedPath, ffprobeBin);
  }

  // 开发环境：使用 @ffprobe-installer/ffprobe 提供的路径
  return require("@ffprobe-installer/ffprobe").path;
}

// 创建任务队列 (复用现有逻辑)
const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

/**
 * 根据用户规则生成输出文件名
 * 规则：在原命名第七个分隔符(-)前面加【软件合成】
 * 如果没有第七个分隔符，使用默认命名规则
 * 返回不带扩展名的基础文件名
 */
function getSmartMergedBaseName(bName, index, suffix, aName) {
  const separator = "-";
  const parts = bName.split(separator);

  // parts.length > 7 表示至少有 7 个分隔符，即至少有 8 个部分
  if (parts.length > 7) {
    const newParts = [...parts];
    // 1. 第一个-符号后面固定是D (即索引为 1 的部分)
    newParts[1] = "D";
    // 2. 在第 7 个分隔符后面加，即在第 8 个部分（索引为 7）前面加
    newParts[7] = "软件合成" + newParts[7];
    // 3. 倒数第二个部分（横竖标识）修正
    newParts[newParts.length - 2] = suffix === "vertical" ? "竖" : "横";
    // 修复：必须加上序号，否则导出倍数 > 1 时会文件名冲突导致花屏/覆盖
    return newParts.join(separator) + `_${String(index + 1).padStart(4, "0")}`;
  }

  // 默认命名规则
  if (aName) {
    // 组合两个文件名
    return `${aName}__${bName}__${String(index + 1).padStart(4, "0")}_${suffix}`;
  } else {
    return `${bName}__${String(index + 1).padStart(4, "0")}_${suffix}`;
  }
}

/**
 * 获取视频元数据（尺寸、时长等）
 * 使用 ffprobe 获取视频信息
 */
async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,duration",
      "-of",
      "json",
      filePath,
    ];

    const process = spawn(getFfprobePath(), args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
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
            duration: stream.duration ? parseFloat(stream.duration) : 0,
          });
        } else {
          reject(new Error("无法解析视频元数据"));
        }
      } catch (err) {
        reject(new Error(`解析 ffprobe 输出失败: ${err.message}`));
      }
    });

    process.on("error", (err) => {
      reject(new Error(`ffprobe 执行失败: ${err.message}`));
    });
  });
}

/**
 * 获取视频尺寸信息（宽度、高度、方向、长宽比）
 * 用于文件选择器显示
 *
 * @param {string} filePath - 视频文件路径
 * @returns {Promise<Object|null>} 尺寸信息 { width, height, orientation, aspectRatio } 或 null
 */
async function getVideoDimensions(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = [
      ".mp4",
      ".mov",
      ".avi",
      ".mkv",
      ".webm",
      ".flv",
      ".m4v",
    ];

    if (!validExtensions.includes(ext)) {
      return null;
    }

    const metadata = await getVideoMetadata(filePath);
    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) {
      return null;
    }

    // 计算方向
    let orientation = "landscape";
    if (width === height) {
      orientation = "square";
    } else if (height > width) {
      orientation = "portrait";
    }

    // 计算长宽比，简化为常用比例
    const ratio = width / height;
    let aspectRatio = "16:9";
    if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = "16:9";
    else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = "9:16";
    else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = "4:3";
    else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = "3:4";
    else if (Math.abs(ratio - 1) < 0.05) aspectRatio = "1:1";
    else aspectRatio = `${Math.round(ratio * 10) / 10}:1`;

    // 从 metadata 获取时长
    const duration = metadata.duration || 0;

    return {
      width,
      height,
      orientation,
      aspectRatio,
      duration,
    };
  } catch (error) {
    console.error(`[获取视频尺寸] 失败: ${filePath} - ${error.message}`);
    return null;
  }
}

/**
 * 获取视频完整信息（一次性获取缩略图、文件大小、尺寸、时长）
 * 合并多次 IPC 调用为一次，提升性能
 *
 * @param {string} filePath - 视频文件路径
 * @param {Object} options - 可选配置
 * @param {number} options.thumbnailMaxSize - 缩略图最大尺寸，默认 64
 * @returns {Promise<Object>} 视频完整信息
 */
async function getVideoFullInfo(filePath, options = {}) {
  const { thumbnailMaxSize = 64 } = options;
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  const result = {
    success: true,
    path: filePath,
    name: fileName,
    thumbnail: null,
    previewUrl: `preview://${encodeURIComponent(filePath)}`,
    fileSize: null,
    width: null,
    height: null,
    duration: null,
    orientation: null,
    aspectRatio: null,
  };

  try {
    if (!fs.existsSync(filePath)) {
      return { ...result, success: false, error: "文件不存在" };
    }

// 获取 ffmpeg 路径（兼容打包环境）
    const ffmpeg = getFfmpegPath();

    // 并行执行所有操作
    const [thumbnailResult, statsResult, metadataResult] =
      await Promise.allSettled([
        // 1. 生成缩略图
        new Promise((resolve, reject) => {
          const tmpDir = path.join(os.tmpdir(), "videostitcher-temp");
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }
          const outputPath = path.join(
            tmpDir,
            `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.png`,
          );

          const args = [
            "-ss",
            "0",
            "-i",
            filePath,
            "-vframes",
            "1",
            "-vf",
            `scale=${thumbnailMaxSize}:-1`,
            "-y",
            outputPath,
          ];

          execFile(ffmpeg, args, { timeout: 10000 }, (err) => {
            if (err) {
              reject(err);
            } else if (fs.existsSync(outputPath)) {
              const thumbnailBase64 = fs.readFileSync(outputPath, {
                encoding: "base64",
              });
              fs.unlinkSync(outputPath); // 读取后删除临时文件
              resolve(`data:image/png;base64,${thumbnailBase64}`);
            } else {
              reject(new Error("缩略图生成失败"));
            }
          });
        }),

        // 2. 获取文件大小
        new Promise((resolve, reject) => {
          fs.stat(filePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats.size);
          });
        }),

        // 3. 获取视频元数据（尺寸、时长）
        getVideoMetadata(filePath).then((metadata) => ({
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration,
          orientation:
            metadata.width > metadata.height
              ? "landscape"
              : metadata.width < metadata.height
                ? "portrait"
                : "square",
          aspectRatio: calculateAspectRatio(metadata.width, metadata.height),
        })),
      ]);

    // 处理结果
    if (thumbnailResult.status === "fulfilled") {
      result.thumbnail = thumbnailResult.value;
    }
    if (statsResult.status === "fulfilled") {
      result.fileSize = statsResult.value;
    }
    if (metadataResult.status === "fulfilled") {
      const meta = metadataResult.value;
      result.width = meta.width;
      result.height = meta.height;
      result.duration = meta.duration;
      result.orientation = meta.orientation;
      result.aspectRatio = meta.aspectRatio;
    }
  } catch (error) {
    console.error(`[获取视频完整信息] 失败: ${fileName} - ${error.message}`);
    result.success = false;
    result.error = error.message;
  }

  return result;
}

/**
 * 计算长宽比字符串
 */
function calculateAspectRatio(width, height) {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.1) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.1) return "9:16";
  if (Math.abs(ratio - 4 / 3) < 0.1) return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.1) return "3:4";
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  return `${Math.round(ratio * 10) / 10}:1`;
}

/**
/**
 * 统一视频合成处理
 * 接收任务数组，每个任务包含素材和配置
 * 
 * @param {Array} tasks - 任务数组，每个任务结构：
 *   {
 *     files: [{ path, category }], // category: 'A', 'B', 'cover', 'bg'
 *     config: { orientation, aPosition, bPosition, bgPosition, coverPosition },
 *     outputDir,
 *     concurrency
 *   }
 */
async function handleVideoMerge(event, tasks) {
  console.log("handleVideoMerge received:", tasks);
  if (!tasks || tasks.length === 0) {
    throw new Error("任务列表为空");
  }

  // 记录开始时间
  const startTime = Date.now();

  // 从第一个任务获取 orientation 用于发送事件
  const firstConfig = tasks[0]?.config || {};
  const orientation = firstConfig.orientation || 'horizontal';
  
  // 验证所有任务都有 outputDir
  for (let i = 0; i < tasks.length; i++) {
    if (!tasks[i].outputDir) {
      throw new Error(`任务 ${i + 1}: 未设置输出目录`);
    }
  }

  // 设置并发数（使用第一个任务的 concurrency）
  const concurrency = tasks[0]?.concurrency || Math.max(1, os.cpus().length - 1);
  queue.setConcurrency(concurrency);

  const total = tasks.length;
  let done = 0;
  let failed = 0;

  event.sender.send("video-start", {
    total,
    mode: orientation,
    concurrency: queue.concurrency,
  });

  const ffmpegTasks = tasks.map((task, index) => {
    return queue.push(async () => {
      const taskStartTime = Date.now();
      event.sender.send("video-task-start", { index });

      // 从 task 获取配置
      const { config, outputDir } = task || {};
      const taskOrientation = config?.orientation || orientation;

      // 从 task.files 中提取各类素材
      const aFile = task.files?.find(f => f.category === 'A');
      const bFile = task.files?.find(f => f.category === 'B');
      const coverFile = task.files?.find(f => f.category === 'cover');
      const bgFile = task.files?.find(f => f.category === 'bg');

      if (!bFile) {
        throw new Error(`任务 ${index + 1}: 缺少B面视频`);
      }

      const aPath = aFile?.path;
      const bPath = bFile.path;
      const coverImage = coverFile?.path;
      const bgImage = bgFile?.path;

      // 使用任务配置中的位置信息
      const aPosition = config?.aPosition;
      const bPosition = config?.bPosition;
      const bgPosition = config?.bgPosition;
      const coverPosition = config?.coverPosition;

      const bName = path.parse(bPath).name;
      const aName = aPath ? path.parse(aPath).name : undefined;
      const suffix = taskOrientation === 'vertical' ? '竖' : '横';
      const rawBaseName = aName 
        ? `${aName}__${bName}_${suffix}`
        : `${bName}_${suffix}`;
      
      // 处理特殊字符和长度限制
      const safeBaseName = generateFileName(outputDir, rawBaseName, {
        extension: '.mp4',
        reserveSuffixSpace: 5,
      });
      
      // 创建安全输出管理器（每个任务独立的临时目录）
      const safeOutput = new SafeOutput(outputDir, 'merge');
      const tempPath = safeOutput.getTempOutputPath(safeBaseName, index);

      try {
        const args = buildArgs({
          aPath,
          bPath,
          outPath: tempPath,
          bgImage,
          coverImage,
          aPosition,
          bPosition,
          bgPosition,
          coverPosition,
          orientation: taskOrientation,
        });

        await runFfmpeg(args, (log) => {
          event.sender.send("video-log", { index, message: log });
        });

        // 将临时文件移动到最终目录（自动处理文件名冲突）
        const result = safeOutput.commitSync(tempPath);
        
        // 清理临时目录
        safeOutput.cleanup(index);
        
        if (!result.success) {
          throw new Error(result.error || '移动文件失败');
        }

        const taskElapsed = ((Date.now() - taskStartTime) / 1000).toFixed(1);
        done++;
        event.sender.send("video-progress", {
          done,
          failed,
          total,
          index,
          outputPath: result.finalPath,
          elapsed: taskElapsed,
        });
      } catch (err) {
        // 清理临时目录
        safeOutput.cleanup(index);
        failed++;
        event.sender.send("video-failed", {
          done,
          failed,
          total,
          index,
          error: err.message,
        });
      }
    });
  });

  await Promise.allSettled(ffmpegTasks);
  
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[转换] 完成，成功: ${done}, 失败: ${failed}, 总耗时: ${totalElapsed}秒`);
  
  event.sender.send("video-finish", { done, failed, total, elapsed: totalElapsed });

  return { done, failed, total, elapsed: totalElapsed };
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
async function handleHorizontalMerge(
  event,
  {
    aVideos,
    bVideos,
    bgImage,
    coverImages,
    outputDir,
    concurrency,
    aPosition,
    bPosition,
    bPositions,
    bgPosition,
    coverPosition,
  },
) {
  if (!bVideos.length) {
    throw new Error("主视频库为空");
  }
  if (!outputDir) {
    throw new Error("未选择输出目录");
  }

  // 如果没有 A 面视频，则不传 aPath，buildArgs 会处理
  const hasAVideos = aVideos && aVideos.length > 0;

  // 设置并发数
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = bVideos.length;
  let done = 0;
  let failed = 0;

  event.sender.send("video-start", {
    total,
    mode: "horizontal",
    concurrency: queue.concurrency,
  });

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
      // 发送任务开始事件
      event.sender.send("video-task-start", { index });

      // 使用预分配的 A 面视频和封面图
      const selectedAVideo = globalASideAssignments[index];
      const selectedCoverImage = globalCoverAssignments[index];

      const bName = path.parse(b).name;
      const aName = selectedAVideo
        ? path.parse(selectedAVideo).name
        : undefined;
      // 使用统一文件名处理：先拼接基础名，再检测冲突
      const baseName = getSmartMergedBaseName(bName, index, "horizontal", aName);
      const outName = generateFileName(outputDir, baseName, {
        extension: ".mp4",
        reserveSuffixSpace: 5,
      });
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
          orientation: "horizontal",
        });

        // 执行 FFmpeg 命令
        await runFfmpeg(args, (log) => {
          event.sender.send("video-log", { index, message: log });
        });

        done++;
        event.sender.send("video-progress", {
          done,
          failed,
          total,
          index,
          outputPath: outPath,
        });
      } catch (err) {
        failed++;
        event.sender.send("video-failed", {
          done,
          failed,
          total,
          index,
          error: err.message,
        });
      }
    });
  });

  await Promise.allSettled(tasks);
  event.sender.send("video-finish", { done, failed, total });

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
async function handleVerticalMerge(
  event,
  {
    mainVideos,
    bgImage,
    aVideos,
    coverImages,
    outputDir,
    concurrency,
    aPosition,
    bPosition,
    bPositions,
    bgPosition,
    coverPosition,
  },
) {
  if (!mainVideos.length) {
    throw new Error("主视频库为空");
  }
  if (!outputDir) {
    throw new Error("未选择输出目录");
  }

  // 如果没有 A 面视频，则不传 aPath，buildArgs 会处理

  const hasAVideos = aVideos && aVideos.length > 0;

  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  const total = mainVideos.length;

  let done = 0;

  let failed = 0;

  event.sender.send("video-start", {
    total,
    mode: "vertical",
    concurrency: queue.concurrency,
  });

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
      // 发送任务开始事件
      event.sender.send("video-task-start", { index });

      // 使用预分配的 A 面视频和封面图
      const selectedAVideo = globalASideAssignments[index];
      const selectedCoverImage = globalCoverAssignments[index];

      const bName = path.parse(mainVideo).name;
      const aName = selectedAVideo
        ? path.parse(selectedAVideo).name
        : undefined;
      // 使用统一文件名处理：先拼接基础名，再检测冲突
      const baseName = getSmartMergedBaseName(bName, index, "vertical", aName);
      const outName = generateFileName(outputDir, baseName, {
        extension: ".mp4",
        reserveSuffixSpace: 5,
      });
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
          orientation: "vertical",
        });

        // 执行 FFmpeg 命令
        await runFfmpeg(args, (log) => {
          event.sender.send("video-log", { index, message: log });
        });

        done++;
        event.sender.send("video-progress", {
          done,
          failed,
          total,
          index,
          outputPath: outPath,
        });
      } catch (err) {
        failed++;
        event.sender.send("video-failed", {
          done,
          failed,
          total,
          index,
          error: err.message,
        });
      }
    });
  });

  await Promise.allSettled(tasks);
  event.sender.send("video-finish", { done, failed, total });

  return { done, failed, total };
}

/**
 * 智能改尺寸处理
 * 为每个视频生成指定模式的输出视频
 */
async function handleResize(
  event,
  { videos, mode, blurAmount, outputDir, concurrency },
) {
  if (!videos.length) {
    throw new Error("视频库为空");
  }
  if (!outputDir) {
    throw new Error("未选择输出目录");
  }

  const {
    buildArgs: buildResizeArgs,
    RESIZE_CONFIGS,
  } = require("../ffmpeg/videoResize");
  const configs = RESIZE_CONFIGS[mode];
  if (!configs) {
    throw new Error(`无效的模式: ${mode}`);
  }

  // 设置并发数
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  // 总任务数以原始视频数量为准（每个视频不管输出几个，都算一个任务）
  const total = videos.length;
  let done = 0;
  let failed = 0;

  event.sender.send("video-start", {
    total,
    mode: "resize",
    concurrency: queue.concurrency,
  });

  const tasks = [];

  // 跟踪每个视频的完成计数，只有当一个视频的所有输出都完成时才发送 progress 事件
  const videoCompletionCount = new Array(videos.length).fill(0);
  const videoFailed = new Array(videos.length).fill(false); // 跟踪每个视频是否有失败
  const videoOutputs = [];

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const videoPath = video.path;
    const videoId = video.id;
    const fileName = path.parse(videoPath).name;
    videoOutputs[i] = [];

    for (let j = 0; j < configs.length; j++) {
      const config = configs[j];
      const suffix = config.suffix;
      // 先占位，任务执行时会生成最终路径并更新
      videoOutputs[i].push(null);

      tasks.push(
        queue.push(async () => {
          const index = i * configs.length + j;
          // 使用 generateFileName 检测冲突并生成唯一文件名
          const outName = generateFileName(outputDir, fileName, {
            suffix: suffix,
            extension: ".mp4",
            reserveSuffixSpace: 5,
          });
          const outPath = path.join(outputDir, outName);
          // 更新输出列表，供进度回调使用
          videoOutputs[i][j] = outPath;

          // 发送任务开始事件，带上视频索引
          event.sender.send("video-task-start", { index, videoIndex: i });

          try {
            console.log(
              `[handleResize] 处理任务 ${index}: ${videoPath}, 目标: ${config.width}x${config.height}, 模糊: ${blurAmount}`,
            );

            const args = buildResizeArgs({
              inputPath: videoPath,
              outputPath: outPath,
              width: config.width,
              height: config.height,
              blurAmount,
              // 每个任务使用全部 CPU 核心数，提高单个任务速度
              threads: os.cpus().length,
            });

            console.log(
              `[handleResize] FFmpeg 命令:`,
              JSON.stringify(
                args.filter(
                  (a) => a.startsWith("[") || a === "-filter_complex",
                ),
                null,
                2,
              ),
            );

            await runFfmpeg(args, (log) => {
              event.sender.send("video-log", { index, message: log });
            });

            // 任务成功，增加该视频的完成计数
            videoCompletionCount[i]++;

            // 检查该视频的所有输出是否都完成
            if (videoCompletionCount[i] === configs.length) {
              // 该视频的所有输出都完成了，发送 progress 事件
              // 只有当该视频没有失败时才计为成功
              if (!videoFailed[i]) {
                done++;
              }
              event.sender.send("video-progress", {
                done,
                failed,
                total,
                index: i, // 视频在数组中的索引
                outputs: videoOutputs[i],
              });
            }
          } catch (err) {
            // 标记该视频有失败
            videoFailed[i] = true;
            // 任务失败也视为该输出完成
            videoCompletionCount[i]++;

            // 检查该视频的所有输出是否都完成
            if (videoCompletionCount[i] === configs.length) {
              failed++;
              event.sender.send("video-progress", {
                done,
                failed,
                total,
                index: i, // 视频在数组中的索引
                outputs: videoOutputs[i],
              });
            }
          }
        }),
      );
    }
  }

  await Promise.allSettled(tasks);
  event.sender.send("video-finish", { done, failed, total });

  return { done, failed, total };
}

/**
 * 横屏合成预览
 * 生成单个合成视频的预览，输出到临时目录
 */
async function handleHorizontalPreview(
  event,
  { aVideo, bVideo, bgImage, coverImage },
) {
  const os = require("os");
  const fs = require("fs");

  if (!bVideo) {
    throw new Error("缺少主视频");
  }

  // 如果没有 A 面视频，则设为 undefined，buildArgs 会处理
  const finalAVideo = aVideo;

  // 创建临时预览目录
  const tmpDir = path.join(os.tmpdir(), "videostitcher-preview");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 生成预览文件名
  const timestamp = Date.now();
  const previewFileName = `preview_horizontal_${timestamp}.mp4`;
  const previewPath = path.join(tmpDir, previewFileName);

  // 发送预览开始事件
  event.sender.send("preview-start", { mode: "horizontal" });

  try {
    // 使用统一拼接模块构建命令
    const args = buildArgs({
      aPath: finalAVideo,
      bPath: bVideo,
      outPath: previewPath,
      bgImage,
      coverImage,
      orientation: "horizontal",
    });

    // 调试：输出命令
    console.log(
      "[DEBUG 预览命令]",
      JSON.stringify(
        args.filter((a) => a.startsWith("[") || a === "-filter_complex"),
        null,
        2,
      ),
    );

    // 执行 FFmpeg 命令
    await runFfmpeg(args, (log) => {
      event.sender.send("preview-log", { message: log });
    });

    // 发送预览完成事件，返回预览文件路径
    event.sender.send("preview-complete", { previewPath });

    return { success: true, previewPath };
  } catch (err) {
    event.sender.send("preview-error", { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * 竖屏合成预览
 */
async function handleVerticalPreview(
  event,
  { mainVideo, bgImage, aVideo, coverImage },
) {
  const os = require("os");
  const fs = require("fs");

  if (!mainVideo) {
    throw new Error("缺少主视频");
  }

  // 如果没有 A 面视频，则设为 undefined，buildArgs 会处理
  const finalAVideo = aVideo;

  // 创建临时预览目录
  const tmpDir = path.join(os.tmpdir(), "videostitcher-preview");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 生成预览文件名
  const timestamp = Date.now();
  const previewFileName = `preview_vertical_${timestamp}.mp4`;
  const previewPath = path.join(tmpDir, previewFileName);

  // 发送预览开始事件
  event.sender.send("preview-start", { mode: "vertical" });

  try {
    // 使用统一拼接模块构建命令
    const args = buildArgs({
      aPath: finalAVideo,
      bPath: mainVideo,
      outPath: previewPath,
      bgImage,
      coverImage,
      orientation: "vertical",
    });

    // 执行 FFmpeg 命令
    await runFfmpeg(args, (log) => {
      event.sender.send("preview-log", { message: log });
    });

    // 发送预览完成事件
    event.sender.send("preview-complete", { previewPath });

    return { success: true, previewPath };
  } catch (err) {
    event.sender.send("preview-error", { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * 极速合成预览 - 快速预览
 * 使用 input seeking 快速截取片段，然后调用 buildArgs 合成
 * 
 * 截取规则：
 * - 有封面：封面图(2秒) + A面前5秒 + A面后5秒 + B面前5秒
 * - 无封面有A：A面后5秒 + B面前5秒
 * - 只有B：B面前5秒
 */
async function handleMergePreviewFast(
  event,
  { bVideo, aVideo, bgImage, coverImage, orientation, aPosition, bPosition, coverPosition },
) {
  const os = require("os");
  const fs = require("fs");
  const tempDir = path.join(os.tmpdir(), "videostitcher-preview");
  
  if (!bVideo) {
    return { success: false, error: "缺少主视频" };
  }

  // 创建临时目录
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const previewPath = path.join(tempDir, `preview_merge_${timestamp}.mp4`);

  event.sender.send("preview-start", { mode: "merge-fast" });

  const startTime = Date.now();

  try {
    // 获取视频时长
    const getVideoDuration = async (videoPath) => {
      if (!videoPath) return 0;
      try {
        const metadata = await getVideoMetadata(videoPath);
        return metadata?.duration || 0;
      } catch {
        return 0;
      }
    };

    const aDuration = await getVideoDuration(aVideo);
    const bDuration = await getVideoDuration(bVideo);

    console.log("[预览] A面时长:", aDuration, "B面时长:", bDuration);

    // 计算截取参数
    let trim = {};
    
    if (aVideo && aDuration > 0) {
      // A 面截取：后5秒（如果时长 <= 5秒，用整个视频）
      if (aDuration <= 5) {
        trim.aStart = 0;
        trim.aDuration = aDuration;
      } else {
        trim.aStart = aDuration - 5;
        trim.aDuration = 5;
      }
    }

    // B 面截取：前5秒（如果时长 <= 5秒，用整个视频）
    if (bDuration <= 5) {
      trim.bStart = 0;
      trim.bDuration = bDuration;
    } else {
      trim.bStart = 0;
      trim.bDuration = 5;
    }

    // 预览模式：720p
    const previewConfig = orientation === "horizontal"
      ? { width: 1280, height: 720, crf: 28 }
      : { width: 720, height: 1280, crf: 28 };

    // 使用 buildPreviewArgs 构建预览命令
    const args = buildPreviewArgs({
      aPath: aVideo,
      bPath: bVideo,
      outPath: previewPath,
      bgImage: bgImage,
      coverImage: coverImage,
      aPosition: aPosition,
      bPosition: bPosition,
      coverPosition: coverPosition,
      orientation,
      preview: previewConfig,
      trim: trim,
      coverDuration: 2,
    });

    console.log("[预览] 生成极速合成预览:", previewPath);
    console.log("[预览] 截取参数:", JSON.stringify(trim));

    await runFfmpeg(args, (log) => {
      event.sender.send("preview-log", { message: log });
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[预览] 生成完成，耗时: ${elapsed}秒`);

    event.sender.send("preview-complete", { previewPath, elapsed });
    return { success: true, previewPath, elapsed };

  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("[预览] 生成失败:", err, `耗时: ${elapsed}秒`);
    const errorMsg = err.message || "未知错误";
    event.sender.send("preview-error", { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * 清理预览临时文件
 */
async function handleClearPreviews() {
  const os = require("os");
  const fs = require("fs");

  const tmpDir = path.join(os.tmpdir(), "videostitcher-preview");

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
async function handleGenerateResizePreviews(
  event,
  { videoPath, mode, blurAmount },
) {
  const os = require("os");
  const path = require("path");

  const tempDir = path.join(os.tmpdir(), "videostitcher-preview");

  try {
    event.sender.send("preview-start", { mode });

    const previews = await generatePreviews({
      inputPath: videoPath,
      tempDir,
      mode,
      blurAmount,
      threads: os.cpus().length, // 预览也使用全部 CPU 核心
      onProgress: (progress) => {
        event.sender.send("preview-log", {
          message: `处理进度: ${Math.floor(progress)}%`,
        });
      },
      onLog: (log) => {
        event.sender.send("preview-log", { message: log });
      },
    });

    event.sender.send("preview-complete", {
      previewPaths: previews.map((p) => p.path),
    });

    return { success: true, previews };
  } catch (err) {
    event.sender.send("preview-error", { error: err.message });
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
 * A+B 前后拼接处理
 * 用于 VideoStitcherMode 的 A+B 前后拼接功能
 *
 * @param {Object} event - IPC 事件对象
 * @param {Object} params - 参数对象
 * @param {string[]} params.aFiles - A面视频列表（前段）
 * @param {string[]} params.bFiles - B面视频列表（后段）
 * @param {string} params.outputDir - 输出目录
 * @param {string} params.orientation - 拼接方向 (landscape | portrait)
 * @param {number} [params.concurrency] - 并发数
 */
async function handleStitchAB(
  event,
  { aFiles, bFiles, outputDir, orientation, concurrency },
) {
  if (!aFiles.length || !bFiles.length) {
    throw new Error("A库或B库为空");
  }
  if (!outputDir) {
    throw new Error("未选择输出目录");
  }

  // 渲染进程已经完成配对，aFiles 和 bFiles 索引一一对应
  const pairs = aFiles.map((a, index) => ({
    a,
    b: bFiles[index],
    index,
  }));
  const total = pairs.length;

  // 设置并发数
  queue.setConcurrency(concurrency || Math.max(1, os.cpus().length - 1));

  let done = 0;
  let failed = 0;

  event.sender.send("video-start", {
    total,
    mode: orientation,
    concurrency: queue.concurrency,
  });

  const tasks = pairs.map(({ a, b, index }) => {
    return queue.push(async () => {
      const aName = path.parse(a).name;
      const bName = path.parse(b).name;
      // 使用统一文件名处理：先拼接基础名，generateFileName 会自动处理冲突
      const baseName = `${aName}__${bName}`;
      const outName = generateFileName(outputDir, baseName, {
        extension: ".mp4",
        reserveSuffixSpace: 5,
      });
      const outPath = path.join(outputDir, outName);

      // 发送任务开始处理事件
      event.sender.send("video-task-start", { index });

      const payload = { aPath: a, bPath: b, outPath, orientation };

      const tryRun = async (attempt) => {
        event.sender.send("video-log", {
          index,
          message: `\n[${index}] attempt=${attempt}\nA=${a}\nB=${b}\nOUT=${outPath}\n`,
        });
        return runFfmpeg(payload, (s) => {
          event.sender.send("video-log", { index, message: s });
        });
      };

      try {
        await tryRun(1);
        done++;
        event.sender.send("video-progress", {
          done,
          failed,
          total,
          index,
          outputPath: outPath,
        });
      } catch (err) {
        event.sender.send("video-log", {
          index,
          message: `\n[${index}] 第一次失败，重试一次...\n${err.message}\n`,
        });
        try {
          await tryRun(2);
          done++;
          event.sender.send("video-progress", {
            done,
            failed,
            total,
            index,
            outputPath: outPath,
          });
        } catch (err2) {
          failed++;
          event.sender.send("video-failed", {
            done,
            failed,
            total,
            index,
            error: err2.message,
          });
        }
      }
    });
  });

  await Promise.allSettled(tasks);
  event.sender.send("video-finish", { done, failed, total });

  return { done, failed, total };
}

/**
 * 注册所有视频处理 IPC 处理器
 */
function registerVideoHandlers() {
  // A+B 前后拼接
  ipcMain.handle("video-stitch-ab", async (event, config) => {
    return handleStitchAB(event, config);
  });

  // 视频合成（统一接口）
  ipcMain.handle("video-merge", async (event, tasks) => {
    return handleVideoMerge(event, tasks);
  });

  // 横屏合成
  ipcMain.handle("video-horizontal-merge", async (event, config) => {
    return handleHorizontalMerge(event, config);
  });

  // 竖屏合成
  ipcMain.handle("video-vertical-merge", async (event, config) => {
    return handleVerticalMerge(event, config);
  });

  // 智能改尺寸
  ipcMain.handle("video-resize", async (event, config) => {
    return handleResize(event, config);
  });

  // 横屏合成预览
  ipcMain.handle("preview-horizontal", async (event, config) => {
    return handleHorizontalPreview(event, config);
  });

  // 竖屏合成预览
  ipcMain.handle("preview-vertical", async (event, config) => {
    return handleVerticalPreview(event, config);
  });

  // 极速合成快速预览（降低画质 + 智能截取）
  ipcMain.handle("preview-merge-fast", async (event, config) => {
    return handleMergePreviewFast(event, config);
  });

  // 清理预览文件
  ipcMain.handle("clear-previews", async () => {
    return handleClearPreviews();
  });

  // 智能改尺寸预览
  ipcMain.handle("generate-resize-previews", async (event, config) => {
    return handleGenerateResizePreviews(event, config);
  });

  // 清理智能改尺寸预览
  ipcMain.handle("clear-resize-previews", async (event, config) => {
    return handleClearResizePreviews(event, config);
  });

  // 获取视频元数据
  ipcMain.handle("video-get-metadata", async (event, filePath) => {
    return getVideoMetadata(filePath);
  });

  // 获取视频尺寸
  ipcMain.handle("video:get-dimensions", async (event, filePath) => {
    return getVideoDimensions(filePath);
  });

  // 获取视频完整信息（缩略图、大小、尺寸、时长）- 一次调用获取所有信息
  ipcMain.handle("video:get-full-info", async (event, filePath, options) => {
    return getVideoFullInfo(filePath, options);
  });
}

module.exports = {
  registerVideoHandlers,
  getVideoDimensions,
  getVideoFullInfo,
  handleStitchAB,
  handleVideoMerge,
  handleHorizontalMerge,
  handleVerticalMerge,
  handleResize,
  handleHorizontalPreview,
  handleVerticalPreview,
  handleClearPreviews,
  handleGenerateResizePreviews,
  handleClearResizePreviews,
  getVideoMetadata,
};
