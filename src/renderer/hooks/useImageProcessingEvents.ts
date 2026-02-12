import { useEffect } from 'react';

/**
 * 图片处理事件数据类型定义
 */
export interface ImageStartData {
  total: number;
  mode: string;
}

/**
 * 单个任务开始处理
 */
export interface ImageTaskStartData {
  /** 任务索引 */
  index: number;
  /** 任务标识 */
  taskId?: string;
}

export interface ImageProgressData {
  done: number;
  failed: number;
  total: number;
  current: string;
}

export interface ImageFailedData {
  current: string;
  error: string;
}

export interface ImageFinishData {
  done: number;
  failed: number;
}

/**
 * 单个任务完成处理
 */
export interface ImageTaskFinishData {
  /** 任务索引 */
  index: number;
  /** 任务标识 */
  taskId?: string;
}

/**
 * 图片处理事件处理器
 */
export interface ImageProcessingHandlers {
  /** 处理开始 */
  onStart?: (data: ImageStartData) => void;
  /** 单个任务开始 */
  onTaskStart?: (data: ImageTaskStartData) => void;
  /** 处理进度更新 */
  onProgress?: (data: ImageProgressData) => void;
  /** 单个任务失败 */
  onFailed?: (data: ImageFailedData) => void;
  /** 所有任务完成 */
  onFinish?: (data: ImageFinishData) => void;
  /** 单个任务完成 */
  onTaskFinish?: (data: ImageTaskFinishData) => void;
}

/**
 * 图片处理事件 Hook
 *
 * 监听图片处理相关的事件，自动管理监听器的注册和清理
 *
 * @example
 * ```tsx
 * useImageProcessingEvents({
 *   onStart: (data) => {
 *     addLog(`开始处理: 总任务 ${data.total}, 模式: ${data.mode}`);
 *   },
 *   onTaskStart: (data) => {
 *     console.log('任务开始:', data.index);
 *   },
 *   onProgress: (data) => {
 *     addLog(`进度: ${data.done}/${data.total}`);
 *   },
 *   onFailed: (data) => {
 *     addLog(`❌ 处理失败: ${data.current} - ${data.error}`, 'error');
 *   },
 *   onFinish: (data) => {
 *     addLog(`✅ 完成! 成功 ${data.done}, 失败 ${data.failed}`, 'success');
 *   },
 * });
 * ```
 */
export function useImageProcessingEvents(handlers: ImageProcessingHandlers) {
  const { onStart, onTaskStart, onProgress, onFailed, onFinish, onTaskFinish } = handlers;

  useEffect(() => {
    // 注册所有监听器
    const unsubscribers: (() => void)[] = [];

    if (onStart) {
      window.api.onImageStart(onStart);
      unsubscribers.push(() => window.api.removeAllListeners('image-start'));
    }

    if (onTaskStart) {
      window.api.onImageTaskStart(onTaskStart);
      unsubscribers.push(() => window.api.removeAllListeners('image-task-start'));
    }

    if (onProgress) {
      window.api.onImageProgress(onProgress);
      unsubscribers.push(() => window.api.removeAllListeners('image-progress'));
    }

    if (onFailed) {
      window.api.onImageFailed(onFailed);
      unsubscribers.push(() => window.api.removeAllListeners('image-failed'));
    }

    if (onFinish) {
      window.api.onImageFinish(onFinish);
      unsubscribers.push(() => window.api.removeAllListeners('image-finish'));
    }

    if (onTaskFinish) {
      window.api.onImageTaskFinish(onTaskFinish);
      unsubscribers.push(() => window.api.removeAllListeners('image-task-finish'));
    }

    // 清理函数：移除所有监听器
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [onStart, onTaskStart, onProgress, onFailed, onFinish, onTaskFinish]);
}
