/**
 * 任务仓库
 * 负责任务数据的 CRUD 操作
 */

import { getDatabase } from '../index';
import type {
  Task,
  TaskFile,
  TaskOutput,
  TaskStatus,
  TaskType,
  TaskStats,
  TaskListOptions,
  TaskListResult,
  TaskFilter,
  TaskError,
} from '@shared/types/task';

export class TaskRepository {
  // ==================== 创建 ====================

  /**
   * 创建任务
   * ID 由数据库自动生成（自增整数）
   */
  createTask(input: {
    type: TaskType | string;
    name?: string;
    outputDir: string;
    config?: Record<string, unknown>;
    files: { path: string; category: string; category_name: string }[];
    priority?: number;
    maxRetry?: number;
  }): Task {
    const db = getDatabase();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO tasks (
        type, name, status, priority,
        created_at, updated_at, output_dir, params,
        progress, retry_count, max_retry
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.type,
      input.name || '',
      'pending',
      input.priority ?? 0,
      now,
      now,
      input.outputDir,
      JSON.stringify(input.config || {}),
      0,
      0,
      input.maxRetry ?? 3
    );

    const id = result.lastInsertRowid as number;

    // 插入文件
    if (input.files.length > 0) {
      this.insertTaskFiles(id, input.files);
    }

    return this.getTaskById(id)!;
  }

  // ==================== 查询 ====================

  /**
   * 获取任务列表
   */
  getTasks(options: TaskListOptions = {}): TaskListResult {
    const db = getDatabase();
    const {
      filter = {},
      sort = { field: 'createdAt', order: 'desc' },
      page = 1,
      pageSize = 50,
      withFiles = false,
      withOutputs = false,
    } = options;

    // 构建 WHERE 条件
    const { whereClause, params } = this.buildWhereClause(filter);

    // 查询总数
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM tasks ${whereClause}`);
    const { count: total } = countStmt.get(...params) as { count: number };

    // 查询列表
    const sortField =
      sort.field === 'createdAt'
        ? 'created_at'
        : sort.field === 'updatedAt'
          ? 'updated_at'
          : sort.field;
    const offset = (page - 1) * pageSize;

    const listStmt = db.prepare(`
      SELECT * FROM tasks
      ${whereClause}
      ORDER BY ${sortField} ${sort.order}
      LIMIT ? OFFSET ?
    `);

    const rows = listStmt.all(...params, pageSize, offset) as Record<string, unknown>[];

    // 映射任务
    let tasks = rows.map((row) => this.mapRowToTask(row));

    // 加载关联数据
    if (withFiles) {
      tasks = tasks.map((task) => ({
        ...task,
        files: this.getTaskFiles(task.id),
      }));
    }
    if (withOutputs) {
      tasks = tasks.map((task) => ({
        ...task,
        outputs: this.getTaskOutputs(task.id),
      }));
    }

    // 获取统计
    const stats = this.getTaskStats();

    return {
      success: true,
      tasks,
      total,
      page,
      pageSize,
      stats,
    };
  }

  /**
   * 获取运行中的任务
   */
  getRunningTasks(): Task[] {
    const db = getDatabase();
    const stmt = db.prepare("SELECT * FROM tasks WHERE status = 'running'");
    const rows = stmt.all() as Record<string, unknown>[];

    return rows.map((row) => this.mapRowToTask(row));
  }

  /**
   * 获取任务文件
   */
  getTaskFiles(taskId: number): TaskFile[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM task_files
      WHERE task_id = ?
      ORDER BY sort_order
    `);
    const rows = stmt.all(taskId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as number,
      path: row.path as string,
      index: row.sort_order as number,
      category: row.category as string,
      category_name: row.category_label as string,
      sortOrder: row.sort_order as number,
    }));
  }

  /**
   * 获取任务输出
   */
  getTaskOutputs(taskId: number): TaskOutput[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM task_outputs WHERE task_id = ?');
    const rows = stmt.all(taskId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as number,
      path: row.path as string,
      type: row.type as 'video' | 'image' | 'other',
      size: (row.size as number) ?? undefined,
      createdAt: row.created_at as number,
    }));
  }

  /**
   * 获取任务统计
   */
  getTaskStats(): TaskStats {
    const db = getDatabase();
    
    // 统计各状态数量
    const countStmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `);
    const rows = countStmt.all() as { status: string; count: number }[];

    const stats: TaskStats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalExecutionTime: 0,
    };

    for (const row of rows) {
      if (row.status === 'queued' || row.status === 'paused') {
        stats.pending += row.count;
      } else if (row.status in stats) {
        stats[row.status as keyof TaskStats] = row.count;
      }
    }

    // 统计已完成任务的总执行时间
    const timeStmt = db.prepare(`
      SELECT COALESCE(SUM(execution_time), 0) as total_time
      FROM tasks
      WHERE status = 'completed' AND execution_time IS NOT NULL
    `);
    const timeRow = timeStmt.get() as { total_time: number };
    stats.totalExecutionTime = timeRow?.total_time || 0;

    return stats;
  }

  // ==================== 更新 ====================

  /**
   * 更新任务状态
   */
  updateTaskStatus(
    id: number,
    status: TaskStatus,
    extras?: {
      progress?: number;
      currentStep?: string;
      errorCode?: string;
      errorMessage?: string;
      errorStack?: string;
      executionTime?: number;
    }
  ): void {
    const db = getDatabase();
    const now = Date.now();

    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: unknown[] = [status, now];

    if (status === 'running') {
      updates.push('started_at = COALESCE(started_at, ?)');
      params.push(now);
    }

    if (['completed', 'failed', 'cancelled'].includes(status)) {
      updates.push('completed_at = ?');
      params.push(now);
    }

    if (extras) {
      if (extras.progress !== undefined) {
        updates.push('progress = ?');
        params.push(extras.progress);
      }
      if (extras.currentStep !== undefined) {
        updates.push('current_step = ?');
        params.push(extras.currentStep || null);
      }
      if (extras.errorCode !== undefined) {
        updates.push('error_code = ?');
        params.push(extras.errorCode || null);
      }
      if (extras.errorMessage !== undefined) {
        updates.push('error_message = ?');
        params.push(extras.errorMessage || null);
      }
      if (extras.errorStack !== undefined) {
        updates.push('error_stack = ?');
        params.push(extras.errorStack || null);
      }
      if (extras.executionTime !== undefined) {
        updates.push('execution_time = ?');
        params.push(extras.executionTime);
      }
    }

    params.push(id);

    const stmt = db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(id: number, progress: number, step?: string): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE tasks
      SET progress = ?, current_step = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(progress, step ?? null, Date.now(), id);
  }

  /**
   * 插入任务文件
   */
  private insertTaskFiles(taskId: number, files: { path: string; category: string; category_name: string }[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO task_files (task_id, path, category, category_label, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: typeof files) => {
      items.forEach((file, index) => {
        stmt.run(taskId, file.path, file.category, file.category_name, index);
      });
    });

    insertMany(files);
  }

  // ==================== 查询 ====================

  /**
   * 根据 ID 获取任务
   */
  getTaskById(id: number): Task | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.mapRowToTask(row);
  }

  /**
   * 更新任务 PID
   */
  updateTaskPid(id: number, pid: number): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE tasks SET pid = ?, pid_started_at = ?, updated_at = ? WHERE id = ?');
    stmt.run(pid, Date.now(), Date.now(), id);
  }

  /**
   * 更新任务输出目录
   */
  updateTaskOutputDir(id: number, outputDir: string): void {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE tasks SET output_dir = ?, updated_at = ? WHERE id = ?');
    stmt.run(outputDir, Date.now(), id);
  }

  /**
   * 清除任务 PID
   */
  clearTaskPid(id: number): void {
    const db = getDatabase();
    const now = Date.now();
    const stmt = db.prepare('UPDATE tasks SET pid = NULL, pid_started_at = NULL, started_at = NULL, updated_at = ? WHERE id = ?');
    stmt.run(now, id);
  }

  /**
   * 增加执行时间
   */
  incrementExecutionTime(id: number, milliseconds: number): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE tasks
      SET execution_time = COALESCE(execution_time, 0) + ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(milliseconds, Date.now(), id);
  }

  /**
   * 添加任务输出
   */
  addTaskOutput(
    taskId: number,
    output: { path: string; type: 'video' | 'image' | 'other'; size?: number }
  ): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO task_outputs (task_id, path, type, size, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(taskId, output.path, output.type, output.size ?? null, Date.now());
  }

  /**
   * 增加重试计数
   */
  incrementRetryCount(id: number): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE tasks SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?
    `);
    stmt.run(Date.now(), id);
  }

  // ==================== 删除 ====================

  /**
   * 删除任务
   */
  deleteTask(id: number): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 清理已完成任务
   */
  deleteCompletedTasks(beforeDays: number = 0): number {
    const db = getDatabase();
    const threshold =
      beforeDays > 0 ? Date.now() - beforeDays * 24 * 60 * 60 * 1000 : Date.now();

    const stmt = db.prepare("DELETE FROM tasks WHERE status = 'completed' AND completed_at < ?");
    const result = stmt.run(threshold);
    return result.changes;
  }

  /**
   * 清理失败任务
   */
  deleteFailedTasks(): number {
    const db = getDatabase();
    const stmt = db.prepare("DELETE FROM tasks WHERE status = 'failed'");
    const result = stmt.run();
    return result.changes;
  }

  /**
   * 清理已取消任务
   */
  deleteCancelledTasks(): number {
    const db = getDatabase();
    const stmt = db.prepare("DELETE FROM tasks WHERE status = 'cancelled'");
    const result = stmt.run();
    return result.changes;
  }

  // ==================== 工具方法 ====================

  /**
   * 构建 WHERE 子句
   */
  private buildWhereClause(filter: TaskFilter): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status && filter.status.length > 0) {
      conditions.push(`status IN (${filter.status.map(() => '?').join(',')})`);
      params.push(...filter.status);
    }

    if (filter.type && filter.type.length > 0) {
      conditions.push(`type IN (${filter.type.map(() => '?').join(',')})`);
      params.push(...filter.type);
    }

    if (filter.search) {
      conditions.push('name LIKE ?');
      params.push(`%${filter.search}%`);
    }

    if (filter.dateFrom) {
      conditions.push('created_at >= ?');
      params.push(filter.dateFrom);
    }

    if (filter.dateTo) {
      conditions.push('created_at <= ?');
      params.push(filter.dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, params };
  }

  /**
   * 映射数据库行到任务对象
   */
  private mapRowToTask(row: Record<string, unknown>): Task {
    const error: TaskError | undefined =
      row.error_message != null
        ? {
            code: (row.error_code as string) ?? undefined,
            message: row.error_message as string,
            stack: (row.error_stack as string) ?? undefined,
          }
        : undefined;

    return {
      id: row.id as number,
      type: row.type as TaskType,
      status: row.status as TaskStatus,
      name: row.name as string,
      priority: row.priority as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      startedAt: (row.started_at as number) ?? undefined,
      completedAt: (row.completed_at as number) ?? undefined,
      executionTime: (row.execution_time as number) ?? undefined,
      outputDir: row.output_dir as string,
      config: JSON.parse(row.params as string) as Record<string, unknown>,
      files: [],
      progress: row.progress as number,
      currentStep: (row.current_step as string) ?? undefined,
      retryCount: row.retry_count as number,
      maxRetry: row.max_retry as number,
      error,
      outputs: [],
      pid: (row.pid as number) ?? undefined,
      pidStartedAt: (row.pid_started_at as number) ?? undefined,
    };
  }
}

// 导出单例
export const taskRepository = new TaskRepository();
