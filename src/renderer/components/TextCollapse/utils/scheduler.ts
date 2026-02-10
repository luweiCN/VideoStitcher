/**
 * 批量测量调度器
 *
 * 合并多次测量请求，提升性能
 * 使用 requestAnimationFrame 批量处理
 */

import { SCHEDULER_DELAY, RAF_TIMEOUT } from '../constants';

/**
 * 测量任务
 */
interface MeasureTask {
  id: string;
  fn: () => void;
  priority: number; // 越小优先级越高
}

/**
 * 批量调度器类
 */
export class MeasureScheduler {
  private tasks: Map<string, MeasureTask>;
  private rafId: number | null;
  private timerId: ReturnType<typeof setTimeout> | null;
  private isScheduled: boolean;

  constructor() {
    this.tasks = new Map();
    this.rafId = null;
    this.timerId = null;
    this.isScheduled = false;
  }

  /**
   * 添加测量任务
   */
  schedule(id: string, fn: () => void, priority: number = 0): void {
    this.tasks.set(id, { id, fn, priority });
    this.scheduleRun();
  }

  /**
   * 取消测量任务
   */
  cancel(id: string): void {
    this.tasks.delete(id);
  }

  /**
   * 调度执行
   */
  private scheduleRun(): void {
    if (this.isScheduled) return;

    this.isScheduled = true;

    // 使用 RAF + setTimeout 双重保险
    this.rafId = requestAnimationFrame(() => {
      this.timerId = setTimeout(() => {
        this.run();
      }, SCHEDULER_DELAY);
    });

    // 超时保护
    setTimeout(() => {
      if (this.isScheduled) {
        this.cancelRun();
        this.run();
      }
    }, RAF_TIMEOUT);
  }

  /**
   * 取消调度
   */
  private cancelRun(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * 执行所有任务
   */
  private run(): void {
    this.isScheduled = false;
    this.cancelRun();

    if (this.tasks.size === 0) return;

    // 按优先级排序
    const sortedTasks = Array.from(this.tasks.values()).sort(
      (a, b) => a.priority - b.priority
    );

    // 清空任务列表
    this.tasks.clear();

    // 执行所有任务
    for (const task of sortedTasks) {
      try {
        task.fn();
      } catch (error) {
        console.error('[MeasureScheduler] Task execution error:', error);
      }
    }
  }

  /**
   * 销毁调度器
   */
  destroy(): void {
    this.cancelRun();
    this.tasks.clear();
  }
}

/**
 * 默认调度器实例
 */
export const defaultScheduler = new MeasureScheduler();

/**
 * 调度测量任务
 */
export function scheduleMeasure(id: string, fn: () => void, priority?: number): void {
  defaultScheduler.schedule(id, fn, priority);
}

/**
 * 取消测量任务
 */
export function cancelMeasure(id: string): void {
  defaultScheduler.cancel(id);
}
