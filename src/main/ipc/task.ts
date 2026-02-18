/**
 * 任务中心 IPC 处理器
 * 处理任务相关的 IPC 通信
 */

import { ipcMain, BrowserWindow } from 'electron';
import { taskRepository } from '../database/repositories/task.repository';
import { taskLogRepository } from '../database/repositories/task-log.repository';
import { configRepository } from '../database/repositories/config.repository';
import { taskQueueManager } from '../services/TaskQueueManager';
import type {
  CreateTaskRequest,
  TaskListOptions,
  TaskCenterConfig,
  Task,
} from '@shared/types/task';

/**
 * 注册任务相关 IPC 处理器
 */
export function registerTaskHandlers(): void {
  // ==================== 任务 CRUD ====================

  /**
   * 创建任务
   */
  ipcMain.handle('task:create', async (_event, request: CreateTaskRequest) => {
    try {
      const task = taskRepository.createTask({
        type: request.type,
        name: request.name,
        outputDir: request.outputDir,
        config: request.params,
        files: request.files.map(f => ({
          path: f.path,
          category: f.category,
          category_name: f.categoryLabel,
        })),
        priority: request.priority,
        maxRetry: request.maxRetry,
      });

      // 发送任务创建事件
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('task:created', task);
      });

      // 如果配置了自动开始，将任务加入队列
      const config = configRepository.getAll();
      if (config.autoStartTasks) {
        taskQueueManager.enqueue(task.id);
      }

      return { success: true, task };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 批量创建任务
   * 直接接受前端 Task 格式
   */
  ipcMain.handle('task:batch-create', async (_event, tasks: Array<{
    id?: string | number;
    type?: string;
    status?: string;
    files: Array<{ path: string; index?: number; category: string; category_name: string }>;
    config?: Record<string, unknown>;
    outputDir?: string;
  }>) => {
    try {
      const createdTasks: Task[] = [];
      const errors: { index: number; error: string }[] = [];

      // 获取配置
      const config = configRepository.getAll();

      for (let i = 0; i < tasks.length; i++) {
        try {
          const taskData = tasks[i];

          const task = taskRepository.createTask({
            type: taskData.type || 'video_merge',
            outputDir: taskData.outputDir || '',
            config: taskData.config || {},
            files: taskData.files.map((f) => ({
              path: f.path,
              category: f.category,
              category_name: f.category_name,
            })),
          });

          createdTasks.push(task);

          // 如果配置了自动开始，将任务加入队列
          if (config.autoStartTasks) {
            taskQueueManager.enqueue(task.id);
          }
        } catch (err) {
          errors.push({ index: i, error: (err as Error).message });
        }
      }

      // 批量发送任务创建事件
      if (createdTasks.length > 0) {
        BrowserWindow.getAllWindows().forEach((window) => {
          createdTasks.forEach((task) => {
            window.webContents.send('task:created', task);
          });
        });
      }

      return {
        success: true,
        tasks: createdTasks,
        successCount: createdTasks.length,
        failCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 获取单个任务
   */
  ipcMain.handle('task:get', async (_event, taskId: number) => {
    const task = taskRepository.getTaskById(taskId);
    if (task) {
      task.files = taskRepository.getTaskFiles(taskId);
      task.outputs = taskRepository.getTaskOutputs(taskId);
    }
    return task;
  });

  /**
   * 获取任务列表
   */
  ipcMain.handle('task:list', async (_event, options?: TaskListOptions) => {
    return taskRepository.getTasks(options);
  });

  /**
   * 删除任务
   */
  ipcMain.handle('task:delete', async (_event, taskId: number) => {
    try {
      // 先取消任务（如果在运行中）
      taskQueueManager.cancel(taskId);

      // 删除任务
      taskRepository.deleteTask(taskId);

      // 发送任务删除事件
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('task:deleted', taskId);
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 更新任务输出目录
   */
  ipcMain.handle('task:update-output-dir', async (_event, taskId: number, outputDir: string) => {
    try {
      const task = taskRepository.getTaskById(taskId);
      if (!task) {
        return { success: false, error: '任务不存在' };
      }

      taskRepository.updateTaskOutputDir(taskId, outputDir);

      // 发送任务更新事件
      const updatedTask = taskRepository.getTaskById(taskId);
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('task:updated', updatedTask);
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ==================== 任务控制 ====================

  /**
   * 开始任务
   */
  ipcMain.handle('task:start', async (_event, taskId: number) => {
    try {
      const task = taskRepository.getTaskById(taskId);
      if (!task) {
        return { success: false, error: '任务不存在' };
      }

      if (!['pending', 'failed', 'cancelled'].includes(task.status)) {
        return { success: false, error: '当前任务状态无法开始' };
      }

      taskQueueManager.enqueue(taskId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 取消任务
   */
  ipcMain.handle('task:cancel', async (_event, taskId: number) => {
    try {
      const success = taskQueueManager.cancel(taskId);
      return { success };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 重试任务
   */
  ipcMain.handle('task:retry', async (_event, taskId: number) => {
    try {
      const task = taskRepository.getTaskById(taskId);
      if (!task) {
        return { success: false, error: '任务不存在' };
      }

      if (!['failed', 'cancelled'].includes(task.status)) {
        return { success: false, error: '只有失败或已取消的任务可以重试' };
      }

      const success = taskQueueManager.retry(taskId);
      return { success };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ==================== 批量操作 ====================

  /**
   * 开始所有待执行任务（恢复任务中心）
   */
  ipcMain.handle('task:start-all', async () => {
    try {
      const count = taskQueueManager.resumeAll();
      return { success: true, count };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 暂停所有运行中任务
   */
  ipcMain.handle('task:pause-all', async () => {
    try {
      const count = taskQueueManager.pauseAll();
      return { success: true, count };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 取消所有未完成任务
   */
  ipcMain.handle('task:cancel-all', async () => {
    try {
      const count = taskQueueManager.cancelAll();
      return { success: true, count };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 清除已完成任务
   */
  ipcMain.handle('task:clear-completed', async (_event, beforeDays?: number) => {
    try {
      const count = taskRepository.deleteCompletedTasks(beforeDays ?? 0);
      return { success: true, count };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 清除失败任务
   */
  ipcMain.handle('task:clear-failed', async () => {
    try {
      const count = taskRepository.deleteFailedTasks();
      return { success: true, count };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ==================== 配置 ====================

  /**
   * 获取配置
   */
  ipcMain.handle('task:get-config', async () => {
    try {
      return configRepository.getAll();
    } catch (err) {
      console.error('[task:get-config] 数据库未就绪，返回默认配置');
      return {
        maxConcurrentTasks: 2,
        threadsPerTask: 4,
        autoStartTasks: true,
        autoRetryFailed: false,
        maxRetryCount: 3,
        showNotification: true,
        keepCompletedDays: 7,
        autoBackup: true,
        maxBackupCount: 5,
      };
    }
  });

  /**
   * 设置配置
   */
  ipcMain.handle('task:set-config', async (_event, config: Partial<TaskCenterConfig>) => {
    try {
      configRepository.setMany(config);
      taskQueueManager.updateConfig(config);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ==================== 并发控制 ====================

  /**
   * 实时设置并发参数
   */
  ipcMain.handle('task:set-concurrency', async (_event, config: {
    maxConcurrentTasks?: number;
    threadsPerTask?: number;
  }) => {
    try {
      taskQueueManager.updateConfig(config);
      return {
        success: true,
        config: taskQueueManager.getConfig(),
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  /**
   * 获取 CPU 信息
   */
  ipcMain.handle('task:get-cpu-info', async () => {
    const cpuInfo = taskQueueManager.getCpuInfo();
    const cores = cpuInfo.cores;

    return {
      cores,
      model: cpuInfo.model,
      recommendedConcurrency: {
        maxConcurrentTasks: Math.max(1, Math.floor(cores / 4)),
        threadsPerTask: Math.max(1, Math.min(cores - 1, 8)),
      },
    };
  });

  /**
   * 获取队列状态
   */
  ipcMain.handle('task:get-queue-status', async () => {
    return taskQueueManager.getQueueStatus();
  });

  // ==================== 日志 ====================

  /**
   * 获取任务日志
   */
  ipcMain.handle('task:get-logs', async (_event, taskId: number, options?: {
    limit?: number;
    offset?: number;
  }) => {
    return taskLogRepository.getTaskLogs(taskId, options);
  });

  /**
   * 获取最近日志（用于任务中心初始化）
   */
  ipcMain.handle('task:get-recent-logs', async (_event, limit?: number) => {
    return taskLogRepository.getRecentLogs(limit ?? 100);
  });

  /**
   * 清除任务日志
   */
  ipcMain.handle('task:clear-logs', async (_event, taskId: number) => {
    try {
      taskLogRepository.clearTaskLogs(taskId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}

/**
 * 设置任务队列管理器的主窗口
 */
export function setTaskQueueMainWindow(window: BrowserWindow): void {
  taskQueueManager.setMainWindow(window);
}

/**
 * 停止任务队列管理器
 */
export function stopTaskQueueManager(): void {
  taskQueueManager.stop();
}
