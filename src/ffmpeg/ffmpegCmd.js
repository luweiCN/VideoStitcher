const { spawn } = require("child_process");
const path = require("path");
const { app } = require("electron");

function getFfmpegPath() {
  const staticPath = require("ffmpeg-static");
  // 在打包后，ffmpeg 被解压到 app.asar.unpacked 目录
  if (app.isPackaged) {
    // Windows 和 macOS 路径处理
    let unpackedPath = staticPath.replace("app.asar", "app.asar.unpacked");
    // 确保路径使用正确的分隔符
    return path.normalize(unpackedPath);
  }
  return staticPath;
}

function buildArgs({ aPath, bPath, outPath, orientation }) {
  const isLandscape = orientation === "landscape";
  const W = isLandscape ? 1920 : 1080;
  const H = isLandscape ? 1080 : 1920;

  // 保留全画面：缩放到不超出目标分辨率，然后 pad 黑边到目标尺寸
  // pad 的 x/y 用 (ow-iw)/2 让画面居中
  // setsar=1:1 确保 SAR 一致，避免 concat 失败
  const filter = `
[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1,fps=30,format=yuv420p[v0];
[1:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1:1,fps=30,format=yuv420p[v1];
[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0];
[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];
[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]
`.trim();

  return [
    "-y",
    "-i", aPath,
    "-i", bPath,
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", "[a]",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "192k",
    outPath
  ];
}

function runFfmpeg({ aPath, bPath, outPath, orientation }, onLog) {
  return new Promise((resolve, reject) => {
    const args = buildArgs({ aPath, bPath, outPath, orientation });
    const ffmpegPath = getFfmpegPath();

    // 调试：输出 ffmpeg 路径
    onLog?.(`[DEBUG] ffmpeg path: ${ffmpegPath}\n`);

    // 检查文件是否存在
    const fs = require("fs");
    if (!fs.existsSync(ffmpegPath)) {
      return reject(new Error(`FFmpeg 不存在: ${ffmpegPath}`));
    }

    const p = spawn(ffmpegPath, args, { windowsHide: true });

    let stderr = "";
    p.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      onLog?.(s);
    });

    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve({ outPath });
      else reject(new Error(`ffmpeg exit code=${code}\n${stderr}`));
    });
  });
}

module.exports = { runFfmpeg };
