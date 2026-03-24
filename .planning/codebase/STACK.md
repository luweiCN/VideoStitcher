# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- TypeScript ~5.8.2 - 主要开发语言，用于主进程、渲染进程和共享代码
- CSS - UI 样式（使用 Tailwind CSS）

**Secondary:**
- JavaScript - 配置文件和脚本
- SQL - 数据库迁移和查询

## Runtime

**Environment:**
- Node.js - Electron 运行时环境
- Electron ^30.0.0 - 桌面应用框架

**Package Manager:**
- npm - 包管理器
- Lockfile: package-lock.json（存在）

## Frameworks

**Core:**
- Electron ^30.0.0 - 桌面应用框架
- React ^19.2.4 - 前端 UI 框架
- React Router DOM ^7.13.0 - 路由管理

**Testing:**
- Vitest ^4.1.0 - 单元测试框架
- Playwright ^1.58.2 - E2E 测试框架
- @testing-library/react ^16.3.2 - React 组件测试
- jsdom ^29.0.0 - 测试环境

**Build/Dev:**
- electron-vite ^5.0.0 - Electron + Vite 构建工具
- Vite ^6.4.1 - 前端构建工具
- TypeScript ~5.8.2 - 类型检查和编译
- electron-builder ^26.7.0 - 应用打包工具
- @electron/rebuild ^4.0.3 - 原生模块重建

## Key Dependencies

**Critical:**
- better-sqlite3 ^12.6.2 - SQLite 数据库（本地数据存储）
- sqlite-vec ^0.1.7-alpha.2 - SQLite 向量扩展（RAG 支持）
- ffmpeg-static ^5.3.0 - FFmpeg 视频处理
- @ffprobe-installer/ffprobe ^2.1.2 - 视频元数据解析
- sharp ^0.33.5 - 图像处理

**AI/ML:**
- @langchain/core ^1.1.32 - LangChain 核心库
- @langchain/langgraph ^1.2.2 - AI 工作流编排
- @langchain/openai ^1.2.13 - OpenAI 兼容 API 支持
- @langchain/community ^1.1.23 - 社区扩展

**UI Components:**
- @radix-ui/react-* - 无头 UI 组件库（Checkbox、Dialog、Dropdown、Select、Slider、Toast、Tooltip 等）
- @xyflow/react ^12.10.1 - 节点编辑器/流程图（导演模式画布）
- @tanstack/react-table ^8.21.3 - 数据表格
- lucide-react ^0.562.0 - 图标库
- plyr ^3.8.4 / plyr-react ^6.0.0 - 视频播放器

**State Management:**
- zustand ^5.0.12 - 轻量级状态管理

**Utilities:**
- uuid ^13.0.0 - UUID 生成
- pinyin ^4.0.0 - 拼音处理
- react-markdown ^10.1.0 + remark-gfm ^4.0.1 - Markdown 渲染
- react-virtuoso ^4.18.1 - 虚拟列表（大数据渲染）
- embla-carousel-react ^8.6.0 - 轮播组件
- tailwind-merge ^3.4.1 + clsx ^2.1.1 - CSS 类名处理

**System:**
- electron-log ^5.4.3 - 日志记录
- electron-updater ^6.7.3 - 自动更新
- systeminformation ^5.31.1 - 系统信息获取
- pidusage ^4.0.1 - 进程资源监控
- node-machine-id ^1.1.12 - 机器唯一标识
- extract-zip ^2.0.1 - ZIP 解压

## Configuration

**Environment:**
- `.env.example` - 环境变量模板
- 关键变量：VOLCANO_ENGINE_API_KEY、VOLCANO_ENGINE_API_BASE_URL、VOLCANO_ENGINE_MODEL

**Build:**
- `electron.vite.config.ts` - Vite + Electron 构建配置
- `electron-builder.yml` - 应用打包配置
- `tsconfig.json` - TypeScript 配置
- `vitest.config.ts` - 测试配置
- `playwright.config.ts` - E2E 测试配置

**Styling:**
- `tailwindcss` ^4.1.18 - CSS 框架
- `@tailwindcss/vite` ^4.1.18 - Tailwind Vite 插件
- `@tailwindcss/postcss` ^4.1.18 - PostCSS 插件

## Platform Requirements

**Development:**
- Node.js（建议使用最新 LTS 版本）
- npm 或 yarn
- macOS / Windows / Linux 开发环境

**Production:**
- macOS: DMG (x64/arm64) + ZIP（自动更新）
- Windows: NSIS 安装包 (x64)
- Linux: deb、rpm、AppImage (x64)

**Native Dependencies:**
- better-sqlite3 需要原生编译（postinstall 自动重建）
- sharp 需要平台特定二进制文件
- ffmpeg-static 和 ffprobe 为平台特定二进制文件

---

*Stack analysis: 2026-03-24*
