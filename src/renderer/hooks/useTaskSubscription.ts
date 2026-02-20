/**
 * 任务订阅 Hook
 * 
 * 封装任务状态变化的监听逻辑，支持订阅特定任务或所有任务
 */

import { useEffect, useRef } from 'react';
import type { Task, TaskLog } from '@shared/types/task';

interface UseTaskSubscriptionOptions {
  /** 订阅特定任务ID，不传则订阅所有任务 */
  taskId?: number;
  /** 任务更新回调 */
  onTaskUpdated?: (task: Task) => void;
  /** 任务开始运行回调 */
  onTaskStarted?: (data: { taskId: number }) => void;
  /** 任务进度更新回调 */
  onTaskProgress?: (data: { taskId: number; progress: number; step?: string }) => void;
  /** 任务日志回调 */
  onTaskLog?: (data: { taskId: number; log: TaskLog }) => void;
  /** 任务完成回调 */
  onTaskCompleted?: (data: { taskId: number; outputs: any[] }) => void;
  /** 任务失败回调 */
  onTaskFailed?: (data: { taskId: number; error: any }) => void;
  /** 任务取消回调 */
  onTaskCancelled?: (data: { taskId: number }) => void;
  /** 任务创建回调 */
  onTaskCreated?: (task: Task) => void;
  /** 任务删除回调 */
  onTaskDeleted?: (taskId: number) => void;
}

/**
 * 任务订阅 Hook
 * 
 * @example
 * // 订阅特定任务
 * useTaskSubscription({
 *   taskId: 123,
 *   onTaskUpdated: (task) => setTask(task),
 *   onTaskLog: (data) => addLog(data.log),
 * });
 * 
 * // 订阅所有任务
 * useTaskSubscription({
 *   onTaskUpdated: (task) => console.log('Task updated:', task.id),
 * });
 */
export function useTaskSubscription(options: UseTaskSubscriptionOptions) {
  const {
    taskId,
    onTaskUpdated,
    onTaskStarted,
    onTaskProgress,
    onTaskLog,
    onTaskCompleted,
    onTaskFailed,
    onTaskCancelled,
    onTaskCreated,
    onTaskDeleted,
  } = options;

  const cleanupRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // 任务更新
    if (onTaskUpdated) {
      const cleanup = window.api.onTaskUpdated((task: Task) => {
        if (taskId === undefined || task.id === taskId) {
          onTaskUpdated(task);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务开始运行
    if (onTaskStarted) {
      const cleanup = window.api.onTaskStarted((data: { taskId: number }) => {
        if (taskId === undefined || data.taskId === taskId) {
          onTaskStarted(data);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务进度更新
    if (onTaskProgress) {
      const cleanup = window.api.onTaskProgress((data: { taskId: number; progress: number; step?: string }) => {
        if (taskId === undefined || data.taskId === taskId) {
          onTaskProgress(data);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务日志
    if (onTaskLog) {
      const cleanup = window.api.onTaskLog((data: { taskId: number; log: TaskLog }) => {
        if (taskId === undefined || data.taskId === taskId) {
          onTaskLog(data);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务完成
    if (onTaskCompleted) {
      const cleanup = window.api.onTaskCompleted((data: { taskId: number; outputs: any[] }) => {
        if (taskId === undefined || data.taskId === taskId) {
          onTaskCompleted(data);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务失败
    if (onTaskFailed) {
      const cleanup = window.api.onTaskFailed((data: { taskId: number; error: any }) => {
        if (taskId === undefined || data.taskId === taskId) {
          onTaskFailed(data);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务取消
    if (onTaskCancelled) {
      const cleanup = window.api.onTaskCancelled((data: { taskId: number }) => {
        if (taskId === undefined || data.taskId === taskId) {
          onTaskCancelled(data);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务创建
    if (onTaskCreated) {
      const cleanup = window.api.onTaskCreated((task: Task) => {
        if (taskId === undefined || task.id === taskId) {
          onTaskCreated(task);
        }
      });
      cleanups.push(cleanup);
    }

    // 任务删除
    if (onTaskDeleted) {
      const cleanup = window.api.onTaskDeleted((id: number) => {
        if (taskId === undefined || id === taskId) {
          onTaskDeleted(id);
        }
      });
      cleanups.push(cleanup);
    }

    cleanupRef.current = cleanups;

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, [
    taskId,
    onTaskUpdated,
    onTaskStarted,
    onTaskProgress,
    onTaskLog,
    onTaskCompleted,
    onTaskFailed,
    onTaskCancelled,
    onTaskCreated,
    onTaskDeleted,
  ]);

  return {
    /** 手动清理所有监听 */
    cleanup: () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    },
  };
}
