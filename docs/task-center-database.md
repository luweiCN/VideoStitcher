# 任务中心数据库技术方案

## 一、技术选型

### 1.1 选型对比

| 方案 | 优点 | 缺点 | 评分 |
|------|------|------|------|
| **better-sqlite3** | 同步API性能高、原生持久化、支持事务、并发安全 | 需要 native 编译、包体积较大 | ⭐⭐⭐⭐⭐ |
| sql.js | 纯 JS、无需编译 | 异步 API、需手动保存、性能较差 | ⭐⭐⭐ |
| LowDB | 轻量、纯 JSON | 查询能力弱、大量数据性能差 | ⭐⭐ |
| Electron Store | 简单易用 | 不适合复杂查询、数据量大时性能差 | ⭐⭐ |
| IndexedDB | 浏览器原生 | 主进程不可用、API 复杂 | ⭐ |

### 1.2 最终选择

**better-sqlite3**，理由：
1. 同步 API，代码更简洁，无需 async/await 包装
2. 性能优异，单次操作微秒级
3. 原生支持文件持久化，无需手动保存
4. 支持事务，确保数据一致性
5. 支持多进程读取（WAL 模式）

---

## 二、安装和配置

### 2.1 依赖安装

```bash
npm install better-sqlite3
npm install @types/better-sqlite3 -D
```

### 2.2 electron-builder 配置

在 `electron.vite.config.ts` 中添加 native 模块支持：

```typescript
export default defineConfig({
  main: {
    // ... 其他配置
    externals: ['better-sqlite3'],
  },
});
```

在 `electron-builder.yml` 或 `package.json` 中配置：

```json
{
  "build": {
    "asarUnpack": [
      "**/node_modules/better-sqlite3/**"
    ]
  }
}
```

### 2.3 数据库位置

数据库文件以项目名命名，便于后续扩展存储其他数据：

```typescript
import { app } from 'electron';
import path from 'path';

function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'VideoStitcher.db');
}

function getBackupDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'backups');
}
```

实际路径：
- **macOS**: `~/Library/Application Support/VideoStitcher/VideoStitcher.db`
- **Windows**: `%APPDATA%/VideoStitcher/VideoStitcher.db`
- **备份目录**: `{userData}/backups/`

---

## 三、数据库架构

### 3.1 完整 Schema

```sql
-- 启用 WAL 模式（提升并发性能）
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- Schema 版本表（用于迁移）
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  -- 主键
  id TEXT PRIMARY KEY,
  
  -- 基本信息
  type TEXT NOT NULL,                    -- 任务类型
  name TEXT NOT NULL,                    -- 任务名称
  status TEXT NOT NULL DEFAULT 'pending',-- 状态
  priority INTEGER NOT NULL DEFAULT 0,   -- 优先级
  
  -- 时间戳（使用 Unix 时间戳，毫秒）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,                    -- 开始执行时间
  completed_at INTEGER,                  -- 完成时间
  
  -- 执行时间统计
  execution_time INTEGER DEFAULT 0,      -- 实际执行时长（毫秒），暂停期间不计入
  
  -- 配置
  output_dir TEXT NOT NULL,              -- 输出目录
  params TEXT NOT NULL DEFAULT '{}',     -- 参数（JSON）
  
  -- 进度
  progress INTEGER NOT NULL DEFAULT 0,   -- 进度 0-100
  current_step TEXT,                     -- 当前步骤
  
  -- 重试
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retry INTEGER NOT NULL DEFAULT 3,
  
  -- 错误信息
  error_code TEXT,
  error_message TEXT,
  error_stack TEXT,
  
  -- 约束
  CHECK (
    status IN ('pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled')
  ),
  CHECK (progress >= 0 AND progress <= 100),
  CHECK (priority >= 0 AND priority <= 100)
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

-- 任务中心运行时间记录表
CREATE TABLE IF NOT EXISTS task_center_sessions (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  stopped_at INTEGER,
  total_execution_time INTEGER DEFAULT 0  -- 本次会话的总执行时间
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
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON task_files(task_id);
CREATE INDEX IF NOT EXISTS idx_task_outputs_task_id ON task_outputs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_timestamp ON task_logs(timestamp);
```

### 3.2 默认配置数据

```sql
INSERT INTO config (key, value, updated_at) VALUES
  ('maxConcurrentTasks', '2', strftime('%s', 'now') * 1000),
  ('threadsPerTask', '4', strftime('%s', 'now') * 1000),
  ('autoStartTasks', 'true', strftime('%s', 'now') * 1000),
  ('autoRetryFailed', 'false', strftime('%s', 'now') * 1000),
  ('maxRetryCount', '3', strftime('%s', 'now') * 1000),
  ('keepCompletedDays', '7', strftime('%s', 'now') * 1000),
  ('showNotification', 'true', strftime('%s', 'now') * 1000),
  ('autoBackup', 'true', strftime('%s', 'now') * 1000),
  ('maxBackupCount', '5', strftime('%s', 'now') * 1000);
```

---

## 四、数据库版本迁移

### 4.1 迁移机制

支持跨版本升级，启动时自动执行所有未应用的迁移：

```typescript
// src/main/database/migrations/index.ts

interface Migration {
  version: number;
  description: string;
  up: string;  // 升级 SQL
  down?: string;  // 降级 SQL（可选）
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: '初始表结构',
    up: `
      CREATE TABLE IF NOT EXISTS tasks (...);
      CREATE TABLE IF NOT EXISTS task_files (...);
      CREATE TABLE IF NOT EXISTS task_outputs (...);
      CREATE TABLE IF NOT EXISTS task_logs (...);
      CREATE TABLE IF NOT EXISTS config (...);
      -- 索引...
    `
  },
  // 未来版本示例：
  // {
  //   version: 2,
  //   description: '添加执行时间字段',
  //   up: `ALTER TABLE tasks ADD COLUMN execution_time INTEGER DEFAULT 0;`
  // },
  // {
  //   version: 3,
  //   description: '添加任务中心会话表',
  //   up: `CREATE TABLE IF NOT EXISTS task_center_sessions (...);`
  // }
];

export function runMigrations(db: Database.Database): void {
  // 确保版本表存在
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT
    )
  `);
  
  // 获取当前版本
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number | null };
  const currentVersion = row?.version ?? 0;
  
  // 按版本顺序执行未应用的迁移
  const pendingMigrations = MIGRATIONS
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);
  
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
      throw err;  // 迁移失败应该阻止应用启动
    }
  }
}
```

### 4.2 跨版本升级示例

用户从 v1.0 升级到 v1.3：
```
v1.0 -> schema_version = 1
v1.1 -> schema_version = 2 (添加字段)
v1.2 -> schema_version = 2 (无数据库变更)
v1.3 -> schema_version = 3 (添加新表)

用户升级时：检测到 currentVersion=1，依次执行 v2、v3 的迁移脚本
```

---

## 五、数据库备份与恢复

### 5.1 自动备份

```typescript
// src/main/database/backup.ts

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDatabase, getDatabasePath, closeDatabase, initDatabase } from './index';

const BACKUP_DIR = () => path.join(app.getPath('userData'), 'backups');

/**
 * 创建备份
 */
export function createBackup(description?: string): { success: boolean; path?: string; error?: string } {
  try {
    const db = getDatabase();
    const backupDir = BACKUP_DIR();
    
    // 确保备份目录存在
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const desc = description ? `_${description}` : '';
    const backupName = `VideoStitcher_${timestamp}${desc}.db`;
    const backupPath = path.join(backupDir, backupName);
    
    // 执行备份
    db.backup(backupPath);
    
    // 清理旧备份（保留最近 N 份）
    cleanOldBackups();
    
    console.log(`[备份] 成功: ${backupPath}`);
    return { success: true, path: backupPath };
  } catch (err) {
    console.error('[备份] 失败:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 清理旧备份
 */
function cleanOldBackups(): void {
  const backupDir = BACKUP_DIR();
  const maxCount = getMaxBackupCount();
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('VideoStitcher_') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  // 删除超出数量的旧备份
  if (files.length > maxCount) {
    files.slice(maxCount).forEach(f => {
      fs.unlinkSync(f.path);
      console.log(`[备份] 清理旧备份: ${f.name}`);
    });
  }
}

/**
 * 获取备份列表
 */
export function listBackups(): { name: string; path: string; size: number; time: number }[] {
  const backupDir = BACKUP_DIR();
  
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
        time: stat.mtime.getTime()
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
    
    // 关闭当前数据库
    closeDatabase();
    
    // 备份当前数据库（以防万一）
    const dbPath = getDatabasePath();
    if (fs.existsSync(dbPath)) {
      const emergencyBackup = `${dbPath}.emergency_${Date.now()}`;
      fs.copyFileSync(dbPath, emergencyBackup);
      console.log(`[恢复] 已创建紧急备份: ${emergencyBackup}`);
    }
    
    // 复制备份文件
    fs.copyFileSync(backupPath, dbPath);
    
    // 重新初始化数据库
    initDatabase();
    
    console.log(`[恢复] 成功: ${backupPath}`);
    return { success: true };
  } catch (err) {
    console.error('[恢复] 失败:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 导出数据库（供用户下载）
 */
export function exportDatabase(): { success: boolean; path?: string; error?: string } {
  return createBackup('export');
}

/**
 * 导入数据库（从用户上传的文件）
 */
export function importDatabase(sourcePath: string): { success: boolean; error?: string } {
  return restoreFromBackup(sourcePath);
}
```

### 5.2 数据库完整性检查与修复

```typescript
// src/main/database/repair.ts

import { getDatabase, closeDatabase, initDatabase, getDatabasePath } from './index';
import fs from 'fs';
import path from 'path';

export interface IntegrityCheckResult {
  healthy: boolean;
  errors: string[];
  canRepair: boolean;
}

/**
 * 检查数据库完整性
 */
export function checkIntegrity(): IntegrityCheckResult {
  try {
    const db = getDatabase();
    
    // 执行完整性检查
    const result = db.pragma('integrity_check') as { integrity_check: string }[];
    
    if (result.length === 1 && result[0].integrity_check === 'ok') {
      return { healthy: true, errors: [], canRepair: false };
    }
    
    const errors = result
      .filter(r => r.integrity_check !== 'ok')
      .map(r => r.integrity_check);
    
    return {
      healthy: false,
      errors,
      canRepair: true
    };
  } catch (err) {
    return {
      healthy: false,
      errors: [(err as Error).message],
      canRepair: false
    };
  }
}

/**
 * 尝试修复数据库
 */
export function repairDatabase(): { success: boolean; error?: string; details?: string[] } {
  const details: string[] = [];
  
  try {
    const db = getDatabase();
    
    // 1. 检查完整性
    const checkBefore = checkIntegrity();
    if (checkBefore.healthy) {
      return { success: true, details: ['数据库已经是健康的'] };
    }
    details.push(`检查发现问题: ${checkBefore.errors.join(', ')}`);
    
    // 2. 尝试 RECOVER 模式
    try {
      db.pragma('journal_mode = DELETE');
      db.exec('VACUUM');
      details.push('执行 VACUUM 完成');
    } catch (err) {
      details.push(`VACUUM 失败: ${(err as Error).message}`);
    }
    
    // 3. 重建索引
    try {
      db.exec('REINDEX');
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
    
    // 5. 如果仍无法修复，尝试从 WAL 恢复
    const dbPath = getDatabasePath();
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    
    if (fs.existsSync(walPath) || fs.existsSync(shmPath)) {
      closeDatabase();
      
      // 尝试删除 WAL 和 SHM 文件
      if (fs.existsSync(walPath)) {
        fs.unlinkSync(walPath);
        details.push('已删除 WAL 文件');
      }
      if (fs.existsSync(shmPath)) {
        fs.unlinkSync(shmPath);
        details.push('已删除 SHM 文件');
      }
      
      initDatabase();
      
      const checkFinal = checkIntegrity();
      if (checkFinal.healthy) {
        details.push('删除 WAL/SHM 后修复成功');
        return { success: true, details };
      }
    }
    
    return {
      success: false,
      error: '无法自动修复，建议从备份恢复',
      details
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
      details
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
  const db = getDatabase();
  const dbPath = getDatabasePath();
  
  const fileSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  
  const taskCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count;
  const logCount = (db.prepare('SELECT COUNT(*) as count FROM task_logs').get() as { count: number }).count;
  const outputCount = (db.prepare('SELECT COUNT(*) as count FROM task_outputs').get() as { count: number }).count;
  
  const oldestRow = db.prepare('SELECT MIN(created_at) as oldest FROM tasks').get() as { oldest: number | null };
  const newestRow = db.prepare('SELECT MAX(created_at) as newest FROM tasks').get() as { newest: number | null };
  
  return {
    fileSize,
    taskCount,
    logCount,
    outputCount,
    oldestTask: oldestRow.oldest,
    newestTask: newestRow.newest
  };
}
```

---

## 六、TypeScript 类型定义

### 6.1 数据库实体类型

```typescript
// src/main/database/types.ts

export type TaskStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskType =
  | 'video_merge'
  | 'video_stitch'
  | 'video_resize'
  | 'image_material'
  | 'cover_format'
  | 'cover_compress'
  | 'lossless_grid';

export type LogLevel = 'info' | 'warning' | 'error' | 'success' | 'debug';

export interface TaskRow {
  id: string;
  type: TaskType;
  name: string;
  status: TaskStatus;
  priority: number;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  completed_at: number | null;
  execution_time: number;
  output_dir: string;
  params: string;  // JSON string
  progress: number;
  current_step: string | null;
  retry_count: number;
  max_retry: number;
  error_code: string | null;
  error_message: string | null;
  error_stack: string | null;
}

export interface TaskFileRow {
  id: string;
  task_id: string;
  path: string;
  category: string;
  category_label: string;
  sort_order: number;
}

export interface TaskOutputRow {
  id: string;
  task_id: string;
  path: string;
  type: 'video' | 'image' | 'other';
  size: number | null;
  created_at: number;
}

export interface TaskLogRow {
  id: string;
  task_id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  raw: string | null;
}

export interface TaskCenterSessionRow {
  id: string;
  started_at: number;
  stopped_at: number | null;
  total_execution_time: number;
}

export interface ConfigRow {
  key: string;
  value: string;
  updated_at: number;
}
```

### 6.2 业务模型类型

```typescript
// src/shared/types/task.ts

export interface Task {
  id: string;
  type: TaskType;
  name: string;
  status: TaskStatus;
  priority: number;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  executionTime?: number;  // 实际执行时长（毫秒）
  outputDir: string;
  params: Record<string, unknown>;
  files: TaskFile[];
  progress: number;
  currentStep?: string;
  retryCount: number;
  maxRetry: number;
  error?: TaskError;
  outputs: TaskOutput[];
}

export interface TaskFile {
  id: string;
  path: string;
  category: string;
  categoryLabel: string;
  sortOrder: number;
}

export interface TaskOutput {
  id: string;
  path: string;
  type: 'video' | 'image' | 'other';
  size?: number;
  createdAt: number;
}

export interface TaskLog {
  id: string;
  taskId: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  raw?: string;
}

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
}

export interface TaskCenterConfig {
  maxConcurrentTasks: number;
  threadsPerTask: number;
  autoStartTasks: boolean;
  autoRetryFailed: boolean;
  maxRetryCount: number;
  keepCompletedDays: number;
  showNotification: boolean;
  autoBackup: boolean;
  maxBackupCount: number;
}

export interface DatabaseStats {
  fileSize: number;
  taskCount: number;
  logCount: number;
  outputCount: number;
  oldestTask: number | null;
  newestTask: number | null;
}

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  time: number;
}
```

---

## 七、Repository 实现

（TaskRepository、TaskLogRepository、ConfigRepository 的实现与之前类似，增加 executionTime 字段的处理，此处略）

---

## 八、IPC 接口扩展

### 8.1 数据库管理相关 IPC

```typescript
// 主进程 IPC 处理器

// 数据库统计
ipcMain.handle('db:get-stats', async () => {
  return getDatabaseStats();
});

// 完整性检查
ipcMain.handle('db:check-integrity', async () => {
  return checkIntegrity();
});

// 修复数据库
ipcMain.handle('db:repair', async () => {
  return repairDatabase();
});

// 备份相关
ipcMain.handle('db:create-backup', async (_, description?: string) => {
  return createBackup(description);
});

ipcMain.handle('db:list-backups', async () => {
  return listBackups();
});

ipcMain.handle('db:restore-backup', async (_, backupPath: string) => {
  return restoreFromBackup(backupPath);
});

ipcMain.handle('db:delete-backup', async (_, backupPath: string) => {
  try {
    fs.unlinkSync(backupPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

// 导出/导入
ipcMain.handle('db:export', async () => {
  return exportDatabase();
});

ipcMain.handle('db:import', async (_, sourcePath: string) => {
  return importDatabase(sourcePath);
});

// 清理任务
ipcMain.handle('db:cleanup-tasks', async (_, options: {
  status?: TaskStatus[];
  beforeDays?: number;
}) => {
  // ... 清理逻辑
});
```

---

## 九、性能优化建议

### 9.1 索引优化

- 高频查询字段建立索引（status, type, created_at）
- 联合索引用于复杂查询
- 定期执行 `ANALYZE` 更新统计信息

### 9.2 批量操作

```typescript
// 使用事务批量插入
const insertLogs = db.transaction((logs: TaskLog[]) => {
  for (const log of logs) {
    logStmt.run(...);
  }
});
```

### 9.3 大数据处理

- 日志表定期清理或归档
- 使用分页查询
- 虚拟列表渲染大量任务
- 设置日志保留上限（如每个任务最多保留 10000 条日志）

---

## 十、启动时数据库初始化流程

```typescript
// src/main/database/index.ts

export function initDatabase(): Database.Database {
  if (db) return db;
  
  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);
  
  // 确保目录存在
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // 检查数据库是否存在（新用户 vs 老用户）
  const isNewDatabase = !fs.existsSync(dbPath);
  
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
  
  // 自动备份（如果启用）
  if (getConfigValue('autoBackup', true)) {
    createBackup('auto');
  }
  
  return db;
}
```
