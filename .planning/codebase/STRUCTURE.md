# 项目结构文档

**分析日期:** 2026-03-24

## 目录结构概览

```
/Users/luwei/code/freelance/VideoStitcher/.worktrees/aside-video-production/
├── build/                    # 构建资源（图标、配置）
├── config/                   # 应用配置
├── docs/                     # 文档目录
├── out/                      # 编译输出（主进程、预加载脚本）
├── scripts/                  # 构建脚本
├── src/
│   ├── main/                 # 主进程代码
│   ├── preload/              # 预加载脚本
│   ├── renderer/             # 渲染进程代码
│   └── shared/               # 共享代码
├── test/                     # 测试文件
├── .claude/                  # Claude 配置文档
├── .planning/                # 规划文档
├── package.json              # 项目配置
├── electron.vite.config.ts   # Electron Vite 配置
├── tsconfig.json             # TypeScript 配置
└── vitest.config.ts          # 测试配置
```

## 详细目录说明

### 根目录

| 文件/目录 | 用途 |
|-----------|------|
| `build/` | 应用图标、构建配置资源 |
| `config/` | 运行时配置文件 |
| `docs/` | 项目文档、使用指南 |
| `out/` | 编译后的主进程和预加载脚本输出 |
| `scripts/` | 图标生成等构建辅助脚本 |
| `test/` | Playwright E2E 测试 |

### src/main/ - 主进程

**位置:** `src/main/`

**用途:** Electron 主进程，负责系统级操作

```
src/main/
├── ai/                       # AI 系统
│   ├── adapters/             # AI 提供商适配器
│   ├── agents/               # Agent 实现
│   │   ├── creative-direction/
│   │   ├── screenplay/
│   │   └── writer-generator/
│   ├── config/               # AI 配置
│   ├── prompts/              # 提示词模板
│   ├── providers/            # AI 提供商实现
│   ├── registry/             # 模型注册表
│   ├── types/                # AI 类型定义
│   ├── utils/                # AI 工具函数
│   ├── workflows/            # LangGraph 工作流
│   │   ├── config/           # 工作流配置
│   │   ├── nodes/            # 工作流节点
│   │   ├── executor.ts       # 执行器
│   │   ├── graph.ts          # 工作流图
│   │   └── state.ts          # 状态定义
│   ├── provider-manager.ts   # 提供商管理器
│   └── UnifiedModel.ts       # 统一模型接口
├── api/                      # 外部 API 调用
├── database/                 # 数据库层
│   ├── migrations/           # 数据库迁移
│   ├── repositories/         # 数据仓储
│   │   ├── asideCreativeDirectionRepository.ts
│   │   ├── asidePersonaRepository.ts
│   │   ├── asideProjectRepository.ts
│   │   ├── asideRegionRepository.ts
│   │   ├── asideScreenplayRepository.ts
│   │   ├── config.repository.ts
│   │   ├── regionRepository.ts
│   │   ├── task-log.repository.ts
│   │   └── task.repository.ts
│   └── index.ts              # 数据库初始化
├── ipc/                      # IPC 处理器
│   ├── ai-workflow-handlers.ts
│   ├── aside-handlers.ts     # AI 视频生产
│   ├── auth.ts               # 授权验证
│   ├── database.ts           # 数据库管理
│   ├── director-mode-handlers.ts
│   ├── file-explorer.ts      # 文件浏览
│   ├── image.ts              # 图片处理
│   ├── region-handlers.ts    # 地区管理
│   ├── system.ts             # 系统信息
│   ├── task.ts               # 任务中心
│   ├── taskGenerator.ts      # 任务生成
│   └── video.ts              # 视频处理
├── models/                   # 数据模型（ORM）
├── services/                 # 业务服务
│   ├── ProcessMonitor.ts     # 进程监控
│   └── TaskQueueManager.ts   # 任务队列管理
├── utils/                    # 工具函数
│   ├── logger.ts             # 日志系统
│   └── ...
├── workers/                  # Worker 线程
├── autoUpdater.ts            # 自动更新
├── index.ts                  # 主进程入口
├── init.ts                   # 启动初始化
├── ipc-handlers.ts           # IPC 处理器注册
└── updater.ts                # 更新逻辑
```

### src/preload/ - 预加载脚本

**位置:** `src/preload/`

**用途:** 桥接主进程和渲染进程，暴露安全的 API

```
src/preload/
└── index.ts                  # 预加载脚本入口
```

### src/renderer/ - 渲染进程

**位置:** `src/renderer/`

**用途:** React 应用，负责 UI 渲染

```
src/renderer/
├── api/                      # API 调用封装
├── components/               # 通用组件
│   ├── Button/               # 按钮组件
│   ├── ConfirmDialog/        # 确认对话框
│   ├── ErrorBoundary/        # 错误边界
│   ├── FileSelector/         # 文件选择器
│   ├── OperationLogPanel/    # 操作日志面板
│   ├── ProgressBar/          # 进度条
│   ├── Radio/                # 单选组件
│   ├── Skeleton/             # 骨架屏
│   ├── TaskCenter/           # 任务中心组件
│   ├── TaskList/             # 任务列表
│   ├── TextCollapse/         # 文本折叠
│   ├── Toast/                # 吐司提示
│   └── VideoPlayer/          # 视频播放器
├── contexts/                 # React Context
│   └── TaskContext.tsx       # 任务中心上下文
├── features/                 # 功能模式页面
│   ├── AdminMode.tsx         # 系统管理
│   ├── CoverCompressMode.tsx # 封面压缩
│   ├── CoverFormatMode/      # 封面格式转换
│   ├── FileNameExtractorMode.tsx
│   ├── ImageMaterialMode/    # 图片素材处理
│   ├── LosslessGridMode/     # 无损九宫格
│   ├── ResizeMode/           # 智能改尺寸
│   ├── UnauthorizedMode.tsx  # 未授权页面
│   ├── VideoMergeMode.tsx    # 横竖屏极速合成
│   └── VideoStitcherMode.tsx # A+B 前后拼接
├── hooks/                    # 自定义 Hooks
│   ├── useAddToTaskCenter.ts
│   ├── useConcurrencyCache.ts
│   ├── useConfirm.ts
│   ├── useGlobalSettings.ts
│   ├── useImageMaterials.ts
│   ├── useMergePreview.ts
│   ├── useOperationLogs.ts
│   ├── usePreviewCache.ts
│   ├── useStitchPreview.ts
│   ├── useTaskSubscription.ts
│   └── useVideoMaterials.ts
├── lib/                      # 第三方库封装
├── pages/                    # 页面级组件
│   ├── AICreative/           # AI 创意视频入口
│   │   ├── index.tsx
│   │   ├── AgentStudioPage.tsx
│   │   ├── AgentConfigPage.tsx
│   │   ├── AICreativeSettingsPage.tsx
│   │   └── AICreativeRegionSettingsPage.tsx
│   └── ASide/                # A面视频生产
│       ├── index.tsx
│       └── components/       # ASide 子组件
│           ├── CreativeDirectionSelector/
│           ├── DirectorMode/
│           ├── PersonaManager/
│           ├── ProductionQueue/
│           ├── ProjectLibrary/
│           ├── QuickCompose/
│           ├── RegionSelector/
│           ├── ScreenplayGenerator/
│           ├── Settings/
│           └── StepLayout/
├── stores/                   # Zustand 状态存储
│   └── asideStore.ts         # ASide 状态
├── utils/                    # 工具函数
├── App.tsx                   # 应用根组件
├── index.html                # HTML 模板
└── main.tsx                  # 渲染进程入口
```

### src/shared/ - 共享代码

**位置:** `src/shared/`

**用途:** 主进程和渲染进程共享的类型和工具

```
src/shared/
├── constants/                # 常量定义
│   ├── promptTemplates.ts    # 提示词模板
│   ├── regionPresets.ts      # 地区预设
│   └── screenplayAgentTemplates.ts
├── ffmpeg/                   # FFmpeg 相关工具
├── sharp/                    # Sharp 图片处理工具
├── types/                    # TypeScript 类型
│   ├── aside.ts              # AI 视频生产类型
│   └── task.ts               # 任务中心类型
└── utils/                    # 共享工具函数
```

## 关键文件位置

### 入口文件

| 文件 | 用途 |
|------|------|
| `src/main/index.ts` | 主进程入口，窗口创建和初始化 |
| `src/preload/index.ts` | 预加载脚本入口，API 暴露 |
| `src/renderer/main.tsx` | 渲染进程入口，React 挂载 |
| `src/renderer/App.tsx` | 应用根组件，路由配置 |

### 配置文件

| 文件 | 用途 |
|------|------|
| `electron.vite.config.ts` | Electron Vite 构建设置 |
| `tsconfig.json` | TypeScript 编译配置 |
| `tsconfig.node.json` | Node 环境 TS 配置 |
| `vitest.config.ts` | 单元测试配置 |
| `playwright.config.ts` | E2E 测试配置 |
| `electron-builder.yml` | 应用打包配置 |

### 核心类型定义

| 文件 | 用途 |
|------|------|
| `src/shared/types/task.ts` | 任务中心类型定义 |
| `src/shared/types/aside.ts` | AI 视频生产类型定义 |
| `src/main/ai/workflows/state.ts` | 工作流状态类型 |

## 命名约定

### 文件命名

| 类型 | 模式 | 示例 |
|------|------|------|
| 组件 | PascalCase.tsx | `VideoMergeMode.tsx` |
| 工具函数 | camelCase.ts | `useMergePreview.ts` |
| 类型定义 | camelCase.ts | `task.ts` |
| 常量 | UPPER_SNAKE_CASE | `WORKFLOW_STEPS` |
| 样式模块 | kebab-case.module.css | `button.module.css` |

### 目录命名

| 类型 | 模式 | 示例 |
|------|------|------|
| 功能模块 | PascalCase | `ImageMaterialMode/` |
| 通用组件 | PascalCase | `ConfirmDialog/` |
| 工具目录 | camelCase | `hooks/`, `utils/` |
| 类型目录 | camelCase | `types/` |

### 代码命名

| 类型 | 模式 | 示例 |
|------|------|------|
| 组件 | PascalCase | `VideoMergeMode` |
| 函数 | camelCase | `useMergePreview` |
| 变量 | camelCase | `taskQueue` |
| 常量 | UPPER_SNAKE_CASE | `MAX_CONCURRENT_TASKS` |
| 类型/接口 | PascalCase | `TaskConfig`, `IRepository` |
| 枚举 | PascalCase | `TaskStatus` |

## 添加新代码的指南

### 添加新功能模式

1. **创建功能组件:**
   ```
   src/renderer/features/NewFeatureMode.tsx
   ```

2. **添加 IPC 处理器:**
   ```
   src/main/ipc/new-feature-handlers.ts
   ```

3. **在预加载脚本暴露 API:**
   ```
   src/preload/index.ts (添加接口定义)
   ```

4. **注册路由:**
   ```
   src/renderer/App.tsx
   ```

### 添加新数据库实体

1. **定义类型:**
   ```
   src/shared/types/newEntity.ts
   ```

2. **创建 Repository:**
   ```
   src/main/database/repositories/newEntityRepository.ts
   ```

3. **添加迁移:**
   ```
   src/main/database/migrations/xxx_add_new_entity.sql
   ```

### 添加新 AI Agent

1. **创建 Agent 实现:**
   ```
   src/main/ai/agents/new-agent/index.ts
   ```

2. **添加工作流节点:**
   ```
   src/main/ai/workflows/nodes/newAgent.ts
   ```

3. **更新工作流图:**
   ```
   src/main/ai/workflows/graph.ts
   ```

## 特殊目录说明

### build/

- **用途:** 应用图标和构建资源
- **生成:** 部分文件由 `scripts/generate-icons.js` 生成
- **提交:** 是，需要提交到版本控制

### out/

- **用途:** 编译输出目录
- **生成:** 由 `electron-vite build` 生成
- **提交:** 否，已加入 `.gitignore`

### node_modules/

- **用途:** 依赖包
- **提交:** 否，已加入 `.gitignore`

### .planning/

- **用途:** 项目规划和代码库文档
- **提交:** 是，包含架构文档和规划

---

*结构分析: 2026-03-24*
