"use strict";
/**
 * macOS 自动更新 IPC 处理器
 *
 * 负责处理渲染进程发送的更新相关请求
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupUpdateHandlers = setupUpdateHandlers;
const electron_1 = require("electron");
const updater_1 = require("./updater");
let macUpdater = null;
/**
 * 设置 macOS 更新处理器
 * @param mainWindow 主窗口实例
 */
function setupUpdateHandlers(mainWindow) {
    // 只在 macOS 上启用
    if (process.platform !== 'darwin') {
        console.log('[更新处理器] 非 macOS 平台，跳过 macOS 更新处理器');
        return;
    }
    console.log('[更新处理器] 初始化 macOS 更新处理器');
    macUpdater = new updater_1.MacUpdater(mainWindow);
    // 检查更新
    electron_1.ipcMain.handle('mac-check-for-updates', async () => {
        if (!macUpdater) {
            return { success: false, error: '更新管理器未初始化' };
        }
        try {
            const result = await macUpdater.checkForUpdates();
            if (result.success && result.hasUpdate && result.updateInfo) {
                // 发送更新可用事件
                mainWindow.webContents.send('update-available', {
                    version: result.updateInfo.version,
                    releaseDate: result.updateInfo.releaseDate,
                    releaseNotes: result.updateInfo.releaseNotes,
                });
            }
            else if (result.success && !result.hasUpdate) {
                // 发送已是最新版本事件
                mainWindow.webContents.send('update-not-available', {
                    version: require('electron').app.getVersion(),
                });
            }
            return result;
        }
        catch (error) {
            console.error('[更新处理器] 检查更新失败:', error);
            return { success: false, error: error.message };
        }
    });
    // 下载更新
    electron_1.ipcMain.handle('mac-download-update', async () => {
        if (!macUpdater) {
            return { success: false, error: '更新管理器未初始化' };
        }
        try {
            return await macUpdater.downloadUpdate();
        }
        catch (error) {
            console.error('[更新处理器] 下载更新失败:', error);
            return { success: false, error: error.message };
        }
    });
    // 安装更新
    electron_1.ipcMain.handle('mac-install-update', async () => {
        if (!macUpdater) {
            return { success: false, error: '更新管理器未初始化' };
        }
        try {
            return await macUpdater.installUpdate();
        }
        catch (error) {
            console.error('[更新处理器] 安装更新失败:', error);
            return { success: false, error: error.message };
        }
    });
    console.log('[更新处理器] macOS 更新处理器已注册');
}
