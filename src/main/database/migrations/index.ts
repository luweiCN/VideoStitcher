/**
 * 数据库迁移模块
 * 支持跨版本升级
 */

import Database from 'better-sqlite3';

interface Migration {
  version: number;
  description: string;
  up: string;
}

/**
 * 迁移脚本列表
 * 按版本号顺序执行
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: '初始表结构',
    up: `
      -- 任务表
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        
        execution_time INTEGER DEFAULT 0,
        
        output_dir TEXT NOT NULL,
        params TEXT NOT NULL DEFAULT '{}',
        
        progress INTEGER NOT NULL DEFAULT 0,
        current_step TEXT,
        
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retry INTEGER NOT NULL DEFAULT 3,
        
        error_code TEXT,
        error_message TEXT,
        error_stack TEXT,
        
        CHECK (status IN ('pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
        CHECK (progress >= 0 AND progress <= 100)
      );

      -- 任务文件表
      CREATE TABLE IF NOT EXISTS task_files (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        path TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- 任务输出表
      CREATE TABLE IF NOT EXISTS task_outputs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other',
        size INTEGER,
        created_at INTEGER NOT NULL,
        
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- 任务日志表
      CREATE TABLE IF NOT EXISTS task_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        raw TEXT,
        
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        
        CHECK (level IN ('info', 'warning', 'error', 'success', 'debug'))
      );

      -- 任务中心会话表
      CREATE TABLE IF NOT EXISTS task_center_sessions (
        id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        stopped_at INTEGER,
        total_execution_time INTEGER DEFAULT 0
      );

      -- 全局配置表
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_outputs_task_id ON task_outputs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_logs_timestamp ON task_logs(timestamp);
    `,
  },
  // 后续版本迁移在此添加
  // {
  //   version: 2,
  //   description: '添加新字段',
  //   up: `ALTER TABLE tasks ADD COLUMN new_field TEXT;`
  // },
];

/**
 * 运行数据库迁移
 */
export function runMigrations(db: Database.Database): void {
  // 创建版本表
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT
    )
  `);

  // 获取当前版本
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
    version: number | null;
  };
  const currentVersion = row?.version ?? 0;

  // 获取待执行的迁移
  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  if (pendingMigrations.length === 0) {
    console.log(`[数据库迁移] 当前版本 v${currentVersion}，无需迁移`);
    return;
  }

  // 执行迁移
  for (const migration of pendingMigrations) {
    try {
      db.transaction(() => {
        db.exec(migration.up);
        db.prepare(`
          INSERT INTO schema_version (version, applied_at, description)
          VALUES (?, ?, ?)
        `).run(migration.version, Date.now(), migration.description);
      })();

      console.log(`[数据库迁移] v${migration.version} ${migration.description} - 成功`);
    } catch (err) {
      console.error(`[数据库迁移] v${migration.version} 失败:`, err);
      throw err;
    }
  }

  console.log(`[数据库迁移] 完成，当前版本 v${pendingMigrations[pendingMigrations.length - 1].version}`);
}

/**
 * 获取当前数据库版本
 */
export function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
    version: number | null;
  };
  return row?.version ?? 0;
}
