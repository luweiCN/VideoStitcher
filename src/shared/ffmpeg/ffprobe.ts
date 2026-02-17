/**
 * FFprobe 模块
 * 封装视频元数据获取功能
 */

import { spawn, execFile } from 'child_process';
import path from 'path';
import { app } from 'electron';

/**
 * 基础视频元数据
 */
export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

/**
 * 扩展视频信息
 */
export interface VideoInfo extends VideoMetadata {
  /** 帧率 */
  fps?: number;
  /** 视频编码 */
  codec?: string;
  /** 比特率 (bps) */
  bitrate?: number;
  /** 宽高比 */
  aspectRatio?: string;
}

/**
 * 获取视频信息的选项
 */
export interface GetVideoInfoOptions {
  /** 额外需要获取的字段 */
  fields?: Array<'fps' | 'codec' | 'bitrate' | 'aspectRatio'>;
  /** 超时时间（毫秒） */
  timeout?: number;
}

// 开发环境才 require ffprobe 模块
let ffprobeInstaller: { path: string } | null = null;
if (typeof app !== 'undefined' && !app.isPackaged) {
  try {
    ffprobeInstaller = require('@ffprobe-installer/ffprobe');
  } catch {
    // 忽略，可能在某些环境下不可用
  }
}

/**
 * 获取 FFprobe 可执行文件路径
 * 打包后需要特殊处理路径
 */
export function getFfprobePath(): string {
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath;
    const platform = process.platform;
    const arch = process.arch;
    let subdir: string;
    if (platform === 'win32') {
      subdir = 'win32-x64';
    } else if (platform === 'darwin') {
      subdir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    } else {
      subdir = 'linux-x64';
    }

    const unpackedPath = path.join(
      resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@ffprobe-installer',
      subdir,
    );

    const ffprobeBin = platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    return path.join(unpackedPath, ffprobeBin);
  }

  if (!ffprobeInstaller) {
    throw new Error('FFprobe 模块未加载');
  }
  return ffprobeInstaller.path;
}

/**
 * 获取视频元数据（宽高、时长）
 */
export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration',
      '-of', 'json',
      filePath,
    ];

    const proc = spawn(getFfprobePath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
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
          reject(new Error('无法解析视频元数据'));
        }
      } catch (err) {
        reject(new Error(`解析 ffprobe 输出失败: ${(err as Error).message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffprobe 执行失败: ${err.message}`));
    });
  });
}

/**
 * 获取视频时长（便捷函数）
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const metadata = await getVideoMetadata(filePath);
    return metadata.duration || 0;
  } catch {
    return 0;
  }
}

/**
 * 通过 stderr 快速获取视频时长（某些场景更快）
 */
export async function getVideoDurationFast(filePath: string, timeout = 5000): Promise<number> {
  return new Promise((resolve) => {
    const args = ['-i', filePath, '-hide_banner'];
    execFile(getFfprobePath(), args, { timeout }, (_err, _stdout, stderr) => {
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const hours = parseInt(match[1]);
        const mins = parseInt(match[2]);
        const secs = parseInt(match[3]);
        const centisecs = parseInt(match[4]);
        resolve(hours * 3600 + mins * 60 + secs + centisecs / 100);
      } else {
        resolve(0);
      }
    });
  });
}

/**
 * 获取扩展视频信息
 */
export async function getVideoInfo(
  filePath: string,
  options: GetVideoInfoOptions = {}
): Promise<VideoInfo> {
  const { fields = [], timeout = 10000 } = options;

  // 构建请求的字段列表
  const baseFields = ['width', 'height', 'duration'];
  const extraFields: string[] = [];

  if (fields.includes('fps')) extraFields.push('r_frame_rate');
  if (fields.includes('codec')) extraFields.push('codec_name');
  if (fields.includes('bitrate')) extraFields.push('bit_rate');

  const allFields = [...baseFields, ...extraFields];

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`获取视频信息超时 (${timeout}ms)`));
    }, timeout);

    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', `stream=${allFields.join(',')}`,
      '-of', 'json',
      filePath,
    ];

    const proc = spawn(getFfprobePath(), args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`ffprobe exit code=${code}: ${stderr}`));
      }

      try {
        const output = JSON.parse(stdout);
        if (output.streams && output.streams.length > 0) {
          const stream = output.streams[0];

          const result: VideoInfo = {
            width: stream.width || 0,
            height: stream.height || 0,
            duration: stream.duration ? parseFloat(stream.duration) : 0,
          };

          // 解析扩展字段
          if (stream.r_frame_rate) {
            const [num, den] = stream.r_frame_rate.split('/');
            result.fps = den ? parseFloat(num) / parseFloat(den) : parseFloat(num);
          }
          if (stream.codec_name) {
            result.codec = stream.codec_name;
          }
          if (stream.bit_rate) {
            result.bitrate = parseInt(stream.bit_rate, 10);
          }

          // 计算宽高比
          if (result.width && result.height) {
            const ratio = result.width / result.height;
            if (Math.abs(ratio - 16 / 9) < 0.1) result.aspectRatio = '16:9';
            else if (Math.abs(ratio - 9 / 16) < 0.1) result.aspectRatio = '9:16';
            else if (Math.abs(ratio - 4 / 3) < 0.1) result.aspectRatio = '4:3';
            else if (Math.abs(ratio - 1) < 0.05) result.aspectRatio = '1:1';
            else result.aspectRatio = `${Math.round(ratio * 10) / 10}:1`;
          }

          resolve(result);
        } else {
          reject(new Error('无法解析视频信息'));
        }
      } catch (err) {
        reject(new Error(`解析 ffprobe 输出失败: ${(err as Error).message}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`ffprobe 执行失败: ${err.message}`));
    });
  });
}
