/**
 * 应用信息与配置 IPC 处理器
 * 包含：应用版本、全局配置、自动更新
 */

import { ipcMain, app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'fs';
import path from 'path';
import os from 'os';

let mainWindow: BrowserWindow | null = null;

/**
 * 检测开发环境
 */
export const isDevelopment: boolean =
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG === 'true' ||
  !app.isPackaged;

/**
 * 设置主窗口引用
 */
export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

/**
 * 处理 releaseNotes
 */
function processReleaseNotes(releaseNotes: string | any[] | undefined): string {
  if (!releaseNotes) return '';
  if (typeof releaseNotes === 'string') return releaseNotes;
  if (Array.isArray(releaseNotes)) return releaseNotes.map(n => n.note || '').join('\n');
  return '';
}

// ==================== 应用信息 ====================

/**
 * 获取应用版本信息
 */
async function handleGetAppVersion(): Promise<{ version: string; isDevelopment: boolean }> {
  return {
    version: app.getVersion(),
    isDevelopment: isDevelopment,
  };
}

// ==================== 全局配置 ====================

interface GlobalSettings {
  defaultOutputDir: string;
  defaultConcurrency: number;
  [key: string]: any;
}

/**
 * 获取配置文件路径
 */
function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'global-settings.json');
}

/**
 * 默认配置
 */
const DEFAULT_SETTINGS: GlobalSettings = {
  defaultOutputDir: '',
  defaultConcurrency: Math.max(1, Math.floor((os.cpus().length || 4) / 2)),
};

/**
 * 获取全局配置
 */
async function handleGetGlobalSettings(): Promise<{ success: boolean; settings?: GlobalSettings; error?: string }> {
  try {
    const configPath = getConfigPath();
    let settings = { ...DEFAULT_SETTINGS };

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const loadedSettings = JSON.parse(data);
      console.log('[全局配置] 读取配置:', loadedSettings);
      settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
    } else {
      console.log('[全局配置] 配置文件不存在，使用默认值');
    }

    if (!settings.defaultOutputDir) {
      settings.defaultOutputDir = app.getPath('downloads');
      console.log('[全局配置] 使用系统下载目录:', settings.defaultOutputDir);
    }

    return { success: true, settings };
  } catch (err: any) {
    console.error('[全局配置] 读取失败:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 保存全局配置
 */
async function handleSetGlobalSettings(_event: Electron.IpcMainInvokeEvent, settings: Partial<GlobalSettings>): Promise<{ success: boolean; error?: string }> {
  try {
    const configPath = getConfigPath();

    let currentSettings: Record<string, any> = {};
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      currentSettings = JSON.parse(data);
    }

    const newSettings = { ...currentSettings, ...settings };

    fs.writeFileSync(configPath, JSON.stringify(newSettings, null, 2), 'utf-8');
    console.log('[全局配置] 保存配置:', newSettings);

    return { success: true };
  } catch (err: any) {
    console.error('[全局配置] 保存失败:', err);
    return { success: false, error: err.message };
  }
}

// ==================== 自动更新 ====================

/**
 * 检查更新
 */
async function handleCheckForUpdates(): Promise<{ success: boolean; hasUpdate?: boolean; updateInfo?: any; error?: string }> {
  try {
    const log = require('electron-log');
    const currentVersion = app.getVersion();

    log.info('=== 开始检查更新 ===');
    log.info('当前应用版本:', currentVersion);

    if (mainWindow && !mainWindow.isDestroyed()) {
      const currentVersionStr = JSON.stringify(currentVersion);
      mainWindow.webContents.executeJavaScript(`
        console.log('%c[检查更新]', 'background: #3b82f6; color: white; padding: 2px 5px; border-radius: 3px;', '开始检查...');
        console.log('当前版本:', ${currentVersionStr});
      `);
    }

    const result = await autoUpdater.checkForUpdates();

    log.info('检查更新结果:', JSON.stringify(result, null, 2));

    if (mainWindow && !mainWindow.isDestroyed() && result) {
      const hasUpdate = result.versionInfo && result.versionInfo.version !== currentVersion;
      const resultStr = JSON.stringify({
        hasUpdate,
        currentVersion,
        latestVersion: result.versionInfo?.version,
        updateInfo: result.updateInfo,
      });
      mainWindow.webContents.executeJavaScript(`
        console.log('检查结果:', ${resultStr});
      `);
    }

    const hasUpdate = result?.versionInfo?.version !== currentVersion;
    const updateInfo = result?.updateInfo
      ? {
          ...result.updateInfo,
          releaseNotes: processReleaseNotes(result.updateInfo.releaseNotes || ''),
        }
      : undefined;

    return { success: true, hasUpdate, updateInfo };
  } catch (err: any) {
    const log = require('electron-log');
    log.error('检查更新失败:', err);

    if (mainWindow && !mainWindow.isDestroyed()) {
      const errorMsg = JSON.stringify(err.message);
      mainWindow.webContents.executeJavaScript(`
        console.error('%c[检查更新失败]', 'background: #ef4444; color: white; padding: 2px 5px; border-radius: 3px;', ${errorMsg});
      `);
    }

    return { success: false, error: err.message };
  }
}

/**
 * 下载更新
 */
async function handleDownloadUpdate(): Promise<{ success: boolean; error?: string }> {
  const log = require('electron-log');
  log.info('[下载更新] 开始下载');

  try {
    await autoUpdater.downloadUpdate();
    log.info('[下载更新] 下载完成');
    return { success: true };
  } catch (err: any) {
    log.error('[下载更新] 失败:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 安装更新
 */
async function handleInstallUpdate(): Promise<{ success: boolean; error?: string }> {
  const log = require('electron-log');
  log.info('[安装更新] 开始安装并重启');

  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err: any) {
    log.error('[安装更新] 失败:', err);
    return { success: false, error: err.message };
  }
}

// ==================== 注册处理器 ====================

/**
 * 注册所有应用信息 IPC 处理器
 */
export function registerApplicationHandlers(win?: BrowserWindow): void {
  if (win) {
    mainWindow = win;
  }

  // 应用信息
  ipcMain.handle('get-app-version', handleGetAppVersion);

  // 全局配置
  ipcMain.handle('get-global-settings', handleGetGlobalSettings);
  ipcMain.handle('set-global-settings', handleSetGlobalSettings);

  // 自动更新（Windows/Linux）
  ipcMain.handle('check-for-updates', handleCheckForUpdates);
  ipcMain.handle('download-update', handleDownloadUpdate);
  ipcMain.handle('install-update', handleInstallUpdate);
}

export {
  handleGetAppVersion,
  handleGetGlobalSettings,
  handleSetGlobalSettings,
  handleCheckForUpdates,
  handleDownloadUpdate,
  handleInstallUpdate,
};
