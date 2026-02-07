/**
 * 文件操作 IPC 处理器
 * 支持批量重命名文件
 */

const { ipcMain } = require('electron');
const fs = require('fs').promises;
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
 * 注册所有文件操作 IPC 处理器
 */
function registerFileHandlers() {
  // 批量重命名
  ipcMain.handle('file:batch-rename', async (event, params) => {
    return handleBatchRename(event, params);
  });
}

module.exports = {
  registerFileHandlers,
  handleBatchRename
};
