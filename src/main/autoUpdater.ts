/**
 * 自动更新配置模块
 *
 * 正式版本只从火山引擎静态更新源检查，不读取私有 GitHub Release。
 * 下载、完整性校验和安装全部交给 electron-updater，renderer 不能提供下载地址。
 */

import { app, BrowserWindow } from 'electron';
import { autoUpdater, type AppUpdater, type UpdateCheckResult } from 'electron-updater';
import log from 'electron-log';

const updateBaseUrl = __UPDATE_BASE_URL__.trim().replace(/\/+$/, '');

let mainWindow: BrowserWindow | null = null;
let isDevelopment = false;
let checkPromise: Promise<UpdateCheckResult | null> | null = null;

interface ProgressInfo {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
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
 * 将 electron-updater 的多种更新说明格式收敛成纯文本。
 */
export function processReleaseNotes(releaseNotes: unknown): string {
  if (releaseNotes == null) return '';
  if (typeof releaseNotes === 'string') return releaseNotes;
  if (!Array.isArray(releaseNotes)) return '';

  return releaseNotes
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'note' in item && typeof item.note === 'string') {
        return item.note;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function sendToRenderer(channel: string, payload?: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function configureUpdateFeed(): boolean {
  if (!updateBaseUrl) return false;

  autoUpdater.setFeedURL({
    provider: 'generic',
    url: updateBaseUrl,
  });
  return true;
}

/**
 * 从火山更新源检查更新。
 */
export function checkForUpdates(): Promise<UpdateCheckResult | null> {
  if (checkPromise) return checkPromise;
  if (!configureUpdateFeed()) {
    return Promise.reject(new Error('未配置火山更新服务地址'));
  }

  checkPromise = (async () => {
    const result = await autoUpdater.checkForUpdates();
    log.info('[自动更新] 火山更新源检查完成');
    return result;
  })().finally(() => {
    checkPromise = null;
  });

  return checkPromise;
}

/**
 * 配置唯一的自动更新状态机。
 */
export function setupAutoUpdater(): AppUpdater {
  const feedConfigured = configureUpdateFeed();

  autoUpdater.logger = log;
  (autoUpdater.logger as typeof log).transports.file.level = 'info';
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.forceDevUpdateConfig = isDevelopment;

  log.info('[自动更新] 配置完成', {
    source: feedConfigured ? '火山引擎静态源' : '未配置',
    version: app.getVersion(),
    packaged: app.isPackaged,
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[自动更新] 发现新版本', info.version);
    sendToRenderer('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: processReleaseNotes(info.releaseNotes),
    });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[自动更新] 当前已是最新版本');
    sendToRenderer('update-not-available', { version: app.getVersion() });
  });

  autoUpdater.on('error', (error: Error) => {
    log.error('[自动更新] 更新失败', error);
    sendToRenderer('update-error', { message: error.message });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    sendToRenderer('update-download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[自动更新] 更新下载完成', info.version);
    sendToRenderer('update-downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: processReleaseNotes(info.releaseNotes),
    });
  });

  if (isDevelopment) {
    log.info('[自动更新] 开发模式下跳过自动检查');
    return autoUpdater;
  }
  if (!feedConfigured) {
    log.error('[自动更新] 正式版本缺少火山更新服务地址，已停止自动检查');
    return autoUpdater;
  }

  setTimeout(() => {
    sendToRenderer('update-checking');
    void checkForUpdates().catch((error: Error) => {
      log.error('[自动更新] 启动检查失败', error);
    });
  }, 5_000);

  setInterval(() => {
    void checkForUpdates().catch((error: Error) => {
      log.error('[自动更新] 定时检查失败', error);
    });
  }, 10 * 60 * 1_000);

  return autoUpdater;
}
