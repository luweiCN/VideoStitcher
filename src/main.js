const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

const { buildPairs } = require("./ffmpeg/pair");
const { TaskQueue } = require("./ffmpeg/queue");
const { runFfmpeg } = require("./ffmpeg/runFfmpeg");

/**
 * 将 Markdown 格式的 Release Notes 转换为 HTML
 * 与 updater.ts 中的 markdownToHtml 方法保持一致
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';

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
  // 配置自动更新
  setupAutoUpdater();
  
  // macOS 应用内更新处理器
  if (process.platform === 'darwin') {
    const { setupUpdateHandlers } = require('./main/ipc-handlers');
    setupUpdateHandlers(win);
    console.log('[主进程] macOS 更新处理器已启用');
  }
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
  autoUpdater.autoInstallOnAppQuit = true; // 应用退出时自动安装已下载的更新

  // 自动更新事件监听
  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info);
    win.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: markdownToHtml(info.releaseNotes || ''),
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
        releaseNotes: markdownToHtml(info.releaseNotes || ''),
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

      // 发送任务开始处理事件
      win.webContents.send("job-task-start", { index });

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
    // 转换 releaseNotes 为 HTML 格式
    const updateInfo = result?.updateInfo ? {
      ...result.updateInfo,
      releaseNotes: markdownToHtml(result.updateInfo.releaseNotes || '')
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
  defaultOutputDir: '', // 空表示使用系统默认下载文件夹
  defaultConcurrency: Math.max(1, Math.floor((require('os').cpus().length || 4) / 2))
};

// 获取全局配置
ipcMain.handle("get-global-settings", async () => {
  try {
    const configPath = getConfigPath();

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const settings = JSON.parse(data);
      console.log('[全局配置] 读取配置:', settings);
      return { ...DEFAULT_SETTINGS, ...settings };
    } else {
      // 配置文件不存在，返回默认值
      console.log('[全局配置] 配置文件不存在，使用默认值:', DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    }
  } catch (err) {
    console.error('[全局配置] 读取失败:', err);
    return { ...DEFAULT_SETTINGS };
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
