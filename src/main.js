const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

const { buildPairs } = require("./ffmpeg/pair");
const { TaskQueue } = require("./ffmpeg/queue");
const { runFfmpeg } = require("./ffmpeg/runFfmpeg");

/**
 * 处理 releaseNotes（autoUpdater 已经返回正确格式，直接使用）
 */
function processReleaseNotes(releaseNotes) {
  return releaseNotes || '';
}

// 导入新的 IPC 处理器
const { registerVideoHandlers } = require("./ipcHandlers/video");
const { registerImageHandlers } = require("./ipcHandlers/image");
const { registerAuthHandlers } = require("./ipcHandlers/auth");
const { registerFileHandlers } = require("./ipcHandlers/file");

let win;
let A = [];
let B = [];
let outDir = "";

const queue = new TaskQueue(Math.max(1, os.cpus().length - 1));

// 检测开发环境
const isDevelopment =
  process.env.NODE_ENV === "development" ||
  process.env.DEBUG === "true" ||
  !app.isPackaged;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, // 保持 webSecurity 启用
    },
  });

  // 开发模式下加载 Vite 服务器，生产模式加载构建文件
  if (isDevelopment) {
    console.log(
      "🔥 Development mode: loading Vite dev server at http://localhost:5173 [RESTARTED at " +
        new Date().toLocaleTimeString() +
        "]",
    );
    win
      .loadURL("http://localhost:5173")
      .then(() => {
        console.log("Vite dev server loaded successfully");
        win.webContents.openDevTools();
      })
      .catch((err) => {
        console.error("Failed to load Vite dev server:", err);
        // 显示错误页面
        win.loadURL(
          "data:text/html;charset=utf-8," +
            encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>开发服务器未启动</title>
          <style>
            body { font-family: system-ui; padding: 40px; background: #1e1e1e; color: #fff; }
            h1 { color: #e74c3c; }
            code { background: #333; padding: 4px 8px; border-radius: 4px; }
            .step { margin: 20px 0; padding: 15px; background: #2a2a2a; border-left: 4px solid #e74c3c; }
          </style>
        </head>
        <body>
          <h1>⚠️ Vite 开发服务器未启动</h1>
          <p>请先启动 Vite 开发服务器：</p>
          <div class="step">
            <code>npm run dev</code>
          </div>
          <p>然后在另一个终端启动 Electron：</p>
          <div class="step">
            <code>npx electron .</code>
          </div>
          <p>或者使用环境变量直接启动：</p>
          <div class="step">
            <code>NODE_ENV=development npx electron .</code>
          </div>
        </body>
        </html>
      `),
        );
      });

    // 监听加载失败
    win.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        console.error(
          "Failed to load:",
          errorCode,
          errorDescription,
          validatedURL,
        );
      },
    );
  } else {
    console.log("Production mode: loading built files");
    // dist/renderer 打包在 app.asar 内，从 __dirname 加载
    // __dirname 在打包后是 app.asar/src
    const htmlPath = path.join(__dirname, "../dist/renderer/index.html");
    console.log("Loading HTML from:", htmlPath);
    console.log("__dirname:", __dirname);
    win.loadFile(htmlPath).catch((err) => {
      console.error("Failed to load production build:", err);
    });
  }
}

// 注册自定义协议用于访问本地文件（预览功能）
function registerPreviewProtocol() {
  protocol.registerFileProtocol('preview', (request, callback) => {
    // 解码 URL 获取文件路径
    const filePath = decodeURIComponent(request.url.substr('preview://'.length));
    // 检查文件是否存在
    if (fs.existsSync(filePath)) {
      callback({ path: filePath });
    } else {
      console.error('预览文件不存在:', filePath);
      callback({ error: -2 }); // 找不到文件
    }
  });
}

app.whenReady().then(() => {
  // 注册预览协议
  registerPreviewProtocol();

  createWindow();
  // 注册视频处理 IPC 处理器
  registerVideoHandlers();
  // 注册图片处理 IPC 处理器
  registerImageHandlers();
  // 注册授权处理 IPC
  registerAuthHandlers();
  // 注册文件操作 IPC 处理器
  registerFileHandlers();

  // macOS 应用内更新处理器（需要在 setupAutoUpdater 之前）
  if (process.platform === 'darwin') {
    const { setupUpdateHandlers } = require('./main/ipc-handlers');
    win.macUpdater = setupUpdateHandlers(win);
    console.log('[主进程] macOS 更新处理器已启用');
  }

  // 配置自动更新（需要 MacUpdater 实例）
  setupAutoUpdater();
});

// 自动更新配置和事件处理
function setupAutoUpdater() {

  // 从环境变量或 package.json 读取仓库信息
  const repoInfo = process.env.GITHUB_REPO || 'luweiCN/VideoStitcher';
  const [owner, repo] = repoInfo.split('/');

  // macOS 必须显式设置 feedURL 才能从 GitHub 检查更新
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: owner,
    repo: repo,
  });

  // 输出到日志文件（electron-log）
  const log = require("electron-log");
  log.info('自动更新配置:', { owner, repo });
  log.info('当前应用版本:', app.getVersion());
  log.info('是否为打包应用:', app.isPackaged);

  // 也输出到渲染进程控制台（方便调试）
  setTimeout(() => {
    if (win && win.webContents) {
      const configStr = JSON.stringify({ owner, repo });
      const versionStr = JSON.stringify(app.getVersion());
      const isPackagedStr = JSON.stringify(app.isPackaged);
      win.webContents.executeJavaScript(`
        console.log('%c[自动更新]', 'background: #10b981; color: white; padding: 2px 5px; border-radius: 3px;', '配置已加载');
        console.log('仓库:', ${configStr});
        console.log('当前版本:', ${versionStr});
        console.log('是否打包:', ${isPackagedStr});
      `);
    }
  }, 2000);

  // 日志输出
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";
  autoUpdater.autoDownload = false; // 不自动下载，由用户确认
  autoUpdater.autoInstallOnAppQuit = false; // 不在退出时自动安装，需用户手动点击重启按钮

  // 开发环境下强制检查更新（用于测试）
  autoUpdater.forceDevUpdateConfig = true;

  // 自动更新事件监听
  autoUpdater.on("update-available", async (info) => {
    console.log("Update available:", info);
    console.log("releaseNotes 类型:", typeof info.releaseNotes);
    console.log("releaseNotes 前100字符:", info.releaseNotes ? info.releaseNotes.substring(0, 100) : 'empty');

    // macOS 平台的更新由 ipc-handlers.ts 统一处理，不在这里发送事件
    // 避免重复触发和状态不一致
    if (process.platform === 'darwin') {
      console.log('[自动更新] macOS 平台，更新由 IPC 处理器统一管理');
      return;
    }

    // Windows/Linux 平台继续使用 electron-updater 的原生更新流程
    win.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: processReleaseNotes(info.releaseNotes || ''),
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("Update not available:", info);
    win.webContents.send("update-not-available", { version: app.getVersion() });
  });

  autoUpdater.on("error", (err) => {
    console.error("Update error:", err);
    win.webContents.send("update-error", { message: err.message });
  });

  autoUpdater.on("download-progress", (progress) => {
    win.webContents.send("update-download-progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("%c[更新下载完成]", "background: #10b981; color: white; padding: 2px 5px; border-radius: 3px;", "事件已触发");
    console.log("info:", info);
    console.log("version:", info.version);
    console.log("releaseDate:", info.releaseDate);
    console.log("releaseNotes:", info.releaseNotes);

    if (win && !win.isDestroyed()) {
      win.webContents.send("update-downloaded", {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: processReleaseNotes(info.releaseNotes || ''),
      });
      console.log("✅ 已发送 update-downloaded 到渲染进程");
    } else {
      console.error("❌ 窗口不存在或已销毁，无法发送事件");
    }
  });

  // 定义 macOS 检查更新的函数
  async function checkForMacOSUpdates() {
    if (!win.macUpdater) {
      console.warn('[自动检查] MacUpdater 未初始化');
      return;
    }

    try {
      // 发送检查中事件到渲染进程
      win.webContents.send('update-checking');

      // 辅助函数：输出日志到浏览器控制台
      const logToConsole = (style, ...args) => {
        console.log(...args);
        if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          const msg = args.map(arg => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          }).join(' ');
          win.webContents.executeJavaScript(`console.log('${style}', '${msg.replace(/\\/g, '/').replace(/'/g, "\\'")}')`);
        }
      };

      logToConsole('%c[Mac 更新] 开始检查更新...', 'background: #8b5cf6; color: white; padding: 2px 5px; border-radius: 3px;');
      logToConsole('%c[Mac 更新] 当前架构:', 'background: #6366f1; color: white;', process.arch);
      logToConsole('%c[Mac 更新] 当前版本:', 'background: #6366f1; color: white;', app.getVersion());

      const result = await autoUpdater.checkForUpdates();
      logToConsole('%c[Mac 更新] 检查完成，返回结果类型:', 'background: #10b981; color: white;', typeof result);

      if (!result) {
        logToConsole('%c[Mac 更新] ❌ 检查结果为空', 'background: #ef4444; color: white;');
        return;
      }

      if (!result.versionInfo) {
        logToConsole('%c[Mac 更新] ❌ versionInfo 为空', 'background: #ef4444; color: white;');
        logToConsole('%c[Mac 更新] result 对象键:', 'background: #ef4444; color: white;', Object.keys(result));
        return;
      }

      const currentVersion = app.getVersion();
      const latestVersion = result.versionInfo.version;
      logToConsole('%c[Mac 更新] 当前版本 vs 最新版本:', 'background: #3b82f6; color: white;', `${currentVersion} -> ${latestVersion}`);

      if (latestVersion !== currentVersion) {
        logToConsole('%c[Mac 更新] ✅ 发现新版本!', 'background: #10b981; color: white;');
        // 直接从 electron-updater 返回的 files 中查找下载 URL
        const files = result.versionInfo?.files || [];
        const currentArch = process.arch;

        logToConsole('%c[Mac 更新] files 数组长度:', 'background: #f59e0b; color: white;', files.length);

        if (files.length === 0) {
          logToConsole('%c[Mac 更新] ❌ files 数组为空！可能 Release 配置不正确', 'background: #ef4444; color: white; font-weight: bold;');
          win.webContents.send('update-error', {
            message: '未找到更新安装包。请确认 Release 中包含 macOS 安装包（.zip 文件）'
          });
          return;
        }

        // 输出每个文件的信息
        files.forEach((f, index) => {
          logToConsole(`%c[Mac 更新] File [${index}] 完整结构:`, 'background: #6366f1; color: white;', f);
          logToConsole(`%c[Mac 更新] File [${index}] 键列表:`, 'background: #6366f1; color: white;', Object.keys(f));
        });

        // 查找适合当前架构的 ZIP 包
        logToConsole('%c[Mac 更新] 开始查找匹配的安装包...', 'background: #8b5cf6; color: white;');
        logToConsole('%c[Mac 更新] 目标架构:', 'background: #8b5cf6; color: white;', currentArch);

        let file = null;
        let matchReason = '';

        // 第一轮：精确匹配
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const url = f.url.toLowerCase();
          const isMacZip = url.includes('mac') && url.endsWith('.zip');

          logToConsole(`%c[Mac 更新] 检查 File [${i}]:`, 'background: #64748b; color: white;', {
            url: f.url,
            isMacZip: isMacZip,
            hasArm64: url.includes('arm64'),
            hasX64: url.includes('-x64-') || url.includes('-x64.'),
            hasUniversal: url.includes('universal'),
            filename: f.url.split('/').pop()
          });

          if (currentArch === 'arm64') {
            if (isMacZip && url.includes('arm64')) {
              file = f;
              matchReason = 'ARM64 精确匹配';
              logToConsole(`%c[Mac 更新] ✅ 找到 ARM64 精确匹配:`, 'background: #10b981; color: white;', f.url);
              break;
            }
          } else if (currentArch === 'x64') {
            if (isMacZip && url.includes('-x64-')) {
              file = f;
              matchReason = 'x64 精确匹配';
              logToConsole(`%c[Mac 更新] ✅ 找到 x64 精确匹配:`, 'background: #10b981; color: white;', f.url);
              break;
            }
            if (isMacZip && url.includes('universal')) {
              file = f;
              matchReason = 'x64 universal 匹配';
              logToConsole(`%c[Mac 更新] ✅ 找到 universal 包:`, 'background: #10b981; color: white;', f.url);
              break;
            }
            if (isMacZip && !url.includes('arm64')) {
              file = f;
              matchReason = 'x64 回退匹配（非 ARM）';
              logToConsole(`%c[Mac 更新] ✅ 找到 x64 回退匹配:`, 'background: #10b981; color: white;', f.url);
              break;
            }
          }
        }

        // 第二轮：ARM64 回退到 universal 包
        if (!file && currentArch === 'arm64') {
          logToConsole('%c[Mac 更新] ARM64 未找到精确匹配，尝试 universal 包...', 'background: #f59e0b; color: white;');
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const url = f.url.toLowerCase();
            const isUniversalMac = url.includes('mac') && url.endsWith('.zip') && url.includes('universal');

            if (isUniversalMac) {
              file = f;
              matchReason = 'ARM64 回退到 universal 包';
              logToConsole(`%c[Mac 更新] ✅ ARM64 使用 universal 包:`, 'background: #10b981; color: white;', f.url);
              break;
            }
          }
        }

        // 第三轮：任何 macOS ZIP 包
        if (!file) {
          logToConsole('%c[Mac 更新] 最后尝试：查找任何 macOS ZIP 包...', 'background: #f59e0b; color: white;');
          for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const url = f.url.toLowerCase();
            const isAnyMacZip = url.includes('mac') && url.endsWith('.zip');

            if (isAnyMacZip) {
              file = f;
              matchReason = '最后回退：任何 macOS ZIP';
              logToConsole(`%c[Mac 更新] ✅ 找到任何 macOS 包:`, 'background: #10b981; color: white;', f.url);
              break;
            }
          }
        }

        if (!file) {
          logToConsole('%c[Mac 更新] ❌ 未找到匹配的安装包!', 'background: #ef4444; color: white; font-weight: bold;');
          logToConsole('%c[Mac 更新] 搜索条件:', 'background: #ef4444; color: white;', {
            currentArch: currentArch,
            targetPatterns: ['mac + arm64', 'mac + x64', 'mac + universal', 'mac + any .zip'],
            filesCount: files.length
          });

          // 输出所有文件名供调试
          const allFilenames = files.map(f => f.url.split('/').pop()).join(', ');
          logToConsole('%c[Mac 更新] 所有文件名:', 'background: #ef4444; color: white;', allFilenames);

          win.webContents.send('update-error', {
            message: `未找到适合 ${currentArch} 架构的 macOS 安装包。可用文件: ${allFilenames}`
          });
          return;
        }

        logToConsole('%c[Mac 更新] 最终选中文件:', 'background: #10b981; color: white;', {
          url: file.url,
          path: file.path,
          size: file.size,
          matchReason: matchReason
        });

        // 处理下载 URL
        let downloadUrl = file.url;

        // 如果 url 只是一个文件名（没有 http/https），需要构建完整的 GitHub 下载 URL
        if (downloadUrl && !downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
          const filename = file.path || downloadUrl;
          const version = result.versionInfo.version;
          // GitHub Release 文件下载 URL 格式
          downloadUrl = `https://github.com/luweiCN/VideoStitcher/releases/download/v${version}/${filename}`;
          logToConsole('%c[Mac 更新] ⚠️ URL 只是文件名，构建完整下载 URL:', 'background: #f59e0b; color: white;', downloadUrl);
        }

        // 验证 URL
        if (!downloadUrl || typeof downloadUrl !== 'string' || downloadUrl.trim() === '') {
          logToConsole('%c[Mac 更新] ❌ 下载 URL 无效!', 'background: #ef4444; color: white; font-weight: bold;', {
            originalUrl: file.url,
            originalPath: file.path,
            processedUrl: downloadUrl,
            type: typeof downloadUrl,
            isEmpty: !downloadUrl || downloadUrl.trim() === ''
          });
          win.webContents.send('update-error', {
            message: '下载 URL 无效，请检查 Release 配置'
          });
          return;
        }

        const updateInfo = {
          version: result.versionInfo.version,
          releaseDate: result.versionInfo.releaseDate,
          releaseNotes: result.updateInfo?.releaseNotes || '',
          downloadUrl: downloadUrl,
          fileSize: file.size || 0,
        };

        logToConsole('%c[Mac 更新] 更新信息已准备:', 'background: #10b981; color: white;', updateInfo);

        // 设置到 MacUpdater
        win.macUpdater.setUpdateInfo(updateInfo);

        // 发送更新可用事件
        logToConsole('%c[Mac 更新] 准备发送 update-available 事件', 'background: #3b82f6; color: white;');

        // 确保窗口和 webContents 存在
        if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send('update-available', {
            version: updateInfo.version,
            releaseDate: updateInfo.releaseDate,
            releaseNotes: updateInfo.releaseNotes,
          });
          logToConsole('%c[Mac 更新] ✅ 已发送 update-available 事件到渲染进程', 'background: #10b981; color: white;');
        } else {
          logToConsole('%c[Mac 更新] ❌ 窗口已销毁，无法发送事件', 'background: #ef4444; color: white;');
        }
      } else {
        // 没有新版本
        logToConsole('%c[Mac 更新] ℹ️ 已是最新版本', 'background: #6b7280; color: white;', latestVersion);
        win.webContents.send('update-not-available', { version: currentVersion });
      }
    } catch (error) {
      logToConsole('%c[Mac 更新] ❌ 检查更新异常:', 'background: #ef4444; color: white; font-weight: bold;', error);
      logToConsole('%c[Mac 更新] 错误详情:', 'background: #ef4444; color: white;', {
        message: error.message,
        stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'no stack'
      });
      win.webContents.send('update-error', { message: `检查更新失败: ${error.message}` });
    }
  }

  // 应用启动后延迟检查更新（避免影响启动速度）
  // 开发模式下不检查更新
  if (!isDevelopment) {
    setTimeout(() => {
      console.log('[自动检查] 开始检查更新...');
      // 发送检查中事件到渲染进程
      win.webContents.send('update-checking');

      if (process.platform === 'darwin') {
        checkForMacOSUpdates();
      } else {
        autoUpdater.checkForUpdates()
          .then((result) => {
            console.log('[自动检查] 检查完成:', result);
          })
          .catch((err) => {
            console.error('[自动检查] 检查失败:', err);
          });
      }
    }, 5000); // 5 秒后检查

    // 每 10 分钟自动检查更新
    setInterval(
      () => {
        if (process.platform === 'darwin') {
          checkForMacOSUpdates();
        } else {
          autoUpdater.checkForUpdates().catch((err) => {
            console.error("Failed to check for updates:", err);
          });
        }
      },
      10 * 60 * 1000,
    );
  } else {
    console.log('[自动检查] 开发模式下跳过自动更新检查');
  }
}

ipcMain.handle("pick-files", async (_e, { title, filters, multiSelection = true }) => {
  const properties = ["openFile"];
  if (multiSelection) {
    properties.push("multiSelections");
  }

  const res = await dialog.showOpenDialog(win, {
    title,
    properties,
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (res.canceled) return [];
  return res.filePaths;
});

ipcMain.handle("pick-outdir", async (_e, { defaultPath } = {}) => {
  const res = await dialog.showOpenDialog(win, {
    title: "选择输出目录",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: defaultPath || undefined,
  });
  if (res.canceled) return "";
  return res.filePaths[0];
});

ipcMain.handle("set-libs", async (_e, { aFiles, bFiles, outputDir }) => {
  A = aFiles || [];
  B = bFiles || [];
  outDir = outputDir || "";
  return { aCount: A.length, bCount: B.length, outDir };
});

ipcMain.handle("set-concurrency", async (_e, { concurrency }) => {
  queue.setConcurrency(Number(concurrency) || 1);
  return { concurrency: queue.concurrency };
});

ipcMain.handle("start-merge", async (_e, { orientation }) => {
  if (!A.length || !B.length) throw new Error("A库或B库为空");
  if (!outDir) throw new Error("未选择输出目录");

  const pairs = buildPairs(A, B);
  const total = pairs.length;

  let done = 0;
  let failed = 0;

  win.webContents.send("video-start", {
    total,
    mode: orientation,
    concurrency: queue.concurrency,
  });

  const tasks = pairs.map(({ a, b, index }) => {
    return queue.push(async () => {
      const aName = path.parse(a).name;
      const bName = path.parse(b).name;
      const outName = `${aName}__${bName}__${String(index).padStart(4, "0")}.mp4`;
      const outPath = path.join(outDir, outName);

      // 发送任务开始处理事件
      win.webContents.send("video-task-start", { index });

      const payload = { aPath: a, bPath: b, outPath, orientation };

      const tryRun = async (attempt) => {
        win.webContents.send("video-log", {
          index,
          message: `\n[${index}] attempt=${attempt}\nA=${a}\nB=${b}\nOUT=${outPath}\n`,
        });
        return runFfmpeg(payload, (s) => {
          win.webContents.send("video-log", { index, message: s });
        });
      };

      try {
        await tryRun(1);
        done++;
        win.webContents.send("video-progress", {
          done,
          failed,
          total,
          index,
          outputPath: outPath,
        });
      } catch (err) {
        win.webContents.send("video-log", {
          index,
          message: `\n[${index}] 第一次失败，重试一次...\n${err.message}\n`,
        });
        try {
          await tryRun(2);
          done++;
          win.webContents.send("job-progress", {
            done,
            failed,
            total,
            index,
            outPath,
          });
        } catch (err2) {
          failed++;
          win.webContents.send("video-failed", {
            done,
            failed,
            total,
            index,
            error: err2.message,
          });
        }
      }
    });
  });

  await Promise.allSettled(tasks);
  win.webContents.send("video-finish", { done, failed, total });
  return { done, failed, total };
});

// 自动更新相关的 IPC 处理器
ipcMain.handle("check-for-updates", async () => {
  try {
    const log = require("electron-log");
    const currentVersion = app.getVersion();

    log.info('=== 开始检查更新 ===');
    log.info('当前应用版本:', currentVersion);

    // 输出到渲染进程控制台
    const currentVersionStr = JSON.stringify(currentVersion);
    win.webContents.executeJavaScript(`
      console.log('%c[检查更新]', 'background: #3b82f6; color: white; padding: 2px 5px; border-radius: 3px;', '开始检查...');
      console.log('当前版本:', ${currentVersionStr});
    `);

    const result = await autoUpdater.checkForUpdates();

    log.info('检查更新结果:', JSON.stringify(result, null, 2));

    // 输出详细结果到渲染进程
    if (result) {
      const hasUpdate = result.versionInfo && result.versionInfo.version !== currentVersion;
      const resultStr = JSON.stringify({
        hasUpdate,
        currentVersion,
        latestVersion: result.versionInfo?.version,
        updateInfo: result.updateInfo
      });
      win.webContents.executeJavaScript(`
        console.log('检查结果:', ${resultStr});
      `);
    }

    // 返回 hasUpdate 字段供前端判断
    const hasUpdate = result?.versionInfo?.version !== currentVersion;
    // 直接使用原始 releaseNotes（GitHub 返回的已经是 HTML）
    const updateInfo = result?.updateInfo ? {
      ...result.updateInfo,
      releaseNotes: processReleaseNotes(result.updateInfo.releaseNotes || '')
    } : undefined;
    return { success: true, hasUpdate, updateInfo };
  } catch (err) {
    const log = require("electron-log");
    log.error('检查更新失败:', err);

    // 输出错误到渲染进程
    const errorMsg = JSON.stringify(err.message);
    win.webContents.executeJavaScript(`
      console.error('%c[检查更新失败]', 'background: #ef4444; color: white; padding: 2px 5px; border-radius: 3px;', ${errorMsg});
    `);

    return { success: false, error: err.message };
  }
});

ipcMain.handle("download-update", async () => {
  const log = require("electron-log");
  log.info("[下载更新] 开始下载");

  try {
    await autoUpdater.downloadUpdate();
    log.info("[下载更新] 下载完成");
    return { success: true };
  } catch (err) {
    log.error("[下载更新] 失败:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("install-update", async () => {
  const log = require("electron-log");
  log.info("[安装更新] 开始安装并重启");

  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (err) {
    log.error("[安装更新] 失败:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-app-version", async () => {
  return {
    version: app.getVersion(),
    isDevelopment: isDevelopment,
  };
});

// 获取系统默认下载目录
ipcMain.handle("get-default-download-dir", async () => {
  try {
    return app.getPath('downloads');
  } catch (err) {
    console.error('[默认下载目录] 获取失败:', err);
    return '';
  }
});

// 获取系统内存信息
ipcMain.handle("get-system-memory", async () => {
  const totalMemory = os.totalmem(); // 总内存（字节）
  const freeMemory = os.freemem();   // 可用内存（字节）
  const usedMemory = totalMemory - freeMemory; // 已用内存

  return {
    total: totalMemory,    // 总内存
    free: freeMemory,      // 可用内存
    used: usedMemory,      // 已用内存
    totalGB: (totalMemory / (1024 * 1024 * 1024)).toFixed(1),
    freeGB: (freeMemory / (1024 * 1024 * 1024)).toFixed(1),
    usedGB: (usedMemory / (1024 * 1024 * 1024)).toFixed(1),
  };
});

// 使用系统默认浏览器打开外部链接
ipcMain.handle("open-external", async (_event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 获取预览文件的 URL
ipcMain.handle("get-preview-url", async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: "文件不存在" };
    }
    // 返回自定义协议的 URL
    const previewUrl = `preview://${encodeURIComponent(filePath)}`;
    return { success: true, url: previewUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 获取文件信息（用于判断文件类型）
ipcMain.handle("get-file-info", async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: "文件不存在" };
    }
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.m4v', '.webm', '.flv', '.wmv'];

    let type = 'unknown';
    if (imageExts.includes(ext)) type = 'image';
    else if (videoExts.includes(ext)) type = 'video';

    return {
      success: true,
      info: {
        name: path.basename(filePath),
        size: stats.size,
        type,
        ext
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 快速生成 A+B 拼接预览视频
ipcMain.handle("generate-stitch-preview", async (_event, { aPath, bPath, orientation }) => {
  try {
    const { buildStitchCommand } = require("./ffmpeg/runFfmpeg");
    const os = require("os");
    const crypto = require("crypto");

    // 生成临时文件路径
    const tempDir = os.tmpdir();
    const tempId = crypto.randomBytes(8).toString("hex");
    const tempPath = path.join(tempDir, `preview_${tempId}.mp4`);

    // 构建快速预览命令（低质量，快速编码）
    const config = {
      aPath,
      bPath,
      outPath: tempPath,
      orientation
    };

    const args = buildStitchCommand(config);

    // 修改编码参数为快速预览模式
    const quickArgs = args.map((arg, index) => {
      if (arg === '-preset') return '-preset';  // 保持 preset
      if (args[index - 1] === '-preset') return 'ultrafast';  // 使用最快预设
      if (arg === '-crf') return '-crf';
      if (args[index - 1] === '-crf') return '35';  // 更低质量，更快
      return arg;
    });

    console.log('[预览生成] 开始生成快速预览视频...');

    await runFfmpeg(quickArgs, (log) => {
      console.log('[预览生成]', log);
    });

    console.log('[预览生成] 完成，临时文件:', tempPath);

    return {
      success: true,
      tempPath
    };
  } catch (err) {
    console.error('[预览生成] 失败:', err);
    return { success: false, error: err.message };
  }
});

// 删除临时预览文件
ipcMain.handle("delete-temp-preview", async (_event, tempPath) => {
  try {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log('[预览清理] 已删除临时文件:', tempPath);
    }
    return { success: true };
  } catch (err) {
    console.error('[预览清理] 删除失败:', err);
    return { success: false, error: err.message };
  }
});

// ==================== 全局配置管理 ====================

// 获取配置文件路径
const getConfigPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'global-settings.json');
};

// 默认配置
const DEFAULT_SETTINGS = {
  defaultOutputDir: '', // 将在运行时动态设置为系统下载目录
  defaultConcurrency: Math.max(1, Math.floor((require('os').cpus().length || 4) / 2))
};

// 获取全局配置
ipcMain.handle("get-global-settings", async () => {
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

    // 如果 defaultOutputDir 为空，自动使用系统下载目录
    if (!settings.defaultOutputDir) {
      settings.defaultOutputDir = app.getPath('downloads');
      console.log('[全局配置] 使用系统下载目录:', settings.defaultOutputDir);
    }

    return { success: true, settings };
  } catch (err) {
    console.error('[全局配置] 读取失败:', err);
    return { success: false, error: err.message };
  }
});

// 保存全局配置
ipcMain.handle("set-global-settings", async (_event, settings) => {
  try {
    const configPath = getConfigPath();

    // 读取现有配置
    let currentSettings = {};
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      currentSettings = JSON.parse(data);
    }

    // 合并新配置
    const newSettings = { ...currentSettings, ...settings };

    // 保存到文件
    fs.writeFileSync(configPath, JSON.stringify(newSettings, null, 2), 'utf-8');
    console.log('[全局配置] 保存配置:', newSettings);

    return { success: true };
  } catch (err) {
    console.error('[全局配置] 保存失败:', err);
    return { success: false, error: err.message };
  }
});
