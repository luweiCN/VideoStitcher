/**
 * 并发安全文件输出模块
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateUniqueFilename } from './fileNameHelper';

interface CommitResult {
  success: boolean;
  finalPath?: string;
  error?: string;
}

interface WithSafeOutputOptions {
  prefix?: string;
  taskId?: number | string;
}

/**
 * 安全输出管理器
 */
export class SafeOutput {
  outputDir: string;
  prefix: string;
  tempDir: string | null;
  tempDirs: Map<number | string, string>;

  constructor(outputDir: string, prefix: string = 'task') {
    this.outputDir = outputDir;
    this.prefix = prefix;
    this.tempDir = null;
    this.tempDirs = new Map();
  }

  /**
   * 创建临时目录
   */
  createTempDir(): string {
    const randomId = crypto.randomBytes(8).toString('hex');
    const tempDirName = `.${this.prefix}_${randomId}`;

    this.tempDir = path.join(this.outputDir, tempDirName);

    while (fs.existsSync(this.tempDir)) {
      const newId = crypto.randomBytes(8).toString('hex');
      this.tempDir = path.join(this.outputDir, `.${this.prefix}_${newId}`);
    }

    fs.mkdirSync(this.tempDir, { recursive: true });
    return this.tempDir;
  }

  /**
   * 为特定任务创建独立的临时目录
   */
  createTaskTempDir(taskId: number | string): string {
    const randomId = crypto.randomBytes(6).toString('hex');
    const tempDirName = `.${this.prefix}_${taskId}_${randomId}`;
    const tempDir = path.join(this.outputDir, tempDirName);

    fs.mkdirSync(tempDir, { recursive: true });
    this.tempDirs.set(taskId, tempDir);

    return tempDir;
  }

  /**
   * 获取临时输出路径
   */
  getTempOutputPath(filename: string, taskId?: number | string): string {
    let tempDir: string;

    if (taskId !== undefined && this.tempDirs.has(taskId)) {
      tempDir = this.tempDirs.get(taskId)!;
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
   */
  async commit(tempPath: string, options: { keepOriginal?: boolean } = {}): Promise<CommitResult> {
    const { keepOriginal = false } = options;

    try {
      if (!fs.existsSync(tempPath)) {
        return { success: false, error: '临时文件不存在' };
      }

      const filename = path.basename(tempPath);
      const uniqueFilename = generateUniqueFilename(this.outputDir, filename);
      const finalPath = path.join(this.outputDir, uniqueFilename);

      if (keepOriginal) {
        await fs.promises.copyFile(tempPath, finalPath);
      } else {
        await fs.promises.rename(tempPath, finalPath);
      }

      return { success: true, finalPath };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * 同步版本的 commit
   */
  commitSync(tempPath: string, options: { keepOriginal?: boolean } = {}): CommitResult {
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
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * 清理临时目录
   */
  cleanup(taskId?: number | string): void {
    try {
      if (taskId !== undefined && this.tempDirs.has(taskId)) {
        const tempDir = this.tempDirs.get(taskId);
        if (tempDir && fs.existsSync(tempDir)) {
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
      console.warn(`[SafeOutput] 清理临时目录失败: ${(err as Error).message}`);
    }
  }

  /**
   * 清理所有临时目录
   */
  cleanupAll(): void {
    for (const [taskId] of this.tempDirs) {
      this.cleanup(taskId);
    }

    if (this.tempDir && fs.existsSync(this.tempDir)) {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[SafeOutput] 清理临时目录失败: ${(err as Error).message}`);
      }
    }
    this.tempDir = null;
  }
}

/**
 * 辅助函数：直接在临时目录执行任务并提交
 */
export async function withSafeOutput(
  outputDir: string,
  filename: string,
  taskFn: (tempPath: string) => Promise<void>,
  options: WithSafeOutputOptions = {}
): Promise<CommitResult> {
  const { prefix = 'task', taskId } = options;
  const safeOutput = new SafeOutput(outputDir, prefix);

  try {
    const tempPath = safeOutput.getTempOutputPath(filename, taskId);

    await taskFn(tempPath);

    const result = await safeOutput.commit(tempPath);

    safeOutput.cleanup(taskId);

    return result;
  } catch (err) {
    safeOutput.cleanup(taskId);
    return { success: false, error: (err as Error).message };
  }
}
