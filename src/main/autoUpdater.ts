/**
 * 自动更新配置模块
 *
 * 正式版本只从火山引擎静态更新源检查，不读取私有 GitHub Release。
 * 下载、完整性校验和安装全部交给 electron-updater。
 * 自动更新失败时，由主进程提供经过校验的完整安装包地址。
 */

import { app, BrowserWindow } from 'electron';
import { autoUpdater, type AppUpdater, type UpdateCheckResult } from 'electron-updater';
import log from 'electron-log';
import { getManagedRollbackTarget } from '@main/releaseDirective';
import { buildManualUpdateDownloadUrl, type ClientUpdateInfo } from '@shared/update';

const updateBaseUrl = __UPDATE_BASE_URL__.trim().replace(/\/+$/, '');

let mainWindow: BrowserWindow | null = null;
let isDevelopment = false;
let checkPromise: Promise<UpdateCheckResult | null> | null = null;
let managedRollbackTarget: string | undefined;
let downloadedRollbackTarget: string | undefined;

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

/**
 * 将更新信息转换成允许发送给渲染进程的安全结构。
 */
export function createClientUpdateInfo(info: {
  version: string;
  releaseDate?: string | null;
  releaseNotes?: unknown;
}): ClientUpdateInfo {
  return {
    version: info.version,
    releaseDate: info.releaseDate ?? '',
    releaseNotes: processReleaseNotes(info.releaseNotes),
    manualDownloadUrl: buildManualUpdateDownloadUrl({
      baseUrl: updateBaseUrl,
      version: info.version,
      platform: process.platform,
      arch: process.arch,
    }),
  };
}

export function isManagedRollbackVersion(version: string): boolean {
  return managedRollbackTarget === version || downloadedRollbackTarget === version;
}

export function getManagedRollbackTargetVersion(): string | undefined {
  return downloadedRollbackTarget ?? managedRollbackTarget;
}

/**
 * 安装已经下载的较低版本前重新验证授权，避免管理员取消回退后仍安装旧包。
 */
export async function validateManagedRollbackInstall(targetVersion: string): Promise<void> {
  const authorizedTarget = await getManagedRollbackTarget({
    updateBaseUrl,
    currentVersion: app.getVersion(),
    signingPublicKey: __LICENSE_SIGNING_PUBLIC_KEY__.trim(),
  });
  if (authorizedTarget !== targetVersion) {
    throw new Error('当前回退授权已经失效，请重新检查版本');
  }
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
    managedRollbackTarget = undefined;
    autoUpdater.allowDowngrade = false;
    try {
      managedRollbackTarget = await getManagedRollbackTarget({
        updateBaseUrl,
        currentVersion: app.getVersion(),
        signingPublicKey: __LICENSE_SIGNING_PUBLIC_KEY__.trim(),
      });
      autoUpdater.allowDowngrade = managedRollbackTarget !== undefined;
      if (managedRollbackTarget) {
        log.warn(`[自动更新] 已验证受控回退指令：${app.getVersion()} → ${managedRollbackTarget}`);
      }
    } catch (error: unknown) {
      log.warn('[自动更新] 回退指令不可用，本次检查不允许降级:', error);
      managedRollbackTarget = undefined;
      autoUpdater.allowDowngrade = false;
    }
    const result = await autoUpdater.checkForUpdates();
    if (managedRollbackTarget && result?.updateInfo.version !== managedRollbackTarget) {
      const unexpectedVersion = result?.updateInfo.version ?? '无';
      managedRollbackTarget = undefined;
      autoUpdater.allowDowngrade = false;
      const error = new Error(`回退清单版本 ${unexpectedVersion} 与签名目标不一致`);
      sendToRenderer('update-error', { message: error.message });
      throw error;
    }
    autoUpdater.allowDowngrade = false;
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
    if (managedRollbackTarget && info.version !== managedRollbackTarget) {
      log.error(`[自动更新] 已阻止与签名目标不一致的回退版本：${info.version}`);
      return;
    }
    if (!managedRollbackTarget) downloadedRollbackTarget = undefined;
    log.info('[自动更新] 发现新版本', info.version);
    sendToRenderer('update-available', createClientUpdateInfo(info));
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
    downloadedRollbackTarget = managedRollbackTarget === info.version ? info.version : undefined;
    log.info('[自动更新] 更新下载完成', info.version);
    sendToRenderer('update-downloaded', createClientUpdateInfo(info));
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
