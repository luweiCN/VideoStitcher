/**
 * 任务中心上下文
 * 提供全局任务状态管理
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  Task,
  TaskStats,
  TaskCenterConfig,
  CreateTaskRequest,
  CreateTaskResponse,
  BatchCreateTaskResponse,
  TaskListOptions,
  QueueStatus,
  CpuInfo,
} from '@shared/types/task';

interface TaskContextValue {
  // 状态
  runningTasks: Task[];
  stats: TaskStats | null;
  config: TaskCenterConfig | null;
  queueStatus: QueueStatus | null;
  loading: boolean;
  error: string | null;
  totalRunTime: number;
  isPaused: boolean;

  // 操作
  createTask: (request: CreateTaskRequest) => Promise<CreateTaskResponse>;
  batchCreateTasks: (tasks: Task[]) => Promise<BatchCreateTaskResponse>;
  startTask: (taskId: string) => Promise<void>;
  pauseTask: (taskId: string) => Promise<void>;
  resumeTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  pauseAllTasks: () => Promise<void>;
  resumeAllTasks: () => Promise<void>;
  cancelAllTasks: () => Promise<void>;

  // 配置
  updateConfig: (config: Partial<TaskCenterConfig>) => Promise<void>;
  setConcurrency: (maxConcurrentTasks?: number, threadsPerTask?: number) => Promise<void>;
  refreshConfig: () => Promise<void>;
  refreshQueueStatus: () => Promise<void>;

  // 工具
  getCpuInfo: () => Promise<CpuInfo>;
  formatRunTime: () => string;
}

const TaskContext = createContext<TaskContextValue | null>(null);

export function useTaskContext(): TaskContextValue {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskCenterProvider');
  }
  return context;
}

interface TaskCenterProviderProps {
  children: React.ReactNode;
}

export function TaskCenterProvider({ children }: TaskCenterProviderProps) {
  const [runningTasks, setRunningTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [config, setConfig] = useState<TaskCenterConfig | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRunTime, setTotalRunTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const runTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 刷新配置
  const refreshConfig = useCallback(async () => {
    try {
      const result = await window.api.getTaskConfig();
      setConfig(result);
      // 恢复保存的运行时间
      if (result.totalRunTime) {
        runTimeRef.current = result.totalRunTime;
        setTotalRunTime(result.totalRunTime);
      }
      // 恢复暂停状态
      setIsPaused(result.isPaused || false);
    } catch (err) {
      console.error('[TaskContext] 刷新配置失败:', err);
    }
  }, []);

  // 刷新队列状态
  const refreshQueueStatus = useCallback(async () => {
    try {
      const result = await window.api.getQueueStatus();
      setQueueStatus(result);
    } catch (err) {
      console.error('[TaskContext] 刷新队列状态失败:', err);
    }
  }, []);

  // 获取 CPU 信息
  const getCpuInfo = useCallback(async () => {
    return window.api.getCpuInfo();
  }, []);

  // 创建任务
  const createTask = useCallback(async (request: CreateTaskRequest): Promise<CreateTaskResponse> => {
    try {
      const result = await window.api.createTask(request);
      return result;
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, []);

  // 批量创建任务
  const batchCreateTasks = useCallback(async (tasks: Task[]): Promise<BatchCreateTaskResponse> => {
    try {
      const result = await window.api.batchCreateTasks(tasks);
      return result;
    } catch (err) {
      return {
        success: false,
        tasks: [],
        successCount: 0,
        failCount: tasks.length,
        errors: [{ index: -1, error: (err as Error).message }],
      };
    }
  }, []);

  // 开始任务
  const startTask = useCallback(async (taskId: string) => {
    await window.api.startTask(taskId);
  }, []);

  // 暂停任务
  const pauseTask = useCallback(async (taskId: string) => {
    await window.api.pauseTask(taskId);
  }, []);

  // 恢复任务
  const resumeTask = useCallback(async (taskId: string) => {
    await window.api.resumeTask(taskId);
  }, []);

  // 取消任务
  const cancelTask = useCallback(async (taskId: string) => {
    await window.api.cancelTask(taskId);
  }, []);

  // 重试任务
  const retryTask = useCallback(async (taskId: string) => {
    await window.api.retryTask(taskId);
  }, []);

  // 删除任务
  const deleteTask = useCallback(async (taskId: string) => {
    await window.api.deleteTask(taskId);
  }, []);

  // 暂停所有任务
  const pauseAllTasks = useCallback(async () => {
    await window.api.pauseAllTasks();
    setIsPaused(true);
    await refreshQueueStatus();
  }, [refreshQueueStatus]);

  // 恢复所有任务
  const resumeAllTasks = useCallback(async () => {
    await window.api.startAllTasks();
    setIsPaused(false);
    await refreshQueueStatus();
  }, [refreshQueueStatus]);

  // 取消所有任务
  const cancelAllTasks = useCallback(async () => {
    await window.api.cancelAllTasks();
    await refreshQueueStatus();
  }, [refreshQueueStatus]);

  // 更新配置
  const updateConfig = useCallback(async (newConfig: Partial<TaskCenterConfig>) => {
    await window.api.setTaskConfig(newConfig);
    await refreshConfig();
  }, [refreshConfig]);

  // 设置并发参数
  const setConcurrency = useCallback(async (maxConcurrentTasks?: number, threadsPerTask?: number) => {
    const updateData: { maxConcurrentTasks?: number; threadsPerTask?: number } = {};
    if (maxConcurrentTasks !== undefined) updateData.maxConcurrentTasks = maxConcurrentTasks;
    if (threadsPerTask !== undefined) updateData.threadsPerTask = threadsPerTask;

    await window.api.setConcurrency(updateData);
    await refreshConfig();
    await refreshQueueStatus();
  }, [refreshConfig, refreshQueueStatus]);

  // 格式化运行时间
  const formatRunTime = useCallback((): string => {
    const seconds = Math.floor(totalRunTime / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [totalRunTime]);

  // 监听任务事件
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // 任务创建 - 只监控执行中的任务（running）
    cleanups.push(
      window.api.onTaskCreated((task: Task) => {
        if (task.status === 'running') {
          setRunningTasks((prev) => {
            if (prev.find((t) => t.id === task.id)) return prev;
            return [...prev, task];
          });
        }
      })
    );

    // 任务更新
    cleanups.push(
      window.api.onTaskUpdated((task: Task) => {
        setRunningTasks((prev) => {
          // 任务开始运行时添加
          if (task.status === 'running') {
            if (prev.find((t) => t.id === task.id)) {
              return prev.map((t) => (t.id === task.id ? task : t));
            }
            return [...prev, task];
          }
          // 任务不再是运行中时移除
          return prev.filter((t) => t.id !== task.id);
        });
      })
    );

    // 任务删除
    cleanups.push(
      window.api.onTaskDeleted((taskId: string) => {
        setRunningTasks((prev) => prev.filter((t) => t.id !== taskId));
      })
    );

    // 任务开始运行
    cleanups.push(
      window.api.onTaskStarted(async (data: { taskId: string }) => {
        // 获取任务详情并添加到运行列表
        const task = await window.api.getTask(data.taskId);
        if (task && task.status === 'running') {
          setRunningTasks((prev) => {
            if (prev.find((t) => t.id === task.id)) return prev;
            return [...prev, task as Task];
          });
        }
      })
    );

    // 任务进度
    cleanups.push(
      window.api.onTaskProgress((data: { taskId: string; progress: number; step?: string }) => {
        setRunningTasks((prev) =>
          prev.map((t) =>
            t.id === data.taskId
              ? { ...t, progress: data.progress, currentStep: data.step }
              : t
          )
        );
      })
    );

    // 任务完成
    cleanups.push(
      window.api.onTaskCompleted((data: { taskId: string; outputs: any[] }) => {
        setRunningTasks((prev) => prev.filter((t) => t.id !== data.taskId));
        refreshQueueStatus();
      })
    );

    // 任务失败
    cleanups.push(
      window.api.onTaskFailed((data: { taskId: string; error: any }) => {
        setRunningTasks((prev) => prev.filter((t) => t.id !== data.taskId));
        refreshQueueStatus();
      })
    );

    // 任务取消
    cleanups.push(
      window.api.onTaskCancelled((data: { taskId: string }) => {
        setRunningTasks((prev) => prev.filter((t) => t.id !== data.taskId));
        refreshQueueStatus();
      })
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [refreshQueueStatus]);

  // 运行时间计时器
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (runningTasks.length > 0) {
        runTimeRef.current += 1000;
        setTotalRunTime(runTimeRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [runningTasks.length]);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await refreshConfig();
        await refreshQueueStatus();
        
        // 加载正在运行中的任务（只有 running 状态的任务显示日志）
        const result = await window.api.getTasks({
          filter: { status: ['running'] },
          withFiles: true,
        });
        if (result.success && result.tasks.length > 0) {
          setRunningTasks(result.tasks as Task[]);
        }
        // 设置统计数据
        if (result.stats) {
          setStats(result.stats as TaskStats);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [refreshConfig, refreshQueueStatus]);

  // 定期刷新队列状态
  useEffect(() => {
    const interval = setInterval(refreshQueueStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshQueueStatus]);

  const value: TaskContextValue = {
    runningTasks,
    stats,
    config,
    queueStatus,
    loading,
    error,
    totalRunTime,
    isPaused,
    createTask,
    batchCreateTasks,
    startTask,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    deleteTask,
    pauseAllTasks,
    resumeAllTasks,
    cancelAllTasks,
    updateConfig,
    setConcurrency,
    refreshConfig,
    refreshQueueStatus,
    getCpuInfo,
    formatRunTime,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
