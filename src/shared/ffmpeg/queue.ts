/**
 * 任务队列模块
 * 控制并发任务执行
 */

interface QueueItem {
  taskFn: () => Promise<void>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export class TaskQueue {
  concurrency: number;
  running: number;
  queue: QueueItem[];
  stopped: boolean;

  constructor(concurrency: number = 2) {
    this.concurrency = Math.max(1, concurrency);
    this.running = 0;
    this.queue = [];
    this.stopped = false;
  }

  setConcurrency(n: number): void {
    this.concurrency = Math.max(1, n);
    this._drain();
  }

  stop(): void {
    this.stopped = true;
  }

  start(): void {
    this.stopped = false;
    this._drain();
  }

  push(taskFn: () => Promise<void>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this._drain();
    });
  }

  _drain(): void {
    if (this.stopped) return;
    while (this.running < this.concurrency && this.queue.length > 0) {
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
