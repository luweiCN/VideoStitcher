class TaskQueue {
  constructor(concurrency = 2) {
    this.concurrency = Math.max(1, concurrency);
    this.running = 0;
    this.queue = [];
    this.stopped = false;
  }

  setConcurrency(n) {
    this.concurrency = Math.max(1, n);
    this._drain();
  }

  stop() {
    this.stopped = true;
  }

  start() {
    this.stopped = false;
    this._drain();
  }

  push(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this._drain();
    });
  }

  _drain() {
    if (this.stopped) return;
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { taskFn, resolve, reject } = this.queue.shift();
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

module.exports = { TaskQueue };
