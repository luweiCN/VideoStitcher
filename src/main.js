const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const os = require("os");
const path = require("path");
const { autoUpdater } = require("electron-updater");

if (require('electron-squirrel-startup')) app.quit();

const { buildPairs } = require("./ffmpeg/pair");
const { TaskQueue } = require("./ffmpeg/queue");
const { runFfmpeg } = require("./ffmpeg/ffmpegCmd");

// 导入新的 IPC 处理器
const { registerVideoHandlers } = require("./ipcHandlers/video");
const { registerImageHandlers } = require("./ipcHandlers/image");

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
    const htmlPath = path.join(__dirname, "../dist/renderer/index.html");
    console.log("Loading HTML from:", htmlPath);
    win.loadFile(htmlPath).catch((err) => {
      console.error("Failed to load production build:", err);
    });
  }
}

app.whenReady().then(() => {
  createWindow();
  // 注册视频处理 IPC 处理器
  registerVideoHandlers();
  // 注册图片处理 IPC 处理器
  registerImageHandlers();
  // 配置自动更新
  setupAutoUpdater();
});

// 存储当前可用更新信息的变量（用于 Windows Squirrel 下载完成后使用）
let pendingUpdateInfo = null;

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

  // 自动更新事件监听
  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info);
    // 保存更新信息供后续使用（Windows Squirrel 需要用到）
    pendingUpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    };
    win.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
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
        releaseNotes: info.releaseNotes,
      });
      console.log("✅ 已发送 update-downloaded 到渲染进程");
    } else {
      console.error("❌ 窗口不存在或已销毁，无法发送事件");
    }
  });

  // 应用启动后延迟检查更新（避免影响启动速度）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("Failed to check for updates on startup:", err);
    });
  }, 5000); // 5 秒后检查

  // 每 10 分钟自动检查更新
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("Failed to check for updates:", err);
      });
    },
    10 * 60 * 1000,
  );
}

ipcMain.handle("pick-files", async (_e, { title, filters }) => {
  const res = await dialog.showOpenDialog(win, {
    title,
    properties: ["openFile", "multiSelections"],
    filters: filters || [{ name: "All Files", extensions: ["*"] }],
  });
  if (res.canceled) return [];
  return res.filePaths;
});

ipcMain.handle("pick-outdir", async () => {
  const res = await dialog.showOpenDialog(win, {
    title: "选择输出目录",
    properties: ["openDirectory", "createDirectory"],
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

  win.webContents.send("job-start", {
    total,
    orientation,
    concurrency: queue.concurrency,
  });

  const tasks = pairs.map(({ a, b, index }) => {
    return queue.push(async () => {
      const aName = path.parse(a).name;
      const bName = path.parse(b).name;
      const outName = `${aName}__${bName}__${String(index).padStart(4, "0")}.mp4`;
      const outPath = path.join(outDir, outName);

      const payload = { aPath: a, bPath: b, outPath, orientation };

      const tryRun = async (attempt) => {
        win.webContents.send("job-log", {
          msg: `\n[${index}] attempt=${attempt}\nA=${a}\nB=${b}\nOUT=${outPath}\n`,
        });
        return runFfmpeg(payload, (s) => {
          win.webContents.send("job-log", { msg: s });
        });
      };

      try {
        await tryRun(1);
        done++;
        win.webContents.send("job-progress", {
          done,
          failed,
          total,
          index,
          outPath,
        });
      } catch (err) {
        win.webContents.send("job-log", {
          msg: `\n[${index}] 第一次失败，重试一次...\n${err.message}\n`,
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
          win.webContents.send("job-failed", {
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
  win.webContents.send("job-finish", { done, failed, total });
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
    return { success: true, hasUpdate, updateInfo: result?.updateInfo };
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
  // 输出到渲染进程控制台
  win.webContents.executeJavaScript(`
    console.log('%c[开始下载更新]', 'background: #3b82f6; color: white; padding: 2px 5px; border-radius: 3px;');
    console.log('当前平台:', '${process.platform}');
    console.log('待处理的更新信息:', ${JSON.stringify(pendingUpdateInfo)});
  `);

  const log = require("electron-log");
  log.info("[下载更新] 开始下载");

  try {
    await autoUpdater.downloadUpdate();
    log.info("[下载更新] 下载完成");

    // 输出到渲染进程控制台
    win.webContents.executeJavaScript(`
      console.log('%c[下载完成]', 'background: #10b981; color: white; padding: 2px 5px; border-radius: 3px;', 'downloadUpdate() promise resolved');
    `);

    // Windows Squirrel: downloadUpdate 完成后通常意味着更新已准备好
    // 但 update-downloaded 事件可能不会立即触发，所以我们需要手动触发
    if (process.platform === "win32") {
      const updateInfo = pendingUpdateInfo || {
        version: app.getVersion(),
        releaseDate: new Date().toISOString(),
        releaseNotes: "Windows 更新已准备就绪，请重启应用以完成安装。",
      };

      log.info("[下载更新] 发送 update-downloaded 事件:", updateInfo);

      // 输出到渲染进程控制台
      const infoStr = JSON.stringify(updateInfo);
      win.webContents.executeJavaScript(`
        console.log('%c[Windows]', 'background: #f59e0b; color: white; padding: 2px 5px; border-radius: 3px;', '手动触发 update-downloaded 事件');
        console.log('发送的更新信息:', ${infoStr});
        console.log('准备发送 IPC 事件...');
      `);

      if (win && !win.isDestroyed()) {
        win.webContents.send("update-downloaded", updateInfo);

        // 输出到渲染进程控制台
        win.webContents.executeJavaScript(`
          console.log('%c[主进程]', 'background: #8b5cf6; color: white; padding: 2px 5px; border-radius: 3px;', '已发送 update-downloaded IPC 事件');
        `);

        log.info("✅ 已手动发送 update-downloaded 到渲染进程");
      } else {
        win.webContents.executeJavaScript(`
          console.error('%c[主进程]', 'background: #ef4444; color: white; padding: 2px 5px; border-radius: 3px;', '窗口不存在或已销毁');
        `);
        log.error("❌ 窗口不存在或已销毁");
      }
    }

    return { success: true };
  } catch (err) {
    log.error("[下载更新] 失败:", err);
    win.webContents.executeJavaScript(`
      console.error('%c[下载失败]', 'background: #ef4444; color: white; padding: 2px 5px; border-radius: 3px;', '${err.message}');
    `);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("install-update", async () => {
  const log = require("electron-log");

  // 输出到渲染进程控制台
  win.webContents.executeJavaScript(`
    console.log('%c[安装更新]', 'background: #10b981; color: white; padding: 2px 5px; border-radius: 3px;', '开始安装更新');
  `);

  log.info("[安装更新] 开始安装并重启");

  try {
    // 先关闭窗口
    win.close();

    // 然后执行更新安装
    // isSilent=false: 显示安装界面
    // isForceRunAfter=true: 安装完成后自动运行应用
    autoUpdater.quitAndInstall(false, true);

    return { success: true };
  } catch (err) {
    log.error("[安装更新] 失败:", err);
    win.webContents.executeJavaScript(`
      console.error('%c[安装失败]', 'background: #ef4444; color: white; padding: 2px 5px; border-radius: 3px;', '${err.message}');
    `);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-app-version", async () => {
  return {
    version: app.getVersion(),
    isDevelopment: isDevelopment,
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
