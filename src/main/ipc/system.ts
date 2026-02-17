/**
 * 系统信息与外部操作 IPC 处理器
 * 包含：系统内存、下载目录、外部链接、平台信息等
 */

import { ipcMain, app, shell } from 'electron';
import os from 'os';

/**
 * 获取系统默认下载目录
 */
async function handleGetDefaultDownloadDir(): Promise<string> {
  try {
    return app.getPath('downloads');
  } catch (err) {
    console.error('[默认下载目录] 获取失败:', err);
    return '';
  }
}

/**
 * 获取系统内存信息
 */
async function handleGetSystemMemory(): Promise<{
  total: number;
  free: number;
  used: number;
  totalGB: string;
  freeGB: string;
  usedGB: string;
}> {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    total: totalMemory,
    free: freeMemory,
    used: usedMemory,
    totalGB: (totalMemory / (1024 * 1024 * 1024)).toFixed(1),
    freeGB: (freeMemory / (1024 * 1024 * 1024)).toFixed(1),
    usedGB: (usedMemory / (1024 * 1024 * 1024)).toFixed(1),
  };
}

/**
 * 使用系统默认浏览器打开外部链接
 */
async function handleOpenExternal(_event: Electron.IpcMainInvokeEvent, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 获取系统平台信息
 */
async function handleGetPlatform(): Promise<string> {
  return process.platform;
}

// ==================== 注册处理器 ====================

/**
 * 注册所有系统信息 IPC 处理器
 */
export function registerSystemHandlers(): void {
  ipcMain.handle('get-default-download-dir', handleGetDefaultDownloadDir);
  ipcMain.handle('get-system-memory', handleGetSystemMemory);
  ipcMain.handle('open-external', handleOpenExternal);
  ipcMain.handle('get-platform', handleGetPlatform);
}

export {
  handleGetDefaultDownloadDir,
  handleGetSystemMemory,
  handleOpenExternal,
  handleGetPlatform,
};
