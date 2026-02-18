/**
 * 任务日志仓库
 * 负责任务日志的存取
 */

import { getDatabase } from '../index';
import type { TaskLog, LogLevel } from '@shared/types/task';

export class TaskLogRepository {
  /**
   * 添加日志
   */
  addLog(
    taskId: number,
    log: {
      level?: LogLevel;
      message: string;
      raw?: string;
    }
  ): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO task_logs (task_id, timestamp, level, message, raw)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(taskId, Date.now(), log.level ?? 'info', log.message, log.raw ?? null);
  }

  /**
   * 获取任务日志
   */
  getTaskLogs(
    taskId: number,
    options: { limit?: number; offset?: number } = {}
  ): TaskLog[] {
    const db = getDatabase();
    const { limit = 1000, offset = 0 } = options;

    const stmt = db.prepare(`
      SELECT * FROM task_logs
      WHERE task_id = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(taskId, limit, offset) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as number,
      taskId: row.task_id as number,
      timestamp: row.timestamp as number,
      level: row.level as LogLevel,
      message: row.message as string,
      raw: (row.raw as string) ?? undefined,
    }));
  }

  /**
   * 清除任务日志
   */
  clearTaskLogs(taskId: number): void {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM task_logs WHERE task_id = ?');
    stmt.run(taskId);
  }

  /**
   * 清除所有日志
   */
  clearAllLogs(): number {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM task_logs');
    const result = stmt.run();
    return result.changes;
  }

  /**
   * 获取日志数量
   */
  getLogCount(taskId?: number): number {
    const db = getDatabase();

    if (taskId) {
      const stmt = db.prepare('SELECT COUNT(*) as count FROM task_logs WHERE task_id = ?');
      const row = stmt.get(taskId) as { count: number };
      return row.count;
    }

    const stmt = db.prepare('SELECT COUNT(*) as count FROM task_logs');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  /**
   * 获取最近的日志（用于任务中心初始化）
   */
  getRecentLogs(limit: number = 100): Array<TaskLog & { taskType?: string }> {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT tl.*, t.type as task_type
      FROM task_logs tl
      LEFT JOIN tasks t ON tl.task_id = t.id
      ORDER BY tl.timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as Record<string, unknown>[];
    
    // 反转顺序，让时间最早的在前面
    return rows.reverse().map((row) => ({
      id: row.id as number,
      taskId: row.task_id as number,
      timestamp: row.timestamp as number,
      level: row.level as LogLevel,
      message: row.message as string,
      raw: (row.raw as string) ?? undefined,
      taskType: row.task_type as string | undefined,
    }));
  }
}

// 导出单例
export const taskLogRepository = new TaskLogRepository();
