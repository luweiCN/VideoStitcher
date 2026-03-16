# VideoStitcher 工程架构设计

> 本文档说明项目的工程目录结构，特别是 AI 功能与传统后端服务的组织方式

---

## 📁 完整目录结构

```
VideoStitcher/
│
├── src/
│   ├── main/                    # Electron 主进程（后端）
│   │   │
│   │   ├── langgraph/           # ✅ AI 工作流（LangGraph）
│   │   │   ├── nodes/           # Agent 节点
│   │   │   │   ├── scriptNode.ts         # 脚本生成
│   │   │   │   ├── characterNode.ts      # 人物设定
│   │   │   │   ├── storyboardNode.ts     # 分镜生成
│   │   │   │   └── videoNode.ts          # 视频生成
│   │   │   ├── graph.ts         # 工作流图定义
│   │   │   ├── state.ts         # 状态定义
│   │   │   ├── taskManager.ts   # 任务管理
│   │   │   └── index.ts
│   │   │
│   │   ├── models/              # ✅ AI 模型
│   │   │   ├── llm/
│   │   │   │   └── doubao.ts    # 豆包大模型
│   │   │   └── embeddings/
│   │   │       └── doubao.ts    # 豆包 Embeddings
│   │   │
│   │   ├── api/                 # ✅ API 客户端
│   │   │   ├── volcano-client.ts    # 火山引擎客户端
│   │   │   └── index.ts
│   │   │
│   │   ├── rag/                 # ✅ RAG 知识库
│   │   │   └── vectorStore.ts   # 向量存储
│   │   │
│   │   ├── database/            # ✅ 数据库层
│   │   │   ├── migrations/      # 数据库迁移
│   │   │   └── repositories/    # Repository 模式
│   │   │       ├── asideProjectRepository.ts
│   │   │       ├── asideScriptRepository.ts
│   │   │       └── ...
│   │   │
│   │   ├── ipc/                 # ✅ IPC 处理器
│   │   │   ├── aside-handlers.ts    # A 面 IPC
│   │   │   ├── task.ts              # 任务中心 IPC
│   │   │   ├── video.ts             # 视频 IPC
│   │   │   └── ...
│   │   │
│   │   ├── services/            # ✅ 业务服务层
│   │   │   ├── TaskQueue.ts         # 任务队列
│   │   │   ├── TaskQueueManager.ts  # 任务管理器
│   │   │   ├── KnowledgeBase.ts     # 知识库
│   │   │   ├── ProcessMonitor.ts    # 进程监控
│   │   │   └── ProjectStorage.ts    # 项目存储
│   │   │
│   │   ├── workers/             # ✅ 工作线程
│   │   │   └── imageWorker.ts       # 图片处理 Worker
│   │   │
│   │   ├── utils/               # ✅ 工具函数
│   │   │   └── logger.ts            # 日志工具
│   │   │
│   │   └── index.ts             # 主入口
│   │
│   ├── shared/                  # 共享模块（主进程 + 渲染进程）
│   │   │
│   │   ├── ffmpeg/              # ✅ FFmpeg 封装
│   │   │   ├── ffmpeg.ts            # FFmpeg 核心封装
│   │   │   ├── ffprobe.ts           # FFprobe 封装
│   │   │   ├── stitch.ts            # 视频拼接
│   │   │   ├── merge.ts             # 视频合并
│   │   │   ├── resize.ts            # 视频改尺寸
│   │   │   ├── queue.ts             # 任务队列
│   │   │   └── types.ts             # 类型定义
│   │   │
│   │   ├── sharp/               # ✅ Sharp 图片处理
│   │   │   ├── compress.ts          # 图片压缩
│   │   │   ├── convert.ts           # 格式转换
│   │   │   ├── grid.ts              # 多宫格
│   │   │   ├── material.ts          # 图片素材
│   │   │   └── types.ts
│   │   │
│   │   ├── types/               # ✅ 共享类型定义
│   │   │   ├── aside.ts             # A 面类型
│   │   │   └── task.ts              # 任务类型
│   │   │
│   │   ├── constants/           # ✅ 常量
│   │   │   ├── asidePresets.ts      # A 面预设
│   │   │   └── regions.ts           # 区域数据
│   │   │
│   │   └── utils/               # ✅ 工具函数
│   │       ├── fileNameHelper.ts    # 文件名处理
│   │       ├── license.ts           # 授权工具
│   │       └── safeOutput.ts        # 安全输出
│   │
│   └── renderer/                # Electron 渲染进程（前端）
│       ├── pages/
│       ├── components/
│       ├── stores/
│       └── ...
│
├── package.json
├── tsconfig.json
└── ...
```

---

## 🎯 分层架构

### Layer 1: 共享层（Shared Layer）
**位置:** `src/shared/`

**职责:**
- ✅ 封装第三方工具（FFmpeg、Sharp）
- ✅ 定义共享类型
- ✅ 提供通用工具函数

**特点:**
- 主进程和渲染进程都可以使用
- 纯函数，无副作用
- 无状态

**示例:**
```typescript
// src/shared/ffmpeg/stitch.ts
export function buildStitchCommand(config: StitchConfig): string[] {
  // 纯函数：构建 FFmpeg 命令
  return ['-i', config.input, '-c:v', 'libx264', ...];
}

// src/shared/sharp/compress.ts
export async function compressImage(input: string, output: string): Promise<void> {
  // Sharp 图片压缩
  await sharp(input).jpeg({ quality: 80 }).toFile(output);
}
```

### Layer 2: 服务层（Service Layer）
**位置:** `src/main/services/`

**职责:**
- ✅ 业务逻辑封装
- ✅ 任务调度和管理
- ✅ 数据处理和转换

**特点:**
- 主进程专用
- 有状态（如任务队列）
- 协调多个底层模块

**示例:**
```typescript
// src/main/services/TaskQueueManager.ts
export class TaskQueueManager {
  private queue: TaskQueue;
  private running: Task[] = [];

  async startTask(task: Task): Promise<void> {
    // 业务逻辑：启动任务
    const command = buildStitchCommand(task.params); // 使用 shared 层
    await this.queue.add(command);
  }
}
```

### Layer 3: AI 层（AI Layer）
**位置:** `src/main/langgraph/` + `src/main/models/` + `src/main/api/`

**职责:**
- ✅ AI 工作流编排
- ✅ LLM 调用
- ✅ AI 服务集成

**特点:**
- 主进程专用
- 使用 LangGraph 编排
- 调用火山引擎等 AI 服务

**示例:**
```typescript
// src/main/langgraph/nodes/scriptNode.ts
export async function scriptNode(state: GraphStateType) {
  // 1. 调用 LLM 生成脚本
  const llm = new DoubaoLLM({ apiKey: '...' });
  const script = await llm.generateText(state.userRequirement);

  // 2. 更新状态
  return {
    scripts: [...state.scripts, script],
  };
}

// src/main/langgraph/graph.ts
const workflow = new StateGraph(GraphState);
workflow.addNode('script', scriptNode);
workflow.addNode('character', characterNode);
// ...
```

### Layer 4: 数据层（Data Layer）
**位置:** `src/main/database/`

**职责:**
- ✅ 数据持久化
- ✅ Repository 模式
- ✅ 数据库迁移

**特点:**
- 主进程专用
- SQLite 数据库
- Repository 抽象

**示例:**
```typescript
// src/main/database/repositories/asideProjectRepository.ts
export class AsideProjectRepository {
  createProject(name: string, gameType: GameType): Project {
    // 数据库操作
    const stmt = db.prepare('INSERT INTO aside_projects ...');
    stmt.run(name, gameType);
    return { id, name, gameType, ... };
  }
}
```

### Layer 5: IPC 层（IPC Layer）
**位置:** `src/main/ipc/`

**职责:**
- ✅ IPC 通信处理
- ✅ 路由分发
- ✅ 权限验证

**特点:**
- 主进程专用
- 处理渲染进程请求
- 调用下层服务

**示例:**
```typescript
// src/main/ipc/aside-handlers.ts
export function registerAsideHandlers() {
  ipcMain.handle('aside:createProject', async (event, name, gameType) => {
    // 1. 调用 Repository
    const project = asideProjectRepository.createProject(name, gameType);

    // 2. 返回结果
    return { success: true, project };
  });
}
```

---

## 🔗 层级依赖关系

```
┌─────────────────────────────────────────────────┐
│  IPC Layer (ipc/)                               │ ← 渲染进程入口
│  - 处理 IPC 请求                                 │
│  - 路由分发                                      │
└────────────┬────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────┐
│  Service Layer (services/)                      │
│  - TaskQueueManager                              │
│  - KnowledgeBase                                 │
└────────────┬────────────────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ↓             ↓
┌──────────┐  ┌──────────────────────────────────┐
│ AI Layer │  │ Data Layer (database/)            │
│ (langgraph/) │ - Repository 模式                │
│ - Agent 节点   │ - SQLite 操作                    │
│ - 工作流编排   └────────────┬─────────────────────┘
└─────┬────┘               │
      │                    │
      └────────┬───────────┘
               │
               ↓
┌─────────────────────────────────────────────────┐
│  Shared Layer (shared/)                         │ ← 底层工具
│  - FFmpeg 封装                                   │
│  - Sharp 封装                                    │
│  - 工具函数                                      │
└─────────────────────────────────────────────────┘
```

---

## 🎨 AI 功能与传统后端的组织方式

### 核心原则
**AI 功能和传统后端服务是平级的，但有清晰的边界**

### 组织方式
```
src/main/
│
├── langgraph/          # AI 工作流（新增）
│   ├── nodes/          # Agent 实现
│   ├── graph.ts        # 工作流定义
│   └── state.ts        # 状态管理
│
├── models/             # AI 模型（新增）
│   ├── llm/            # 大语言模型
│   └── embeddings/     # 向量模型
│
├── api/                # API 客户端（新增）
│   └── volcano-client.ts
│
├── rag/                # RAG 知识库（新增）
│   └── vectorStore.ts
│
├── services/           # 传统业务服务（已有）
│   ├── TaskQueue.ts
│   ├── KnowledgeBase.ts
│   └── ...
│
└── database/           # 数据库（已有）
    └── repositories/
```

### 依赖关系
```
IPC Handler
    ↓
    ├─→ LangGraph Workflow  → AI 服务
    │       ↓
    │   Repository (database)
    │
    └─→ TaskQueueManager  → FFmpeg/Sharp
            ↓
        Repository (database)
```

### 关键设计点

#### 1. AI 模块独立
```typescript
// ✅ AI 相关代码集中在 langgraph/ 和 models/
src/main/langgraph/    # 工作流
src/main/models/       # 模型
src/main/api/          # API 客户端
```

#### 2. 传统工具在 Shared
```typescript
// ✅ FFmpeg 和 Sharp 在 shared/，方便复用
src/shared/ffmpeg/     # FFmpeg 工具
src/shared/sharp/      # Sharp 工具
```

#### 3. 服务层协调
```typescript
// ✅ Service 层协调 AI 和传统工具
class TaskQueueManager {
  async executeTask(task: Task) {
    if (task.type === 'ai_video') {
      // 调用 LangGraph
      await langgraphApp.invoke(state);
    } else {
      // 调用传统工具
      await runFfmpeg(task.command);
    }
  }
}
```

#### 4. IPC 统一入口
```typescript
// ✅ 所有请求通过 IPC 进入
ipcMain.handle('task:start', async (event, taskId) => {
  return taskQueueManager.startTask(taskId);
});
```

---

## 📦 模块职责清单

| 模块 | 职责 | 依赖 | 示例 |
|------|------|------|------|
| **langgraph/** | AI 工作流编排 | models/, api/ | scriptNode.ts |
| **models/** | AI 模型封装 | api/ | doubao.ts |
| **api/** | API 客户端 | - | volcano-client.ts |
| **rag/** | 知识库检索 | models/ | vectorStore.ts |
| **services/** | 业务逻辑 | shared/, database/ | TaskQueueManager.ts |
| **database/** | 数据持久化 | - | asideProjectRepository.ts |
| **ipc/** | IPC 通信 | services/, langgraph/ | aside-handlers.ts |
| **shared/ffmpeg/** | FFmpeg 工具 | - | stitch.ts |
| **shared/sharp/** | Sharp 工具 | - | compress.ts |

---

## ✅ 架构优势

### 1. 清晰的分层
- AI 功能独立，不影响传统代码
- 传统工具在 shared，方便复用
- 每层职责明确

### 2. 易于扩展
- 添加新的 AI 服务商：只需在 `api/` 和 `models/` 添加
- 添加新的传统工具：只需在 `shared/` 添加
- 添加新的工作流：只需在 `langgraph/nodes/` 添加

### 3. 易于维护
- AI 代码集中，不会和 FFmpeg 混在一起
- 共享工具独立，便于测试
- 服务层协调，职责清晰

### 4. 易于测试
- 每层可以独立测试
- Mock 依赖容易
- 单元测试 + 集成测试

---

## 🚀 扩展指南

### 添加新的 AI 功能
```
1. 在 models/ 添加模型封装
2. 在 langgraph/nodes/ 添加 Agent 节点
3. 在 langgraph/graph.ts 更新工作流
4. 在 ipc/ 添加 IPC 处理器
```

### 添加新的传统工具
```
1. 在 shared/ 添加工具封装（如 shared/pdf/）
2. 在 services/ 使用新工具
3. 在 ipc/ 暴露 API
```

### 集成新的 AI 服务商
```
1. 在 api/ 添加客户端（如 api/openai-client.ts）
2. 在 models/ 添加模型（如 models/llm/openai.ts）
3. 在配置中选择服务商
```

---

**创建时间:** 2026-03-17
**作者:** Claude
**适用人群:** 项目开发者
