import { useEffect } from 'react';

/**
 * 视频处理事件数据类型定义（与 preload.ts 保持一致）
 */
export interface VideoStartData {
  total: number;
  mode: string;
  concurrency: number;
}

/**
 * 单个任务开始处理
 */
export interface VideoTaskStartData {
  /** 任务索引 */
  index: number;
  /** 任务标识 */
  taskId?: string;
}

export interface VideoProgressData {
  done: number;
  failed: number;
  total: number;
  index: number;
  outputPath: string;
}

export interface VideoFailedData {
  done: number;
  failed: number;
  total: number;
  index: number;
  error: string;
}

export interface VideoFinishData {
  done: number;
  failed: number;
  total: number;
}

export interface VideoLogData {
  index: number;
  message: string;
}

/**
 * 视频处理事件处理器
 */
export interface VideoProcessingHandlers {
  /** 处理开始 */
  onStart?: (data: VideoStartData) => void;
  /** 单个任务开始 */
  onTaskStart?: (data: VideoTaskStartData) => void;
  /** 处理进度更新 */
  onProgress?: (data: VideoProgressData) => void;
  /** 单个任务失败 */
  onFailed?: (data: VideoFailedData) => void;
  /** 所有任务完成 */
  onFinish?: (data: VideoFinishData) => void;
  /** 单个任务日志 */
  onLog?: (data: VideoLogData) => void;
}

/**
 * 视频处理事件 Hook
 *
 * 监听视频处理相关的事件，自动管理监听器的注册和清理
 *
 * @example
 * ```tsx
 * useVideoProcessingEvents({
 *   onStart: (data) => {
 *     addLog(`开始处理: 总任务 ${data.total}, 并发 ${data.concurrency}`);
 *   },
 *   onProgress: (data) => {
 *     addLog(`进度: ${data.done}/${data.total}`);
 *   },
 *   onFailed: (data) => {
 *     addLog(`❌ 任务 ${data.index + 1} 失败: ${data.error}`, 'error');
 *   },
 *   onFinish: (data) => {
 *     addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
 *   },
 *   onLog: (data) => {
 *     addLog(`[任务 ${data.index + 1}] ${data.message}`);
 *   },
 * });
 * ```
 */
export function useVideoProcessingEvents(handlers: VideoProcessingHandlers) {
  const { onStart, onTaskStart, onProgress, onFailed, onFinish, onLog } = handlers;

  useEffect(() => {
    // 注册所有监听器，收集清理函数
    const unsubscribers: (() => void)[] = [];

    if (onStart) {
      unsubscribers.push(window.api.onVideoStart(onStart));
    }

    if (onTaskStart) {
      unsubscribers.push(window.api.onVideoTaskStart(onTaskStart));
    }

    if (onProgress) {
      unsubscribers.push(window.api.onVideoProgress(onProgress));
    }

    if (onFailed) {
      unsubscribers.push(window.api.onVideoFailed(onFailed));
    }

    if (onFinish) {
      unsubscribers.push(window.api.onVideoFinish(onFinish));
    }

    if (onLog) {
      unsubscribers.push(window.api.onVideoLog(onLog));
    }

    // 清理函数：移除当前实例注册的监听器
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onStart, onTaskStart, onProgress, onFailed, onFinish, onLog]);
}
