# 任务中心设计方案

## 一、需求概述

### 1.1 背景

当前应用在处理音视频任务时，点击按钮就立刻开始处理，处理过程中界面锁定无法操作。用户实际使用场景是：先添加素材等待生成，再添加其他素材再次等待，效率低下。

### 1.2 目标

构建统一的任务中心系统，实现：
- 用户可在任意功能模块添加任务到队列，不阻塞界面
- 任务中心统一管理任务执行、进度、日志
- 任务持久化，关闭软件后重新打开可恢复
- 支持并发控制、任务暂停/取消/重试等操作

---

## 二、整体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           渲染进程 (React)                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ 功能模块 A  │  │ 功能模块 B  │  │ 功能模块 C  │  │  任务中心  │ │
│  │(VideoMerge) │  │ (Resize)    │  │ (Stitch)    │  │   页面     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                │                │                │        │
│         └────────────────┴────────────────┴────────────────┘        │
│                                    │                                 │
│                           ┌────────▼────────┐                        │
│                           │   TaskContext   │                        │
│                           │  (全局状态管理)  │                        │
│                           └────────┬────────┘                        │
│                                    │                                 │
│                           ┌────────▼────────┐                        │
│                           │   TaskService   │                        │
│                           │  (渲染进程服务)  │                        │
│                           └────────┬────────┘                        │
└────────────────────────────────────┼────────────────────────────────┘
                                     │ IPC
┌────────────────────────────────────┼────────────────────────────────┐
│                           ┌────────▼────────┐                        │
│                           │  TaskQueueMgr   │                        │
│                           │  (主进程队列)    │                        │
│                           └────────┬────────┘                        │
│                           主进程 (Electron)                          │
│                                    │                                 │
│              ┌─────────────────────┼─────────────────────┐          │
│              │                     │                     │          │
│      ┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐   │
│      │   FFmpeg      │    │    Sharp      │    │   其他处理     │   │
│      │   Worker      │    │   Worker      │    │   Worker       │   │
│      └───────────────┘    └───────────────┘    └───────────────┘   │
│                                                                      │
│                           ┌────────────────┐                         │
│                           │   SQLite DB    │                         │
│                           │  (任务持久化)   │                         │
│                           └────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块

| 模块 | 位置 | 职责 |
|------|------|------|
| TaskContext | 渲染进程 | 全局任务状态管理，提供任务增删改查 API |
| TaskService | 渲染进程 | 封装 IPC 通信，与主进程交互 |
| TaskQueueManager | 主进程 | 任务队列管理，并发控制，任务调度 |
| TaskExecutor | 主进程 | 实际执行任务（FFmpeg/Sharp） |
| TaskDatabase | 主进程 | SQLite 持久化存储 |

---

## 三、数据模型设计

### 3.1 任务状态

```typescript
type TaskStatus = 
  | 'pending'      // 等待中（未开始）
  | 'queued'       // 已入队，等待执行
  | 'running'      // 执行中
  | 'paused'       // 已暂停
  | 'completed'    // 已完成
  | 'failed'       // 失败
  | 'cancelled';   // 已取消
```

### 3.2 任务类型

```typescript
type TaskType = 
  | 'video_merge'       // 横竖屏极速合成
  | 'video_stitch'      // A+B 前后拼接
  | 'video_resize'      // 智能改尺寸
  | 'image_material'    // 图片素材处理
  | 'cover_format'      // 封面格式转换
  | 'cover_compress'    // 封面压缩
  | 'lossless_grid';    // 专业无损九宫格
```

### 3.3 任务数据结构

```typescript
interface Task {
  // 基础信息
  id: string;                    // 任务唯一 ID
  type: TaskType;                // 任务类型
  name: string;                  // 任务名称（用户可编辑）
  status: TaskStatus;            // 任务状态
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  startedAt?: number;            // 开始执行时间
  completedAt?: number;          // 完成时间
  
  // 执行时间统计
  executionTime?: number;        // 实际执行时长（毫秒），暂停期间不计入
  
  // 任务配置
  priority: number;              // 优先级（越大越优先）
  outputDir: string;             // 输出目录
  
  // 任务参数（根据 type 不同而不同）
  params: Record<string, unknown>;
  
  // 素材文件
  files: TaskFile[];
  
  // 执行信息
  progress: number;              // 进度 0-100
  currentStep?: string;          // 当前步骤描述
  
  // 输出信息
  outputs: TaskOutput[];         // 输出文件列表
  
  // 错误信息
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

interface TaskFile {
  id: string;
  path: string;                  // 文件路径
  category: string;              // 分类（A/B/cover/bg 等）
  categoryLabel: string;         // 分类显示名称
  index: number;                 // 同类索引
}

interface TaskOutput {
  path: string;                  // 输出文件路径
  type: 'video' | 'image' | 'other';
  size?: number;                 // 文件大小
}

interface TaskLog {
  id: string;
  taskId: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  raw?: string;                  // 原始日志（FFmpeg 输出等）
}
```

### 3.4 全局配置

```typescript
interface TaskCenterConfig {
  // 并发设置
  maxConcurrentTasks: number;    // 最大同时执行任务数（1-8）
  threadsPerTask: number;        // 每个任务使用的线程数（1-CPU核心数）
  
  // 自动化设置
  autoStartTasks: boolean;       // 添加任务后自动开始
  autoRetryFailed: boolean;      // 失败后自动重试
  maxRetryCount: number;         // 最大重试次数
  
  // 完成后操作
  openOutputDirOnComplete: boolean;  // 完成后打开输出目录
  showNotification: boolean;     // 显示系统通知
  
  // 历史记录
  keepCompletedDays: number;     // 保留已完成任务的天数（0=永久）
  
  // 数据库
  autoBackup: boolean;           // 自动备份
  maxBackupCount: number;        // 保留备份数量
}
```

### 3.5 任务执行参数

每个任务可以覆盖全局配置的线程数：

```typescript
interface Task {
  // ... 其他字段
  
  // 执行参数（可覆盖全局配置）
  threads?: number;              // 此任务使用的线程数（可选，默认使用全局配置）
}
```

### 3.6 FFmpeg/Sharp 线程控制

```typescript
// FFmpeg 命令行参数
// -threads n : 使用 n 个线程进行编码

// Sharp 配置
// sharp(input).threads(n)
```

---

## 四、数据库设计

### 4.1 技术选型

**选择：better-sqlite3**

| 特性 | better-sqlite3 | sql.js | LowDB |
|------|----------------|--------|-------|
| 性能 | ⭐⭐⭐⭐⭐ 同步API | ⭐⭐⭐ 异步 | ⭐⭐ JSON |
| 包体积 | ~2MB | ~1MB | ~50KB |
| 持久化 | 原生文件 | 内存+手动保存 | JSON文件 |
| 查询能力 | 完整SQL | 完整SQL | 简单查询 |
| 并发安全 | 是 | 否 | 否 |

选择 better-sqlite3 的原因：
1. 同步 API，代码更简洁
2. 性能优异，适合大量任务
3. 原生支持文件持久化
4. 支持事务，数据一致性有保障

### 4.2 表结构设计

```sql
-- Schema 版本表（用于迁移）
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);

-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- 时间戳
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  
  -- 执行时间统计
  execution_time INTEGER DEFAULT 0,  -- 实际执行时长（毫秒），暂停期间不计入
  
  -- 配置
  output_dir TEXT NOT NULL,
  params TEXT NOT NULL,  -- JSON
  
  -- 进度
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT,
  
  -- 重试
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retry INTEGER NOT NULL DEFAULT 3,
  
  -- 错误
  error_code TEXT,
  error_message TEXT,
  error_stack TEXT,
  
  -- 约束
  CHECK (status IN ('pending', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled'))
);

-- 任务文件表
CREATE TABLE task_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  path TEXT NOT NULL,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 任务输出表
CREATE TABLE task_outputs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  size INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 任务日志表
CREATE TABLE task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  raw TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 任务中心会话表（记录运行时间）
CREATE TABLE task_center_sessions (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  stopped_at INTEGER,
  total_execution_time INTEGER DEFAULT 0
);

-- 全局配置表
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 索引
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_task_files_task_id ON task_files(task_id);
CREATE INDEX idx_task_outputs_task_id ON task_outputs(task_id);
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX idx_task_logs_timestamp ON task_logs(timestamp);
```

### 4.3 数据库位置

数据库文件以项目名命名：`VideoStitcher.db`

```
macOS: ~/Library/Application Support/VideoStitcher/taskcenter.db
Windows: %APPDATA%/VideoStitcher/taskcenter.db
```

---

## 五、IPC 通信设计

### 5.1 通道命名

```typescript
// 任务操作
'task:create'           // 创建任务
'task:update'           // 更新任务
'task:delete'           // 删除任务
'task:get'              // 获取单个任务
'task:list'             // 获取任务列表
'task:start'            // 开始任务
'task:pause'            // 暂停任务
'task:resume'           // 恢复任务
'task:cancel'           // 取消任务
'task:retry'            // 重试任务
'task:update-output-dir'// 更新输出目录

// 批量操作
'task:start-all'        // 开始所有待执行任务
'task:pause-all'        // 暂停所有运行中任务
'task:cancel-all'       // 取消所有未完成任务
'task:clear-completed'  // 清除已完成任务

// 配置
'task:get-config'       // 获取配置
'task:set-config'       // 设置配置

// 事件（主进程 -> 渲染进程）
'task:created'          // 任务创建事件
'task:updated'          // 任务更新事件
'task:deleted'          // 任务删除事件
'task:started'          // 任务开始事件
'task:progress'         // 任务进度事件
'task:log'              // 任务日志事件
'task:completed'        // 任务完成事件
'task:failed'           // 任务失败事件
'task:cancelled'        // 任务取消事件
```

### 5.2 事件数据结构

```typescript
// 任务进度事件
interface TaskProgressEvent {
  taskId: string;
  progress: number;      // 0-100
  step?: string;         // 当前步骤
  elapsed?: number;      // 已耗时（秒）
  eta?: number;          // 预计剩余时间（秒）
}

// 任务日志事件
interface TaskLogEvent {
  taskId: string;
  log: {
    id: string;
    timestamp: number;
    level: 'info' | 'warning' | 'error' | 'success';
    message: string;
    raw?: string;
  };
}
```

---

## 六、界面设计

### 6.1 页面结构

```
任务中心
├── 顶部：统计概览 + 全局控制
│   ├── 统计卡片：待执行/执行中/已完成/失败
│   └── 控制按钮：全部开始/全部暂停/设置
│
├── 中部：任务列表（可筛选/排序）
│   ├── 筛选栏：状态筛选 + 类型筛选 + 搜索
│   └── 任务卡片列表
│       └── 单个任务卡片
│           ├── 基本信息：名称、类型、状态、进度
│           ├── 输出目录（可修改）
│           └── 操作按钮：开始/暂停/取消/删除/查看详情
│
└── 右侧/模态框：任务详情
    ├── 任务信息
    │   ├── 名称、类型、状态
    │   ├── 创建时间、执行时间、完成时间
    │   └── 输出目录
    ├── 素材列表
    │   └── 文件缩略图 + 信息
    ├── 任务参数
    │   └── JSON 格式展示
    ├── 输出文件
    │   └── 输出文件列表（可预览/打开目录）
    └── 执行日志
        └── 实时滚动日志
```

### 6.2 入口位置

1. **首页导航**：在首页添加「任务中心」入口卡片
2. **全局浮窗**：右下角固定浮窗显示当前任务状态
3. **各功能模块**：按钮改为「添加到任务」

### 6.3 组件拆分

```
src/renderer/features/TaskCenter/
├── index.tsx                    # 任务中心主页面
├── components/
│   ├── TaskStats.tsx           # 统计概览
│   ├── TaskFilters.tsx         # 筛选栏
│   ├── TaskCard.tsx            # 任务卡片
│   ├── TaskDetailModal.tsx     # 任务详情弹窗
│   ├── TaskLogsPanel.tsx       # 日志面板
│   ├── TaskFilesList.tsx       # 素材列表
│   ├── TaskOutputsList.tsx     # 输出文件列表
│   ├── TaskCenterSettings.tsx  # 设置面板
│   └── GlobalTaskIndicator.tsx # 全局任务指示器
├── hooks/
│   ├── useTaskCenter.ts        # 任务中心逻辑
│   ├── useTaskEvents.ts        # 任务事件监听
│   └── useTaskFilters.ts       # 筛选逻辑
└── utils/
    └── taskHelpers.ts          # 工具函数
```

---

## 七、分阶段实施计划

### 阶段一：基础设施（预计 3-4 天）

**目标**：搭建任务中心的基础架构

1. **数据库层**
   - 安装 better-sqlite3
   - 创建数据库初始化模块
   - 实现基础的 CRUD 操作

2. **主进程任务管理**
   - 创建 TaskQueueManager 类
   - 实现任务队列和并发控制
   - 实现 IPC 处理器

3. **渲染进程状态管理**
   - 创建 TaskContext
   - 实现 IPC 事件监听
   - 实现任务的增删改查 API

**交付物**：
- 数据库模块
- 任务队列管理器
- 全局状态管理

---

### 阶段二：任务中心界面（预计 4-5 天）

**目标**：完成任务中心的用户界面

1. **任务列表页面**
   - 统计概览组件
   - 任务卡片组件
   - 筛选和排序功能

2. **任务详情页面**
   - 任务信息展示
   - 素材列表展示
   - 输出文件列表
   - 执行日志展示

3. **全局任务指示器**
   - 右下角浮窗
   - 实时进度显示
   - 快速跳转入口

**交付物**：
- 完整的任务中心页面
- 任务详情弹窗
- 全局任务指示器

---

### 阶段三：功能模块改造（预计 5-6 天）

**目标**：将现有功能模块改造为添加任务模式

1. **改造模式**：
   - 保留原有的「立即执行」功能（可选）
   - 新增「添加到任务中心」按钮
   - 任务配置保存到数据库

2. **需要改造的模块**：
   - VideoMergeMode（横竖屏极速合成）
   - ResizeMode（智能改尺寸）
   - VideoStitcherMode（A+B 前后拼接）
   - ImageMaterialMode（图片素材处理）
   - CoverFormatMode（封面格式转换）
   - CoverCompressMode（封面压缩）
   - LosslessGridMode（专业无损九宫格）

**交付物**：
- 所有功能模块支持添加任务
- 任务可正常执行

---

### 阶段四：任务执行引擎（预计 3-4 天）

**目标**：实现任务的执行和监控

1. **任务执行器**
   - 重构现有 FFmpeg 处理逻辑
   - 支持任务暂停/恢复
   - 支持进度回调

2. **并发控制**
   - 实现多任务并发
   - 实现线程数控制
   - 资源使用优化

3. **错误处理**
   - 任务失败重试
   - 错误信息记录
   - 异常恢复

**交付物**：
- 稳定的任务执行引擎
- 完善的错误处理机制

---

### 阶段五：完善和优化（预计 2-3 天）

**目标**：优化用户体验和系统稳定性

1. **性能优化**
   - 大量任务的虚拟列表
   - 数据库查询优化
   - 内存使用优化

2. **用户体验**
   - 任务完成通知
   - 快捷键支持
   - 批量操作

3. **数据管理**
   - 任务历史清理
   - 数据导出/导入
   - 数据备份恢复

**交付物**：
- 性能优化报告
- 用户体验改进
- 完整的测试用例

---

## 八、技术风险和应对

### 8.1 风险列表

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| better-sqlite3 编译问题 | 高 | 提供 fallback 到 sql.js |
| 任务执行中断电 | 中 | 定期保存进度，支持断点续传 |
| 大量任务性能问题 | 中 | 虚拟列表、分页加载 |
| 并发冲突 | 中 | 使用数据库事务 |

### 8.2 回滚方案

- 保留原有的「立即执行」功能
- 数据库损坏时自动重建
- 配置文件备份机制

---

## 九、验收标准

### 9.1 功能验收

- [ ] 可以在任意功能模块添加任务
- [ ] 添加任务后界面不阻塞
- [ ] 任务中心可查看所有任务
- [ ] 可暂停/恢复/取消任务
- [ ] 可修改未开始任务的输出目录
- [ ] 关闭软件后重新打开任务仍在
- [ ] 可设置并发数和线程数
- [ ] 任务日志实时显示
- [ ] 任务完成后可预览输出文件

### 9.2 性能验收

- [ ] 支持 1000+ 任务不卡顿
- [ ] 任务列表滚动流畅（60fps）
- [ ] 数据库操作响应 < 100ms

### 9.3 稳定性验收

- [ ] 连续运行 24 小时无崩溃
- [ ] 异常断电后数据完整
- [ ] 内存使用稳定，无泄漏

---

## 十、附录

### 10.1 参考实现

- Electron 任务管理：[electron-builder](https://github.com/electron-userland/electron-builder)
- 任务队列：[bull](https://github.com/OptimalBits/bull)
- 数据库：[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

### 10.2 相关文档

- [数据库详细设计](./task-center-database.md)
- [API 接口文档](./task-center-api.md)
- [UI 设计稿](./task-center-ui.md)
