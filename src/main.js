const { app, BrowserWindow, ipcMain, dialog } = require("electron");
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

// 自动更新配置和事件处理
function setupAutoUpdater() {
  // 从环境变量读取仓库信息（可选覆盖）
  if (process.env.GITHUB_REPO) {
    const [owner, repo] = process.env.GITHUB_REPO.split('/');
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: owner,
      repo: repo,
    });
  }
  // 如果没有环境变量，electron-updater 会自动从 package.json 的 publish 字段读取

  // 日志输出
  autoUpdater.logger = require("electron-log");
  autoUpdater.logger.transports.file.level = "info";
  autoUpdater.autoDownload = false; // 不自动下载，由用户确认

  // 自动更新事件监听
  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info);
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
    console.log("Update downloaded:", info);
    win.webContents.send("update-downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

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
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("download-update", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("install-update", async () => {
  try {
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-app-version", async () => {
  return {
    version: app.getVersion(),
    isDevelopment: isDevelopment,
  };
});
