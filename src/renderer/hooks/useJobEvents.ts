import { useEffect } from 'react';

/**
 * A+B 前后拼接任务事件数据类型定义（与 preload.ts 保持一致）
 */
export interface JobStartData {
  total: number;
  orientation: string;
  concurrency: number;
}

export interface JobTaskStartData {
  index: number;
}

export interface JobLogData {
  msg: string;
}

export interface JobProgressData {
  done: number;
  failed: number;
  total: number;
  index: number;
  outPath: string;
}

export interface JobFailedData {
  done: number;
  failed: number;
  total: number;
  index: number;
  error: string;
}

export interface JobFinishData {
  done: number;
  failed: number;
  total: number;
}

/**
 * A+B 前后拼接任务事件处理器
 */
export interface JobEventHandlers {
  /** 处理开始 */
  onStart?: (data: JobStartData) => void;
  /** 单个任务开始 */
  onTaskStart?: (data: JobTaskStartData) => void;
  /** 日志消息 */
  onLog?: (data: JobLogData) => void;
  /** 处理进度更新 */
  onProgress?: (data: JobProgressData) => void;
  /** 单个任务失败 */
  onFailed?: (data: JobFailedData) => void;
  /** 所有任务完成 */
  onFinish?: (data: JobFinishData) => void;
}

/**
 * A+B 前后拼接任务事件 Hook
 *
 * 监听 A+B 前后拼接相关的事件，自动管理监听器的注册和清理
 *
 * @example
 * ```tsx
 * useJobEvents({
 *   onStart: (data) => {
 *     addLog(`开始处理 ${data.total} 个合成任务...`);
 *   },
 *   onTaskStart: (data) => {
 *     console.log('任务开始:', data.index);
 *   },
 *   onLog: (data) => {
 *     addLog(data.msg);
 *   },
 *   onProgress: (data) => {
 *     setProgress({ done: data.done, failed: data.failed, total: data.total });
 *   },
 *   onFailed: (data) => {
 *     addLog(`[错误] 任务 #${data.index + 1} 处理失败: ${data.error}`, 'error');
 *   },
 *   onFinish: (data) => {
 *     addLog(`所有任务完成! 成功: ${data.done}, 失败: ${data.failed}`, 'success');
 *   },
 * });
 * ```
 */
export function useJobEvents(handlers: JobEventHandlers) {
  const { onStart, onTaskStart, onLog, onProgress, onFailed, onFinish } = handlers;

  useEffect(() => {
    // 注册所有监听器
    const unsubscribers: (() => void)[] = [];

    if (onStart) {
      window.api.onJobStart(onStart);
      unsubscribers.push(() => window.api.removeAllListeners('job-start'));
    }

    if (onTaskStart) {
      window.api.onJobTaskStart(onTaskStart);
      unsubscribers.push(() => window.api.removeAllListeners('job-task-start'));
    }

    if (onLog) {
      window.api.onJobLog(onLog);
      unsubscribers.push(() => window.api.removeAllListeners('job-log'));
    }

    if (onProgress) {
      window.api.onJobProgress(onProgress);
      unsubscribers.push(() => window.api.removeAllListeners('job-progress'));
    }

    if (onFailed) {
      window.api.onJobFailed(onFailed);
      unsubscribers.push(() => window.api.removeAllListeners('job-failed'));
    }

    if (onFinish) {
      window.api.onJobFinish(onFinish);
      unsubscribers.push(() => window.api.removeAllListeners('job-finish'));
    }

    // 清理函数：移除所有监听器
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onStart, onTaskStart, onLog, onProgress, onFailed, onFinish]);
}
