const { spawn } = require("child_process");
const path = require("path");
const { app } = require("electron");

/**
 * 获取 FFmpeg 可执行文件路径
 */
function getFfmpegPath() {
  if (app.isPackaged) {
    // 打包后：ffmpeg 在 app.asar.unpacked/node_modules/ffmpeg-static/
    const resourcesPath = process.resourcesPath;
    const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static');

    // 根据 platform 选择正确的可执行文件名
    const ffmpegBin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    return path.join(unpackedPath, ffmpegBin);
  }

  // 开发环境：使用 ffmpeg-static 提供的路径
  return require("ffmpeg-static");
}

/**
 * 构建视频拼接的 FFmpeg 命令
 * @param {Object} config - 拼接配置
 * @param {string} config.aPath - A 面视频路径
 * @param {string} config.bPath - B 面视频路径
 * @param {string} config.outPath - 输出路径
 * @param {string} config.orientation - 方向 'landscape' | 'portrait'
 * @returns {string[]} FFmpeg 命令数组
 */
function buildStitchCommand(config) {
  const { aPath, bPath, outPath, orientation } = config;

  // 目标分辨率
  const targetWidth = orientation === 'landscape' ? 1920 : 1080;
  const targetHeight = orientation === 'landscape' ? 1080 : 1920;
  const targetFps = 30;

  const args = [
    '-y',  // 覆盖输出文件
    '-i', aPath,  // A 面视频输入
    '-i', bPath,  // B 面视频输入
  ];

  // 使用 filter_complex 进行拼接和缩放
  // 视频处理：缩放 + pad + 统一 SAR + 统一帧率
  // 音频处理：统一采样率到 48kHz
  // concat 同时拼接视频和音频
  const filters = [
    `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1:1[fps];[fps]fps=${targetFps}[v0]`,
    `[1:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1:1[fps];[fps]fps=${targetFps}[v1]`,
    `[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0]`,
    `[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1]`,
    `[v0][v1]concat=n=2:v=1:a=0[final_v]`,
    `[a0][a1]concat=n=2:v=0:a=1[final_a]`
  ];

  args.push('-filter_complex', filters.join(';'));

  // 映射输出流（视频和音频）
  args.push('-map', '[final_v]', '-map', '[final_a]');

  // 视频编码参数
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-r', `${targetFps}`,  // 帧率
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest'  // 以最短的流为准
  );

  // 输出文件
  args.push(outPath);

  return args;
}

/**
 * 执行 FFmpeg 命令
 * @param {string[]|Object} argsOrConfig - FFmpeg 命令行参数数组或拼接配置对象
 * @param {function} onLog - 日志回调函数
 * @returns {Promise<{success: boolean}>}
 */
function runFfmpeg(argsOrConfig, onLog) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();

    // 判断是配置对象还是命令数组
    let args;
    if (Array.isArray(argsOrConfig)) {
      // 已经是命令数组，直接使用
      args = argsOrConfig;
    } else {
      // 是配置对象，需要转换为命令
      args = buildStitchCommand(argsOrConfig);
    }

    // 调试：输出 ffmpeg 命令
    onLog?.(`[DEBUG] ffmpeg: ${ffmpegPath} ${args.slice(1).join(' ')}\n`);

    // 检查文件是否存在
    const fs = require("fs");
    if (!fs.existsSync(ffmpegPath)) {
      return reject(new Error(`FFmpeg 不存在: ${ffmpegPath}`));
    }

    // macOS 上需要 -nostdin 防止 FFmpeg 从 stdin 读取导致卡住
    const finalArgs = args[0] === "-y" ? ["-y", "-nostdin", ...args.slice(1)] : args;

    const p = spawn(ffmpegPath, finalArgs, { windowsHide: true });

    let stderr = "";
    p.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      onLog?.(s);
    });

    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve({ success: true });
      else reject(new Error(`ffmpeg exit code=${code}\n${stderr}`));
    });
  });
}

module.exports = { runFfmpeg, getFfmpegPath, buildStitchCommand };
