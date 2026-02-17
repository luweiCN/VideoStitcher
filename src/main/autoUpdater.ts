/**
 * 自动更新配置模块
 * 配置 electron-updater 并处理自动更新事件
 */

import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import os from 'os';
import log from 'electron-log';
import ffmpegStatic from 'ffmpeg-static';

let mainWindow: BrowserWindow | null = null;
let isDevelopment = false;

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl?: string;
  fileSize?: number;
}

interface ProgressInfo {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

interface VersionInfo {
  version: string;
  releaseDate: string;
  files: Array<{
    url: string;
    path?: string;
    size?: number;
  }>;
}

interface UpdateCheckResult {
  versionInfo?: VersionInfo;
  updateInfo?: {
    releaseNotes?: string;
  };
}

/**
 * 设置主窗口引用
 */
export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

/**
 * 设置开发环境标志
 */
export function setDevelopmentMode(isDev: boolean): void {
  isDevelopment = isDev;
}

/**
 * 处理 releaseNotes
 */
export function processReleaseNotes(releaseNotes: unknown): string {
  if (releaseNotes == null) return '';
  if (typeof releaseNotes === 'string') return releaseNotes;
  if (Array.isArray(releaseNotes)) {
    return releaseNotes.map((n: any) => typeof n === 'string' ? n : n.note || '').join('\n');
  }
  return '';
}

/**
 * 获取 FFmpeg 可执行文件路径（用于视频缩略图）
 */
function getFfmpegPath(): string {
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath;
    // 打包后：ffmpeg 在 app.asar.unpacked/node_modules/ffmpeg-static/
    return path.join(
      resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'ffmpeg-static',
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    );
  }
  return ffmpegStatic || '';
}

/**
 * 配置自动更新
 */
export function setupAutoUpdater(): void {
  // 从环境变量或 package.json 读取仓库信息
  const repoInfo = process.env.GITHUB_REPO || 'luweiCN/VideoStitcher';
  const [owner, repo] = repoInfo.split('/');

  // macOS 必须显式设置 feedURL 才能从 GitHub 检查更新
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: owner,
    repo: repo,
  });

  // 输出到日志文件（electron-log）
  log.info('自动更新配置:', { owner, repo });
  log.info('当前应用版本:', app.getVersion());
  log.info('是否为打包应用:', app.isPackaged);

  // 也输出到渲染进程控制台（方便调试）
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      const configStr = JSON.stringify({ owner, repo });
      const versionStr = JSON.stringify(app.getVersion());
      const isPackagedStr = JSON.stringify(app.isPackaged);
      mainWindow.webContents.executeJavaScript(`
        console.log('%c[自动更新]', 'background: #10b981; color: white; padding: 2px 5px; border-radius: 3px;', '配置已加载');
        console.log('仓库:', ${configStr});
        console.log('当前版本:', ${versionStr});
        console.log('是否打包:', ${isPackagedStr});
      `);
    }
  }, 2000);

  // 日志输出
  autoUpdater.logger = log;
  (autoUpdater.logger as any).transports.file.level = 'info';
  autoUpdater.autoDownload = false; // 不自动下载，由用户确认
  autoUpdater.autoInstallOnAppQuit = false; // 不在退出时自动安装，需用户手动点击重启按钮

  // 开发环境下强制检查更新（用于测试）
  autoUpdater.forceDevUpdateConfig = true;

  // 自动更新事件监听
  autoUpdater.on('update-available', async (info) => {
    console.log('Update available:', info);

    // macOS 平台的更新由 ipc-handlers.ts 统一处理，不在这里发送事件
    if (process.platform === 'darwin') {
      console.log('[自动更新] macOS 平台，更新由 IPC 处理器统一管理');
      return;
    }

    // Windows/Linux 平台继续使用 electron-updater 的原生更新流程
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: processReleaseNotes(info.releaseNotes),
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info);
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('update-not-available', { version: app.getVersion() });
    }
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('Update error:', err);
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('update-error', { message: err.message });
    }
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('update-download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[更新下载完成] 事件已触发');
    console.log('info:', info);

    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: processReleaseNotes(info.releaseNotes),
      });
      console.log('✅ 已发送 update-downloaded 到渲染进程');
    } else {
      console.error('❌ 窗口不存在或已销毁，无法发送事件');
    }
  });

  // 应用启动后延迟检查更新（避免影响启动速度）
  if (!isDevelopment) {
    setTimeout(() => {
      console.log('[自动检查] 开始检查更新...');
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('update-checking');
      }

      if (process.platform === 'darwin') {
        checkForMacOSUpdates();
      } else {
        autoUpdater
          .checkForUpdates()
          .then((result) => {
            console.log('[自动检查] 检查完成:', result);
          })
          .catch((err: Error) => {
            console.error('[自动检查] 检查失败:', err);
          });
      }
    }, 5000); // 5 秒后检查

    // 每 10 分钟自动检查更新
    setInterval(() => {
      if (process.platform === 'darwin') {
        checkForMacOSUpdates();
      } else {
        autoUpdater.checkForUpdates().catch((err: Error) => {
          console.error('Failed to check for updates:', err);
        });
      }
    }, 10 * 60 * 1000);
  } else {
    console.log('[自动检查] 开发模式下跳过自动更新检查');
  }
}

/**
 * macOS 检查更新
 */
export async function checkForMacOSUpdates(): Promise<void> {
  if (!mainWindow || !(mainWindow as any).macUpdater) {
    console.warn('[自动检查] MacUpdater 未初始化');
    return;
  }

  try {
    // 发送检查中事件到渲染进程
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('update-checking');
    }

    // 辅助函数：输出日志到浏览器控制台
    const logToConsole = (style: string, ...args: unknown[]) => {
      console.log(...args);
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        const msg = args
          .map((arg) => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(' ');
        mainWindow.webContents.executeJavaScript(
          `console.log('${style}', '${msg.replace(/\\/g, '/').replace(/'/g, "\\'")}')`
        );
      }
    };

    logToConsole(
      '%c[Mac 更新] 开始检查更新...',
      'background: #8b5cf6; color: white; padding: 2px 5px; border-radius: 3px;'
    );
    logToConsole('%c[Mac 更新] 当前架构:', 'background: #6366f1; color: white;', process.arch);
    logToConsole('%c[Mac 更新] 当前版本:', 'background: #6366f1; color: white;', app.getVersion());

    const result = await autoUpdater.checkForUpdates() as UpdateCheckResult | null;
    logToConsole(
      '%c[Mac 更新] 检查完成，返回结果类型:',
      'background: #10b981; color: white;',
      typeof result
    );

    if (!result) {
      logToConsole('%c[Mac 更新] ❌ 检查结果为空', 'background: #ef4444; color: white;');
      return;
    }

    if (!result.versionInfo) {
      logToConsole('%c[Mac 更新] ❌ versionInfo 为空', 'background: #ef4444; color: white;');
      logToConsole('%c[Mac 更新] result 对象键:', 'background: #ef4444; color: white;', Object.keys(result));
      return;
    }

    const currentVersion = app.getVersion();
    const latestVersion = result.versionInfo.version;
    logToConsole(
      '%c[Mac 更新] 当前版本 vs 最新版本:',
      'background: #3b82f6; color: white;',
      `${currentVersion} -> ${latestVersion}`
    );

    if (latestVersion !== currentVersion) {
      logToConsole('%c[Mac 更新] ✅ 发现新版本!', 'background: #10b981; color: white;');
      // 直接从 electron-updater 返回的 files 中查找下载 URL
      const files = result.versionInfo?.files || [];
      const currentArch = process.arch;

      logToConsole('%c[Mac 更新] files 数组长度:', 'background: #f59e0b; color: white;', files.length);

      if (files.length === 0) {
        logToConsole(
          '%c[Mac 更新] ❌ files 数组为空！可能 Release 配置不正确',
          'background: #ef4444; color: white; font-weight: bold;'
        );
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('update-error', {
            message: '未找到更新安装包。请确认 Release 中包含 macOS 安装包（.zip 文件）',
          });
        }
        return;
      }

      // 查找适合当前架构的 ZIP 包
      let file: { url: string; path?: string; size?: number } | null = null;
      let matchReason = '';

      // 第一轮：精确匹配
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const url = f.url.toLowerCase();
        const isMacZip = url.includes('mac') && url.endsWith('.zip');

        if (currentArch === 'arm64') {
          if (isMacZip && url.includes('arm64')) {
            file = f;
            matchReason = 'ARM64 精确匹配';
            break;
          }
        } else if (currentArch === 'x64') {
          if (isMacZip && url.includes('-x64-')) {
            file = f;
            matchReason = 'x64 精确匹配';
            break;
          }
          if (isMacZip && url.includes('universal')) {
            file = f;
            matchReason = 'x64 universal 匹配';
            break;
          }
          if (isMacZip && !url.includes('arm64')) {
            file = f;
            matchReason = 'x64 回退匹配（非 ARM）';
            break;
          }
        }
      }

      // 第二轮：ARM64 回退到 universal 包
      if (!file && currentArch === 'arm64') {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const url = f.url.toLowerCase();
          const isUniversalMac = url.includes('mac') && url.endsWith('.zip') && url.includes('universal');

          if (isUniversalMac) {
            file = f;
            matchReason = 'ARM64 回退到 universal 包';
            break;
          }
        }
      }

      // 第三轮：任何 macOS ZIP 包
      if (!file) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const url = f.url.toLowerCase();
          const isAnyMacZip = url.includes('mac') && url.endsWith('.zip');

          if (isAnyMacZip) {
            file = f;
            matchReason = '最后回退：任何 macOS ZIP';
            break;
          }
        }
      }

      if (!file) {
        const allFilenames = files.map((f) => f.url.split('/').pop()).join(', ');
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('update-error', {
            message: `未找到适合 ${currentArch} 架构的 macOS 安装包。可用文件: ${allFilenames}`,
          });
        }
        return;
      }

      // 处理下载 URL
      let downloadUrl = file.url;

      if (downloadUrl && !downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
        const filename = file.path || downloadUrl;
        const version = result.versionInfo!.version;
        downloadUrl = `https://github.com/luweiCN/VideoStitcher/releases/download/v${version}/${filename}`;
      }

      if (!downloadUrl || typeof downloadUrl !== 'string' || downloadUrl.trim() === '') {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
          mainWindow.webContents.send('update-error', {
            message: '下载 URL 无效，请检查 Release 配置',
          });
        }
        return;
      }

      const updateInfo: UpdateInfo = {
        version: result.versionInfo.version,
        releaseDate: result.versionInfo.releaseDate,
        releaseNotes: result.updateInfo?.releaseNotes || '',
        downloadUrl: downloadUrl,
        fileSize: file.size || 0,
      };

      // 设置到 MacUpdater
      (mainWindow as any).macUpdater.setUpdateInfo(updateInfo);

      // 发送更新可用事件
      if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('update-available', {
          version: updateInfo.version,
          releaseDate: updateInfo.releaseDate,
          releaseNotes: updateInfo.releaseNotes,
        });
      }
    } else {
      // 没有新版本
      logToConsole('%c[Mac 更新] ℹ️ 已是最新版本', 'background: #6b7280; color: white;', latestVersion);
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('update-not-available', { version: currentVersion });
      }
    }
  } catch (error) {
    const err = error as Error;
    console.error('[Mac 更新] ❌ 检查更新异常:', err);
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('update-error', { message: `检查更新失败: ${err.message}` });
    }
  }
}
