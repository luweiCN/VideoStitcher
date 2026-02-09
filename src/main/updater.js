"use strict";
/**
 * macOS 应用内自动更新管理器
 *
 * 功能：
 * 1. 接收 electron-updater 的更新信息
 * 2. 下载 ZIP 包并显示进度
 * 3. 解压并自动安装
 * 4. 创建独立更新脚本，实现主应用退出后继续安装
 *
 * 注意：检查更新使用 electron-updater，MacUpdater 只负责下载和安装
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacUpdater = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const child_process_1 = require("child_process");
class MacUpdater {
    // 辅助函数：输出日志到浏览器控制台
    logToRenderer(style, ...args) {
        // 输出到主进程控制台
        console.log(...args);
        // 输出到渲染进程的浏览器控制台
        if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isDestroyed()) {
            // 将参数转换为可安全传递的格式
            const serializedArgs = args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    }
                    catch {
                        return '{}';
                    }
                }
                return String(arg);
            });
            // 使用 console.log 的 apply 方式，保持对象结构
            const code = `
        (function() {
          const args = ${JSON.stringify(serializedArgs)}.map(arg => {
            try {
              return JSON.parse(arg);
            } catch {
              return arg;
            }
          });
          console.log('${style}', ...args);
        })();
      `;
            this.mainWindow.webContents.executeJavaScript(code).catch(() => { });
        }
    }
    constructor(mainWindow) {
        this.mainWindow = null;
        this.updateInfo = null;
        this.downloadedZipPath = null;
        this.mainWindow = mainWindow;
    }
    /**
     * 设置更新信息（从 electron-updater 的 update-available 事件传入）
     * @param updateInfo 更新信息
     */
    setUpdateInfo(updateInfo) {
        // 合并更新信息：保留已有的 downloadUrl 和 fileSize，只更新其他字段
        if (this.updateInfo && (this.updateInfo.downloadUrl || this.updateInfo.fileSize)) {
            // 如果已有下载信息，只更新其他字段
            this.updateInfo = {
                ...this.updateInfo,
                version: updateInfo.version || this.updateInfo.version,
                releaseDate: updateInfo.releaseDate || this.updateInfo.releaseDate,
                releaseNotes: updateInfo.releaseNotes !== undefined ? updateInfo.releaseNotes : this.updateInfo.releaseNotes,
                // 保留已有的下载信息
                downloadUrl: updateInfo.downloadUrl || this.updateInfo.downloadUrl,
                fileSize: updateInfo.fileSize || this.updateInfo.fileSize,
            };
            console.log('[macOS 更新] 更新信息已合并:', {
                version: this.updateInfo.version,
                downloadUrl: this.updateInfo.downloadUrl,
                fileSize: this.updateInfo.fileSize,
            });
        }
        else {
            // 没有现有信息，直接设置
            this.updateInfo = updateInfo;
            console.log('[macOS 更新] 更新信息已设置:', {
                version: updateInfo.version,
                downloadUrl: updateInfo.downloadUrl,
                fileSize: updateInfo.fileSize,
            });
        }
    }
    /**
     * 检查更新（不实现，使用 electron-updater 的检查）
     */
    async checkForUpdates() {
        // macOS 上不使用此方法，使用 electron-updater 的 autoUpdater.checkForUpdates()
        console.warn('[macOS 更新] checkForUpdates 不应被调用，请使用 electron-updater');
        return { success: false, hasUpdate: false, error: '请使用 electron-updater 检查更新' };
    }
    /**
     * 下载更新（带进度）
     */
    async downloadUpdate() {
        this.logToRenderer('%c[MacUpdater] 🔄 downloadUpdate() 被调用', 'background: #3b82f6; color: white; padding: 2px 5px; border-radius: 3px;');
        if (!this.updateInfo) {
            this.logToRenderer('%c[MacUpdater] ❌ 未找到更新信息', 'background: #ef4444; color: white;');
            return { success: false, error: '未找到更新信息，请先检查更新' };
        }
        if (!this.updateInfo.downloadUrl) {
            this.logToRenderer('%c[MacUpdater] ❌ 更新信息中缺少下载 URL', 'background: #ef4444; color: white;', {
                updateInfo: this.updateInfo
            });
            return { success: false, error: '更新信息中缺少下载 URL' };
        }
        try {
            const tempDir = electron_1.app.getPath('temp');
            const zipPath = path.join(tempDir, `VideoStitcher-Update-${this.updateInfo.version}.zip`);
            this.logToRenderer('%c[MacUpdater] 📥 开始下载', 'background: #3b82f6; color: white;', {
                目标路径: zipPath,
                下载URL: this.updateInfo.downloadUrl,
                文件大小: `${(this.updateInfo.fileSize / 1024 / 1024).toFixed(1)} MB`,
                版本: this.updateInfo.version
            });
            await this.downloadFile(this.updateInfo.downloadUrl, zipPath, (progress) => {
                // 发送下载进度到渲染进程
                this.mainWindow?.webContents.send('update-download-progress', { percent: progress });
            });
            this.downloadedZipPath = zipPath;
            this.logToRenderer('%c[MacUpdater] ✅ 下载完成！准备发送 update-downloaded 事件', 'background: #10b981; color: white;', {
                zipPath: zipPath,
                version: this.updateInfo.version
            });
            // 发送下载完成事件
            if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isDestroyed()) {
                this.mainWindow.webContents.send('update-downloaded', {
                    version: this.updateInfo.version,
                    releaseDate: this.updateInfo.releaseDate,
                    releaseNotes: this.updateInfo.releaseNotes,
                });
                this.logToRenderer('%c[MacUpdater] 📤 已发送 update-downloaded 事件到渲染进程', 'background: #8b5cf6; color: white;');
            }
            else {
                this.logToRenderer('%c[MacUpdater] ❌ 窗口已销毁，无法发送事件', 'background: #ef4444; color: white;');
            }
            return { success: true };
        }
        catch (error) {
            this.logToRenderer('%c[MacUpdater] ❌ 下载失败', 'background: #ef4444; color: white; font-weight: bold;', {
                message: error.message,
                stack: error.stack?.split('\n')?.slice(0, 3)?.join('\n')
            });
            return { success: false, error: error.message };
        }
    }
    /**
     * 安装更新
     */
    async installUpdate() {
        this.logToRenderer('%c[MacUpdater] 🔧 installUpdate() 被调用', 'background: #f59e0b; color: white; padding: 2px 5px; border-radius: 3px;');
        if (!this.downloadedZipPath || !fs.existsSync(this.downloadedZipPath)) {
            this.logToRenderer('%c[MacUpdater] ❌ 未找到下载的更新包', 'background: #ef4444; color: white;', {
                downloadedZipPath: this.downloadedZipPath,
                exists: this.downloadedZipPath ? fs.existsSync(this.downloadedZipPath) : 'N/A'
            });
            return { success: false, error: '未找到下载的更新包' };
        }
        this.logToRenderer('%c[MacUpdater] ✅ 找到下载的更新包', 'background: #10b981; color: white;', {
            path: this.downloadedZipPath,
            size: `${(fs.statSync(this.downloadedZipPath).size / 1024 / 1024).toFixed(1)} MB`
        });
        try {
            const tempDir = electron_1.app.getPath('temp');
            const extractDir = path.join(tempDir, 'VideoStitcher-Extract');
            this.logToRenderer('%c[MacUpdater] 📦 开始解压', 'background: #3b82f6; color: white;', {
                源文件: this.downloadedZipPath,
                目标目录: extractDir
            });
            // 清理旧的解压目录（更健壮的处理方式）
            if (fs.existsSync(extractDir)) {
                try {
                    // 检查是文件还是目录
                    const stats = fs.statSync(extractDir);
                    if (stats.isFile()) {
                        // 如果是文件，直接删除
                        this.logToRenderer('%c[MacUpdater] 🗑️ 删除残留文件', 'background: #f59e0b; color: white;', { path: extractDir });
                        fs.unlinkSync(extractDir);
                    }
                    else if (stats.isDirectory()) {
                        // 如果是目录，递归删除
                        this.logToRenderer('%c[MacUpdater] 🗑️ 删除旧目录', 'background: #f59e0b; color: white;', { path: extractDir });
                        fs.rmSync(extractDir, { recursive: true, force: true });
                    }
                }
                catch (cleanupError) {
                    // 清理失败，尝试使用系统命令
                    this.logToRenderer('%c[MacUpdater] ⚠️ 文件系统清理失败，尝试使用系统命令', 'background: #f59e0b; color: white;', {
                        error: cleanupError.message
                    });
                    try {
                        (0, child_process_1.execSync)(`rm -rf "${extractDir}"`, { stdio: 'pipe' });
                    }
                    catch (rmError) {
                        // 如果系统命令也失败，记录警告但继续
                        this.logToRenderer('%c[MacUpdater] ⚠️ 系统命令清理也失败，继续尝试', 'background: #f59e0b; color: white;');
                    }
                }
            }
            fs.mkdirSync(extractDir, { recursive: true });
            // 使用 macOS 原生 ditto 解压 ZIP，保留代码签名、扩展属性和资源分支
            try {
                (0, child_process_1.execSync)(`ditto -xk "${this.downloadedZipPath}" "${extractDir}"`, { stdio: 'pipe' });
                this.logToRenderer('%c[MacUpdater] ✅ 解压成功', 'background: #10b981; color: white;');
            }
            catch (dittoError) {
                throw new Error(`ditto 解压失败: ${dittoError.message}`);
            }
            // 清除 macOS 隔离属性，避免 Gatekeeper 阻止启动
            try {
                (0, child_process_1.execSync)(`xattr -cr "${extractDir}"`, { stdio: 'pipe' });
            }
            catch {
                // 清除隔离属性失败不影响安装流程
                this.logToRenderer('%c[MacUpdater] ⚠️ 清除隔离属性失败，继续安装', 'background: #f59e0b; color: white;');
            }
            // 查找 .app
            this.logToRenderer('%c[MacUpdater] 🔍 查找 .app 文件', 'background: #8b5cf6; color: white;');
            const appPath = this.findAppInDirectory(extractDir);
            if (!appPath) {
                this.logToRenderer('%c[MacUpdater] ❌ 未在解压目录中找到 .app 文件', 'background: #ef4444; color: white;', {
                    extractDir: extractDir
                });
                throw new Error('未在解压目录中找到 .app 文件');
            }
            this.logToRenderer('%c[MacUpdater] ✅ 找到应用', 'background: #10b981; color: white;', { appPath });
            // 验证找到的路径
            if (!appPath.endsWith('.app')) {
                throw new Error(`找到的路径不是有效的 .app 包: ${appPath}`);
            }
            // 验证路径存在且是目录
            if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) {
                throw new Error(`找到的 .app 路径无效或不是目录: ${appPath}`);
            }
            // 验证 .app 包含必要的结构
            const contentsPath = path.join(appPath, 'Contents');
            if (!fs.existsSync(contentsPath)) {
                throw new Error(`找到的 .app 包缺少 Contents 目录: ${appPath}`);
            }
            this.logToRenderer('%c[MacUpdater] ✅ 路径验证通过', 'background: #10b981; color: white;');
            // 获取当前应用路径
            const currentAppPath = this.getCurrentAppPath();
            this.logToRenderer('%c[MacUpdater] 📍 当前应用路径', 'background: #3b82f6; color: white;', { currentAppPath });
            // 获取主应用 PID
            const mainPid = process.pid;
            this.logToRenderer('%c[MacUpdater] 🔢 主应用 PID', 'background: #3b82f6; color: white;', { mainPid });
            // 创建更新脚本
            this.logToRenderer('%c[MacUpdater] 📝 创建更新脚本', 'background: #8b5cf6; color: white;');
            const scriptPath = await this.createUpdateScript(currentAppPath, appPath, mainPid);
            this.logToRenderer('%c[MacUpdater] ✅ 更新脚本已创建', 'background: #10b981; color: white;', { scriptPath });
            // 启动独立更新进程
            this.logToRenderer('%c[MacUpdater] 🚀 启动更新脚本', 'background: #f59e0b; color: white;');
            this.launchUpdateScript(scriptPath);
            this.logToRenderer('%c[MacUpdater] ⏳ 500ms 后退出应用', 'background: #f59e0b; color: white;');
            // 延迟退出，确保脚本已启动
            setTimeout(() => {
                this.logToRenderer('%c[MacUpdater] 👋 应用即将退出', 'background: #ef4444; color: white;');
                electron_1.app.quit();
            }, 500);
            return { success: true };
        }
        catch (error) {
            this.logToRenderer('%c[MacUpdater] ❌ 安装失败', 'background: #ef4444; color: white; font-weight: bold;', {
                message: error.message,
                stack: error.stack?.split('\n')?.slice(0, 5)?.join('\n')
            });
            return { success: false, error: error.message };
        }
    }
    /**
     * 获取当前应用的 .app 路径
     */
    getCurrentAppPath() {
        let appPath = electron_1.app.getAppPath();
        // 如果在 .app/Contents/Resources 内，需要向上查找
        while (appPath && !appPath.endsWith('.app')) {
            const parent = path.dirname(appPath);
            if (parent === appPath)
                break;
            appPath = parent;
        }
        return appPath;
    }
    /**
     * 在目录中查找 .app 文件
     * 限制查找深度，避免进入 .app 包内部
     */
    findAppInDirectory(dir, depth = 0) {
        // 限制最大深度为 2 层（处理 ZIP 包可能有一层包装目录的情况）
        if (depth > 2) {
            console.log(`[macOS 更新] 深度 ${depth} 超过限制，停止查找`);
            return null;
        }
        console.log(`[macOS 更新] 在深度 ${depth} 查找目录:`, dir);
        const items = fs.readdirSync(dir);
        console.log(`[macOS 更新] 目录内容 (${items.length} 项):`, items.join(', '));
        // 首先在当前目录查找 .app
        for (const item of items) {
            if (item.endsWith('.app')) {
                const fullPath = path.join(dir, item);
                console.log(`[macOS 更新] 检查可能的 .app:`, fullPath);
                // 确保这是一个目录（.app 是目录）
                try {
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        console.log(`[macOS 更新] ✓ 在深度 ${depth} 找到有效的 .app:`, fullPath);
                        return fullPath;
                    }
                    else {
                        console.log(`[macOS 更新] ✗ ${fullPath} 不是目录，跳过`);
                    }
                }
                catch (err) {
                    console.log(`[macOS 更新] ✗ 无法检查 ${fullPath}:`, err);
                }
            }
        }
        // 如果当前目录没有 .app，递归查找子目录（但不进入 .app 内部）
        for (const item of items) {
            const fullPath = path.join(dir, item);
            // 跳过以 .app 结尾的目录（不进入 .app 内部）
            if (item.endsWith('.app')) {
                console.log(`[macOS 更新] 跳过 .app 目录，不进入:`, item);
                continue;
            }
            try {
                if (fs.statSync(fullPath).isDirectory()) {
                    const found = this.findAppInDirectory(fullPath, depth + 1);
                    if (found)
                        return found;
                }
            }
            catch (err) {
                console.log(`[macOS 更新] 无法访问目录 ${fullPath}:`, err);
            }
        }
        console.log(`[macOS 更新] 在深度 ${depth} 未找到 .app`);
        return null;
    }
    /**
     * 创建更新脚本
     * @param oldAppPath 旧应用路径
     * @param newAppPath 新应用路径
     * @param mainPid 主应用进程 ID
     */
    async createUpdateScript(oldAppPath, newAppPath, mainPid) {
        const tempDir = electron_1.app.getPath('temp');
        const scriptPath = path.join(tempDir, 'update-install.sh');
        const logPath = path.join(tempDir, 'updater.log');
        // 备份路径
        const backupPath = path.join(tempDir, 'VideoStitcher-Backup.app');
        // 获取父目录（通常是 /Applications）
        const installDir = path.dirname(oldAppPath);
        const appName = path.basename(oldAppPath);
        const targetPath = path.join(installDir, appName);
        const script = `#!/bin/bash
# VideoStitcher 自动更新脚本
# 生成时间: ${new Date().toISOString()}

LOG="${logPath}"

echo "========================================" > "$LOG"
echo "VideoStitcher 自动更新" >> "$LOG"
echo "时间: $(date)" >> "$LOG"
echo "主应用 PID: ${mainPid}" >> "$LOG"
echo "========================================" >> "$LOG"

# 等待主应用完全退出
echo "等待主应用退出..." >> "$LOG"
PID=${mainPid}
WAIT_COUNT=0
while ps -p $PID > /dev/null 2>&1; do
  sleep 0.5
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ $WAIT_COUNT -gt 60 ]; then
    echo "超时：主应用未退出" >> "$LOG"
    exit 1
  fi
done
echo "主应用已退出" >> "$LOG"

# 额外等待确保文件释放
sleep 1

# 备份旧版本
echo "备份旧版本..." >> "$LOG"
if [ -d "${oldAppPath}" ]; then
  if [ -d "${backupPath}" ]; then
    rm -rf "${backupPath}" >> "$LOG" 2>&1
  fi
  mv "${oldAppPath}" "${backupPath}" >> "$LOG" 2>&1
  if [ $? -eq 0 ]; then
    echo "备份成功: ${backupPath}" >> "$LOG"
  else
    echo "备份失败" >> "$LOG"
    exit 1
  fi
else
  echo "旧版本不存在: ${oldAppPath}" >> "$LOG"
fi

# 安装新版本（使用 ditto 保留代码签名和扩展属性）
echo "安装新版本..." >> "$LOG"
ditto "${newAppPath}" "${targetPath}" >> "$LOG" 2>&1
if [ $? -eq 0 ]; then
  echo "安装成功: ${targetPath}" >> "$LOG"
else
  echo "安装失败，恢复备份..." >> "$LOG"
  if [ -d "${backupPath}" ]; then
    mv "${backupPath}" "${oldAppPath}" >> "$LOG" 2>&1
  fi
  exit 1
fi

# 清理备份
echo "清理备份..." >> "$LOG"
if [ -d "${backupPath}" ]; then
  rm -rf "${backupPath}" >> "$LOG" 2>&1
fi

# 清理解压目录
echo "清理临时文件..." >> "$LOG"
EXTRACT_DIR="$(dirname "${newAppPath}")"
if [ -d "$EXTRACT_DIR" ]; then
  rm -rf "$EXTRACT_DIR" >> "$LOG" 2>&1
fi

# 清理下载的 ZIP
ZIP_FILE="${this.downloadedZipPath}"
if [ -f "$ZIP_FILE" ]; then
  rm -f "$ZIP_FILE" >> "$LOG" 2>&1
fi

# 清除隔离属性
echo "清除隔离属性..." >> "$LOG"
xattr -cr "${targetPath}" >> "$LOG" 2>&1

# 启动新版本
echo "启动新版本..." >> "$LOG"
open "${targetPath}" >> "$LOG" 2>&1

echo "更新完成！" >> "$LOG"
echo "========================================" >> "$LOG"

# 清理自己（延迟删除）
(sleep 2 && rm -f "$0") &

exit 0
`;
        fs.writeFileSync(scriptPath, script, { mode: 0o755 });
        console.log('[macOS 更新] 更新脚本已保存:', scriptPath);
        return scriptPath;
    }
    /**
     * 启动独立更新脚本
     */
    launchUpdateScript(scriptPath) {
        this.logToRenderer('%c[MacUpdater] 🔧 启动更新脚本', 'background: #8b5cf6; color: white;', { scriptPath });
        const child = (0, child_process_1.spawn)('/bin/bash', [scriptPath], {
            detached: true, // 脱离父进程
            stdio: 'ignore', // 不继承 stdio
            env: {
                ...process.env,
                PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
            },
        });
        child.unref(); // 允许父进程退出
        this.logToRenderer('%c[MacUpdater] ✅ 更新脚本已启动', 'background: #10b981; color: white;', {
            PID: child.pid,
            detached: true
        });
    }
    /**
     * HTTPS GET 请求（返回 JSON）
     */
    fetchJson(url) {
        return new Promise((resolve, reject) => {
            https.get(url, {
                headers: {
                    'User-Agent': 'VideoStitcher-Updater',
                },
            }, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    // 处理重定向
                    if (res.headers.location) {
                        return this.fetchJson(res.headers.location).then(resolve, reject);
                    }
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            }).on('error', reject);
        });
    }
    /**
     * 下载文件（带进度回调）
     */
    downloadFile(url, destPath, onProgress) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            let httpRequest = null;
            const cleanup = () => {
                if (httpRequest) {
                    httpRequest.destroy();
                }
                try {
                    file.close();
                }
                catch {
                    // 忽略关闭错误
                }
            };
            const startDownload = (downloadUrl) => {
                httpRequest = https.get(downloadUrl, {
                    headers: {
                        'User-Agent': 'VideoStitcher-Updater',
                    },
                }, (res) => {
                    // 处理重定向
                    if (res.statusCode === 302 || res.statusCode === 301) {
                        if (res.headers.location) {
                            startDownload(res.headers.location);
                            return;
                        }
                    }
                    if (res.statusCode !== 200) {
                        cleanup();
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }
                    const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
                    let downloadedBytes = 0;
                    res.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        file.write(chunk);
                        // 检查窗口是否已销毁，如果已销毁则停止发送进度
                        if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isDestroyed()) {
                            if (totalBytes > 0) {
                                const percent = Math.round((downloadedBytes / totalBytes) * 100);
                                try {
                                    onProgress(percent);
                                }
                                catch (error) {
                                    // 忽略进度回调错误
                                }
                            }
                        }
                    });
                    res.on('end', () => {
                        file.end();
                        resolve();
                    });
                    res.on('error', (error) => {
                        cleanup();
                        if (fs.existsSync(destPath)) {
                            try {
                                fs.unlinkSync(destPath);
                            }
                            catch {
                                // 忽略删除错误
                            }
                        }
                        reject(error);
                    });
                }).on('error', (error) => {
                    cleanup();
                    if (fs.existsSync(destPath)) {
                        try {
                            fs.unlinkSync(destPath);
                        }
                        catch {
                            // 忽略删除错误
                        }
                    }
                    reject(error);
                });
            };
            startDownload(url);
        });
    }
}
exports.MacUpdater = MacUpdater;
