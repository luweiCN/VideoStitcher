# 代码规范

**分析日期:** 2026-03-24

## 语言规范

### 代码注释

**所有注释必须使用中文**

```typescript
/**
 * 执行 FFmpeg 命令
 * @param args FFmpeg 参数
 * @param onLog 日志回调
 * @param onPid PID 回调（进程启动后立即调用）
 */
export function runFfmpeg(
  args: string[],
  onLog?: FfmpegLogCallback,
  onPid?: (pid: number) => void
): Promise<FfmpegResult> {
  // 调试：输出 ffmpeg 命令
  onLog?.(`[DEBUG] ffmpeg: ${ffmpegPath} ${args.slice(1).join(' ')}\n`);
}
```

### 日志输出

**所有日志必须使用中文**

```typescript
console.log('[主进程] 窗口已调用 show() 和 focus()');
console.error('[主进程] 停止任务队列管理器失败:', err);
console.warn('FFmpeg 路径未找到，使用内置版本');
```

### 命名规范

| 类型 | 语言 | 示例 |
|------|------|------|
| 变量 | 英文 | `videoPath`, `outputDir` |
| 函数 | 英文 | `processVideo`, `handleMerge` |
| 类/接口 | 英文 PascalCase | `TaskQueueManager`, `VideoDimensions` |
| 类型别名 | 英文 PascalCase | `ButtonVariant`, `ThemeColor` |
| 枚举 | 英文 PascalCase | `ASideView` |
| 注释 | 中文 | `// 处理视频拼接` |
| 日志 | 中文 | `console.log('开始处理')` |

## 代码风格

### TypeScript 规范

**严格类型检查:**
- 启用 `strict: true`
- 目标版本: ES2020
- JSX: react-jsx

**路径别名 (强制使用):**

所有导入必须使用别名，禁止使用相对路径:

```typescript
// ✅ 正确 - 使用别名
import { something } from '@shared/utils/helper';
import { handler } from '@main/ipc/video';
import { Component } from '@/components/Button';

// ❌ 错误 - 使用相对路径
import { something } from '../../shared/utils/helper';
import { handler } from './ipc/video';
```

**别名映射:**

| 别名 | 路径 | 用途 |
|------|------|------|
| `@main/*` | `src/main/*` | 主进程代码 |
| `@shared/*` | `src/shared/*` | 共享代码 |
| `@preload/*` | `src/preload/*` | 预加载脚本 |
| `@/*` | `src/renderer/*` | 渲染进程代码 |
| `@renderer/*` | `src/renderer/*` | 渲染进程代码 |

### React 组件规范

**函数组件定义:**

```typescript
import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * 按钮组件 - 基于 Radix UI 设计原则
 * 无样式组件，使用 Tailwind CSS 自定义样式
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button ref={ref} className={...} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**组件文件结构:**
- 组件文件使用 PascalCase: `Button.tsx`, `TaskCenter.tsx`
- 每个组件目录包含 `index.ts` 导出文件
- 类型定义放在组件文件顶部或独立的 `types.ts`

### UI 样式规范

**配色标准:**

| 用途 | Tailwind 类名 | 说明 |
|------|--------------|------|
| 主背景 | `bg-black` | 纯黑，无偏色 |
| 卡片/容器背景 | `bg-black/50` | 半透明黑色 |
| 次级背景 | `bg-neutral-900` | 中等深灰色 |
| 边框 | `border-slate-800` | 主边框 |
| 边框（半透明） | `border-slate-700/50` | 次要边框 |
| 主标题文字 | `text-slate-100` 或 `text-white` | |
| 次要文字 | `text-slate-300` | |
| 说明文字 | `text-slate-500` 或 `text-slate-600` | |

**禁止使用的颜色:**

| 禁止 | 替代 |
|------|------|
| ❌ `bg-gray-*` | ✅ `bg-black`, `bg-neutral-*`, `bg-slate-*` |
| ❌ `bg-[#0a0a0f]` | ✅ `bg-black` |
| ❌ `bg-[#12121a]` | ✅ `bg-neutral-900` 或 `bg-black` |

**功能模块配色:**

| 模块 | 主题色 | Tailwind 类 |
|------|--------|-------------|
| 视频拼接 | 青色 | `cyan` |
| 视频合成 | 紫色 | `violet` |
| 图片处理 | 琥珀色 | `amber` |
| 封面格式 | 玫瑰色 | `rose` |
| 智能改尺寸 | 绿宝石 | `emerald` |
| 无损拼图 | 粉色 | `pink` |

## 导入组织

**导入顺序:**

1. React/框架导入
2. 第三方库导入
3. 路径别名导入 (`@/*`, `@main/*`, `@shared/*`)
4. 相对路径导入 (仅在必要时)
5. 类型导入

```typescript
import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/Button';
import { useASideStore } from '@/stores/asideStore';
import { runFfmpeg } from '@shared/ffmpeg';

import type { VideoDimensions } from '@shared/ffmpeg/types';
```

## 错误处理

**IPC 处理器错误处理:**

```typescript
async function handleOperation(): Promise<{ success: boolean; error?: string }> {
  try {
    // 执行业务逻辑
    return { success: true };
  } catch (err) {
    console.error('[操作] 失败:', err);
    return { success: false, error: (err as Error).message };
  }
}
```

**全局错误处理:**

```typescript
// 主进程全局错误处理
process.on('uncaughtException', (error) => {
  if (error.name === 'TaskCancelledError') {
    console.log('[主进程] 任务已取消，忽略错误');
    return;
  }
  console.error('[主进程] 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[主进程] 未处理的 Promise 拒绝:', reason);
});
```

## IPC 通道命名规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `video:` | 视频相关 | `video:get-metadata` |
| `image:` | 图片相关 | `image:get-dimensions` |
| `file:` | 文件操作 | `file:batch-rename` |
| `auth:` | 授权相关 | `auth:check-license` |
| `task:` | 任务生成 | `task:generate-stitch` |
| `preview-` | 预览相关 | `preview-horizontal` |
| `clear-` | 清理操作 | `clear-previews` |

## 状态管理规范

**Zustand Store 结构:**

```typescript
interface StoreState {
  // ==================== 状态 ====================
  currentView: ASideView;
  isLoading: boolean;
  error: string | null;

  // ==================== Actions ====================
  setCurrentView: (view: ASideView) => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
  currentView: 'library',
  isLoading: false,
  error: null,

  setCurrentView: (view) => set({ currentView: view }),
  reset: () => set({ currentView: 'library', isLoading: false, error: null }),
}));
```

## 文件命名规范

| 类型 | 命名规范 | 示例 |
|------|----------|------|
| 组件 | PascalCase.tsx | `Button.tsx`, `TaskCenter.tsx` |
| 工具函数 | camelCase.ts | `fileNameHelper.ts`, `safeOutput.ts` |
| 类型定义 | camelCase.ts 或 types.ts | `types.ts`, `task.ts` |
| 常量 | UPPER_SNAKE_CASE | `RESIZE_CONFIGS`, `CLIP_DURATION` |
| 测试文件 | *.test.ts 或 *.test.tsx | `utils.test.ts`, `components.test.tsx` |
| Store | camelCase.ts | `asideStore.ts` |
| Hook | useCamelCase.ts | `useAddToTaskCenter.ts` |

## 注释规范

**函数注释 (JSDoc):**

```typescript
/**
 * 获取视频完整信息
 * @param filePath 视频文件路径
 * @param options 配置选项
 * @param options.thumbnailMaxSize 缩略图最大尺寸
 * @returns 视频完整信息对象
 */
export async function getVideoFullInfo(
  filePath: string,
  options: { thumbnailMaxSize?: number } = {}
): Promise<VideoFullInfo> {
  // 实现
}
```

**复杂逻辑注释:**

```typescript
// 极速预览的截取逻辑：
// - 封面：取开头 0.1 秒
// - A面：
//   - 不足5秒：取全部（不截取）
//   - 5-10秒：取前5秒（只取一段）
//   - 10秒以上：取前5秒 + 后5秒（两段拼接）
// - B面：取开头5秒（不足5秒则取全部）
const CLIP_DURATION = 5;
```

## 类型定义规范

**接口命名:**

```typescript
// Props 接口
interface ButtonProps { }

// 数据模型接口
interface VideoFullInfo { }

// 配置接口
interface ResizeConfig { }

// Store 接口
interface ASideStore { }
```

**类型导出:**

```typescript
// 在 types.ts 中集中导出
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export type { VideoDimensions, VideoFullInfo } from './video';
```

---

*代码规范分析: 2026-03-24*
