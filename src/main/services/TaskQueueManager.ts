/**
 * 任务队列管理器
 * 负责任务的调度、并发控制和执行
 */

import { BrowserWindow } from 'electron';
import os from 'os';
import { taskRepository } from '../database/repositories/task.repository';
import { taskLogRepository } from '../database/repositories/task-log.repository';
import { configRepository } from '../database/repositories/config.repository';
import { executeSingleMergeTask } from '../ipc/video';
import type { Task, TaskCenterConfig, QueueStatus, TaskOutput } from '@shared/types/task';
import { DEFAULT_TASK_CENTER_CONFIG } from '@shared/types/task';

/**
 * 任务执行器接口
 */
interface TaskExecutor {
  taskId: string;
  paused: boolean;
  startTime: number;
  pausedTime: number;
}

/**
 * 任务队列管理器
 */
export class TaskQueueManager {
  private config: TaskCenterConfig | null = null;
  private runningTasks: Map<string, TaskExecutor>;
  private queuedTaskIds: string[];
  private mainWindow: BrowserWindow | null = null;
  private executionTimeTimer: NodeJS.Timeout | null = null;
  private sessionStartTime: number = 0;
  private totalSessionTime: number = 0;
  private initialized: boolean = false;

  constructor() {
    this.runningTasks = new Map();
    this.queuedTaskIds = [];
    this.sessionStartTime = Date.now();
  }

  /**
   * 初始化（在数据库初始化后调用）
   */
  init(): void {
    if (this.initialized) return;
    this.config = configRepository.getAll();
    this.initialized = true;
    this.startExecutionTimer();
    console.log('[TaskQueueManager] 初始化完成');
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      this.config = { ...DEFAULT_TASK_CENTER_CONFIG };
    }
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * 更新并发配置（实时生效）
   */
  updateConfig(config: Partial<TaskCenterConfig>): void {
    this.ensureInitialized();
    if (config.maxConcurrentTasks !== undefined) {
      this.config!.maxConcurrentTasks = config.maxConcurrentTasks;
    }
    if (config.threadsPerTask !== undefined) {
      this.config!.threadsPerTask = config.threadsPerTask;
    }

    // 保存到数据库
    configRepository.setMany(config);

    // 尝试启动更多任务
    this.tryStartNext();
  }

  /**
   * 获取当前配置
   */
  getConfig(): TaskCenterConfig {
    this.ensureInitialized();
    return { ...this.config! };
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): QueueStatus {
    this.ensureInitialized();
    return {
      running: this.runningTasks.size,
      queued: this.queuedTaskIds.length,
      maxConcurrent: this.config!.maxConcurrentTasks,
      threadsPerTask: this.config!.threadsPerTask,
      totalThreads: this.runningTasks.size * this.config!.threadsPerTask,
    };
  }

  /**
   * 获取 CPU 信息
   */
  getCpuInfo(): { cores: number; model: string } {
    const cpus = os.cpus();
    return {
      cores: cpus.length,
      model: cpus[0]?.model ?? 'Unknown',
    };
  }

  /**
   * 添加任务到队列
   */
  enqueue(taskId: string): void {
    this.ensureInitialized();
    const task = taskRepository.getTaskById(taskId);
    if (!task) {
      console.error(`[TaskQueueManager] 任务不存在: ${taskId}`);
      return;
    }

    // 更新状态为 queued
    taskRepository.updateTaskStatus(taskId, 'queued');

    // 加入队列
    this.queuedTaskIds.push(taskId);

    // 发送任务更新事件
    this.sendTaskUpdated(taskId);

    // 尝试启动
    this.tryStartNext();
  }

  /**
   * 暂停任务
   */
  pause(taskId: string): boolean {
    const executor = this.runningTasks.get(taskId);
    if (executor && !executor.paused) {
      executor.paused = true;
      executor.pausedTime = Date.now();

      // 更新数据库状态
      taskRepository.updateTaskStatus(taskId, 'paused');
      this.sendTaskUpdated(taskId);

      return true;
    }
    return false;
  }

  /**
   * 恢复任务
   */
  resume(taskId: string): boolean {
    const executor = this.runningTasks.get(taskId);
    if (executor && executor.paused) {
      executor.paused = false;

      // 计算暂停时间并累加到执行时间
      const pauseDuration = Date.now() - executor.pausedTime;
      taskRepository.incrementExecutionTime(taskId, pauseDuration);

      // 更新数据库状态
      taskRepository.updateTaskStatus(taskId, 'running');
      this.sendTaskUpdated(taskId);

      return true;
    }
    return false;
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    // 如果在运行中
    const executor = this.runningTasks.get(taskId);
    if (executor) {
      this.runningTasks.delete(taskId);

      // 更新数据库状态
      taskRepository.updateTaskStatus(taskId, 'cancelled');
      this.sendTaskCancelled(taskId);

      // 尝试启动下一个任务
      this.tryStartNext();

      return true;
    }

    // 如果在队列中
    const index = this.queuedTaskIds.indexOf(taskId);
    if (index > -1) {
      this.queuedTaskIds.splice(index, 1);

      // 更新数据库状态
      taskRepository.updateTaskStatus(taskId, 'cancelled');
      this.sendTaskCancelled(taskId);

      return true;
    }

    return false;
  }

  /**
   * 重试任务
   */
  retry(taskId: string): boolean {
    const task = taskRepository.getTaskById(taskId);
    if (!task) return false;

    // 重置状态
    taskRepository.updateTaskStatus(taskId, 'pending');
    taskRepository.incrementRetryCount(taskId);

    // 重新入队
    this.enqueue(taskId);

    return true;
  }

  /**
   * 暂停所有运行中的任务
   */
  pauseAll(): number {
    let count = 0;
    for (const taskId of this.runningTasks.keys()) {
      if (this.pause(taskId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 恢复所有暂停的任务
   */
  resumeAll(): number {
    let count = 0;
    for (const taskId of this.runningTasks.keys()) {
      const executor = this.runningTasks.get(taskId);
      if (executor?.paused && this.resume(taskId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 取消所有未完成的任务
   */
  cancelAll(): number {
    let count = 0;

    // 取消队列中的任务
    while (this.queuedTaskIds.length > 0) {
      const taskId = this.queuedTaskIds.shift();
      if (taskId) {
        taskRepository.updateTaskStatus(taskId, 'cancelled');
        this.sendTaskCancelled(taskId);
        count++;
      }
    }

    // 取消运行中的任务
    for (const taskId of this.runningTasks.keys()) {
      if (this.cancel(taskId)) {
        count++;
      }
    }

    return count;
  }

  /**
   * 获取总运行时间
   */
  getTotalRunTime(): number {
    return this.totalSessionTime + (Date.now() - this.sessionStartTime);
  }

  /**
   * 尝试启动下一个任务
   */
  private tryStartNext(): void {
    this.ensureInitialized();
    while (
      this.runningTasks.size < this.config!.maxConcurrentTasks &&
      this.queuedTaskIds.length > 0
    ) {
      const taskId = this.queuedTaskIds.shift();
      if (taskId) {
        this.startTask(taskId);
      }
    }
  }

  /**
   * 启动单个任务
   */
  private async startTask(taskId: string): Promise<void> {
    this.ensureInitialized();
    const task = taskRepository.getTaskById(taskId);
    if (!task) return;

    // 加载文件列表
    task.files = taskRepository.getTaskFiles(taskId);

    // 创建执行器
    const executor: TaskExecutor = {
      taskId,
      paused: false,
      startTime: Date.now(),
      pausedTime: 0,
    };

    this.runningTasks.set(taskId, executor);

    // 更新状态为运行中
    taskRepository.updateTaskStatus(taskId, 'running');
    this.sendTaskStarted(taskId);

    // 根据任务类型执行
    try {
      await this.executeTask(task, executor);
    } catch (err) {
      this.handleTaskError(taskId, err as Error);
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(
    task: Task,
    executor: TaskExecutor
  ): Promise<void> {
    const { type, config, outputDir, files } = task;

    // 检查是否被暂停/取消
    if (executor.paused) {
      return;
    }

    // 根据任务类型调用不同的执行器
    switch (type) {
      case 'video_merge':
        await this.executeMergeTask(task, executor);
        break;

      case 'video_stitch':
      case 'video_resize':
        // TODO: 实现其他视频任务
        this.addLog(task.id, 'info', `开始执行任务: ${type}`);
        this.handleTaskComplete(task.id, []);
        break;

      case 'image_material':
      case 'cover_format':
      case 'cover_compress':
      case 'lossless_grid':
        // TODO: 实现图片任务
        this.addLog(task.id, 'info', `开始执行任务: ${type}`);
        this.handleTaskComplete(task.id, []);
        break;

      default:
        throw new Error(`未知的任务类型: ${type}`);
    }
  }

  /**
   * 执行视频合成任务
   */
  private async executeMergeTask(
    task: Task,
    executor: TaskExecutor
  ): Promise<void> {
    this.addLog(task.id, 'info', '开始执行视频合成任务');

    // 转换文件格式
    const taskFiles = (task.files || []).map((f: any) => ({
      path: f.path,
      category: f.category,
      category_name: f.category_name || f.categoryLabel || f.category,
    }));

    const result = await executeSingleMergeTask(
      {
        id: task.id,
        files: taskFiles,
        config: task.config as any,
        outputDir: task.outputDir || '',
      },
      (message: string) => {
        // 检查是否被取消
        if (!this.runningTasks.has(task.id)) {
          throw new Error('任务已被取消');
        }
        this.addLog(task.id, 'info', message);
      }
    );

    if (result.success) {
      const outputs: TaskOutput[] = result.outputPath
        ? [{ path: result.outputPath, type: 'video' as const }]
        : [];
      this.handleTaskComplete(task.id, outputs);
    } else {
      throw new Error(result.error || '任务执行失败');
    }
  }

  /**
   * 处理任务完成
   */
  private handleTaskComplete(taskId: string, outputs: TaskOutput[]): void {
    const executor = this.runningTasks.get(taskId);
    if (!executor) return;

    // 计算执行时间
    const executionTime = Date.now() - executor.startTime;
    taskRepository.updateTaskStatus(taskId, 'completed', { executionTime });

    // 保存输出
    for (const output of outputs) {
      taskRepository.addTaskOutput(taskId, output);
    }

    // 移除执行器
    this.runningTasks.delete(taskId);

    // 发送完成事件
    this.sendTaskCompleted(taskId, outputs);

    // 尝试启动下一个
    this.tryStartNext();
  }

  /**
   * 处理任务错误
   */
  private handleTaskError(taskId: string, error: Error): void {
    const executor = this.runningTasks.get(taskId);
    if (!executor) return;

    // 添加错误日志
    this.addLog(taskId, 'error', `任务执行失败: ${error.message}`);

    // 更新状态
    taskRepository.updateTaskStatus(taskId, 'failed', {
      errorCode: 'EXECUTION_ERROR',
      errorMessage: error.message,
      errorStack: error.stack,
    });

    // 移除执行器
    this.runningTasks.delete(taskId);

    // 发送失败事件
    this.sendTaskFailed(taskId, {
      code: 'EXECUTION_ERROR',
      message: error.message,
      stack: error.stack,
    });

    // 尝试启动下一个
    this.tryStartNext();
  }

  /**
   * 添加日志
   */
  private addLog(taskId: string, level: 'info' | 'warning' | 'error' | 'success', message: string): void {
    taskLogRepository.addLog(taskId, { level, message });

    // 发送日志事件
    const logs = taskLogRepository.getTaskLogs(taskId, { limit: 1, offset: 0 });
    if (logs.length > 0) {
      this.sendTaskLog(taskId, logs[0]);
    }
  }

  /**
   * 启动执行时间计时器
   */
  private startExecutionTimer(): void {
    this.executionTimeTimer = setInterval(() => {
      // 每秒更新运行中任务的执行时间
      for (const [taskId, executor] of this.runningTasks) {
        if (!executor.paused) {
          taskRepository.incrementExecutionTime(taskId, 1000);
        }
      }
    }, 1000);
  }

  /**
   * 停止计时器
   */
  stop(): void {
    if (this.executionTimeTimer) {
      clearInterval(this.executionTimeTimer);
      this.executionTimeTimer = null;
    }

    // 暂停所有运行中的任务
    this.pauseAll();
  }

  // ==================== 事件发送 ====================

  private sendTaskUpdated(taskId: string): void {
    const task = taskRepository.getTaskById(taskId);
    if (task && this.mainWindow) {
      this.mainWindow.webContents.send('task:updated', task);
    }
  }

  private sendTaskStarted(taskId: string): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:started', { taskId });
    }
  }

  private sendTaskProgress(event: { taskId: string; progress: number; step?: string }): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:progress', event);
    }
  }

  private sendTaskLog(taskId: string, log: any): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:log', { taskId, log });
    }
  }

  private sendTaskCompleted(taskId: string, outputs: TaskOutput[]): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:completed', { taskId, outputs });
    }
  }

  private sendTaskFailed(taskId: string, error: any): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:failed', { taskId, error });
    }
  }

  private sendTaskCancelled(taskId: string): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:cancelled', { taskId });
    }
  }
}

// 导出单例
export const taskQueueManager = new TaskQueueManager();
