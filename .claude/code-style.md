# 代码风格指南

## 注释规范

### 语言要求

**所有注释必须使用中文**

### 函数注释

使用 JSDoc 风格：

```javascript
/**
 * 检查是否有可用的更新
 * @returns {Promise<{success: boolean, updateInfo?: Object, error?: string}>}
 */
async function checkForUpdates() {
  // ...
}
```

### 行内注释

```javascript
// 设置每 10 分钟检查一次更新
setInterval(() => {
  autoUpdater.checkForUpdates();
}, 10 * 60 * 1000);
```

### 复杂逻辑注释

```javascript
// 解析版本号并递增
// 格式: MAJOR.MINOR.PATCH (例如: 0.1.6)
const parts = currentVersion.split('.');
```

---

## 日志输出规范

### 语言要求

**所有日志必须使用中文**

```javascript
console.log('正在检查更新...');
console.error('视频处理失败:', error);
console.warn('FFmpeg 路径未找到，使用内置版本');
```

### 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| `log` | 常规信息 | `'开始处理视频'` |
| `error` | 错误信息 | `'视频处理失败'` |
| `warn` | 警告信息 | `'参数缺失，使用默认值'` |
| `debug` | 调试信息 | `'当前配置: {...}'` |

---

## 命名规范

| 类型 | 语言 | 示例 |
|------|------|------|
| 变量 | 英文 | `videoPath`, `outputDir` |
| 函数 | 英文 | `processVideo`, `handleMerge` |
| 注释 | 中文 | `// 处理视频拼接` |
| 日志 | 中文 | `console.log('开始处理')` |

---

## TypeScript 规范

### 路径别名 ⚠️ 重要

**所有导入必须使用别名，禁止使用相对路径**

```typescript
// ✅ 正确 - 使用别名
import { something } from '@shared/utils/helper';
import { handler } from '@main/ipc/video';
import { Component } from '@/components/Button';

// ❌ 错误 - 使用相对路径
import { something } from '../../shared/utils/helper';
import { handler } from './ipc/video';
import { Component } from '../components/Button';
```

| 别名 | 路径 | 用途 |
|------|------|------|
| `@main/*` | `src/main/*` | 主进程代码 |
| `@shared/*` | `src/shared/*` | 共享代码 |
| `@preload/*` | `src/preload/*` | 预加载脚本 |
| `@/*` | `src/renderer/*` | 渲染进程代码 |

### 类型定义

- 主进程类型检查：`npx tsc --noEmit -p tsconfig.node.json`
- 渲染进程类型检查：`npx tsc --noEmit`
