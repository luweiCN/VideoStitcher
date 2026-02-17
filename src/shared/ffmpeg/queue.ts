/**
 * 任务队列模块
 * 控制并发任务执行
 */

interface QueueItem {
  taskFn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export class TaskQueue {
  private _concurrency: number;
  private running: number;
  private queue: QueueItem[];
  private stopped: boolean;

  constructor(concurrency: number = 2) {
    this._concurrency = Math.max(1, concurrency);
    this.running = 0;
    this.queue = [];
    this.stopped = false;
  }

  /** 获取当前并发数 */
  get concurrency(): number {
    return this._concurrency;
  }

  setConcurrency(n: number): void {
    this._concurrency = Math.max(1, n);
    this._drain();
  }

  stop(): void {
    this.stopped = true;
  }

  start(): void {
    this.stopped = false;
    this._drain();
  }

  push<T = unknown>(taskFn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        taskFn: taskFn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this._drain();
    });
  }

  private _drain(): void {
    if (this.stopped) return;
    while (this.running < this._concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      const { taskFn, resolve, reject } = item;
      this.running++;
      Promise.resolve()
        .then(taskFn)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._drain();
        });
    }
  }
}
