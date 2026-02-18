/**
 * 任务日志仓库
 * 负责任务日志的存取
 */

import { getDatabase } from '../index';
import type { TaskLog, LogLevel } from '@shared/types/task';

/**
 * ID 生成器
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export class TaskLogRepository {
  /**
   * 添加日志
   */
  addLog(
    taskId: string,
    log: {
      level?: LogLevel;
      message: string;
      raw?: string;
    }
  ): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO task_logs (id, task_id, timestamp, level, message, raw)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(generateId(), taskId, Date.now(), log.level ?? 'info', log.message, log.raw ?? null);
  }

  /**
   * 获取任务日志
   */
  getTaskLogs(
    taskId: string,
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
      id: row.id as string,
      taskId: row.task_id as string,
      timestamp: row.timestamp as number,
      level: row.level as LogLevel,
      message: row.message as string,
      raw: (row.raw as string) ?? undefined,
    }));
  }

  /**
   * 清除任务日志
   */
  clearTaskLogs(taskId: string): void {
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
  getLogCount(taskId?: string): number {
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
}

// 导出单例
export const taskLogRepository = new TaskLogRepository();
