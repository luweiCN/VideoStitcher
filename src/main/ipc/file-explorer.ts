/**
 * 文件浏览器 IPC 处理器
 * 包含：文件选择对话框、批量重命名、目录读取、文件操作等
 */

import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

/**
 * 设置主窗口引用
 */
export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

// ==================== 文件选择器 ====================

interface PickFilesParams {
  title: string;
  filters?: { name: string; extensions: string[] }[];
  multiSelection?: boolean;
}

/**
 * 选择文件对话框
 */
async function handlePickFiles(_event: Electron.IpcMainInvokeEvent, { title, filters, multiSelection = true }: PickFilesParams): Promise<string[]> {
  const properties: ('openFile' | 'multiSelections')[] = ['openFile'];
  if (multiSelection) {
    properties.push('multiSelections');
  }

  const res = await dialog.showOpenDialog(mainWindow!, {
    title,
    properties,
    filters: filters || [{ name: '所有文件', extensions: ['*'] }],
  });
  if (res.canceled) return [];
  return res.filePaths;
}

/**
 * 选择输出目录对话框
 */
async function handlePickOutDir(_event: Electron.IpcMainInvokeEvent, { defaultPath }: { defaultPath?: string } = {}): Promise<string> {
  const res = await dialog.showOpenDialog(mainWindow!, {
    title: '选择输出目录',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath || undefined,
  });
  if (res.canceled) return '';
  return res.filePaths[0];
}

// ==================== 批量重命名 ====================

interface RenameOperation {
  sourcePath: string;
  targetName: string;
}

interface RenameResult {
  success: number;
  failed: number;
  errors: { file: string; error: string }[];
}

/**
 * 批量重命名文件
 */
async function handleBatchRename(event: Electron.IpcMainInvokeEvent, { operations }: { operations: RenameOperation[] }): Promise<RenameResult> {
  if (!operations || operations.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  console.log(`[文件重命名] 开始处理 ${operations.length} 个文件`);

  const results: RenameResult = { success: 0, failed: 0, errors: [] };

  event.sender.send('file-start', { total: operations.length, sessionId: null });

  for (let i = 0; i < operations.length; i++) {
    const { sourcePath, targetName } = operations[i];

    try {
      const dir = path.dirname(sourcePath);
      const ext = path.extname(sourcePath);
      const targetPath = path.join(dir, targetName + ext);

      // 检查源文件是否存在
      try {
        await fsp.access(sourcePath);
      } catch {
        throw new Error('源文件不存在');
      }

      // 检查目标文件是否已存在
      try {
        await fsp.access(targetPath);
        throw new Error('目标文件已存在');
      } catch (err: any) {
        if (err.message === '目标文件已存在') {
          throw err;
        }
      }

      await fsp.rename(sourcePath, targetPath);
      results.success++;

      console.log(`[文件重命名] 成功: ${sourcePath} -> ${targetPath}`);

      event.sender.send('file-progress', {
        index: i,
        total: operations.length,
        sourcePath,
        targetPath,
        success: true,
      });
    } catch (error: any) {
      results.errors.push({ file: sourcePath, error: error.message });
      results.failed++;

      console.error(`[文件重命名] 失败: ${sourcePath} - ${error.message}`);

      event.sender.send('file-progress', {
        index: i,
        total: operations.length,
        sourcePath,
        success: false,
        error: error.message,
      });
    }
  }

  event.sender.send('file-complete', results);

  console.log(`[文件重命名] 完成，成功: ${results.success}，失败: ${results.failed}`);

  return results;
}

// ==================== 目录读取 ====================

interface DirectoryInfo {
  path: string;
  name: string;
  isDirectory: boolean;
}

/**
 * 读取目录内容
 */
async function handleReadDirectory(_event: Electron.IpcMainInvokeEvent, { dirPath, includeHidden = false, recursive = false, maxDepth = 10, extensions = null }: {
  dirPath: string;
  includeHidden?: boolean;
  recursive?: boolean;
  maxDepth?: number;
  extensions?: string[] | null;
}): Promise<{ success: boolean; files?: DirectoryInfo[]; error?: string }> {
  try {
    const stats = await fsp.stat(dirPath);
    if (!stats.isDirectory()) {
      return { success: false, error: '不是有效的目录' };
    }

    const files: DirectoryInfo[] = [];

    async function readDirRecursive(currentDir: string, currentDepth = 0): Promise<void> {
      if (currentDepth >= maxDepth) {
        console.log(`[读取目录] 达到最大深度 ${maxDepth}，停止递归`);
        return;
      }

      const entries = await fsp.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!includeHidden && entry.name.startsWith('.')) continue;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isFile()) {
          if (extensions) {
            const ext = path.extname(entry.name).toLowerCase().slice(1);
            if (!extensions.includes(ext)) continue;
          }

          files.push({
            path: fullPath,
            name: entry.name,
            isDirectory: false,
          });
        } else if (entry.isDirectory() && recursive) {
          await readDirRecursive(fullPath, currentDepth + 1);
        }
      }
    }

    await readDirRecursive(dirPath);

    return { success: true, files };
  } catch (error: any) {
    console.error('[读取目录] 失败:', error);
    return { success: false, error: error.message };
  }
}

// ==================== 其他文件操作 ====================

/**
 * 检查路径类型
 */
async function handleCheckPathType(_event: Electron.IpcMainInvokeEvent, { filePath }: { filePath: string }): Promise<{ success: boolean; isDirectory?: boolean; isFile?: boolean; error?: string }> {
  try {
    const stats = await fsp.stat(filePath);
    return {
      success: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 在系统文件管理器中显示文件
 */
async function handleShowItemInFolder(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<void> {
  shell.showItemInFolder(filePath);
}

/**
 * 用系统默认程序打开文件
 */
async function handleOpenPath(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<void> {
  await shell.openPath(filePath);
}

// ==================== 注册处理器 ====================

/**
 * 注册所有文件浏览器 IPC 处理器
 */
export function registerFileExplorerHandlers(win?: BrowserWindow): void {
  if (win) {
    mainWindow = win;
  }

  // 文件选择器
  ipcMain.handle('pick-files', handlePickFiles);
  ipcMain.handle('pick-outdir', handlePickOutDir);

  // 批量重命名
  ipcMain.handle('file:batch-rename', async (event, params) => {
    return handleBatchRename(event, params);
  });

  // 读取目录内容
  ipcMain.handle('file:read-directory', async (event, params) => {
    return handleReadDirectory(event, params);
  });

  // 检查路径类型
  ipcMain.handle('file:check-path-type', handleCheckPathType);

  // 在文件管理器中显示
  ipcMain.handle('file:show-item-in-folder', handleShowItemInFolder);

  // 用系统默认程序打开
  ipcMain.handle('file:open-path', handleOpenPath);
}

export {
  handlePickFiles,
  handlePickOutDir,
  handleBatchRename,
  handleReadDirectory,
};
