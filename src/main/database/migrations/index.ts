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
      -- 任务表（自增ID）
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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

        pid INTEGER,
        pid_started_at INTEGER,

        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        CHECK (progress >= 0 AND progress <= 100)
      );

      -- 任务文件表
      CREATE TABLE IF NOT EXISTS task_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- 任务输出表
      CREATE TABLE IF NOT EXISTS task_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'other',
        size INTEGER,
        created_at INTEGER NOT NULL,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      -- 任务日志表
      CREATE TABLE IF NOT EXISTS task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        raw TEXT,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,

        CHECK (level IN ('info', 'warning', 'error', 'success', 'debug'))
      );

      -- 任务中心会话表
      CREATE TABLE IF NOT EXISTS task_center_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  {
    version: 2,
    description: '添加 AI 视频生产相关表',
    up: `
      -- AI 脚本表
      CREATE TABLE IF NOT EXISTS ai_scripts (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        style TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        selected INTEGER NOT NULL DEFAULT 0
      );

      -- AI 角色表
      CREATE TABLE IF NOT EXISTS ai_characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        created_at INTEGER NOT NULL
      );

      -- AI 分镜表
      CREATE TABLE IF NOT EXISTS ai_storyboard_scenes (
        id TEXT PRIMARY KEY,
        scene_number INTEGER NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        duration INTEGER,
        created_at INTEGER NOT NULL
      );

      -- AI 视频输出表
      CREATE TABLE IF NOT EXISTS ai_videos (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER NOT NULL DEFAULT 0,
        task_id TEXT,
        created_at INTEGER NOT NULL,

        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        CHECK (progress >= 0 AND progress <= 100)
      );

      -- 知识库文档表
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_ai_scripts_created_at ON ai_scripts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_characters_created_at ON ai_characters(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_storyboard_scenes_scene_number ON ai_storyboard_scenes(scene_number);
      CREATE INDEX IF NOT EXISTS idx_ai_videos_status ON ai_videos(status);
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at DESC);
    `,
  },
  {
    version: 3,
    description: 'A 面视频生产功能表',
    up: `
      -- 1. 项目表
      CREATE TABLE IF NOT EXISTS aside_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        game_type TEXT NOT NULL,
        selling_point TEXT,  -- 新增:项目卖点(可选,最多200字符)
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- 2. 创意方向表（项目级别）
      CREATE TABLE IF NOT EXISTS aside_creative_directions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon_name TEXT,
        is_preset INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE
      );

      -- 3. 人设表（项目级别）
      CREATE TABLE IF NOT EXISTS aside_personas (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        is_preset INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE
      );

      -- 4. 剧本表
      CREATE TABLE IF NOT EXISTS aside_screenplays (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        content TEXT NOT NULL,
        creative_direction_id TEXT,
        persona_id TEXT,
        region TEXT DEFAULT 'universal',  -- 移到剧本表
        ai_model TEXT,
        status TEXT DEFAULT 'draft',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE,
        FOREIGN KEY (creative_direction_id) REFERENCES aside_creative_directions(id),
        FOREIGN KEY (persona_id) REFERENCES aside_personas(id),

        CHECK (status IN ('draft', 'library', 'producing', 'completed'))
      );

      -- 创建索引
      CREATE INDEX IF NOT EXISTS idx_aside_creative_directions_project ON aside_creative_directions(project_id);
      CREATE INDEX IF NOT EXISTS idx_aside_personas_project ON aside_personas(project_id);
      CREATE INDEX IF NOT EXISTS idx_aside_screenplays_project ON aside_screenplays(project_id);
      CREATE INDEX IF NOT EXISTS idx_aside_screenplays_status ON aside_screenplays(status);
    `,
  },
  {
    version: 4,
    description: '修复表名：aside_scripts → aside_screenplays（开发阶段修复）',
    up: `
      -- 重命名表（如果旧表存在）
      ALTER TABLE aside_scripts RENAME TO aside_screenplays;

      -- 删除旧索引
      DROP INDEX IF EXISTS idx_aside_scripts_project;
      DROP INDEX IF EXISTS idx_aside_scripts_status;

      -- 创建新索引
      CREATE INDEX IF NOT EXISTS idx_aside_screenplays_project ON aside_screenplays(project_id);
      CREATE INDEX IF NOT EXISTS idx_aside_screenplays_status ON aside_screenplays(status);
    `,
  },
];

/**
 * 运行数据库迁移
 */
export function runMigrations(db: Database.Database): void {
  console.log('[数据库迁移] 开始执行迁移...');

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

  console.log(`[数据库迁移] 当前版本: v${currentVersion}`);

  // 获取待执行的迁移
  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  if (pendingMigrations.length === 0) {
    console.log(`[数据库迁移] 已是最新版本，无需迁移`);
    return;
  }

  console.log(`[数据库迁移] 发现 ${pendingMigrations.length} 个待执行迁移`);

  // 执行迁移
  for (const migration of pendingMigrations) {
    console.log(`[数据库迁移] 开始执行 v${migration.version}: ${migration.description}`);

    try {
      // 使用事务确保：迁移 SQL 和版本记录要么都成功，要么都失败
      const transaction = db.transaction(() => {
        db.exec(migration.up);
        db.prepare(`
          INSERT INTO schema_version (version, applied_at, description)
          VALUES (?, ?, ?)
        `).run(migration.version, Date.now(), migration.description);
      });

      // 执行事务
      transaction();

      console.log(`[数据库迁移] ✅ v${migration.version} ${migration.description} - 成功`);
    } catch (err) {
      // 迁移失败，立即终止
      console.error(`[数据库迁移] ❌ v${migration.version} 失败:`, err);
      console.error(`[数据库迁移] 迁移已终止，数据库版本保持在 v${currentVersion}`);
      throw new Error(`数据库迁移 v${migration.version} 失败: ${(err as Error).message}`);
    }
  }

  const finalVersion = pendingMigrations[pendingMigrations.length - 1].version;
  console.log(`[数据库迁移] ✅ 所有迁移完成，当前版本 v${finalVersion}`);
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
