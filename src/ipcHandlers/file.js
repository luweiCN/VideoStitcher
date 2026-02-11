/**
 * 文件操作 IPC 处理器
 * 支持批量重命名文件、读取目录内容
 */

const { ipcMain, shell } = require('electron');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * 批量重命名文件
 *
 * @param {Object} event - IPC 事件对象
 * @param {Object} params - 参数对象
 * @param {Array} params.operations - 重命名操作数组
 *   [{ sourcePath: string, targetName: string }, ...]
 * @returns {Promise<Object>} 处理结果 { success: number, failed: number, errors: Array }
 */
async function handleBatchRename(event, { operations }) {
  if (!operations || operations.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  console.log(`[文件重命名] 开始处理 ${operations.length} 个文件`);

  const results = { success: 0, failed: 0, errors: [] };

  // 发送开始事件
  event.sender.send('file-start', { total: operations.length, sessionId: null });

  for (let i = 0; i < operations.length; i++) {
    const { sourcePath, targetName } = operations[i];

    try {
      const dir = path.dirname(sourcePath);
      const ext = path.extname(sourcePath);
      const targetPath = path.join(dir, targetName + ext);

      // 检查源文件是否存在
      try {
        await fs.access(sourcePath);
      } catch {
        throw new Error('源文件不存在');
      }

      // 检查目标文件是否已存在
      try {
        await fs.access(targetPath);
        // 如果 access 成功，说明目标文件已存在
        throw new Error('目标文件已存在');
      } catch (err) {
        // 如果是我们主动抛出的错误，直接重新抛出
        if (err.message === '目标文件已存在') {
          throw err;
        }
        // 否则是文件不存在的正常情况（access 失败），继续执行重命名
      }

      // 执行重命名
      await fs.rename(sourcePath, targetPath);
      results.success++;

      console.log(`[文件重命名] 成功: ${sourcePath} -> ${targetPath}`);

      // 发送进度事件
      event.sender.send('file-progress', {
        index: i,
        total: operations.length,
        sourcePath,
        targetPath,
        success: true
      });
    } catch (error) {
      results.errors.push({ file: sourcePath, error: error.message });
      results.failed++;

      console.error(`[文件重命名] 失败: ${sourcePath} - ${error.message}`);

      event.sender.send('file-progress', {
        index: i,
        total: operations.length,
        sourcePath,
        success: false,
        error: error.message
      });
    }
  }

  // 发送完成事件
  event.sender.send('file-complete', results);

  console.log(`[文件重命名] 完成，成功: ${results.success}，失败: ${results.failed}`);

  return results;
}

/**
 * 读取目录内容
 *
 * @param {Object} event - IPC 事件对象
 * @param {Object} params - 参数对象
 * @param {string} params.dirPath - 目录路径
 * @param {boolean} params.includeHidden - 是否包含隐藏文件（默认 false）
 * @param {boolean} params.recursive - 是否递归读取子目录（默认 false）
 * @param {number} params.maxDepth - 递归最大深度（默认 10）
 * @param {Array<string>} params.extensions - 只包含指定扩展名的文件（默认 null，包含所有）
 * @returns {Promise<Object>} 结果对象 { success: boolean, files?: Array, error?: string }
 */
async function handleReadDirectory(event, { dirPath, includeHidden = false, recursive = false, maxDepth = 10, extensions = null }) {
  try {
    // 检查路径是否存在且是目录
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return { success: false, error: '不是有效的目录' };
    }

    const files = [];

    /**
     * 递归读取目录
     * @param {string} currentDir - 当前目录路径
     * @param {number} currentDepth - 当前深度
     */
    async function readDirRecursive(currentDir, currentDepth = 0) {
      // 检查深度限制
      if (currentDepth >= maxDepth) {
        console.log(`[读取目录] 达到最大深度 ${maxDepth}，停止递归`);
        return;
      }

      // 读取目录内容
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        // 跳过隐藏文件和文件夹（如果不包含）
        if (!includeHidden && entry.name.startsWith('.')) continue;

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isFile()) {
          // 检查扩展名过滤
          if (extensions) {
            const ext = path.extname(entry.name).toLowerCase().slice(1);
            if (!extensions.includes(ext)) continue;
          }

          files.push({
            path: fullPath,
            name: entry.name,
            isDirectory: false
          });
        } else if (entry.isDirectory() && recursive) {
          // 递归读取子目录
          await readDirRecursive(fullPath, currentDepth + 1);
        }
      }
    }

    await readDirRecursive(dirPath);

    return { success: true, files };
  } catch (error) {
    console.error('[读取目录] 失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 注册所有文件操作 IPC 处理器
 */
function registerFileHandlers() {
  // 批量重命名
  ipcMain.handle('file:batch-rename', async (event, params) => {
    return handleBatchRename(event, params);
  });

  // 读取目录内容
  ipcMain.handle('file:read-directory', async (event, params) => {
    return handleReadDirectory(event, params);
  });

  // 检查路径类型（文件或目录）
  ipcMain.handle('file:check-path-type', async (event, { filePath }) => {
    try {
      const stats = await fs.stat(filePath);
      return {
        success: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // 在系统文件管理器中显示文件
  ipcMain.handle('file:show-item-in-folder', async (event, filePath) => {
    shell.showItemInFolder(filePath);
  });

  // 用系统默认程序打开文件
  ipcMain.handle('file:open-path', async (event, filePath) => {
    await shell.openPath(filePath);
  });
}

module.exports = {
  registerFileHandlers,
  handleBatchRename,
  handleReadDirectory
};
