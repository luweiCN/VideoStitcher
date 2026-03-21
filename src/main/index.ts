import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';

// 初始化日志模块（必须在其他模块之前导入）
import '@main/utils/logger';

// 导入启动初始化模块
import { initStartup } from '@main/init';

// 导入数据库初始化
import { initDatabase, closeDatabase } from '@main/database';

// 导入 IPC 处理器
import { registerVideoHandlers } from '@main/ipc/video';
import { registerImageHandlers } from '@main/ipc/image';
import { registerAuthHandlers } from '@main/ipc/auth';
import { registerFileExplorerHandlers } from '@main/ipc/file-explorer';
import { registerTaskGeneratorHandlers } from '@main/ipc/taskGenerator';
import { registerApplicationHandlers, isDevelopment } from '@main/ipc/application';
import { registerSystemHandlers } from '@main/ipc/system';
import { registerTaskHandlers, setTaskQueueMainWindow, stopTaskQueueManager } from '@main/ipc/task';
import { registerDatabaseIpc } from '@main/ipc/database';
import { registerAsideHandlers } from '@main/ipc/aside-handlers';
import { registerDirectorModeHandlers } from '@main/ipc/director-mode-handlers';
import { registerAIWorkflowHandlers } from '@main/ipc/ai-workflow-handlers';
import { registerRegionHandlers } from '@main/ipc/region-handlers';
import { regionRepository } from '@main/database/repositories/regionRepository';
import { taskQueueManager, TaskCancelledError } from '@main/services/TaskQueueManager';

// 导入 AI 提供商初始化
import { initializeGlobalProvider } from '@main/ai/provider-manager';

// 导入自动更新模块
import { setupAutoUpdater, setMainWindow as setAutoUpdaterWindow, setDevelopmentMode } from '@main/autoUpdater';

// macOS 更新处理器
import { setupUpdateHandlers } from '@main/ipc-handlers';

// 全局错误处理：忽略任务取消错误
process.on('uncaughtException', (error) => {
  if (error.name === 'TaskCancelledError' || error.message === '任务已被取消') {
    console.log('[主进程] 任务已取消，忽略错误');
    return;
  }
  console.error('[主进程] 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error && (reason.name === 'TaskCancelledError' || reason.message === '任务已被取消')) {
    console.log('[主进程] 任务已取消，忽略 Promise 拒绝');
    return;
  }
  console.error('[主进程] 未处理的 Promise 拒绝:', reason);
});

let win: BrowserWindow | null = null;

function createWindow(): void {
  // 使用生成的圆角图标
  const iconPath = join(__dirname, '../../build/icon.png');

  // macOS 设置 Dock 图标
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath);
  }

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // 窗口准备好后显示
  win.once('ready-to-show', () => {
    console.log('[主进程] 窗口 ready-to-show，即将显示');
    win?.show();
    win?.focus();
    console.log('[主进程] 窗口已调用 show() 和 focus()');
  });

  // 监听窗口关闭
  win.on('closed', () => {
    console.log('[主进程] 窗口已关闭');
    
    // 停止任务队列管理器
    try {
      stopTaskQueueManager();
    } catch (err) {
      console.error('[主进程] 停止任务队列管理器失败:', err);
    }
    
    win = null;
  });

  // 阻止默认的拖放行为
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // 在页面加载完成后注入 JavaScript 阻止默认拖放行为
  win.webContents.on('dom-ready', () => {
    win?.webContents.executeJavaScript(`
      document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);

      document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);

      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href.startsWith('file://')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, false);

      console.log('[Main] 已注入拖放事件阻止代码');
    `).catch(err => console.error('注入拖放阻止代码失败:', err));
  });

  // 开发模式下加载 Vite 服务器，生产模式加载构建文件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    console.log(
      "🔥 Development mode: loading Vite dev server at " + process.env['ELECTRON_RENDERER_URL'] + " [RESTARTED at " +
        new Date().toLocaleTimeString() + "]",
    );
    win.loadURL(process.env['ELECTRON_RENDERER_URL']).then(() => {
      console.log("Vite dev server loaded successfully");
      win?.webContents.openDevTools();
    }).catch((err) => {
      console.error("Failed to load Vite dev server:", err);
    });
  } else {
    console.log("Production mode: loading built files");
    const htmlPath = join(__dirname, '../renderer/index.html');
    console.log("Loading HTML from:", htmlPath);
    win.loadFile(htmlPath).catch((err) => {
      console.error("Failed to load production build:", err);
    });
  }
}

/**
 * 注册所有 IPC 处理器
 */
function registerAllHandlers(): void {
  console.log('[主进程] 开始注册 IPC 处理器...');

  if (!win) return;

  // 设置主窗口引用
  registerFileExplorerHandlers(win);
  registerApplicationHandlers(win);
  setAutoUpdaterWindow(win);
  setTaskQueueMainWindow(win);

  // 注册各模块处理器
  registerVideoHandlers();
  registerImageHandlers();
  registerAuthHandlers();
  registerTaskGeneratorHandlers();
  registerSystemHandlers();

  // 任务中心处理器
  registerTaskHandlers();

  // 数据库管理处理器
  registerDatabaseIpc();

  // AI 视频生产处理器
  registerAsideHandlers();

  // 导演模式处理器
  registerDirectorModeHandlers();

  // AI 工作流处理器
  registerAIWorkflowHandlers();

  // 地区管理处理器
  registerRegionHandlers();

  console.log('[主进程] IPC 处理器注册完成');
}

// 应用启动
app.whenReady().then(() => {
  console.log('[主进程] app.whenReady 触发，开始初始化...');

  // 初始化数据库
  try {
    console.log('[主进程] 初始化数据库...');
    initDatabase();
    console.log('[主进程] 数据库初始化完成');

    // 确保预置地区数据已植入
    regionRepository.ensurePresetsSeeded();

    // 初始化任务队列管理器（必须在数据库初始化后）
    taskQueueManager.init();
    console.log('[主进程] 任务队列管理器初始化完成');
  } catch (err) {
    console.error('[主进程] 数据库初始化失败:', err);
  }

  // 初始化全局 AI 提供商
  try {
    console.log('[主进程] 初始化全局 AI 提供商...');
    initializeGlobalProvider();
    console.log('[主进程] 全局 AI 提供商初始化完成');
  } catch (err) {
    console.error('[主进程] 全局 AI 提供商初始化失败:', err);
  }

  // electron-toolkit 工具初始化
  electronApp.setAppUserModelId('com.videostitcher');

  // 默认菜单快捷键
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // 执行启动初始化（清理残留文件、注册协议等）
  initStartup();

  try {
    console.log('[主进程] 创建窗口...');
    createWindow();
    console.log('[主进程] 窗口创建完成');
  } catch (err) {
    console.error('[主进程] 创建窗口失败:', err);
    return;
  }

  // 注册所有 IPC 处理器
  try {
    registerAllHandlers();
  } catch (err) {
    console.error('[主进程] 注册 IPC 处理器失败:', err);
  }

  // macOS 应用内更新处理器
  if (process.platform === 'darwin') {
    try {
      console.log('[主进程] 加载 macOS 更新处理器...');
      if (win) {
        (win as any).macUpdater = setupUpdateHandlers(win);
      }
      console.log('[主进程] macOS 更新处理器已启用');
    } catch (err) {
      console.error('[主进程] macOS 更新处理器加载失败:', err);
    }
  }

  // 配置自动更新
  try {
    console.log('[主进程] 配置自动更新...');
    setDevelopmentMode(isDevelopment);
    setupAutoUpdater();
    console.log('[主进程] 自动更新配置完成');
  } catch (err) {
    console.error('[主进程] 配置自动更新失败:', err);
  }

  console.log('[主进程] 初始化完成！');
}).catch((err) => {
  console.error('[主进程] app.whenReady 发生错误:', err);
});

// macOS 激活应用
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 关闭数据库
    try {
      closeDatabase();
    } catch (err) {
      console.error('[主进程] 关闭数据库失败:', err);
    }
    
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  console.log('[主进程] 应用即将退出，开始清理...');
  
  // 停止任务队列管理器
  try {
    stopTaskQueueManager();
  } catch (err) {
    console.error('[主进程] 停止任务队列管理器失败:', err);
  }
  
  // 关闭数据库
  try {
    closeDatabase();
  } catch (err) {
    console.error('[主进程] 关闭数据库失败:', err);
  }
});
