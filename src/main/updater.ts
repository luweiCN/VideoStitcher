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

import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { spawn, execSync } from 'child_process';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  fileSize: number;
}

export class MacUpdater {
  private mainWindow: BrowserWindow | null = null;
  private updateInfo: UpdateInfo | null = null;
  private downloadedZipPath: string | null = null;

  // 辅助函数：输出日志到浏览器控制台
  private logToRenderer(style: string, ...args: any[]): void {
    // 输出到主进程控制台
    console.log(...args);

    // 输出到渲染进程的浏览器控制台
    if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isDestroyed()) {
      // 将参数转换为可安全传递的格式
      const serializedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
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

      this.mainWindow.webContents.executeJavaScript(code).catch(() => {});
    }
  }

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * 设置更新信息（从 electron-updater 的 update-available 事件传入）
   * @param updateInfo 更新信息
   */
  setUpdateInfo(updateInfo: Partial<UpdateInfo>): void {
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
    } else {
      // 没有现有信息，直接设置
      this.updateInfo = updateInfo as UpdateInfo;
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
  async checkForUpdates(): Promise<{ success: boolean; hasUpdate: boolean; updateInfo?: UpdateInfo; error?: string }> {
    // macOS 上不使用此方法，使用 electron-updater 的 autoUpdater.checkForUpdates()
    console.warn('[macOS 更新] checkForUpdates 不应被调用，请使用 electron-updater');
    return { success: false, hasUpdate: false, error: '请使用 electron-updater 检查更新' };
  }

  /**
   * 下载更新（带进度）
   */
  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
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
      const tempDir = app.getPath('temp');
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
      } else {
        this.logToRenderer('%c[MacUpdater] ❌ 窗口已销毁，无法发送事件', 'background: #ef4444; color: white;');
      }

      return { success: true };
    } catch (error: any) {
      this.logToRenderer('%c[MacUpdater] ❌ 下载失败', 'background: #ef4444; color: white; font-weight: bold;', {
        message: error.message,
        stack: error.stack?.split('\n')?.slice(0, 3)?.join('\n')
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 安装更新
   * 解压和安装逻辑都在更新脚本中执行，避免应用内残留文件问题
   */
  async installUpdate(): Promise<{ success: boolean; error?: string }> {
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
      // 获取当前应用路径
      const currentAppPath = this.getCurrentAppPath();
      this.logToRenderer('%c[MacUpdater] 📍 当前应用路径', 'background: #3b82f6; color: white;', { currentAppPath });

      // 获取主应用 PID
      const mainPid = process.pid;
      this.logToRenderer('%c[MacUpdater] 🔢 主应用 PID', 'background: #3b82f6; color: white;', { mainPid });

      // 创建更新脚本（解压和安装逻辑都在脚本中）
      this.logToRenderer('%c[MacUpdater] 📝 创建更新脚本', 'background: #8b5cf6; color: white;');
      const scriptPath = await this.createUpdateScript(this.downloadedZipPath, currentAppPath, mainPid);
      this.logToRenderer('%c[MacUpdater] ✅ 更新脚本已创建', 'background: #10b981; color: white;', { scriptPath });

      // 启动独立更新进程
      this.logToRenderer('%c[MacUpdater] 🚀 启动更新脚本', 'background: #f59e0b; color: white;');
      this.launchUpdateScript(scriptPath);

      this.logToRenderer('%c[MacUpdater] ⏳ 500ms 后退出应用', 'background: #f59e0b; color: white;');
      // 延迟退出，确保脚本已启动
      setTimeout(() => {
        this.logToRenderer('%c[MacUpdater] 👋 应用即将退出，脚本将在后台继续安装', 'background: #ef4444; color: white;');
        app.quit();
      }, 500);

      return { success: true };
    } catch (error: any) {
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
  private getCurrentAppPath(): string {
    let appPath = app.getAppPath();

    // 如果在 .app/Contents/Resources 内，需要向上查找
    while (appPath && !appPath.endsWith('.app')) {
      const parent = path.dirname(appPath);
      if (parent === appPath) break;
      appPath = parent;
    }

    return appPath;
  }

  /**
   * 创建更新脚本
   * 解压和安装逻辑都在脚本中执行，避免应用内残留文件问题
   * @param zipPath 下载的 ZIP 文件路径
   * @param currentAppPath 当前应用路径
   * @param mainPid 主应用进程 ID
   */
  private async createUpdateScript(zipPath: string, currentAppPath: string, mainPid: number): Promise<string> {
    const tempDir = app.getPath('temp');
    const scriptPath = path.join(tempDir, 'update-install.sh');
    const logPath = path.join(tempDir, 'updater.log');
    const extractDir = path.join(tempDir, 'VideoStitcher-Extract');
    const backupPath = path.join(tempDir, 'VideoStitcher-Backup.app');

    // 获取父目录（通常是 /Applications）
    const installDir = path.dirname(currentAppPath);
    const appName = path.basename(currentAppPath);
    const targetPath = path.join(installDir, appName);

    const script = `#!/bin/bash
# VideoStitcher 自动更新脚本
# 生成时间: ${new Date().toISOString()}

LOG="${logPath}"
ZIP_FILE="${zipPath}"
EXTRACT_DIR="${extractDir}"
BACKUP_PATH="${backupPath}"
OLD_APP="${currentAppPath}"
NEW_APP_TARGET="${targetPath}"

echo "========================================" > "$LOG"
echo "VideoStitcher 自动更新" >> "$LOG"
echo "时间: $(date)" >> "$LOG"
echo "主应用 PID: ${mainPid}" >> "$LOG"
echo "ZIP 文件: $ZIP_FILE" >> "$LOG"
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

# 清理旧的解压目录
echo "清理旧的解压目录..." >> "$LOG"
if [ -d "$EXTRACT_DIR" ]; then
  rm -rf "$EXTRACT_DIR" >> "$LOG" 2>&1
fi

# 创建解压目录
echo "创建解压目录..." >> "$LOG"
mkdir -p "$EXTRACT_DIR" >> "$LOG" 2>&1

# 使用 macOS 原生 ditto 解压 ZIP，保留代码签名、扩展属性和资源分支
echo "解压 ZIP 文件..." >> "$LOG"
ditto -xk "$ZIP_FILE" "$EXTRACT_DIR" >> "$LOG" 2>&1
if [ $? -ne 0 ]; then
  echo "解压失败" >> "$LOG"
  exit 1
fi
echo "解压成功" >> "$LOG"

# 清除 macOS 隔离属性，避免 Gatekeeper 阻止启动
echo "清除隔离属性..." >> "$LOG"
xattr -cr "$EXTRACT_DIR" >> "$LOG" 2>&1

# 查找 .app 文件（递归查找，最多2层深度）
echo "查找 .app 文件..." >> "$LOG"
find_app_in_dir() {
  local dir="$1"
  local depth="$2"
  local max_depth=2

  if [ $depth -gt $max_depth ]; then
    return 1
  fi

  # 首先在当前目录查找 .app
  for item in "$dir"/*; do
    if [ -d "$item" ]; then
      local basename=$(basename "$item")
      if [[ "$basename" == *.app ]]; then
        # 验证是目录且包含 Contents
        if [ -d "$item/Contents" ]; then
          echo "找到 .app: $item" >> "$LOG"
          echo "$item"
          return 0
        fi
      fi
    fi
  done

  # 递归查找子目录
  for item in "$dir"/*; do
    if [ -d "$item" ]; then
      local basename=$(basename "$item")
      # 跳过 .app 目录，不进入内部
      if [[ "$basename" != *.app ]]; then
        local found=$(find_app_in_dir "$item" $((depth + 1)))
        if [ -n "$found" ]; then
          echo "$found"
          return 0
        fi
      fi
    fi
  done

  return 1
}

NEW_APP=$(find_app_in_dir "$EXTRACT_DIR" 0)
if [ -z "$NEW_APP" ]; then
  echo "错误：未在解压目录中找到 .app 文件" >> "$LOG"
  echo "解压目录内容：" >> "$LOG"
  ls -la "$EXTRACT_DIR" >> "$LOG" 2>&1
  exit 1
fi

echo "新应用路径: $NEW_APP" >> "$LOG"

# 验证新应用
if [ ! -d "$NEW_APP" ]; then
  echo "错误：新应用路径不存在或不是目录" >> "$LOG"
  exit 1
fi

if [ ! -d "$NEW_APP/Contents" ]; then
  echo "错误：新应用缺少 Contents 目录" >> "$LOG"
  exit 1
fi

echo "新应用验证通过" >> "$LOG"

# 备份旧版本
echo "备份旧版本..." >> "$LOG"
if [ -d "$OLD_APP" ]; then
  if [ -d "$BACKUP_PATH" ]; then
    rm -rf "$BACKUP_PATH" >> "$LOG" 2>&1
  fi
  mv "$OLD_APP" "$BACKUP_PATH" >> "$LOG" 2>&1
  if [ $? -eq 0 ]; then
    echo "备份成功: $BACKUP_PATH" >> "$LOG"
  else
    echo "备份失败" >> "$LOG"
    exit 1
  fi
else
  echo "旧版本不存在: $OLD_APP" >> "$LOG"
fi

# 安装新版本（使用 ditto 保留代码签名和扩展属性）
echo "安装新版本..." >> "$LOG"
ditto "$NEW_APP" "$NEW_APP_TARGET" >> "$LOG" 2>&1
if [ $? -eq 0 ]; then
  echo "安装成功: $NEW_APP_TARGET" >> "$LOG"
else
  echo "安装失败，恢复备份..." >> "$LOG"
  if [ -d "$BACKUP_PATH" ]; then
    mv "$BACKUP_PATH" "$OLD_APP" >> "$LOG" 2>&1
  fi
  exit 1
fi

# 清理备份
echo "清理备份..." >> "$LOG"
if [ -d "$BACKUP_PATH" ]; then
  rm -rf "$BACKUP_PATH" >> "$LOG" 2>&1
fi

# 清理解压目录
echo "清理临时文件..." >> "$LOG"
if [ -d "$EXTRACT_DIR" ]; then
  rm -rf "$EXTRACT_DIR" >> "$LOG" 2>&1
fi

# 清理下载的 ZIP
if [ -f "$ZIP_FILE" ]; then
  rm -f "$ZIP_FILE" >> "$LOG" 2>&1
fi

# 再次清除隔离属性
echo "清除隔离属性..." >> "$LOG"
xattr -cr "$NEW_APP_TARGET" >> "$LOG" 2>&1

# 启动新版本
echo "启动新版本..." >> "$LOG"
open "$NEW_APP_TARGET" >> "$LOG" 2>&1

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
  private launchUpdateScript(scriptPath: string): void {
    this.logToRenderer('%c[MacUpdater] 🔧 启动更新脚本', 'background: #8b5cf6; color: white;', { scriptPath });

    const child = spawn('/bin/bash', [scriptPath], {
      detached: true,      // 脱离父进程
      stdio: 'ignore',     // 不继承 stdio
      env: {
        ...process.env,
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
      },
    });

    child.unref();  // 允许父进程退出

    this.logToRenderer('%c[MacUpdater] ✅ 更新脚本已启动', 'background: #10b981; color: white;', {
      PID: child.pid,
      detached: true
    });
  }

  /**
   * HTTPS GET 请求（返回 JSON）
   */
  private fetchJson(url: string): Promise<any> {
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
        res.on('data', (chunk: Buffer) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 下载文件（带进度回调）
   */
  private downloadFile(
    url: string,
    destPath: string,
    onProgress: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let httpRequest: any = null;

      const cleanup = () => {
        if (httpRequest) {
          httpRequest.destroy();
        }
        try {
          file.close();
        } catch {
          // 忽略关闭错误
        }
      };

      const startDownload = (downloadUrl: string) => {
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

          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            file.write(chunk);

            // 检查窗口是否已销毁，如果已销毁则停止发送进度
            if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isDestroyed()) {
              if (totalBytes > 0) {
                const percent = Math.round((downloadedBytes / totalBytes) * 100);
                try {
                  onProgress(percent);
                } catch (error) {
                  // 忽略进度回调错误
                }
              }
            }
          });

          res.on('end', () => {
            file.end();
            resolve();
          });

          res.on('error', (error: Error) => {
            cleanup();
            if (fs.existsSync(destPath)) {
              try {
                fs.unlinkSync(destPath);
              } catch {
                // 忽略删除错误
              }
            }
            reject(error);
          });
        }).on('error', (error: Error) => {
          cleanup();
          if (fs.existsSync(destPath)) {
            try {
              fs.unlinkSync(destPath);
            } catch {
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
