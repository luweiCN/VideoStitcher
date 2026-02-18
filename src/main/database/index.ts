/**
 * 数据库初始化模块
 * 使用 better-sqlite3 进行本地数据持久化
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations';

let db: Database.Database | null = null;

/**
 * 获取数据库文件路径
 */
export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'VideoStitcher.db');
}

/**
 * 获取备份目录路径
 */
export function getBackupDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'backups');
}

/**
 * 初始化数据库
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  // 确保目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 检查是否是新数据库
  const isNewDatabase = !fs.existsSync(dbPath);

  // 创建数据库连接
  db = new Database(dbPath);

  // 性能优化配置
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB
  db.pragma('temp_store = MEMORY');

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 运行迁移
  runMigrations(db);

  // 新数据库初始化默认配置
  if (isNewDatabase) {
    initDefaultConfig(db);
  }

  console.log(`[数据库] 初始化完成: ${dbPath}`);

  return db;
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()');
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[数据库] 连接已关闭');
  }
}

/**
 * 初始化默认配置
 */
function initDefaultConfig(db: Database.Database): void {
  const now = Date.now();
  const defaults: [string, string][] = [
    ['maxConcurrentTasks', '2'],
    ['threadsPerTask', '4'],
    ['autoStartTasks', 'true'],
    ['autoRetryFailed', 'false'],
    ['maxRetryCount', '3'],
    ['keepCompletedDays', '7'],
    ['showNotification', 'true'],
    ['autoBackup', 'true'],
    ['maxBackupCount', '5'],
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO config (key, value, updated_at)
    VALUES (?, ?, ?)
  `);

  for (const [key, value] of defaults) {
    stmt.run(key, value, now);
  }

  console.log('[数据库] 默认配置已初始化');
}

/**
 * 检查数据库完整性
 */
export function checkIntegrity(): { healthy: boolean; errors: string[] } {
  const database = getDatabase();

  try {
    const result = database.pragma('integrity_check') as { integrity_check: string }[];

    if (result.length === 1 && result[0].integrity_check === 'ok') {
      return { healthy: true, errors: [] };
    }

    const errors = result
      .filter((r) => r.integrity_check !== 'ok')
      .map((r) => r.integrity_check);

    return { healthy: false, errors };
  } catch (err) {
    return {
      healthy: false,
      errors: [(err as Error).message],
    };
  }
}

/**
 * 获取数据库统计信息
 */
export function getDatabaseStats(): {
  fileSize: number;
  taskCount: number;
  logCount: number;
  outputCount: number;
  oldestTask: number | null;
  newestTask: number | null;
} {
  const database = getDatabase();
  const dbPath = getDatabasePath();

  const fileSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

  const taskCount = (
    database.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
  ).count;

  const logCount = (
    database.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number }
  ).count;

  const outputCount = (
    database.prepare('SELECT COUNT(*) as count FROM task_outputs').get() as { count: number }
  ).count;

  const oldestRow = database.prepare('SELECT MIN(created_at) as oldest FROM tasks').get() as {
    oldest: number | null;
  };
  const newestRow = database.prepare('SELECT MAX(created_at) as newest FROM tasks').get() as {
    newest: number | null;
  };

  return {
    fileSize,
    taskCount,
    logCount,
    outputCount,
    oldestTask: oldestRow.oldest,
    newestTask: newestRow.newest,
  };
}
