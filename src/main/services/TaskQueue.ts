/**
 * 异步任务队列管理器
 * 负责管理长时间运行的异步任务（如视频生成）
 */

import { BrowserWindow } from 'electron';
import log from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// 使用 logger
const logger = log;

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 任务类型枚举
 */
export enum TaskType {
  SCRIPT_GENERATION = 'script_generation',
  CHARACTER_GENERATION = 'character_generation',
  STORYBOARD_GENERATION = 'storyboard_generation',
  VIDEO_GENERATION = 'video_generation',
}

/**
 * 任务数据结构
 */
export interface Task {
  /** 任务 ID */
  id: string;
  /** 任务类型 */
  type: TaskType;
  /** 任务状态 */
  status: TaskStatus;
  /** 任务进度 (0-100) */
  progress: number;
  /** 任务消息 */
  message: string;
  /** 任务结果（可选） */
  result?: unknown;
  /** 错误信息（可选） */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 任务队列管理器类
 */
export class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private mainWindow: BrowserWindow | null = null;

  /**
   * 设置主窗口引用（用于发送 IPC 消息）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    logger.info('[任务队列] 主窗口已设置');
  }

  /**
   * 添加任务到队列
   * @param type 任务类型
   * @param initialMessage 初始消息
   * @returns 任务 ID
   */
  addTask(type: TaskType, initialMessage = '任务已创建'): string {
    const taskId = uuidv4();
    const now = Date.now();

    const task: Task = {
      id: taskId,
      type,
      status: TaskStatus.PENDING,
      progress: 0,
      message: initialMessage,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, task);

    logger.info('[任务队列] 任务已添加', {
      taskId,
      type,
      totalTasks: this.tasks.size,
    });

    // 通知渲染进程
    this.notifyTaskUpdate(task);

    return taskId;
  }

  /**
   * 更新任务进度
   * @param taskId 任务 ID
   * @param progress 进度 (0-100)
   * @param message 进度消息
   */
  async updateProgress(taskId: string, progress: number, message: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      logger.warn('[任务队列] 任务不存在', { taskId });
      return;
    }

    // 更新任务数据
    task.progress = Math.min(100, Math.max(0, progress));
    task.message = message;
    task.status = progress > 0 ? TaskStatus.PROCESSING : TaskStatus.PENDING;
    task.updatedAt = Date.now();

    logger.info('[任务队列] 任务进度更新', {
      taskId,
      progress: task.progress,
      message: task.message,
    });

    // 通知渲染进程
    this.notifyTaskUpdate(task);
  }

  /**
   * 标记任务完成
   * @param taskId 任务 ID
   * @param result 任务结果（可选）
   */
  async completeTask(taskId: string, result?: unknown): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      logger.warn('[任务队列] 任务不存在', { taskId });
      return;
    }

    // 更新任务数据
    task.status = TaskStatus.COMPLETED;
    task.progress = 100;
    task.message = '任务完成';
    task.result = result;
    task.updatedAt = Date.now();

    logger.info('[任务队列] 任务已完成', {
      taskId,
      type: task.type,
    });

    // 通知渲染进程
    this.notifyTaskUpdate(task);
  }

  /**
   * 标记任务失败
   * @param taskId 任务 ID
   * @param error 错误信息
   */
  async failTask(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (!task) {
      logger.warn('[任务队列] 任务不存在', { taskId });
      return;
    }

    // 更新任务数据
    task.status = TaskStatus.FAILED;
    task.error = error;
    task.message = `任务失败: ${error}`;
    task.updatedAt = Date.now();

    logger.error('[任务队列] 任务失败', {
      taskId,
      error,
    });

    // 通知渲染进程
    this.notifyTaskUpdate(task);
  }

  /**
   * 获取任务状态
   * @param taskId 任务 ID
   * @returns 任务数据（如果存在）
   */
  getTaskStatus(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   * @returns 任务列表
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 清理已完成的任务（保留最近 100 个）
   */
  cleanupCompletedTasks(): void {
    const completedTasks = Array.from(this.tasks.values())
      .filter((task) => task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED)
      .sort((a, b) => b.createdAt - a.createdAt);

    // 保留最近 100 个已完成的任务
    const tasksToKeep = new Set(completedTasks.slice(0, 100).map((task) => task.id));

    let cleanedCount = 0;
    this.tasks.forEach((task, taskId) => {
      if (
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
        !tasksToKeep.has(taskId)
      ) {
        this.tasks.delete(taskId);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info('[任务队列] 已清理过期任务', { count: cleanedCount });
    }
  }

  /**
   * 通知渲染进程任务更新
   * @param task 任务数据
   */
  private notifyTaskUpdate(task: Task): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    // 发送 IPC 消息到渲染进程
    this.mainWindow.webContents.send('task:update', task);
  }
}

// 导出单例实例
export const taskQueue = new TaskQueue();
