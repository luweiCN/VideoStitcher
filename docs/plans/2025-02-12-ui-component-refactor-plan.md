# UI 组件重构统一执行计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 统一所有功能模块的布局和配色，以 A+B 前后拼接和极速合成页面为基准

**架构说明:** 将各功能模块的布局、配色、按钮组件统一为标准化模式

**技术栈:** React + Tailwind CSS + TypeScript

---

## 基准标准（来自 VideoStitcherMode 和 VideoMergeMode）

### 配色标准
| 用途 | Tailwind 类名 | 说明 |
|------|--------------|------|
| 主背景 | `bg-black` | 纯黑，无偏色 |
| 侧边栏背景 | `bg-black` | 纯黑背景 |
| 设置卡片背景 | `bg-black/50` | 半透明黑色 |
| 边框 | `border-slate-800` | 主边框颜色 |
| 次要边框 | `border-slate-700/50` | 半透明边框 |
| 主标题文字 | `text-slate-100` 或 `text-white` | |
| 次要文字 | `text-slate-300` | |
| 说明文字 | `text-slate-500` 或 `text-slate-600` | |
| 禁用文字 | `text-slate-700` | |

### 布局结构
```
┌─────────────────────────────────────────────────────────────┐
│                    PageHeader                          │
├──────────────┬───────────────────────┬───────────────────────┤
│              │                       │                       │
│   左侧栏    │      中间区域          │       右侧栏         │
│ (文件选择    │    (预览/操作)         │    (设置              │
│   +参数)     │                       │    +日志              │
│              │                       │    +按钮)            │
│              │                       │                       │
└──────────────┴───────────────────────┴───────────────────────┘
```

### 组件标准
- 使用 `Button` 组件库替代所有自定义按钮
- 统一间距：`p-4`, `gap-4`, `space-y-4`
- 统一圆角：`rounded-xl`
- 统一边框：`border border-slate-800`

---

## 需要改造的模块列表

| 模块 | 文件路径 | 主题色 | 优先级 | 状态 |
|------|----------|--------|--------|------|
| 封面压缩 | `CoverCompressMode.tsx` | emerald | 1 | ✅ 已完成 |
| 图片素材处理 | `ImageMaterialMode.tsx` | amber | 2 | ✅ 已完成 |
| 封面格式转换 | `CoverFormatMode.tsx` | fuchsia | 3 | 🔄 下一个 |
| 智能改尺寸 | `ResizeMode.tsx` | rose | 4 | 待改造 |
| 文件名提取 | `FileNameExtractorMode.tsx` | pink | 5 | 待改造(特殊布局) |

---

## Task 1: 改造封面压缩模块 (CoverCompressMode)

**文件:**
- 修改: `src/renderer/features/CoverCompressMode.tsx`

**当前问题:**
- 使用 `bg-slate-950` 作为主背景
- 使用 `bg-slate-900` 作为侧边栏背景
- 使用自定义按钮而非 Button 组件

**改造步骤:**

**Step 1: 修改主容器背景色**

将:
```tsx
<div className="h-screen bg-slate-950 text-white flex flex-col">
```

改为:
```tsx
<div className="h-screen bg-black text-slate-100 flex flex-col">
```

**Step 2: 修改左侧栏背景色**

将:
```tsx
<div className="w-full max-w-md border-r border-slate-800 bg-slate-900 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
```

改为:
```tsx
<div className="w-full max-w-md border-r border-slate-800 bg-black p-4 flex flex-col gap-4 shrink-0 overflow-y-auto">
```

**Step 3: 修改设置卡片背景色**

将所有:
```tsx
<div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
```

改为:
```tsx
<div className="p-4 bg-black/50 rounded-xl border border-slate-800">
```

**Step 4: 修改右侧面板背景色**

将:
```tsx
<div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
```

改为:
```tsx
<div className="flex-1 bg-black p-4 overflow-y-auto">
```

**Step 5: 替换开始按钮为 Button 组件**

将:
```tsx
<button
  onClick={startProcessing}
  disabled={files.length === 0 || !outputDir || isProcessing}
  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
>
  {isProcessing ? (
    <>
      <Loader2 className="w-5 h-5 animate-spin" />
      处理中...
    </>
  ) : (
    <>
      <Play className="w-5 h-5" />
      开始压缩
    </>
  )}
</button>
```

改为:
```tsx
import { Button } from '../components/Button/Button';

// ...

<Button
  onClick={startProcessing}
  disabled={files.length === 0 || !outputDir || isProcessing}
  variant="primary"
  size="md"
  fullWidth
  loading={isProcessing}
  leftIcon={!isProcessing && <Play className="w-4 h-4" />}
>
  {isProcessing ? '处理中...' : '开始压缩'}
</Button>
```

**Step 6: 检查并修改进度条背景色**

确保进度条使用正确背景:
```tsx
<div className="w-full bg-slate-800 rounded-full h-2">
```

**Step 7: 统一间距**

将主要间距从 `gap-6` 改为 `gap-4`，将 `p-6` 改为 `p-4`

**Step 8: 提交并验收**

```bash
git add src/renderer/features/CoverCompressMode.tsx
git commit -m "refactor: 统一封面压缩模块布局和配色

- 主背景改为 bg-black
- 侧边栏背景改为 bg-black
- 设置卡片改为 bg-black/50
- 按钮改用 Button 组件库
- 统一间距为 p-4, gap-4
```

---

## Task 2: 改造智能改尺寸模块 (ResizeMode)

**文件:**
- 修改: `src/renderer/features/ResizeMode.tsx`

**当前问题:**
- 使用 `bg-slate-950` 作为主背景
- 使用 `bg-slate-900` 作为左侧预览区背景
- 使用自定义按钮而非 Button 组件

**改造步骤:**

**Step 1: 修改主容器背景色**

将:
```tsx
<div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
```

改为:
```tsx
<div className="h-screen bg-black text-slate-100 flex flex-col overflow-hidden">
```

**Step 2: 修改左侧预览区背景色**

将:
```tsx
<div className="w-[400px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
```

改为:
```tsx
<div className="w-[400px] bg-black border-r border-slate-800 flex flex-col shrink-0">
```

**Step 3: 修改中间控制区背景色**

将:
```tsx
<div className="w-[320px] bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
```

改为:
```tsx
<div className="w-[320px] bg-black border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto">
```

**Step 4: 修改设置卡片背景色**

将所有:
```tsx
<div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
```

改为:
```tsx
<div className="bg-black/50 border border-slate-800 rounded-xl p-4">
```

**Step 5: 修改右侧面板背景色**

将:
```tsx
<div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
```

改为:
```tsx
<div className="flex-1 bg-black flex flex-col overflow-hidden">
```

**Step 6: 替换开始按钮为 Button 组件**

将:
```tsx
<button
  onClick={startProcessing}
  disabled={...}
  className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 ..."
>
```

改为:
```tsx
import { Button } from '../components/Button/Button';

// ...

<Button
  onClick={startProcessing}
  disabled={isProcessing || isGeneratingPreview || videos.length === 0 || !outputDir}
  variant="primary"
  size="md"
  fullWidth
  loading={isProcessing}
  leftIcon={!isProcessing && <Play className="w-4 h-4" />}
>
  {isProcessing ? '处理中...' : '开始处理'}
</Button>
```

**Step 7: 替换导航按钮为 Button 组件**

将:
```tsx
<button className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 ...">
  <ChevronLeft className="w-4 h-4" />
  上一个
</button>
```

改为:
```tsx
<Button
  onClick={handlePrevVideo}
  disabled={currentVideoIndex === 0 || isGeneratingPreview}
  variant="ghost"
  size="sm"
  leftIcon={<ChevronLeft className="w-4 h-4" />}
>
  上一个
</Button>
```

**Step 8: 统一间距和圆角**

- 设置卡片 `p-3` 改为 `p-4`
- 统一使用 `rounded-xl`

**Step 9: 提交并验收**

```bash
git add src/renderer/features/ResizeMode.tsx
git commit -m "refactor: 统一智能改尺寸模块布局和配色

- 主背景改为 bg-black
- 侧边栏背景改为 bg-black
- 设置卡片改为 bg-black/50
- 按钮改用 Button 组件库
- 统一间距为 p-4, gap-4
```

---

## Task 3: 改造图片素材处理模块 (ImageMaterialMode)

**文件:**
- 修改: `src/renderer/features/ImageMaterialMode.tsx`

**当前问题:**
- 使用 `bg-slate-950` 作为主背景
- 使用 `bg-slate-900` 作为侧边栏背景
- 使用自定义按钮而非 Button 组件

**改造步骤:**

**Step 1: 修改主容器背景色**

将:
```tsx
<div className="h-screen bg-slate-950 text-white flex flex-col">
```

改为:
```tsx
<div className="h-screen bg-black text-slate-100 flex flex-col">
```

**Step 2: 修改左侧控制面板背景色**

将:
```tsx
<div className="w-96 border-r border-slate-800 bg-slate-900 p-6 flex flex-col gap-5 overflow-y-auto">
```

改为:
```tsx
<div className="w-96 border-r border-slate-800 bg-black p-4 flex flex-col gap-4 overflow-y-auto">
```

**Step 3: 修改预览模式卡片背景色**

将:
```tsx
<button className="... border-slate-800 bg-slate-950 ...">
```

改为:
```tsx
<button className="... border-slate-800 bg-black/50 ...">
```

**Step 4: 修改导出选项卡片背景色**

将:
```tsx
<div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
```

改为:
```tsx
<div className="space-y-2 bg-black/50 p-4 rounded-xl border border-slate-800">
```

**Step 5: 修改 Logo 控制卡片背景色**

将:
```tsx
<div className="space-y-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
```

改为:
```tsx
<div className="space-y-4 p-4 bg-black/50 rounded-xl border border-slate-800">
```

**Step 6: 修改右侧文件列表背景色**

将:
```tsx
<div className="w-72 border-l border-slate-800 bg-slate-900 flex flex-col">
```

改为:
```tsx
<div className="w-72 border-l border-slate-800 bg-black flex flex-col">
```

**Step 7: 替换开始按钮为 Button 组件**

将:
```tsx
<button className="w-full py-4 bg-amber-600 hover:bg-amber-500 ...">
```

改为:
```tsx
import { Button } from '../components/Button/Button';

// ...

<Button
  onClick={processImages}
  disabled={images.length === 0 || isProcessing || !outputDir || (!exportOptions.single && !exportOptions.grid)}
  variant="primary"
  size="md"
  fullWidth
  loading={isProcessing}
  leftIcon={!isProcessing && <FolderOpen className="w-5 h-5" />}
>
  {isProcessing ? '处理中...' : '开始处理'}
</Button>
```

**Step 8: 替换清除 Logo 按钮为 Button 组件**

**Step 9: 统一间距和圆角**

- `gap-5` 改为 `gap-4`
- `p-6` 改为 `p-4`
- `p-3` 改为 `p-4`

**Step 10: 提交并验收**

```bash
git add src/renderer/features/ImageMaterialMode.tsx
git commit -m "refactor: 统一图片素材处理模块布局和配色

- 主背景改为 bg-black
- 侧边栏背景改为 bg-black
- 设置卡片改为 bg-black/50
- 按钮改用 Button 组件库
- 统一间距为 p-4, gap-4
```

---

## Task 4: 改造封面格式转换模块 (CoverFormatMode)

**文件:**
- 修改: `src/renderer/features/CoverFormatMode.tsx`

**当前问题:**
- 使用 `bg-slate-950` 作为主背景
- 使用 `bg-slate-900` 作为侧边栏背景
- 使用自定义按钮而非 Button 组件
- 使用 `bg-gray-800` 进度条背景

**改造步骤:**

**Step 1: 修改主容器背景色**

将:
```tsx
<div className="h-screen bg-slate-950 text-white flex flex-col">
```

改为:
```tsx
<div className="h-screen bg-black text-slate-100 flex flex-col">
```

**Step 2: 修改左侧控制面板背景色**

将:
```tsx
<div className="w-full max-w-md border-r border-slate-800 bg-slate-900 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
```

改为:
```tsx
<div className="w-full max-w-md border-r border-slate-800 bg-black p-4 flex flex-col gap-4 shrink-0 overflow-y-auto">
```

**Step 3: 修改设置卡片背景色**

将:
```tsx
<div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
```

改为:
```tsx
<div className="p-4 bg-black/50 rounded-xl border border-slate-800">
```

**Step 4: 修改右侧面板背景色**

将:
```tsx
<div className="flex-1 bg-slate-950 p-6 overflow-y-auto">
```

改为:
```tsx
<div className="flex-1 bg-black p-4 overflow-y-auto">
```

**Step 5: 修改进度条背景色**

将:
```tsx
<div className="w-32 bg-gray-800 rounded-full h-2">
```

改为:
```tsx
<div className="w-32 bg-slate-800 rounded-full h-2">
```

**Step 6: 替换开始按钮为 Button 组件**

**Step 7: 统一间距和圆角**

**Step 8: 提交并验收**

```bash
git add src/renderer/features/CoverFormatMode.tsx
git commit -m "refactor: 统一封面格式转换模块布局和配色

- 主背景改为 bg-black
- 侧边栏背景改为 bg-black
- 设置卡片改为 bg-black/50
- 进度条背景改为 bg-slate-800
- 按钮改用 Button 组件库
- 统一间距为 p-4, gap-4
```

---

## Task 5: 改造文件名提取模块 (FileNameExtractorMode)

**文件:**
- 修改: `src/renderer/features/FileNameExtractorMode.tsx`

**注意:** 此模块布局与基准页面差异较大，需要特别处理

**当前问题:**
- 使用 `bg-slate-950` 作为主背景
- 使用 `bg-slate-900` 作为面板背景
- 使用自定义按钮而非 Button 组件

**改造步骤:**

**Step 1: 修改主容器背景色**

将:
```tsx
<div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
```

改为:
```tsx
<div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans">
```

**Step 2: 修改控制面板背景色**

将:
```tsx
<div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col flex-1 min-h-0">
```

改为:
```tsx
<div className="bg-black border border-slate-800 rounded-3xl p-4 flex flex-col flex-1 min-h-0">
```

**Step 3: 修改文件列表面板背景色**

将:
```tsx
<div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
```

改为:
```tsx
<div className="lg:col-span-2 bg-black border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
```

**Step 4: 修改输入框和 textarea 背景色**

将:
```tsx
className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-500 text-white"
```

改为:
```tsx
className="w-full bg-black/50 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-pink-500/50 text-slate-300"
```

**Step 5: 替换所有按钮为 Button 组件**

包括：
- 导出格式选择按钮
- "一键复制全部" 按钮
- "清空列表" 按钮
- "序号"/"替换" 工具按钮
- "执行重命名" 按钮
- "保存修改" 按钮

示例:
```tsx
<Button
  onClick={copyToClipboard}
  disabled={files.length === 0}
  variant="primary"
  size="md"
  fullWidth
  leftIcon={copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
>
  {copied ? '已复制' : '一键复制全部'}
</Button>
```

**Step 6: 修改面板标题栏背景色**

将:
```tsx
<div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
```

改为:
```tsx
<div className="p-4 border-b border-slate-800 flex items-center justify-between bg-black/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
```

**Step 7: 统一间距和圆角**

**Step 8: 提交并验收**

```bash
git add src/renderer/features/FileNameExtractorMode.tsx
git commit -m "refactor: 统一文件名提取模块布局和配色

- 主背景改为 bg-black
- 面板背景改为 bg-black
- 输入框背景改为 bg-black/50
- 按钮改用 Button 组件库
- 统一间距为 p-4, gap-4
```

---

## 验收检查清单

每个模块改造完成后，请验收以下内容：

### 配色检查
- [ ] 主背景使用 `bg-black`（无偏色）
- [ ] 边框使用 `border-slate-800`
- [ ] 设置卡片使用 `bg-black/50`
- [ ] 没有使用 `bg-gray-*` 或 `bg-slate-950`
- [ ] 没有使用自定义 hex 颜色如 `bg-[#0a0a0f]`

### 组件检查
- [ ] 所有按钮使用 Button 组件库
- [ ] 按钮的 loading 状态正确显示
- [ ] 按钮的 disabled 状态正确显示

### 布局检查
- [ ] 有顶部栏 (PageHeader)
- [ ] 有左侧栏用于文件选择和参数调节
- [ ] 有中间区域用于预览或操作
- [ ] 有右侧栏用于设置、日志和按钮

### 响应式检查
- [ ] 页面放大时布局不破坏
- [ ] 页面缩小时布局不破坏
- [ ] 滚动条正常工作

### 功能检查
- [ ] 文件选择功能正常
- [ ] 参数设置功能正常
- [ ] 开始处理功能正常
- [ ] 日志显示功能正常

---

## 问题记录

在改造过程中遇到的问题将记录于此：

### CoverCompressMode (封面压缩)

**已完成日期:** 2025-02-12

**新增功能:**
1. 图片对比预览弹窗 (ImageCompareModal)
   - 使用 react-compare-slider 库实现拖动对比
   - 自动识别横版/竖版图片，调整滑杆方向
   - 添加"原图"和"处理后"标签
   - 显示压缩前后文件大小对比

2. 日志系统规范化
   - 所有 addLog 调用添加显式 type 参数
   - 统一日志类型: 'info', 'success', 'error', 'warning'
   - 修复进度日志被误识别为失败的问题
   - loadFileInfo 中添加异步加载日志

**遇到的问题及解决方案:**

| 问题 | 解决方案 |
|------|----------|
| react-compare-slider props 名称错误（itemleft vs itemOne） | 直接阅读 node_modules 源代码确认正确 API |
| `window.api` 类型错误 | 检查 preload.ts 发现 Window 接口已正确定义 |
| 处理完成后按钮一直显示"处理中" | 添加 `onFinish` 回调设置 `setIsProcessing(false)` |
| 进度日志被识别为红色（失败） | 改为显式指定 `type: 'info'` |
| "第 N 个任务完成" 被识别为 info | 改为显式指定 `type: 'success'` |

**经验教训:**
1. 第三方库使用时，应优先阅读源码/类型定义而非猜测
2. `inferLogType` 自动推断不靠谱，所有 addLog 应显式指定 type
3. 异步操作完成后务必更新对应的状态变量
4. 进度日志和失败日志都要用显式 type，避免误判

### ResizeMode (智能改尺寸)
- 待补充

### ImageMaterialMode (图片素材处理)

**已完成日期:** 2025-02-12

**改造内容:**
- 改为标准三栏布局（与 CoverCompressMode 一致）
  - 左侧 (w-96): 文件选择 + Logo设置 + 预览模式 + 导出选项
  - 中间: 任务列表 + 预览画布（上下布局）
  - 右侧 (w-80): 输出目录 + 并发设置 + 日志 + 开始按钮
- 主背景 `bg-slate-950` → `bg-black`
- 侧边栏背景 `bg-slate-900` → `bg-black`
- 设置卡片背景 `bg-slate-950` → `bg-black/50`
- 按钮改用 Button 组件库（主题色 amber）
- 统一间距 `p-6` → `p-4`, `gap-5` → `gap-4`
- Canvas 占位背景改为 `#0f172a` (slate-900)
- 所有 addLog 添加显式 type 参数
- 添加并发线程数缓存 (`useConcurrencyCache`)
- 添加任务状态 UI (`pending` → `waiting` → `processing` → `completed`/`error`)
- 使用 Radix UI Slider 和 Checkbox 替代原生组件
- FileSelector 添加 `ref`，选择后自动清空避免重复触发

**遇到的问题及解决方案:**

| 问题 | 解决方案 |
|------|----------|
| LogThemeColor 缺少 `amber` 类型 | 在 `types.ts` 和 `LogFooter.tsx` 中添加 `amber` 配置 |
| FileSelectorGroup 使用两次导致 Context 冲突 | 合并为一个 FileSelectorGroup 包裹两个 FileSelector |
| min-h-[200px] 位置错误 | 移到任务列表容器而非空状态 div |
| 空状态文字不统一 | 改为"暂无任务" |
| 并发线程数无法缓存 | 使用 `useConcurrencyCache` hook |
| 任务列表固定高度不生效 | `flex-1` 与 `h-[240px]` 冲突，改用 `max-h-[240px]` |
| 缩略图加载慢 | 使用 Sharp 后端生成 200x200 base64 缩略图，一次性全部加载 |
| 切换任务日志重复 | `switchToPreview` 和 `useEffect` 都调用了加载函数，造成重复 |
| 删除后面任务时预览不更新 | `currentIndex` 不变，useEffect 不会触发，需手动加载 |
| 初始进入时没有加载图片信息 | `currentIndex` 默认 0 不变，useEffect 不会触发 |
| Canvas 重绘不生效 | 需要在状态更新后用 `setTimeout` 延迟调用 `drawPreview()` |

**经验教训:**
1. **`flex-1` 与固定高度冲突**: 当元素同时有 `flex-1` 和固定 `h-` 时，flex 会忽略固定高度。解决方案：用 `max-h-` 或 `min-h-` 替代
2. **缓存 Hook 复用**: 并发数、输出目录等缓存应使用已有的 Hook (`useConcurrencyCache`, `useOutputDirCache`)，而非手动 `useState` + `localStorage`
3. **组件 Ref 要及时添加**: FileSelector 等需要手动清空的组件，必须添加 `ref` 并调用 `clearFiles()` 方法
4. **Radix UI 组件的 data 属性**: 使用 `data-[state=checked]:` 选择器实现主题色切换，比手动判断类名更简洁
5. **useEffect 依赖设计原则**: 只依赖真正需要响应变化的值。监听 `images` 数组会导致每次数组引用变化都触发，应该只监听 `currentIndex` 和 `images.length`
6. **状态变化后操作要延迟**: 当需要在 `setState` 后执行操作时（如 Canvas 重绘），必须用 `setTimeout(..., 0)` 确保状态已更新
7. **职责分离原则**: `switchToPreview` 只负责切换索引，实际的加载由 useEffect 统一处理。但如果索引不变内容变（如删除），需手动调用加载

### CoverFormatMode (封面格式转换)
- 待补充

### FileNameExtractorMode (文件名提取)
- 待补充

---

## 执行策略

1. **逐个改造**: 每次只改造一个模块
2. **用户验收**: 改造完成后等待用户验收
3. **问题更新**: 将验收中发现的问题记录到本文件的"问题记录"部分
4. **继续下一个**: 验收通过后继续改造下一个模块

## 注意事项

1. **不随意重置**: 当遇到改不好的问题时，必须得到用户同意才能重置文件
2. **保留功能**: 确保改造不影响原有功能
3. **测试验证**: 用户会负责测试验证
4. **中文日志**: 确保所有注释和日志使用中文
