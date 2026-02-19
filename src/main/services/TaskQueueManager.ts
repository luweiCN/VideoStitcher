/**
 * 任务队列管理器
 * 负责任务的调度、并发控制和执行
 */

import { BrowserWindow } from 'electron';
import os from 'os';
import si from 'systeminformation';
import { exec } from 'child_process';
import { processMonitor } from './ProcessMonitor';
import { taskRepository } from '../database/repositories/task.repository';
import { taskLogRepository } from '../database/repositories/task-log.repository';
import { configRepository } from '../database/repositories/config.repository';
import { executeSingleMergeTask } from '../ipc/video';
import type { Task, TaskCenterConfig, QueueStatus, TaskOutput, TaskStats } from '@shared/types/task';
import { DEFAULT_TASK_CENTER_CONFIG } from '@shared/types/task';

/**
 * 任务执行器接口
 */
interface TaskExecutor {
  taskId: number;
  startTime: number;
  pid?: number;
}

/**
 * 任务取消错误（静默处理，不弹窗）
 */
export class TaskCancelledError extends Error {
  constructor(message: string = '任务已被取消') {
    super(message);
    this.name = 'TaskCancelledError';
  }
}

/**
 * 任务执行器接口
 * 
 * 任务状态：pending → running → completed/failed/cancelled
 * 暂停是任务中心的状态，不是任务的状态
 */
export class TaskQueueManager {
  private config: TaskCenterConfig | null = null;
  private runningTasks: Map<number, TaskExecutor>;
  private mainWindow: BrowserWindow | null = null;
  private executionTimeTimer: NodeJS.Timeout | null = null;
  private runTimeSaveTimer: NodeJS.Timeout | null = null;
  private systemStatsTimer: NodeJS.Timeout | null = null;
  private sessionStartTime: number = 0;
  private currentSessionRunTime: number = 0;
  private initialized: boolean = false;

  constructor() {
    this.runningTasks = new Map();
  }

  /**
   * 初始化（在数据库初始化后调用）
   */
  init(): void {
    if (this.initialized) return;
    this.config = configRepository.getAll();
    this.initialized = true;
    
    // 恢复运行时间
    this.currentSessionRunTime = 0;
    this.sessionStartTime = Date.now();
    
    // 启动计时器
    this.startExecutionTimer();
    this.startRunTimeSaveTimer();
    this.startSystemStatsBroadcast();
    
    // 恢复未完成的任务到队列
    this.restoreTasks();
    
    console.log('[TaskQueueManager] 初始化完成, isPaused:', this.config.isPaused);
  }

  /**
   * 恢复未完成的任务
   */
  private restoreTasks(): void {
    // 先清理临时文件
    this.cleanupTempFiles();

    // 如果任务中心是暂停状态，不自动恢复任务
    if (this.config?.isPaused) {
      console.log('[TaskQueueManager] 任务中心已暂停，不自动恢复任务');
      
      // 将所有运行中的任务改为 pending
      const runningTasks = taskRepository.getTasks({
        filter: { status: ['running'] },
        pageSize: 1000,
      });
      
      for (const task of runningTasks.tasks) {
        // 杀掉可能存在的孤儿进程
        if (task.pid) {
          this.killProcess(task.pid);
        }
        taskRepository.updateTaskStatus(task.id, 'pending');
        taskRepository.clearTaskPid(task.id);
        this.sendTaskUpdated(task.id);
      }
      
      return;
    }
    
    // 获取运行中的任务
    const runningTasks = taskRepository.getTasks({
      filter: { status: ['running'] },
      pageSize: 1000,
    });

    for (const task of runningTasks.tasks) {
      // 检查进程是否还在运行
      const processAlive = task.pid && this.checkProcessExists(task.pid);
      
      if (processAlive) {
        // 进程还在，杀掉它（无法恢复）
        this.killProcess(task.pid!);
        console.log(`[TaskQueueManager] 杀掉孤儿进程 PID: ${task.pid}`);
      }
      
      // 检查输出是否已存在（任务实际已完成）
      const outputs = taskRepository.getTaskOutputs(task.id);
      const hasValidOutput = outputs.length > 0 && outputs.every(o => this.fileExists(o.path));
      
      if (hasValidOutput) {
        // 任务实际已完成
        taskRepository.updateTaskStatus(task.id, 'completed');
        console.log(`[TaskQueueManager] 任务 ${task.id} 实际已完成`);
      } else {
        // 需要重新执行
        taskRepository.updateTaskStatus(task.id, 'pending');
        console.log(`[TaskQueueManager] 任务 ${task.id} 需要重新执行`);
      }
      
      taskRepository.clearTaskPid(task.id);
    }

    // 尝试启动任务
    this.tryStartNext();
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
    
    // 从数据库获取任务统计
    const stats = taskRepository.getTaskStats();
    
    return {
      running: this.runningTasks.size,
      queued: 0, // 不再使用队列概念
      pending: stats.pending,
      completed: stats.completed,
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
   * 添加任务（状态保持 pending，尝试启动）
   */
  enqueue(taskId: number): void {
    this.ensureInitialized();
    const task = taskRepository.getTaskById(taskId);
    if (!task) {
      console.error(`[TaskQueueManager] 任务不存在: ${taskId}`);
      return;
    }

    // 发送任务更新事件
    this.sendTaskUpdated(taskId);

    // 尝试启动
    this.tryStartNext();
  }

  /**
   * 取消任务
   */
  cancel(taskId: number): boolean {
    const executor = this.runningTasks.get(taskId);
    if (executor) {
      // 杀掉进程
      if (executor.pid) {
        this.killProcess(executor.pid);
      }
      this.runningTasks.delete(taskId);

      // 更新数据库状态
      taskRepository.updateTaskStatus(taskId, 'cancelled');
      taskRepository.clearTaskPid(taskId);
      
      // 发送日志和事件
      this.addLog(taskId, 'info', '任务已取消');
      this.sendTaskCancelled(taskId);

      // 尝试启动下一个任务
      this.tryStartNext();

      return true;
    }

    // 如果是 pending 状态，直接取消
    const task = taskRepository.getTaskById(taskId);
    if (task && task.status === 'pending') {
      taskRepository.updateTaskStatus(taskId, 'cancelled');
      this.addLog(taskId, 'info', '任务已取消');
      this.sendTaskCancelled(taskId);
      return true;
    }

    return false;
  }

  /**
   * 重试任务
   */
  retry(taskId: number): boolean {
    const task = taskRepository.getTaskById(taskId);
    if (!task) return false;

    // 重置状态为 pending
    taskRepository.updateTaskStatus(taskId, 'pending');
    taskRepository.incrementRetryCount(taskId);

    // 发送更新事件
    this.sendTaskUpdated(taskId);

    // 尝试启动
    this.tryStartNext();

    return true;
  }

  /**
   * 暂停任务中心
   * 杀掉所有运行中的进程，状态改为 pending
   */
  pauseAll(): number {
    let count = 0;
    
    // 杀掉所有运行中的任务
    for (const [taskId, executor] of this.runningTasks) {
      // 从内存获取 PID
      let pid = executor.pid;
      
      // 如果内存没有，从数据库获取
      if (!pid) {
        const task = taskRepository.getTaskById(taskId);
        pid = task?.pid;
      }
      
      if (pid) {
        console.log(`[TaskQueueManager] 暂停任务 ${taskId}，杀掉进程 PID: ${pid}`);
        this.killProcess(pid);
      } else {
        console.log(`[TaskQueueManager] 暂停任务 ${taskId}，但找不到 PID`);
      }
      
      taskRepository.updateTaskStatus(taskId, 'pending');
      taskRepository.clearTaskPid(taskId);
      this.sendTaskUpdated(taskId);
      count++;
    }
    
    this.runningTasks.clear();
    
    // 保存暂停状态和运行时间
    this.saveRunTime();
    configRepository.set('isPaused', true);
    if (this.config) {
      this.config.isPaused = true;
    }
    
    // 发送系统日志
    this.broadcastLog('task-center', 'system', `任务中心已暂停，停止了 ${count} 个任务`, 'warning');
    
    return count;
  }

  /**
   * 恢复任务中心
   * 从数据库取 pending 任务开始执行
   */
  resumeAll(): number {
    // 保存恢复状态
    configRepository.set('isPaused', false);
    if (this.config) {
      this.config.isPaused = false;
    }
    
    // 获取待执行任务数量
    const pendingTasks = taskRepository.getTasks({
      filter: { status: ['pending'] },
      pageSize: 1000,
    });
    
    // 尝试启动任务
    this.tryStartNext();
    
    // 发送系统日志
    this.broadcastLog('task-center', 'system', `任务中心已恢复，待执行任务: ${pendingTasks.total}`, 'success');
    
    return pendingTasks.total;
  }

  /**
   * 取消所有未完成的任务
   */
  cancelAll(): number {
    let count = 0;

    // 取消运行中的任务
    for (const [taskId, executor] of this.runningTasks) {
      if (executor.pid) {
        this.killProcess(executor.pid);
      }
      taskRepository.updateTaskStatus(taskId, 'cancelled');
      taskRepository.clearTaskPid(taskId);
      this.sendTaskCancelled(taskId);
      count++;
    }
    this.runningTasks.clear();

    // 取消所有 pending 状态的任务
    const pendingTasks = taskRepository.getTasks({
      filter: { status: ['pending'] },
      pageSize: 1000,
    });
    
    for (const task of pendingTasks.tasks) {
      taskRepository.updateTaskStatus(task.id, 'cancelled');
      this.sendTaskCancelled(task.id);
      count++;
    }

    return count;
  }

  /**
   * 尝试启动下一个任务
   * 从数据库取 pending 状态的任务
   */
  private tryStartNext(): void {
    this.ensureInitialized();
    
    // 如果任务中心暂停，不启动新任务
    if (this.config?.isPaused) {
      return;
    }
    
    // 检查是否有空闲执行槽
    while (this.runningTasks.size < this.config!.maxConcurrentTasks) {
      // 从数据库取一个 pending 任务
      const result = taskRepository.getTasks({
        filter: { status: ['pending'] },
        sort: { field: 'createdAt', order: 'asc' },
        pageSize: 1,
      });
      
      if (result.tasks.length === 0) {
        break;
      }
      
      const task = result.tasks[0];
      this.startTask(task.id);
    }
  }

  /**
   * 启动单个任务
   */
  private async startTask(taskId: number): Promise<void> {
    this.ensureInitialized();
    const task = taskRepository.getTaskById(taskId);
    if (!task) return;

    // 加载文件列表
    task.files = taskRepository.getTaskFiles(taskId);

    // 创建执行器
    const executor: TaskExecutor = {
      taskId,
      startTime: Date.now(),
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

    // 检查是否被取消（从 runningTasks 中移除）
    if (!this.runningTasks.has(task.id)) {
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
    const taskFiles = (task.files || []).map((f: any, idx: number) => ({
      path: f.path,
      index: f.index ?? idx,
      category: f.category,
      category_name: f.category_name || f.categoryLabel || f.category,
    }));

    const result = await executeSingleMergeTask(
      {
        id: task.id,
        files: taskFiles,
        config: task.config as any,
        outputDir: task.outputDir || '',
        threads: this.config!.threadsPerTask,
      },
      (message: string) => {
        // 检查是否被取消
        if (!this.runningTasks.has(task.id)) {
          throw new TaskCancelledError();
        }
        this.addLog(task.id, 'info', message);
      },
      (pid: number) => {
        // 记录进程 PID 到内存和数据库
        const exec = this.runningTasks.get(task.id);
        if (exec) {
          exec.pid = pid;
          taskRepository.updateTaskPid(task.id, pid);
          console.log(`[TaskQueueManager] 任务 ${task.id} 的 FFmpeg 进程 PID: ${pid}`);
        }
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
  private handleTaskComplete(taskId: number, outputs: TaskOutput[]): void {
    const executor = this.runningTasks.get(taskId);
    if (!executor) return;

    // 计算执行时间
    const executionTime = Date.now() - executor.startTime;
    taskRepository.updateTaskStatus(taskId, 'completed', { executionTime });

    // 清除 PID
    taskRepository.clearTaskPid(taskId);

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
  private handleTaskError(taskId: number, error: Error): void {
    // 如果是取消错误，静默处理（任务状态已在 cancel() 中更新）
    if (error instanceof TaskCancelledError) {
      this.addLog(taskId, 'info', '任务已取消');
      return;
    }
    
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

    // 清除 PID
    taskRepository.clearTaskPid(taskId);

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
  private addLog(taskId: number, level: 'info' | 'warning' | 'error' | 'success', message: string): void {
    taskLogRepository.addLog(taskId, { level, message });

    // 获取任务类型
    const task = taskRepository.getTaskById(taskId);
    const taskType = task?.type || 'unknown';

    // 广播日志
    this.broadcastLog(taskId, taskType, message, level);
  }

  /**
   * 启动执行时间计时器
   */
  private startExecutionTimer(): void {
    this.executionTimeTimer = setInterval(() => {
      // 每秒更新运行中任务的执行时间
      for (const [taskId] of this.runningTasks) {
        taskRepository.incrementExecutionTime(taskId, 1000);
      }
      
      // 更新当前会话运行时间
      if (this.runningTasks.size > 0) {
        this.currentSessionRunTime += 1000;
      }
    }, 1000);
  }

  /**
   * 启动运行时间定期保存计时器（每10秒保存一次）
   */
  private startRunTimeSaveTimer(): void {
    this.runTimeSaveTimer = setInterval(() => {
      this.saveRunTime();
    }, 10000);
  }

  /**
   * 保存运行时间到数据库
   */
  private saveRunTime(): void {
    if (!this.config) return;
    
    const totalRunTime = (this.config.totalRunTime || 0) + this.currentSessionRunTime;
    configRepository.set('totalRunTime', totalRunTime);
    configRepository.set('sessionStartTime', this.sessionStartTime);
    
    // 重置当前会话时间
    this.config.totalRunTime = totalRunTime;
    this.currentSessionRunTime = 0;
  }

  /**
   * 获取总运行时间（包括当前会话）
   */
  getTotalRunTime(): number {
    const savedTime = this.config?.totalRunTime || 0;
    return savedTime + this.currentSessionRunTime;
  }

  /**
   * 获取运行中任务的进程信息
   */
  getRunningTaskProcesses(): Array<{ taskId: number; pid?: number; startTime: number }> {
    const processes: Array<{ taskId: number; pid?: number; startTime: number }> = [];
    for (const [taskId, executor] of this.runningTasks) {
      processes.push({
        taskId,
        pid: executor.pid,
        startTime: executor.startTime,
      });
    }
    return processes;
  }

  /**
   * 获取运行中任务的 PID 列表
   */
  getRunningPids(): number[] {
    const pids: number[] = [];
    for (const executor of this.runningTasks.values()) {
      if (executor.pid) {
        pids.push(executor.pid);
      }
    }
    return pids;
  }

  // ==================== 进程和文件辅助方法 ====================

  /**
   * 检查进程是否存在
   */
  private checkProcessExists(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 杀掉进程及其子进程（强制终止）
   */
  private killProcess(pid: number): void {
    try {
      // macOS/Linux: 使用 pkill 杀掉进程树
      if (process.platform === 'darwin' || process.platform === 'linux') {
        exec(`pkill -P ${pid}`, () => {});
        exec(`kill -9 ${pid}`, () => {});
      } else {
        // Windows: 使用 taskkill
        exec(`taskkill /pid ${pid} /T /F`, () => {});
      }
      
      console.log(`[TaskQueueManager] 已发送终止信号给进程 PID: ${pid}`);
    } catch (err) {
      console.log(`[TaskQueueManager] 杀掉进程失败: ${pid}`, err);
    }
  }

  /**
   * 检查文件是否存在
   */
  private fileExists(path: string): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(path);
    } catch {
      return false;
    }
  }

  /**
   * 清理临时文件
   */
  private cleanupTempFiles(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tempDirs = [
        path.join(os.tmpdir(), 'videostitcher-temp'),
        path.join(os.tmpdir(), 'videostitcher-preview'),
      ];
      
      for (const dir of tempDirs) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`[TaskQueueManager] 清理临时目录: ${dir}`);
        }
      }
    } catch (err) {
      console.error('[TaskQueueManager] 清理临时文件失败:', err);
    }
  }

  /**
   * 停止计时器
   */
  stop(): void {
    // 保存运行时间
    this.saveRunTime();
    
    if (this.executionTimeTimer) {
      clearInterval(this.executionTimeTimer);
      this.executionTimeTimer = null;
    }
    
    if (this.runTimeSaveTimer) {
      clearInterval(this.runTimeSaveTimer);
      this.runTimeSaveTimer = null;
    }

    if (this.systemStatsTimer) {
      clearInterval(this.systemStatsTimer);
      this.systemStatsTimer = null;
    }

    // 杀掉所有运行中的进程
    for (const executor of this.runningTasks.values()) {
      if (executor.pid) {
        this.killProcess(executor.pid);
        // 更新任务状态为 pending（下次可恢复）
        taskRepository.updateTaskStatus(executor.taskId, 'pending');
        taskRepository.clearTaskPid(executor.taskId);
      }
    }
    this.runningTasks.clear();

    // 清理临时文件
    this.cleanupTempFiles();
    
    console.log('[TaskQueueManager] 已停止，进程已清理，临时文件已删除');
  }

  // ==================== 状态广播 ====================

  /**
   * 启动状态广播（每1秒，广播所有状态）
   */
  private startSystemStatsBroadcast(): void {
    // 立即广播一次
    this.broadcastState();
    
    this.systemStatsTimer = setInterval(() => {
      this.broadcastState();
    }, 1000);
  }

  /**
   * 广播完整状态（每秒调用）
   */
  private async broadcastState(): Promise<void> {
    if (!this.mainWindow) return;

    try {
      // 1. 获取系统状态
      const [currentLoad, mem] = await Promise.all([
        si.currentLoad(),
        si.mem(),
      ]);

      // 2. 获取运行中任务的 PID
      const runningPids = this.getRunningPids();
      
      // 3. 使用 ProcessMonitor 获取任务进程统计（包含进程树）
      let totalCpu = 0;
      let totalMemory = 0;
      const processes: Array<{ pid: number; name: string; cpu: number; memory: number; memoryMB: string }> = [];
      
      if (runningPids.length > 0) {
        // 批量获取所有任务进程的统计（包含子进程）
        const taskStatsMap = await processMonitor.getBatchTaskProcessStats(runningPids);
        
        for (const [mainPid, stats] of taskStatsMap) {
          totalCpu += stats.totalCpu;
          totalMemory += stats.totalMemory;
          
          // 添加主进程信息
          processes.push({
            pid: mainPid,
            name: 'ffmpeg',
            cpu: stats.totalCpu,
            memory: stats.totalMemory,
            memoryMB: stats.totalMemoryMB.toFixed(1),
          });
        }
      }

      // 4. 获取任务统计（从数据库）
      const taskStats = taskRepository.getTaskStats();

      // 5. 获取任务列表（最多20条，优先显示运行中的任务）
      const runningTaskIds = Array.from(this.runningTasks.keys());
      const runningTasks = runningTaskIds
        .map(id => taskRepository.getTaskById(id))
        .filter((t): t is Task => t !== null)
        .map(t => ({
          ...t,
          files: taskRepository.getTaskFiles(t.id),
        }));
      
      // 获取其他任务填充到20条
      const runningCount = runningTasks.length;
      const remainingSlots = Math.max(0, 20 - runningCount);
      const excludeIds = runningTaskIds;
      
      let otherTasks: Task[] = [];
      if (remainingSlots > 0) {
        const result = taskRepository.getTasks({
          filter: { status: ['pending'] },
          sort: { field: 'createdAt', order: 'asc' },
          pageSize: remainingSlots,
        });
        otherTasks = result.tasks
          .filter(t => !excludeIds.includes(t.id))
          .map(t => ({
            ...t,
            files: taskRepository.getTaskFiles(t.id),
          }));
      }
      
      const allTasks = [...runningTasks, ...otherTasks];

      // 6. 组装完整状态
      const totalCores = currentLoad.cpus.length;
      const taskCpuCores = Math.round(totalCpu / 100 * 10) / 10;
      
      const state = {
        isPaused: this.config?.isPaused || false,
        runningCount: this.runningTasks.size,
        pendingCount: taskStats.pending,
        taskStats,
        tasks: allTasks, // 任务列表（运行中+待执行，最多20条）
        
        // 系统状态
        systemStats: {
          cpu: {
            usage: Math.round(currentLoad.currentLoad),
            cores: currentLoad.cpus.map((cpu: any) => Math.round(cpu.load)),
          },
          memory: {
            total: mem.total,
            used: mem.active || mem.used,
            usedPercent: Math.round(((mem.active || mem.used) / mem.total) * 100),
            totalGB: (mem.total / (1024 * 1024 * 1024)).toFixed(1),
            usedGB: ((mem.active || mem.used) / (1024 * 1024 * 1024)).toFixed(1),
          },
          taskProcess: {
            cpuCores: taskCpuCores, // 任务占用的核心数
            totalCores, // 总核心数
            totalMemoryMB: (totalMemory / (1024 * 1024)).toFixed(1),
          },
        },
        
        // 配置
        config: {
          maxConcurrentTasks: this.config?.maxConcurrentTasks || 2,
          threadsPerTask: this.config?.threadsPerTask || 4,
        },
      };

      this.mainWindow.webContents.send('task-center:state', state);
    } catch (err) {
      console.error('[TaskQueueManager] 广播状态失败:', err);
    }
  }

  /**
   * 广播日志
   */
  broadcastLog(taskId: number | 'task-center', taskType: string, message: string, level: 'info' | 'error' | 'warning' | 'success' = 'info'): void {
    if (!this.mainWindow) return;

    this.mainWindow.webContents.send('task-center:log', {
      taskId,
      taskType,
      message,
      level,
      timestamp: Date.now(),
    });
  }

  // ==================== 事件发送 ====================

  private sendTaskUpdated(taskId: number): void {
    const task = taskRepository.getTaskById(taskId);
    if (task && this.mainWindow) {
      this.mainWindow.webContents.send('task:updated', task);
    }
  }

  private sendTaskStarted(taskId: number): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:started', { taskId });
    }
  }

  private sendTaskProgress(event: { taskId: number; progress: number; step?: string }): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:progress', event);
    }
  }

  private sendTaskLog(taskId: number, log: any): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:log', { taskId, log });
    }
  }

  private sendTaskCompleted(taskId: number, outputs: TaskOutput[]): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:completed', { taskId, outputs });
    }
  }

  private sendTaskFailed(taskId: number, error: any): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:failed', { taskId, error });
    }
  }

  private sendTaskCancelled(taskId: number): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('task:cancelled', { taskId });
    }
  }
}

// 导出单例
export const taskQueueManager = new TaskQueueManager();
