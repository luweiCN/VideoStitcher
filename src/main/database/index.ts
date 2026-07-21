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
let activeDatabasePath: string | null = null;

function getPrimaryDatabasePath(): string {
  return path.join(app.getPath('userData'), 'VideoStitcher.db');
}

function getRecoveredDatabasePath(): string {
  return path.join(app.getPath('userData'), 'VideoStitcher.recovered.db');
}

/**
 * 获取数据库文件路径
 */
export function getDatabasePath(): string {
  if (activeDatabasePath) return activeDatabasePath;
  const recoveredPath = getRecoveredDatabasePath();
  return fs.existsSync(recoveredPath) ? recoveredPath : getPrimaryDatabasePath();
}

/**
 * 获取备份目录路径
 */
export function getBackupDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'backups');
}

function closeConnection(connection: Database.Database | null): void {
  if (!connection) return;
  try {
    connection.close();
  } catch {
    // 恢复流程中尽力关闭连接，不覆盖原始错误。
  }
}

function openConfiguredDatabase(dbPath: string): Database.Database {
  let connection = new Database(dbPath);
  try {
    connection.pragma('busy_timeout = 5000');
    try {
      connection.pragma('journal_mode = WAL');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/disk I\/O error/i.test(message)) throw error;
      // Windows 异常退出后可能残留不可用的 WAL/SHM 状态，先尝试普通日志模式。
      console.warn('[数据库] WAL 模式不可用，尝试 DELETE 日志模式:', message);
      closeConnection(connection);
      connection = new Database(dbPath);
      connection.pragma('busy_timeout = 5000');
      connection.pragma('journal_mode = DELETE');
    }
    connection.pragma('synchronous = NORMAL');
    connection.pragma('cache_size = -64000'); // 64MB
    connection.pragma('temp_store = MEMORY');
    connection.pragma('foreign_keys = ON');
    return connection;
  } catch (error) {
    closeConnection(connection);
    throw error;
  }
}

/**
 * 原路径的 WAL/SHM 无法再打开时，将主体和日志复制到新文件名完成检查点合并。
 * 原始文件全部保留，恢复失败也不会覆盖历史任务数据。
 */
function createRecoveredDatabase(primaryPath: string, recoveredPath: string): void {
  const temporaryPath = `${recoveredPath}.tmp-${process.pid}-${Date.now()}`;
  const temporaryFiles = [temporaryPath, `${temporaryPath}-wal`, `${temporaryPath}-shm`];
  try {
    fs.copyFileSync(primaryPath, temporaryPath);
    for (const suffix of ['-wal', '-shm']) {
      const source = `${primaryPath}${suffix}`;
      if (fs.existsSync(source)) fs.copyFileSync(source, `${temporaryPath}${suffix}`);
    }

    const recoveryConnection = new Database(temporaryPath);
    try {
      recoveryConnection.pragma('busy_timeout = 5000');
      const integrity = recoveryConnection.pragma('integrity_check', { simple: true }) as string;
      if (integrity !== 'ok') throw new Error(`数据库恢复副本完整性检查失败: ${integrity}`);
      recoveryConnection.pragma('wal_checkpoint(TRUNCATE)');
      recoveryConnection.pragma('journal_mode = DELETE');
    } finally {
      closeConnection(recoveryConnection);
    }

    fs.renameSync(temporaryPath, recoveredPath);
    console.warn(`[数据库] 原路径日志文件异常，已无损切换到恢复副本: ${recoveredPath}`);
  } finally {
    for (const filePath of temporaryFiles) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // 临时文件清理失败不影响已完成的恢复副本。
        }
      }
    }
  }
}

/**
 * 初始化数据库
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  let dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  // 确保目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 检查是否是新数据库
  let isNewDatabase = !fs.existsSync(dbPath);

  // 只有全部初始化步骤成功后才发布连接，避免后续模块拿到半失效实例
  let connection: Database.Database | null = null;
  try {
    try {
      connection = openConfiguredDatabase(dbPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const primaryPath = getPrimaryDatabasePath();
      if (!/disk I\/O error/i.test(message) || dbPath !== primaryPath || !fs.existsSync(primaryPath)) {
        throw error;
      }
      const recoveredPath = getRecoveredDatabasePath();
      createRecoveredDatabase(primaryPath, recoveredPath);
      dbPath = recoveredPath;
      isNewDatabase = false;
      connection = openConfiguredDatabase(dbPath);
    }

    runMigrations(connection);
    if (isNewDatabase) {
      initDefaultConfig(connection);
    }

    db = connection;
    activeDatabasePath = dbPath;
    console.log(`[数据库] 初始化完成: ${dbPath}`);
    return connection;
  } catch (error) {
    closeConnection(connection);
    db = null;
    throw error;
  }
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
  const walPath = `${dbPath}-wal`;

  // 计算数据库大小（包含 WAL 文件）
  let fileSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  if (fs.existsSync(walPath)) {
    fileSize += fs.statSync(walPath).size;
  }

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

/**
 * 获取日志表大小（字节）
 */
export function getLogSize(): number {
  const database = getDatabase();
  const result = database.prepare(`
    SELECT SUM(LENGTH(message) + COALESCE(LENGTH(raw), 0) + 50) as size
    FROM task_logs
  `).get() as { size: number | null };
  return result.size || 0;
}

/**
 * 清除所有日志
 */
export function clearLogs(): { success: boolean; deletedCount: number; error?: string } {
  try {
    const database = getDatabase();
    const result = database.prepare('DELETE FROM task_logs').run();
    
    // 关闭数据库，释放文件句柄
    closeDatabase();
    
    // 重新打开并执行 VACUUM（此时会真正缩小文件）
    const dbPath = getDatabasePath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('foreign_keys = ON');
    db.exec('VACUUM');
    
    console.log(`[数据库] 已清除 ${result.changes} 条日志`);
    return { success: true, deletedCount: result.changes };
  } catch (err) {
    return { success: false, deletedCount: 0, error: (err as Error).message };
  }
}

/**
 * 清除指定天数前的已完成任务及其日志
 */
export function cleanupOldTasks(beforeDays: number): { success: boolean; deletedCount: number; error?: string } {
  try {
    const database = getDatabase();
    const cutoffTime = Date.now() - beforeDays * 24 * 60 * 60 * 1000;
    
    // 删除旧任务（外键级联会自动删除相关日志、文件、输出）
    const result = database.prepare(`
      DELETE FROM tasks 
      WHERE status IN ('completed', 'failed', 'cancelled') 
      AND completed_at < ?
    `).run(cutoffTime);
    
    // 关闭数据库，释放文件句柄
    closeDatabase();
    
    // 重新打开并执行 VACUUM
    const dbPath = getDatabasePath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('foreign_keys = ON');
    db.exec('VACUUM');
    
    console.log(`[数据库] 已清理 ${result.changes} 个 ${beforeDays} 天前的任务`);
    return { success: true, deletedCount: result.changes };
  } catch (err) {
    return { success: false, deletedCount: 0, error: (err as Error).message };
  }
}

/**
 * 修复数据库
 * 返回 needReset: true 表示需要重置数据库
 */
export function repairDatabase(): { 
  success: boolean; 
  needReset?: boolean;
  error?: string; 
  details?: string[] 
} {
  const details: string[] = [];
  
  try {
    const database = getDatabase();
    
    // 1. 检查完整性
    const checkBefore = checkIntegrity();
    if (checkBefore.healthy) {
      return { success: true, details: ['数据库已经是健康的'] };
    }
    details.push(`检查发现问题: ${checkBefore.errors.join(', ')}`);
    
    // 2. 尝试 VACUUM
    try {
      database.pragma('journal_mode = DELETE');
      database.exec('VACUUM');
      details.push('执行 VACUUM 完成');
    } catch (err) {
      details.push(`VACUUM 失败: ${(err as Error).message}`);
    }
    
    // 3. 重建索引
    try {
      database.exec('REINDEX');
      details.push('重建索引完成');
    } catch (err) {
      details.push(`REINDEX 失败: ${(err as Error).message}`);
    }
    
    // 4. 再次检查
    const checkAfter = checkIntegrity();
    if (checkAfter.healthy) {
      details.push('修复成功');
      return { success: true, details };
    }
    
    details.push(`修复后仍有问题: ${checkAfter.errors.join(', ')}`);
    
    // 5. 尝试删除 WAL/SHM 文件
    const dbPath = getDatabasePath();
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    
    if (fs.existsSync(walPath) || fs.existsSync(shmPath)) {
      closeDatabase();
      
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
        details.push('已删除 WAL 文件');
      }
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
        details.push('已删除 SHM 文件');
      }
      
      // 重新打开数据库
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('foreign_keys = ON');
      
      const checkFinal = checkIntegrity();
      if (checkFinal.healthy) {
        details.push('删除 WAL/SHM 后修复成功');
        return { success: true, details };
      }
    }
    
    // 6. 所有方法都失败，建议重置
    details.push('所有修复手段都失败，需要重置数据库');
    return {
      success: false,
      needReset: true,
      error: '无法自动修复，建议重置数据库',
      details,
    };
  } catch (err) {
    return {
      success: false,
      needReset: true,
      error: (err as Error).message,
      details,
    };
  }
}

/**
 * 重置数据库（删除并重建）
 * 危险操作：会丢失所有数据
 */
export function resetDatabase(): { success: boolean; error?: string } {
  try {
    const dbPath = getDatabasePath();
    
    // 1. 关闭连接
    closeDatabase();
    
    // 2. 删除数据库文件及相关文件
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
    }
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
    }
    
    // 3. 重新初始化
    initDatabase();
    
    console.log('[数据库] 重置完成');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 创建备份
 */
export async function createBackup(description?: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const database = getDatabase();
    const backupDir = getBackupDir();
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const desc = description ? `_${description}` : '';
    const backupName = `VideoStitcher_${timestamp}${desc}.db`;
    const backupPath = path.join(backupDir, backupName);
    
    await database.backup(backupPath);
    
    console.log(`[数据库] 备份成功: ${backupPath}`);
    return { success: true, path: backupPath };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 获取备份列表
 */
export function listBackups(): { name: string; path: string; size: number; time: number }[] {
  const backupDir = getBackupDir();
  
  if (!fs.existsSync(backupDir)) {
    return [];
  }
  
  return fs.readdirSync(backupDir)
    .filter(f => f.startsWith('VideoStitcher_') && f.endsWith('.db'))
    .map(f => {
      const filePath = path.join(backupDir, f);
      const stat = fs.statSync(filePath);
      return {
        name: f,
        path: filePath,
        size: stat.size,
        time: stat.mtime.getTime(),
      };
    })
    .sort((a, b) => b.time - a.time);
}

/**
 * 从备份恢复
 */
export function restoreFromBackup(backupPath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: '备份文件不存在' };
    }
    
    closeDatabase();
    
    const dbPath = getDatabasePath();
    
    // 紧急备份当前数据库
    if (fs.existsSync(dbPath)) {
      const emergencyBackup = `${dbPath}.emergency_${Date.now()}`;
      fs.copyFileSync(dbPath, emergencyBackup);
      console.log(`[数据库] 已创建紧急备份: ${emergencyBackup}`);
    }
    
    // 复制备份文件
    fs.copyFileSync(backupPath, dbPath);
    
    // 重新初始化
    initDatabase();
    
    console.log(`[数据库] 从备份恢复成功: ${backupPath}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
