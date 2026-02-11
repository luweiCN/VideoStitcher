# VideoStitcher 项目规范

## 项目概述

**项目名称**: VideoStitcher
**描述**: 全能视频批处理工具箱
**技术栈**: Electron + React + Vite + Tailwind CSS + FFmpeg

---

## 语言规范 ⚠️ 重要

### 所有代码相关内容必须使用中文

1. **代码注释** - 必须用中文
2. **日志输出** - 必须用中文
3. **Git 提交信息** - 必须用中文
4. **变量命名** - 使用英文（这是编程惯例）
5. **函数命名** - 使用英文（这是编程惯例）

```javascript
// ✅ 正确示例
/**
 * 处理视频水平拼接
 * @param {Object} config - 拼接配置
 * @returns {Promise<void>}
 */
function videoHorizontalMerge(config) {
  console.log('开始处理视频水平拼接');
  // ...
}

// ❌ 错误示例
/**
 * Handle video horizontal merge
 * @param {Object} config - Merge configuration
 * @returns {Promise<void>}
 */
function videoHorizontalMerge(config) {
  console.log('Starting video horizontal merge');
  // ...
}
```

---

## 代码注释规范

### 函数注释

使用 JSDoc 风格，所有描述用中文：

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

### 使用中文日志

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

## Git 提交信息规范

### 格式

```
<类型>: <简短描述>

[可选的详细描述]
```

### 类型标识

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加批量视频处理功能` |
| `fix` | 修复 bug | `fix: 修复导出时崩溃的问题` |
| `docs` | 文档更新 | `docs: 更新 README 安装说明` |
| `style` | 代码格式 | `style: 统一代码缩进格式` |
| `refactor` | 重构 | `refactor: 优化视频处理模块结构` |
| `perf` | 性能优化 | `perf: 减少内存占用` |
| `test` | 测试相关 | `test: 添加单元测试` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |
| `debug` | 调试代码 | `debug: 输出目录结构` |

### 示例

```bash
# 功能
git commit -m "feat: 添加视频水印功能"

# 修复
git commit -m "fix: 修复 macOS 下无法选择文件的问题"

# 文档
git commit -m "docs: 更新用户手册"

# 构建
git commit -m "chore: 升级 Electron 到 30.0.0"
```

---

## 项目结构

```
VideoStitcher/
├── src/
│   ├── main.js           # Electron 主进程
│   ├── preload.js        # 预加载脚本（生成文件）
│   └── renderer/         # React 渲染进程
│       ├── features/     # 功能模块
│       ├── components/   # 公共组件
│       └── utils/        # 工具函数
├── .github/workflows/    # GitHub Actions
├── forge.config.js       # Electron Forge 配置
└── package.json          # 项目配置
```

---

## 开发注意事项

### 视频处理

- 使用内置的 `ffmpeg-static`
- 支持的格式：MP4, MOV, AVI, MKV 等
- 注意处理大文件时的内存管理

### 自动更新

- **Windows**: 使用 Squirrel 安装包，支持自动更新
- **macOS**: 检测更新后提示用户手动下载 DMG

### 跨平台

- Windows 路径分隔符: `\`
- macOS/Linux 路径分隔符: `/`
- 使用 `path.join()` 或 `path.resolve()` 处理路径

---

## 发布流程

1. 更新代码并提交（中文 commit）
2. 在 GitHub Actions 手动触发 "Release" workflow
3. 选择版本类型（patch/minor/major）
4. 等待构建完成
5. Release 会自动生成，包含中文更新日志

---

## UI 配色标准 ⚠️ 重要

### 颜色方案

**核心原则：纯黑主题 + slate 色系边框和文字**

| 用途 | Tailwind 类名 | 说明 |
|------|--------------|------|
| 主背景 | `bg-black` | 纯黑，无偏色 |
| 卡片/容器背景 | `bg-black/50` | 半透明黑色 |
| 次级背景 | `bg-neutral-900` | 中等深灰色 |
| 悬浮/输入框背景 | `bg-slate-900/50` → 改为 `bg-black/50` | 深色半透明 |
| 边框 | `border-slate-800` | 主边框 |
| 边框（半透明） | `border-slate-700/50` | 次要边框 |
| 主标题文字 | `text-slate-100` 或 `text-white` | |
| 次要文字 | `text-slate-300` | |
| 说明文字 | `text-slate-500` 或 `text-slate-600` | |
| 禁用文字 | `text-slate-700` | |

### 禁止使用的颜色

- ❌ `bg-gray-*` - 有偏色的灰色，改用 zinc 或 slate 或 black
- ❌ `bg-[#0a0a0f]` - 自定义 hex 颜色，改用 `bg-black`
- ❌ `bg-[#12121a]` - 自定义 hex 颜色，改用 `bg-neutral-900` 或 `bg-black`

### 组件配色示例

```tsx
{/* 主容器 */}
<div className="bg-black text-slate-100">...</div>

{/* 卡片 */}
<div className="bg-black/50 border border-slate-800 rounded-xl">...</div>

{/* 输入框 */}
<input className="bg-black/50 border border-slate-800 text-slate-300" />

{/* 按钮 */}
<button className="bg-gradient-to-r from-pink-600 to-violet-600 text-white" />

{/* 页面 Header */}
<header className="bg-black/50 border-b border-slate-800">...</header>

{/* Tooltip */}
<div className="bg-black border border-slate-700/50">...</div>
```

---

## AI 助手使用指南

当使用 Claude Code 或其他 AI 助手时：

1. **告知 AI 遵循本规范** - 引用本文件
2. **检查代码** - 确保注释和日志是中文
3. **检查提交** - 确保提交信息是中文且符合格式
4. **不强行修改** - 如果代码已经用英文注释，可以不改动

### 示例提示词

```
请根据 /path/to/CLAUDE.md 中的规范，检查我的代码：
1. 注释是否使用中文
2. 日志输出是否使用中文
3. 提交信息是否符合规范
```
