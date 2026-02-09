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
 * @returns MacUpdater 实例
 */
function setupUpdateHandlers(mainWindow) {
    // 只在 macOS 上启用
    if (process.platform !== 'darwin') {
        console.log('[更新处理器] 非 macOS 平台，跳过 macOS 更新处理器');
        return null;
    }
    console.log('[更新处理器] 初始化 macOS 更新处理器');
    macUpdater = new updater_1.MacUpdater(mainWindow);
    // 设置更新信息（用于自动检测到更新时初始化内部状态）
    electron_1.ipcMain.handle('mac-set-update-info', async (_event, updateInfo) => {
        if (!macUpdater) {
            return { success: false, error: '更新管理器未初始化' };
        }
        try {
            macUpdater.setUpdateInfo(updateInfo);
            return { success: true };
        }
        catch (error) {
            console.error('[更新处理器] 设置更新信息失败:', error);
            return { success: false, error: error.message };
        }
    });
    // 检查更新 - 使用 electron-updater
    electron_1.ipcMain.handle('mac-check-for-updates', async () => {
        const { autoUpdater } = require('electron-updater');
        try {
            console.log('[更新处理器] 开始检查更新...');
            const result = await autoUpdater.checkForUpdates();
            console.log('[更新处理器] 检查结果:', result);
            if (result?.versionInfo && result.versionInfo.version !== require('electron').app.getVersion()) {
                // 直接从 electron-updater 返回的 files 中查找下载 URL
                const files = result.versionInfo?.files || [];
                const currentArch = process.arch;
                // 查找适合当前架构的 ZIP 包
                let file = files.find((f) => {
                    const url = f.url.toLowerCase();
                    const isMacZip = url.includes('mac') && url.endsWith('.zip');
                    if (currentArch === 'arm64') {
                        return isMacZip && url.includes('arm64');
                    }
                    else if (currentArch === 'x64') {
                        return isMacZip && (url.includes('-x64-') || url.includes('-x64.') || !url.includes('arm64'));
                    }
                    return false;
                });
                // 如果 ARM64 找不到专用包，尝试通用包
                if (!file && currentArch === 'arm64') {
                    file = files.find((f) => {
                        const url = f.url.toLowerCase();
                        return url.includes('mac') && url.endsWith('.zip') && !url.includes('arm64');
                    });
                }
                if (!file) {
                    console.warn('[更新处理器] 未找到适用于当前架构的 macOS 安装包');
                }
                // 处理下载 URL - electron-updater 可能只返回文件名
                let downloadUrl = file?.url || '';
                if (downloadUrl && !downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
                    // URL 只是文件名，构建完整的 GitHub Release 下载 URL
                    const filename = file?.path || downloadUrl;
                    const version = result.versionInfo.version;
                    downloadUrl = `https://github.com/luweiCN/VideoStitcher/releases/download/v${version}/${filename}`;
                    console.log('[更新处理器] URL 只是文件名，构建完整下载 URL:', downloadUrl);
                }
                const updateInfo = {
                    version: result.versionInfo.version,
                    releaseDate: result.versionInfo.releaseDate,
                    releaseNotes: result.updateInfo?.releaseNotes || '',
                    downloadUrl: downloadUrl,
                    fileSize: file?.size || 0,
                };
                // 设置到 MacUpdater
                if (macUpdater) {
                    macUpdater.setUpdateInfo(updateInfo);
                }
                // 发送更新可用事件
                mainWindow.webContents.send('update-available', {
                    version: updateInfo.version,
                    releaseDate: updateInfo.releaseDate,
                    releaseNotes: updateInfo.releaseNotes,
                });
                console.log('[更新处理器] 发送 update-available 事件');
                return { success: true, hasUpdate: true, updateInfo };
            }
            else {
                // 没有新版本
                mainWindow.webContents.send('update-not-available', {
                    version: require('electron').app.getVersion(),
                });
                return { success: true, hasUpdate: false };
            }
        }
        catch (error) {
            console.error('[更新处理器] 检查更新失败:', error);
            return { success: false, error: error.message };
        }
    });
    // 下载更新
    electron_1.ipcMain.handle('mac-download-update', async () => {
        console.log('%c[更新处理器] 📥 收到 mac-download-update 请求', 'background: #3b82f6; color: white; padding: 2px 5px; border-radius: 3px;');
        if (!macUpdater) {
            console.error('%c[更新处理器] ❌ macUpdater 未初始化', 'background: #ef4444; color: white;');
            return { success: false, error: '更新管理器未初始化' };
        }
        console.log('%c[更新处理器] ✅ macUpdater 存在，开始下载', 'background: #10b981; color: white;');
        try {
            const result = await macUpdater.downloadUpdate();
            console.log('%c[更新处理器] 📊 下载结果', 'background: #8b5cf6; color: white;', result);
            return result;
        }
        catch (error) {
            console.error('%c[更新处理器] ❌ 下载更新失败', 'background: #ef4444; color: white; font-weight: bold;', error);
            return { success: false, error: error.message };
        }
    });
    // 安装更新
    electron_1.ipcMain.handle('mac-install-update', async () => {
        console.log('%c[更新处理器] 🔧 收到 mac-install-update 请求', 'background: #f59e0b; color: white; padding: 2px 5px; border-radius: 3px;');
        if (!macUpdater) {
            console.error('%c[更新处理器] ❌ macUpdater 未初始化', 'background: #ef4444; color: white;');
            return { success: false, error: '更新管理器未初始化' };
        }
        console.log('%c[更新处理器] ✅ macUpdater 存在，开始安装', 'background: #10b981; color: white;');
        try {
            const result = await macUpdater.installUpdate();
            console.log('%c[更新处理器] 📊 安装结果', 'background: #8b5cf6; color: white;', result);
            return result;
        }
        catch (error) {
            console.error('%c[更新处理器] ❌ 安装更新失败', 'background: #ef4444; color: white; font-weight: bold;', {
                message: error.message,
                stack: error.stack?.split('\n')?.slice(0, 5)?.join('\n')
            });
            return { success: false, error: error.message };
        }
    });
    console.log('[更新处理器] macOS 更新处理器已注册');
    return macUpdater;
}
