# 架构文档

**分析日期:** 2026-03-24

## 系统架构概述

VideoStitcher 是一款基于 Electron 的全能视频批处理工具箱，采用经典的双进程架构（主进程 + 渲染进程），结合现代化的前端技术栈和 AI 能力。

### 整体架构模式

**架构类型:** Electron 桌面应用 + 模块化功能设计

**关键特征:**
- **多进程架构**: 主进程负责系统级操作，渲染进程负责 UI 交互
- **模块化设计**: 功能按模式（Mode）划分，每个模式独立维护状态和逻辑
- **IPC 通信**: 通过预加载脚本桥接主进程和渲染进程
- **任务队列**: 集中式任务管理，支持并发控制和状态持久化
- **AI 工作流**: 基于 LangGraph 的多 Agent 协作流程

## 主要模块和组件

### 1. 主进程层 (Main Process)

**位置:** `src/main/`

**职责:**
- 窗口管理
- 文件系统操作
- FFmpeg 视频处理
- 数据库访问
- AI 模型调用
- 任务调度执行

**核心模块:**

| 模块 | 路径 | 职责 |
|------|------|------|
| IPC 处理器 | `src/main/ipc/` | 处理渲染进程的 IPC 调用 |
| 数据库 | `src/main/database/` | SQLite 数据库操作和仓储模式 |
| AI 系统 | `src/main/ai/` | LangChain/LangGraph AI 工作流 |
| 服务层 | `src/main/services/` | 任务队列管理、进程监控 |
| 工具函数 | `src/main/utils/` | 日志、文件操作等工具 |

### 2. 渲染进程层 (Renderer Process)

**位置:** `src/renderer/`

**职责:**
- UI 渲染和用户交互
- 状态管理
- 路由导航
- 预览生成

**核心模块:**

| 模块 | 路径 | 职责 |
|------|------|------|
| 功能模式 | `src/renderer/features/` | 各功能模式的页面组件 |
| 页面 | `src/renderer/pages/` | 路由级页面组件 |
| 组件库 | `src/renderer/components/` | 通用 UI 组件 |
| 状态管理 | `src/renderer/stores/` | Zustand 状态存储 |
| 自定义 Hooks | `src/renderer/hooks/` | 业务逻辑封装 |

### 3. 预加载脚本 (Preload)

**位置:** `src/preload/index.ts`

**职责:**
- 定义 `window.api` 接口
- 桥接主进程和渲染进程的 IPC 通信
- 类型安全的 API 暴露

### 4. 共享层 (Shared)

**位置:** `src/shared/`

**职责:**
- 类型定义共享
- 工具函数共享
- 常量定义

## 数据流和通信模式

### IPC 通信架构

```
渲染进程 (Renderer)          主进程 (Main)
     |                            |
     |  ipcRenderer.invoke()      |
     |--------------------------->|
     |                            |
     |  ipcRenderer.on()          |
     |<---------------------------|
     |                            |
```

**通信模式:**
1. **请求-响应**: 渲染进程调用 `window.api.xxx()`，主进程通过 `ipcMain.handle()` 处理
2. **事件推送**: 主进程通过 `webContents.send()` 主动推送状态更新

**主要 IPC 通道:**
- `task-center:state` - 任务中心状态广播
- `task-center:log` - 任务日志广播
- `task:updated/completed/failed/cancelled` - 任务状态变更

### 数据流

**任务创建流程:**
```
1. 用户在渲染进程配置任务
2. 调用 window.api.addTask() 发送到主进程
3. 主进程写入数据库 (taskRepository)
4. TaskQueueManager 检测到新任务
5. 启动 FFmpeg 进程执行任务
6. 通过 IPC 推送进度和结果
```

**AI 工作流流程:**
```
1. 用户输入脚本和配置
2. LangGraph 工作流执行器按步骤调用 Agent
3. 每个 Agent 调用 LLM 生成内容
4. 状态在 WorkflowState 中累积
5. 最终结果返回渲染进程
```

## 设计模式和原则

### 1. 仓储模式 (Repository Pattern)

**应用位置:** `src/main/database/repositories/`

**实现:**
- 每个数据实体对应一个 Repository
- 封装数据库操作细节
- 提供类型安全的 CRUD 接口

**示例 Repository:**
- `task.repository.ts` - 任务数据管理
- `asideProjectRepository.ts` - AI 项目数据管理
- `asideScreenplayRepository.ts` - 剧本数据管理

### 2. 单例模式

**应用:**
- `TaskQueueManager` - 全局任务队列管理器
- 数据库连接实例

### 3. 观察者模式

**应用:**
- IPC 事件监听
- 任务状态变更通知
- 系统状态广播

### 4. 策略模式

**应用:**
- AI Provider 切换（OpenAI、火山引擎等）
- 视频处理模式（合并、改尺寸、拼接等）

### 5. 工作流模式

**应用位置:** `src/main/ai/workflows/`

**实现:**
- 基于 LangGraph 的状态机工作流
- 5 个 Agent 节点顺序执行
- 支持导演模式（人工确认）和快速模式（自动执行）

## 核心子系统详解

### 任务队列系统

**核心类:** `TaskQueueManager` (`src/main/services/TaskQueueManager.ts`)

**功能:**
- 任务状态管理 (pending → running → completed/failed/cancelled)
- 并发控制 (可配置最大并发数和每任务线程数)
- 进程管理 (记录 PID，支持取消任务)
- 持久化 (数据库保存任务状态和输出)

**状态流转:**
```
pending → running → completed
   ↓         ↓
cancelled  failed
```

### AI 工作流系统

**核心文件:**
- `src/main/ai/workflows/graph.ts` - LangGraph 工作流图定义
- `src/main/ai/workflows/executor.ts` - 工作流执行器
- `src/main/ai/workflows/state.ts` - 工作流状态定义

**5 个 Agent 节点:**
1. **剧本写作** (screenplay) - 根据输入生成剧本
2. **艺术总监** (art_director) - 提炼剧本精华、创作角色
3. **选角导演** (casting_director) - 生成人物图像提示词
4. **分镜设计** (storyboard_artist) - 生成分镜图
5. **摄像师** (cinematographer) - 生成视频合成计划

### 数据库系统

**技术:** SQLite (better-sqlite3)

**核心表:**
- `tasks` - 任务主表
- `task_files` - 任务文件关联
- `task_outputs` - 任务输出文件
- `task_logs` - 任务执行日志
- `aside_projects` - AI 项目
- `aside_screenplays` - 剧本数据
- `config` - 应用配置

## 模块依赖关系

```
main/
├── ipc/          → 依赖 services/, database/, ai/
├── services/     → 依赖 database/, utils/
├── database/     → 依赖 shared/types/
├── ai/           → 依赖 database/, shared/
└── utils/        → 无依赖

renderer/
├── features/     → 依赖 components/, hooks/, stores/
├── pages/        → 依赖 features/, components/
├── components/   → 依赖 hooks/, stores/
├── hooks/        → 依赖 stores/
└── stores/       → 依赖 api/ (通过 window.api)

shared/
└── types/        → 无依赖，被所有层引用
```

## 扩展点

### 添加新功能模式

1. 在 `src/renderer/features/` 创建新模式组件
2. 在 `src/main/ipc/` 添加对应的 IPC 处理器
3. 在 `src/preload/index.ts` 暴露 API 接口
4. 在 `src/renderer/App.tsx` 添加路由

### 添加新 AI Agent

1. 在 `src/main/ai/agents/` 创建 Agent 实现
2. 在 `src/main/ai/workflows/nodes/` 添加节点处理函数
3. 在 `src/main/ai/workflows/graph.ts` 更新工作流图
4. 在 `src/main/ai/workflows/state.ts` 更新状态类型

### 添加新数据库实体

1. 在 `src/shared/types/` 定义类型
2. 在 `src/main/database/` 添加表迁移
3. 在 `src/main/database/repositories/` 创建 Repository

---

*架构分析: 2026-03-24*
