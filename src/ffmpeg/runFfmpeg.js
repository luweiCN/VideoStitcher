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
 * 执行 FFmpeg 命令
 * @param {string[]} args - FFmpeg 命令行参数数组
 * @param {function} onLog - 日志回调函数
 * @returns {Promise<{outPath: string}>}
 */
function runFfmpeg(args, onLog) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();

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

module.exports = { runFfmpeg, getFfmpegPath };
