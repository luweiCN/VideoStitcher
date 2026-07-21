/**
 * 应用信息与配置 IPC 处理器
 * 包含：应用版本、全局配置、自动更新、日志管理
 */

import { app, shell } from 'electron';
import { trustedIpcMain as ipcMain } from './security';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getLogFilePath, getLogContent, getLogDirectory } from '@main/utils/logger';
import { checkForUpdates, createClientUpdateInfo } from '@main/autoUpdater';

/**
 * 检测开发环境
 */
export const isDevelopment: boolean = !app.isPackaged;

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
    const currentVersion = app.getVersion();

    log.info('[自动更新] 手动检查开始，当前版本:', currentVersion);

    const result = await checkForUpdates();

    const hasUpdate = Boolean(result?.versionInfo?.version && result.versionInfo.version !== currentVersion);
    const updateInfo = result?.updateInfo
      ? createClientUpdateInfo(result.updateInfo)
      : undefined;

    return { success: true, hasUpdate, updateInfo };
  } catch (err: any) {
    log.error('[自动更新] 手动检查失败:', err);

    return { success: false, error: err.message };
  }
}

/**
 * 下载更新
 */
async function handleDownloadUpdate(): Promise<{ success: boolean; error?: string }> {
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
  log.info('[安装更新] 开始安装并重启');

  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err: any) {
    log.error('[安装更新] 失败:', err);
    return { success: false, error: err.message };
  }
}

// ==================== 日志管理 ====================

/**
 * 获取日志文件路径
 */
async function handleGetLogFilePath(): Promise<{ path: string }> {
  return { path: getLogFilePath() };
}

/**
 * 获取日志内容（最后 N 行）
 */
async function handleGetLogContent(_event: any, lines: number = 200): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const content = getLogContent(lines);
    return { success: true, content };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 打开日志文件所在目录
 */
async function handleOpenLogDirectory(): Promise<{ success: boolean; error?: string }> {
  try {
    await shell.openPath(getLogDirectory());
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==================== 注册处理器 ====================

/**
 * 注册所有应用信息 IPC 处理器
 */
export function registerApplicationHandlers(): void {
  // 应用信息
  ipcMain.handle('get-app-version', handleGetAppVersion);

  // 全局配置
  ipcMain.handle('get-global-settings', handleGetGlobalSettings);
  ipcMain.handle('set-global-settings', handleSetGlobalSettings);

  // 自动更新（Windows/Linux）
  ipcMain.handle('check-for-updates', handleCheckForUpdates);
  ipcMain.handle('download-update', handleDownloadUpdate);
  ipcMain.handle('install-update', handleInstallUpdate);

  // 日志管理
  ipcMain.handle('get-log-file-path', handleGetLogFilePath);
  ipcMain.handle('get-log-content', handleGetLogContent);
  ipcMain.handle('open-log-directory', handleOpenLogDirectory);
}

export {
  handleGetAppVersion,
  handleGetGlobalSettings,
  handleSetGlobalSettings,
  handleCheckForUpdates,
  handleDownloadUpdate,
  handleInstallUpdate,
};
