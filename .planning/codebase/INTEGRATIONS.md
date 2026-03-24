# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**AI Services:**
- 火山引擎（VolcEngine）- 主要 AI 能力提供商
  - SDK/Client: 自定义实现（`src/main/api/volcano-client.ts`、`src/main/ai/providers/volcengine/`）
  - Auth: VOLCANO_ENGINE_API_KEY（环境变量）
  - 能力：
    - 豆包大语言模型（文本生成）
    - Seedream 3.0（图片生成）
    - 视频生成 API
  - 端点：`https://ark.cn-beijing.volces.com/api/v3`

**LangChain Ecosystem:**
- @langchain/core - 核心抽象和接口
- @langchain/langgraph - AI 工作流图编排（导演模式工作流）
- @langchain/openai - OpenAI 兼容 API 支持

## Data Storage

**Databases:**
- SQLite（better-sqlite3）- 本地关系型数据库
  - 位置：用户数据目录（`app.getPath('userData')/VideoStitcher.db`）
  - 功能：任务管理、配置存储、知识库文档
  - WAL 模式启用，支持高性能并发

**Vector Storage:**
- sqlite-vec - SQLite 向量扩展
  - 用途：RAG（检索增强生成）知识库
  - 表：`knowledge_documents`、`knowledge_vectors`
  - 向量维度：依赖豆包嵌入模型

**File Storage:**
- 本地文件系统 - 视频、图片、项目文件存储
- 备份目录：`userData/backups/` - 数据库备份

**Caching:**
- 内存缓存 - `src/main/utils/cache.ts` 实现的 LRU 缓存
- SQLite 缓存 - 64MB 缓存配置

## Authentication & Identity

**Auth Provider:**
- 自定义实现 - 基于 node-machine-id 的机器标识
- 实现位置：`src/main/ipc/auth.ts`
- 方式：本地机器 ID 绑定，无云端认证

## Media Processing

**Video Processing:**
- FFmpeg（ffmpeg-static）- 视频编码/解码/处理
- FFprobe（@ffprobe-installer/ffprobe）- 视频元数据解析

**Image Processing:**
- Sharp - 高性能图像处理（调整大小、格式转换、压缩）
- 自定义 Worker：`src/main/workers/imageWorker.ts`

## Monitoring & Observability

**Error Tracking:**
- electron-log - 本地日志文件记录
- 位置：`src/main/utils/logger.ts`
- 日志文件：用户数据目录下的 logs/

**Logs:**
- 结构化日志输出（主进程和渲染进程）
- 日志级别：info、warn、error
- 中文日志输出（遵循项目规范）

## CI/CD & Deployment

**Hosting:**
- GitHub Releases - 自动更新分发
- 配置：`electron-builder.yml` 中的 publish 配置

**Auto Updater:**
- electron-updater - 自动更新检查
- 实现：`src/main/autoUpdater.ts`
- 支持平台：macOS（ZIP）、Windows（NSIS）

**Build Pipeline:**
- electron-builder - 跨平台打包
- 支持：macOS (DMG/ZIP)、Windows (NSIS)、Linux (deb/rpm/AppImage)

## Environment Configuration

**Required env vars:**
- `VOLCANO_ENGINE_API_KEY` - 火山引擎 API 密钥（AI 功能必需）

**Optional env vars:**
- `VOLCANO_ENGINE_API_BASE_URL` - 自定义 API 端点
- `VOLCANO_ENGINE_MODEL` - 默认模型（默认：doubao-pro-32k）
- `ELECTRON_RENDERER_URL` - 开发模式 Vite 服务器 URL

**Secrets location:**
- `.env` 文件（本地开发，已加入 .gitignore）
- 打包后：环境变量需通过应用配置管理

## Webhooks & Callbacks

**Incoming:**
- 无 - 纯桌面应用，无服务端 webhook

**Outgoing:**
- 火山引擎 API 调用 - LLM、图片生成、视频生成
- GitHub API - 自动更新检查（electron-updater）

## Network & Communication

**IPC (Inter-Process Communication):**
- Electron IPC - 主进程与渲染进程通信
- 处理器位置：`src/main/ipc/` 目录
- 主要模块：video、image、task、auth、database、ai-workflow、aside、director-mode

**Preload Script:**
- 位置：`src/preload/index.ts`
- 安全：contextIsolation 启用，nodeIntegration 禁用

## External Data Sources

**Knowledge Base:**
- 本地文档导入（Markdown、文本文件）
- 向量嵌入：豆包嵌入模型（通过火山引擎 API）
- 实现：`src/main/services/KnowledgeBase.ts`

**Region/Preset Data:**
- 内置地区预设数据
- 存储：SQLite + 内存缓存
- 实现：`src/main/database/repositories/regionRepository.ts`

---

*Integration audit: 2026-03-24*
