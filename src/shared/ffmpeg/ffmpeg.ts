/**
 * FFmpeg 执行核心模块
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import ffmpegStatic from 'ffmpeg-static';
import type { FfmpegResult, FfmpegLogCallback } from './types';

/**
 * 获取 FFmpeg 可执行文件路径
 */
export function getFfmpegPath(): string {
  if (app.isPackaged) {
    // 打包后：ffmpeg 在 app.asar.unpacked/node_modules/ffmpeg-static/
    const resourcesPath = process.resourcesPath;
    const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static');

    // 根据 platform 选择正确的可执行文件名
    const ffmpegBin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    return path.join(unpackedPath, ffmpegBin);
  }

  // 开发环境：使用 ffmpeg-static 提供的路径
  return ffmpegStatic as string;
}

/**
 * 执行 FFmpeg 命令
 */
export function runFfmpeg(
  args: string[],
  onLog?: FfmpegLogCallback
): Promise<FfmpegResult> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();

    // 调试：输出 ffmpeg 命令
    onLog?.(`[DEBUG] ffmpeg: ${ffmpegPath} ${args.slice(1).join(' ')}\n`);

    // 检查文件是否存在
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
