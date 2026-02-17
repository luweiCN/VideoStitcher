# 架构设计指南

## 项目结构

```
VideoStitcher/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 入口文件
│   │   ├── init.ts        # 初始化逻辑
│   │   ├── autoUpdater.ts # 自动更新
│   │   ├── ipc-handlers.ts
│   │   └── ipc/           # IPC 处理器
│   │       ├── video.ts
│   │       ├── image.ts
│   │       ├── auth.ts
│   │       └── ...
│   ├── preload/           # 预加载脚本
│   │   └── index.ts
│   ├── renderer/          # React 渲染进程
│   │   ├── features/      # 功能模块
│   │   ├── components/    # 公共组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── utils/         # 工具函数
│   │   └── types/         # 类型定义
│   └── shared/            # 主进程和渲染进程共享代码
│       ├── ffmpeg/        # FFmpeg 相关
│       ├── sharp/         # 图片处理
│       └── utils/         # 工具函数
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── package.json
```

---

## 技术栈

| 技术 | 用途 |
|------|------|
| Electron | 桌面应用框架 |
| React | UI 框架 |
| Vite (electron-vite) | 构建工具 |
| Tailwind CSS | 样式框架 |
| FFmpeg | 视频处理 |
| Sharp | 图片处理 |

---

## 进程通信

### IPC 通道命名规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `video:` | 视频相关 | `video:get-metadata` |
| `image:` | 图片相关 | `image:get-dimensions` |
| `file:` | 文件操作 | `file:batch-rename` |
| `auth:` | 授权相关 | `auth:check-license` |
| `task:` | 任务生成 | `task:generate-stitch` |

### 路径别名

在代码中使用别名导入：

```typescript
// 主进程
import { something } from '@shared/utils/helper';
import { handler } from '@main/ipc/video';

// 渲染进程
import { Component } from '@/components/Button';
import { useHook } from '@/hooks/useSomething';
```

---

## 开发注意事项

### 视频处理

- 使用 `ffmpeg-static` 获取 FFmpeg 路径
- 支持的格式：MP4, MOV, AVI, MKV 等
- 注意处理大文件时的内存管理

### 自动更新

| 平台 | 方式 |
|------|------|
| Windows | Squirrel 安装包，支持自动更新 |
| macOS | 检测更新后提示用户手动下载 DMG |

### 跨平台路径处理

```typescript
// 使用 path.join() 或 path.resolve() 处理路径
import path from 'path';
const outputPath = path.join(outputDir, filename);
```

---

## 构建配置

### electron-vite 配置

配置文件：`electron.vite.config.ts`

| 进程 | 入口 | 别名 |
|------|------|------|
| main | `src/main/index.ts` | `@main/*`, `@shared/*` |
| preload | `src/preload/index.ts` | `@preload/*`, `@shared/*` |
| renderer | `src/renderer/index.html` | `@/*` |

### TypeScript 配置

- `tsconfig.json` - 渲染进程
- `tsconfig.node.json` - 主进程 + 预加载脚本
