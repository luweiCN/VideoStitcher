/**
 * 并发安全文件输出模块
 * 
 * 解决问题：
 * 多个任务并发执行时，如果直接写入同一输出目录，可能导致文件名冲突和互相覆盖
 * 
 * 解决方案：
 * 1. 每个任务在临时目录（随机命名的隐藏文件夹）中生成文件
 * 2. 任务完成后，原子性地将文件移动到输出目录
 * 3. 移动时自动处理文件名冲突（递增序号）
 * 
 * 使用方式：
 * ```js
 * const safeOutput = new SafeOutput(outputDir, 'merge');
 * 
 * // 获取临时输出路径（任务写入此路径）
 * const tempPath = safeOutput.getTempOutputPath('video_001.mp4');
 * 
 * // 执行 FFmpeg 等任务...
 * await runFfmpeg(args);
 * 
 * // 完成后，原子性移动到最终目录
 * const finalPath = await safeOutput.commit(tempPath);
 * ```
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateFileName } = require('./fileNameHelper');

/**
 * 安全输出管理器
 */
class SafeOutput {
  /**
   * @param {string} outputDir - 最终输出目录
   * @param {string} [prefix='task'] - 临时文件夹前缀
   */
  constructor(outputDir, prefix = 'task') {
    this.outputDir = outputDir;
    this.prefix = prefix;
    this.tempDir = null;
    this.tempDirs = new Map(); // 存储多个临时目录
  }

  /**
   * 创建临时目录
   * @returns {string} 临时目录路径
   */
  createTempDir() {
    const randomId = crypto.randomBytes(8).toString('hex');
    const tempDirName = `.${this.prefix}_${randomId}`;
    
    // 使用隐藏文件夹（以.开头）
    this.tempDir = path.join(this.outputDir, tempDirName);
    
    // 确保目录不存在（极小概率冲突）
    while (fs.existsSync(this.tempDir)) {
      const newId = crypto.randomBytes(8).toString('hex');
      this.tempDir = path.join(this.outputDir, `.${this.prefix}_${newId}`);
    }
    
    fs.mkdirSync(this.tempDir, { recursive: true });
    return this.tempDir;
  }

  /**
   * 为特定任务创建独立的临时目录
   * @param {number|string} taskId - 任务标识
   * @returns {string} 临时目录路径
   */
  createTaskTempDir(taskId) {
    const randomId = crypto.randomBytes(6).toString('hex');
    const tempDirName = `.${this.prefix}_${taskId}_${randomId}`;
    const tempDir = path.join(this.outputDir, tempDirName);
    
    fs.mkdirSync(tempDir, { recursive: true });
    this.tempDirs.set(taskId, tempDir);
    
    return tempDir;
  }

  /**
   * 获取临时输出路径
   * @param {string} filename - 文件名
   * @param {number|string} [taskId] - 任务标识（可选）
   * @returns {string} 临时文件完整路径
   */
  getTempOutputPath(filename, taskId) {
    let tempDir;
    
    if (taskId !== undefined && this.tempDirs.has(taskId)) {
      tempDir = this.tempDirs.get(taskId);
    } else if (taskId !== undefined) {
      tempDir = this.createTaskTempDir(taskId);
    } else if (this.tempDir) {
      tempDir = this.tempDir;
    } else {
      tempDir = this.createTempDir();
    }
    
    return path.join(tempDir, filename);
  }

  /**
   * 将临时文件移动到最终输出目录（原子操作）
   * 自动处理文件名冲突
   * 
   * @param {string} tempPath - 临时文件路径
   * @param {Object} options - 选项
   * @param {boolean} [options.keepOriginal=false] - 是否保留原文件（默认移动）
   * @returns {Promise<{success: boolean, finalPath?: string, error?: string}>}
   */
  async commit(tempPath, options = {}) {
    const { keepOriginal = false } = options;
    
    try {
      // 检查临时文件是否存在
      if (!fs.existsSync(tempPath)) {
        return { success: false, error: '临时文件不存在' };
      }

      const filename = path.basename(tempPath);
      
      // 在输出目录中生成唯一文件名
      const uniqueFilename = generateUniqueFilename(this.outputDir, filename);
      const finalPath = path.join(this.outputDir, uniqueFilename);
      
      // 移动或复制文件
      if (keepOriginal) {
        await fs.promises.copyFile(tempPath, finalPath);
      } else {
        await fs.promises.rename(tempPath, finalPath);
      }
      
      return { success: true, finalPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 同步版本的 commit
   * @param {string} tempPath - 临时文件路径
   * @param {Object} options - 选项
   * @returns {{success: boolean, finalPath?: string, error?: string}}
   */
  commitSync(tempPath, options = {}) {
    const { keepOriginal = false } = options;
    
    try {
      if (!fs.existsSync(tempPath)) {
        return { success: false, error: '临时文件不存在' };
      }

      const filename = path.basename(tempPath);
      const uniqueFilename = generateUniqueFilename(this.outputDir, filename);
      const finalPath = path.join(this.outputDir, uniqueFilename);
      
      if (keepOriginal) {
        fs.copyFileSync(tempPath, finalPath);
      } else {
        fs.renameSync(tempPath, finalPath);
      }
      
      return { success: true, finalPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * 清理临时目录
   * @param {number|string} [taskId] - 任务标识（可选，不传则清理所有）
   */
  cleanup(taskId) {
    try {
      if (taskId !== undefined && this.tempDirs.has(taskId)) {
        const tempDir = this.tempDirs.get(taskId);
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        this.tempDirs.delete(taskId);
      } else if (this.tempDir) {
        if (fs.existsSync(this.tempDir)) {
          fs.rmSync(this.tempDir, { recursive: true, force: true });
        }
        this.tempDir = null;
      }
    } catch (err) {
      console.warn(`[SafeOutput] 清理临时目录失败: ${err.message}`);
    }
  }

  /**
   * 清理所有临时目录
   */
  cleanupAll() {
    // 清理所有任务临时目录
    for (const [taskId] of this.tempDirs) {
      this.cleanup(taskId);
    }
    
    // 清理主临时目录
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[SafeOutput] 清理临时目录失败: ${err.message}`);
      }
    }
    this.tempDir = null;
  }
}

/**
 * 辅助函数：直接在临时目录执行任务并提交
 * 适用于简单的单文件输出场景
 * 
 * @param {string} outputDir - 输出目录
 * @param {string} filename - 目标文件名
 * @param {Function} taskFn - 任务函数，接收临时路径，返回 Promise
 * @param {Object} options - 选项
 * @returns {Promise<{success: boolean, finalPath?: string, error?: string}>}
 * 
 * @example
 * const result = await withSafeOutput(outputDir, 'video.mp4', async (tempPath) => {
 *   await runFfmpeg(['-i', input, tempPath]);
 * });
 */
async function withSafeOutput(outputDir, filename, taskFn, options = {}) {
  const { prefix = 'task', taskId } = options;
  const safeOutput = new SafeOutput(outputDir, prefix);
  
  try {
    const tempPath = safeOutput.getTempOutputPath(filename, taskId);
    
    // 执行任务
    await taskFn(tempPath);
    
    // 提交到最终目录
    const result = await safeOutput.commit(tempPath);
    
    // 清理临时目录
    safeOutput.cleanup(taskId);
    
    return result;
  } catch (err) {
    safeOutput.cleanup(taskId);
    return { success: false, error: err.message };
  }
}

module.exports = {
  SafeOutput,
  withSafeOutput,
};
