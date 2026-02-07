"use strict";
/**
 * macOS 应用内自动更新管理器
 *
 * 功能：
 * 1. 从 GitHub Releases API 检查更新
 * 2. 下载 ZIP 包并显示进度
 * 3. 解压并自动安装
 * 4. 创建独立更新脚本，实现主应用退出后继续安装
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MacUpdater = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const child_process_1 = require("child_process");
const extract_zip_1 = __importDefault(require("extract-zip"));
class MacUpdater {
    constructor(mainWindow) {
        this.mainWindow = null;
        this.updateInfo = null;
        this.downloadedZipPath = null;
        this.mainWindow = mainWindow;
    }
    /**
     * 比较版本号
     * @param current 当前版本 (例如: "0.4.6")
     * @param latest 最新版本 (例如: "0.5.0")
     * @returns true 表示有新版本
     */
    compareVersions(current, latest) {
        const cleanCurrent = current.replace(/^v/, '');
        const cleanLatest = latest.replace(/^v/, '');
        const currentParts = cleanCurrent.split('.').map(Number);
        const latestParts = cleanLatest.split('.').map(Number);
        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
            const c = currentParts[i] || 0;
            const l = latestParts[i] || 0;
            if (l > c)
                return true;
            if (l < c)
                return false;
        }
        return false;
    }
    /**
     * 将 Markdown 格式的 Release Notes 转换为 HTML
     * @param markdown Markdown 文本
     * @returns HTML 文本
     */
    markdownToHtml(markdown) {
        if (!markdown)
            return '';
        let html = markdown;
        // H2 标题
        html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mb-3 text-white">$1</h2>');
        // H3 标题
        html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-indigo-300">$1</h3>');
        // H4 标题
        html = html.replace(/^#### (.+)$/gm, '<h4 class="text-base font-medium mt-3 mb-1 text-slate-200">$1</h4>');
        // 粗体
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
        // 处理列表：先标记列表项，然后包装
        html = html.replace(/^- (.+)$/gm, '___LIST_ITEM___<li class="ml-4 text-slate-300">$1</li>');
        // 将连续的列表项包装在 ul 中
        html = html.replace(/(___LIST_ITEM___<li.*?<\/li>\n?)+/g, (match) => {
            const items = match.replace(/___LIST_ITEM___/g, '');
            return `<ul class="list-disc ml-4 space-y-1 my-2">${items}</ul>`;
        });
        // 单换行（在双换行之前处理）
        html = html.replace(/([^\n])\n([^\n])/g, '$1<br />$2');
        // 段落（双换行）
        html = html.replace(/\n\n+/g, '<div class="my-2"></div>');
        return html;
    }
    /**
     * 检查 GitHub Releases 最新版本
     */
    async checkForUpdates() {
        try {
            const currentVersion = electron_1.app.getVersion();
            console.log('[macOS 更新] 当前版本:', currentVersion);
            // 从 GitHub API 获取最新 release
            const response = await this.fetchJson('https://api.github.com/repos/luweiCN/VideoStitcher/releases/latest');
            if (!response.tag_name) {
                throw new Error('无法获取最新版本信息');
            }
            const latestVersion = response.tag_name.replace(/^v/, '');
            console.log('[macOS 更新] 最新版本:', latestVersion);
            const hasUpdate = this.compareVersions(currentVersion, latestVersion);
            if (!hasUpdate) {
                return { success: true, hasUpdate: false };
            }
            // 查找 macOS ZIP 包 - 根据当前系统架构选择
            const currentArch = process.arch; // 'x64' 或 'arm64'
            console.log('[macOS 更新] 当前系统架构:', currentArch);
            // 先尝试查找架构特定的包
            let asset = response.assets?.find((a) => {
                const name = a.name.toLowerCase();
                const isMacZip = name.includes('mac') && name.endsWith('.zip');
                if (currentArch === 'arm64') {
                    // 查找包含 'arm64' 的包（例如：VideoStitcher-0.4.7-arm64-mac.zip）
                    return isMacZip && name.includes('arm64');
                }
                else if (currentArch === 'x64') {
                    // 查找明确标记为 x64 的包，或者不包含 arm64 的通用包
                    // 例如：VideoStitcher-0.4.7-x64-mac.zip 或 VideoStitcher-0.4.7-mac.zip
                    return isMacZip && (name.includes('-x64-') || name.includes('-x64.') || !name.includes('arm64'));
                }
                return false;
            });
            // 如果 ARM64 找不到专用包，尝试通用包（在 Rosetta 2 下运行）
            if (!asset && currentArch === 'arm64') {
                console.log('[macOS 更新] 未找到 ARM64 专用包，尝试查找通用包（将通过 Rosetta 2 运行）');
                asset = response.assets?.find((a) => {
                    const name = a.name.toLowerCase();
                    return name.includes('mac') && name.endsWith('.zip') && !name.includes('arm64');
                });
            }
            if (!asset) {
                throw new Error(`未找到适用于 ${currentArch} 架构的 macOS 安装包`);
            }
            console.log('[macOS 更新] 选择的安装包:', asset.name);
            this.updateInfo = {
                version: latestVersion,
                releaseDate: response.published_at,
                releaseNotes: this.markdownToHtml(response.body || ''),
                downloadUrl: asset.browser_download_url,
                fileSize: asset.size,
            };
            console.log('[macOS 更新] 发现新版本:', this.updateInfo);
            return {
                success: true,
                hasUpdate: true,
                updateInfo: this.updateInfo,
            };
        }
        catch (error) {
            console.error('[macOS 更新] 检查更新失败:', error);
            return {
                success: false,
                hasUpdate: false,
                error: error.message,
            };
        }
    }
    /**
     * 下载更新（带进度）
     */
    async downloadUpdate() {
        if (!this.updateInfo) {
            return { success: false, error: '未找到更新信息' };
        }
        try {
            const tempDir = electron_1.app.getPath('temp');
            const zipPath = path.join(tempDir, `VideoStitcher-Update-${this.updateInfo.version}.zip`);
            console.log('[macOS 更新] 开始下载到:', zipPath);
            await this.downloadFile(this.updateInfo.downloadUrl, zipPath, (progress) => {
                // 发送下载进度到渲染进程
                this.mainWindow?.webContents.send('update-download-progress', { percent: progress });
            });
            this.downloadedZipPath = zipPath;
            console.log('[macOS 更新] 下载完成:', zipPath);
            // 发送下载完成事件
            this.mainWindow?.webContents.send('update-downloaded', {
                version: this.updateInfo.version,
                releaseDate: this.updateInfo.releaseDate,
                releaseNotes: this.updateInfo.releaseNotes,
            });
            return { success: true };
        }
        catch (error) {
            console.error('[macOS 更新] 下载失败:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * 安装更新
     */
    async installUpdate() {
        if (!this.downloadedZipPath || !fs.existsSync(this.downloadedZipPath)) {
            return { success: false, error: '未找到下载的更新包' };
        }
        try {
            const tempDir = electron_1.app.getPath('temp');
            const extractDir = path.join(tempDir, 'VideoStitcher-Extract');
            // 清理旧的解压目录
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
            }
            fs.mkdirSync(extractDir, { recursive: true });
            console.log('[macOS 更新] 解压到:', extractDir);
            // 解压 ZIP
            await (0, extract_zip_1.default)(this.downloadedZipPath, { dir: extractDir });
            // 查找 .app
            const appPath = this.findAppInDirectory(extractDir);
            if (!appPath) {
                throw new Error('未在解压目录中找到 .app 文件');
            }
            console.log('[macOS 更新] 找到应用:', appPath);
            // 获取当前应用路径
            const currentAppPath = this.getCurrentAppPath();
            console.log('[macOS 更新] 当前应用路径:', currentAppPath);
            // 创建更新脚本
            const scriptPath = await this.createUpdateScript(currentAppPath, appPath);
            console.log('[macOS 更新] 更新脚本已创建:', scriptPath);
            // 启动独立更新进程
            this.launchUpdateScript(scriptPath);
            // 延迟退出，确保脚本已启动
            setTimeout(() => {
                electron_1.app.quit();
            }, 500);
            return { success: true };
        }
        catch (error) {
            console.error('[macOS 更新] 安装失败:', error);
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
            return null;
        }
        const items = fs.readdirSync(dir);
        // 首先在当前目录查找 .app
        for (const item of items) {
            if (item.endsWith('.app')) {
                const fullPath = path.join(dir, item);
                // 确保这是一个目录（.app 是目录）
                if (fs.statSync(fullPath).isDirectory()) {
                    console.log(`[macOS 更新] 在深度 ${depth} 找到 .app:`, fullPath);
                    return fullPath;
                }
            }
        }
        // 如果当前目录没有 .app，递归查找子目录（但不进入 .app 内部）
        for (const item of items) {
            const fullPath = path.join(dir, item);
            // 跳过以 .app 结尾的目录（不进入 .app 内部）
            if (item.endsWith('.app')) {
                continue;
            }
            if (fs.statSync(fullPath).isDirectory()) {
                const found = this.findAppInDirectory(fullPath, depth + 1);
                if (found)
                    return found;
            }
        }
        return null;
    }
    /**
     * 创建更新脚本
     */
    async createUpdateScript(oldAppPath, newAppPath) {
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
echo "========================================" >> "$LOG"

# 等待主应用完全退出
echo "等待主应用退出..." >> "$LOG"
PID=${process.pid}
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

# 安装新版本
echo "安装新版本..." >> "$LOG"
cp -R "${newAppPath}" "${targetPath}" >> "$LOG" 2>&1
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
        console.log('[macOS 更新] 启动更新脚本:', scriptPath);
        const child = (0, child_process_1.spawn)('/bin/bash', [scriptPath], {
            detached: true, // 脱离父进程
            stdio: 'ignore', // 不继承 stdio
            env: {
                ...process.env,
                PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
            },
        });
        child.unref(); // 允许父进程退出
        console.log('[macOS 更新] 更新脚本已启动 (PID:', child.pid, ')');
    }
    /**
     * 通用 HTTPS GET 请求（返回 JSON）
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
            const request = (downloadUrl) => {
                https.get(downloadUrl, {
                    headers: {
                        'User-Agent': 'VideoStitcher-Updater',
                    },
                }, (res) => {
                    // 处理重定向
                    if (res.statusCode === 302 || res.statusCode === 301) {
                        if (res.headers.location) {
                            request(res.headers.location);
                            return;
                        }
                    }
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}`));
                        return;
                    }
                    const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
                    let downloadedBytes = 0;
                    res.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        file.write(chunk);
                        if (totalBytes > 0) {
                            const percent = Math.round((downloadedBytes / totalBytes) * 100);
                            onProgress(percent);
                        }
                    });
                    res.on('end', () => {
                        file.end();
                        resolve();
                    });
                    res.on('error', (error) => {
                        file.close();
                        fs.unlinkSync(destPath);
                        reject(error);
                    });
                }).on('error', (error) => {
                    file.close();
                    if (fs.existsSync(destPath)) {
                        fs.unlinkSync(destPath);
                    }
                    reject(error);
                });
            };
            request(url);
        });
    }
}
exports.MacUpdater = MacUpdater;
