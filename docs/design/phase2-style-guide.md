# 第二阶段 UI 风格指南

> 基于第一阶段 VideoStitcher 设计系统提取

## 执行摘要

本文档分析 VideoStitcher 第一阶段的设计系统，并为第二阶段 AI 视频制作功能提供风格指导。第一阶段采用**暗色主题 + 渐变强调色 + 模块化配色**的设计策略，视觉层次清晰，交互反馈明确。

---

## 1. 设计系统总览

### 1.1 设计理念

- **专业工具感**：深色背景 + 高对比度文字 + 彩色图标
- **功能模块化**：每个功能模块使用独特的主题色区分
- **层次分明**：背景层 → 内容层 → 交互层 → 强调层
- **动态渐变**：渐变色增加视觉吸引力和现代感

### 1.2 核心设计原则

| 原则 | 说明 | 体现 |
|------|------|------|
| **深色优先** | 纯黑背景，减少视觉疲劳 | `bg-black`, `bg-slate-900` |
| **色彩编码** | 每个功能模块独立配色 | `violet`, `amber`, `rose` 等 |
| **渐变强调** | 按钮、卡片悬停使用渐变 | `from-pink-600 to-violet-600` |
| **层次透明** | 半透明增加深度感 | `bg-black/50`, `border-slate-700/50` |
| **圆角统一** | 一致的圆角半径 | `rounded-xl`, `rounded-2xl` |

---

## 2. 配色系统

### 2.1 基础色板

#### 背景色系（从深到浅）

| 用途 | Tailwind 类 | 色值 | 使用场景 |
|------|------------|------|---------|
| 主背景 | `bg-black` | #000000 | 页面主背景 |
| 次级背景 | `bg-slate-950` | #020617 | 首页背景 |
| 卡片背景 | `bg-black/50` | rgba(0,0,0,0.5) | 半透明容器 |
| 容器背景 | `bg-slate-900` | #0f172a | 侧边栏、输入框 |
| 悬停背景 | `bg-slate-800` | #1e293b | 按钮、列表悬停 |

#### 文字色系

| 用途 | Tailwind 类 | 色值 | 使用场景 |
|------|------------|------|---------|
| 主标题 | `text-white` / `text-slate-100` | #ffffff / #f1f5f9 | 标题、重点内容 |
| 次要文字 | `text-slate-300` | #cbd5e1 | 说明文字、标签 |
| 辅助文字 | `text-slate-400` | #94a3b8 | 提示文字、时间戳 |
| 弱化文字 | `text-slate-500` / `text-slate-600` | #64748b / #475569 | 禁用、注释 |
| 禁用文字 | `text-slate-700` | #334155 | 禁用状态 |

#### 边框色系

| 用途 | Tailwind 类 | 色值 | 使用场景 |
|------|------------|------|---------|
| 主边框 | `border-slate-800` | #1e293b | 主要分隔线 |
| 次级边框 | `border-slate-700/50` | rgba(51,65,85,0.5) | 输入框、卡片 |
| 悬停边框 | `border-{color}-500/50` | 动态 | 模块主题色边框 |

### 2.2 功能模块主题色

每个功能模块使用独特的主题色进行视觉区分：

| 模块名称 | 主题色 | Tailwind 色名 | 主要类名 |
|---------|-------|--------------|---------|
| 横竖屏极速合成 | 紫色 | `violet` | `text-violet-400`, `bg-violet-500` |
| 图片素材处理 | 琥珀色 | `amber` | `text-amber-400`, `bg-amber-500` |
| 智能改尺寸 | 玫瑰色 | `rose` | `text-rose-400`, `bg-rose-500` |
| 封面格式转换 | 紫红色 | `fuchsia` | `text-fuchsia-400`, `bg-fuchsia-500` |
| 封面压缩 | 绿宝石 | `emerald` | `text-emerald-400`, `bg-emerald-500` |
| 文件名提取 | 粉色 | `pink` | `text-pink-400`, `bg-pink-500` |
| 专业无损多宫格 | 青色 | `cyan` | `text-cyan-400`, `bg-cyan-500` |
| A+B 前后拼接 | 粉色 | `pink` | `text-pink-400`, `bg-pink-500` |

**主题色使用规则：**
- 图标颜色：`text-{color}-400`
- 悬停背景：`hover:bg-{color}-500`
- 边框强调：`hover:border-{color}-500/50`
- 阴影光晕：`shadow-{color}-500/10`

### 2.3 渐变色方案

#### 主按钮渐变

```css
/* 主按钮 - 粉紫渐变 */
bg-gradient-to-r from-pink-600 to-violet-600
hover:from-pink-500 hover:to-violet-500

/* 危险按钮 - 红玫渐变 */
bg-gradient-to-r from-rose-600 to-red-600
hover:from-rose-500 hover:to-red-600

/* 更新通知 - 靛紫渐变 */
bg-gradient-to-br from-indigo-600 to-purple-600
```

#### 次级按钮渐变（按主题色）

```css
/* 紫色主题 */
from-violet-600/20 to-purple-600/20
hover:from-violet-600/30 hover:to-purple-600/30

/* 琥珀色主题 */
from-amber-600/20 to-orange-600/20
hover:from-amber-600/30 hover:to-orange-600/30
```

#### 标题渐变文字

```css
/* Logo 渐变文字 */
bg-clip-text text-transparent
bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-400
```

---

## 3. 字体系统

### 3.1 字体族

```css
font-sans  /* 系统默认无衬线字体 */
font-mono  /* 等宽字体，用于代码、数字 */
```

### 3.2 字号体系

| 用途 | Tailwind 类 | 像素值 | 使用场景 |
|------|------------|--------|---------|
| 超大标题 | `text-5xl` | 48px | 应用名称 |
| 大标题 | `text-lg` | 18px | 页面标题 |
| 中标题 | `text-base` | 16px | 卡片标题 |
| 正文 | `text-sm` | 14px | 正文内容、按钮 |
| 小字 | `text-xs` | 12px | 标签、辅助信息 |
| 极小字 | `text-[10px]` | 10px | 控制面板、按钮组 |

### 3.3 字重体系

| 用途 | Tailwind 类 | 字重值 | 使用场景 |
|------|------------|--------|---------|
| 极粗 | `font-black` | 900 | Logo、大标题 |
| 粗体 | `font-bold` | 700 | 标题、按钮 |
| 半粗 | `font-semibold` | 600 | 强调文字 |
| 中等 | `font-medium` | 500 | 正文、标签 |

---

## 4. 间距系统

### 4.1 基础间距

采用 **4px 基准** 的间距体系：

| Tailwind 类 | 像素值 | 使用场景 |
|------------|--------|---------|
| `p-1` | 4px | 极小内边距 |
| `p-2` | 8px | 小内边距 |
| `p-3` | 12px | 中内边距 |
| `p-4` | 16px | 标准内边距 |
| `p-5` | 20px | 大内边距 |
| `p-6` | 24px | 卡片内边距 |
| `p-8` | 32px | 区块内边距 |

### 4.2 间距尺度

```css
gap-1  /* 4px - 紧凑间距 */
gap-2  /* 8px - 小间距 */
gap-3  /* 12px - 中间距 */
gap-4  /* 16px - 标准间距 */
gap-6  /* 24px - 大间距 */
space-y-4  /* 垂直间距 16px */
```

---

## 5. 圆角系统

### 5.1 圆角尺度

| Tailwind 类 | 像素值 | 使用场景 |
|------------|--------|---------|
| `rounded` | 4px | 小元素 |
| `rounded-lg` | 8px | 按钮、输入框 |
| `rounded-xl` | 12px | 卡片、对话框 |
| `rounded-2xl` | 16px | 大卡片、模态框 |
| `rounded-full` | 9999px | 圆形图标、徽章 |

---

## 6. 阴影系统

### 6.1 阴影层级

```css
shadow-lg   /* 大阴影 - 主按钮、模态框 */
shadow-xl   /* 超大阴影 - 弹窗 */
shadow-2xl  /* 巨大阴影 - 重要弹窗 */

/* 彩色阴影 */
shadow-violet-900/20   /* 紫色阴影 */
shadow-purple-500/10   /* 紫色光晕 */
```

---

## 7. 组件设计规范

### 7.1 页面布局

#### 标准三栏布局

```
┌─────────────────────────────────────────────┐
│  PageHeader (bg-black/50, border-b)         │
├───────┬─────────────────────┬───────────────┤
│ 左侧栏 │   中间内容区          │   右侧栏      │
│ w-80  │   flex-1            │   w-80       │
│ 边框r │   border-r          │   边框l       │
└───────┴─────────────────────┴───────────────┘
```

**布局参数：**
- 侧边栏宽度：`w-80` (320px) / `w-96` (384px)
- 中间区：`flex-1` 自适应
- 边框：`border-r border-slate-800`
- 背景：`bg-black`

### 7.2 卡片样式

#### 标准卡片

```tsx
<div className="bg-slate-900 border border-slate-800 rounded-2xl p-5
  hover:border-{color}-500 hover:shadow-lg hover:shadow-{color}-500/10
  transition-all hover:-translate-y-0.5">
  <!-- 内容 -->
</div>
```

#### 悬停效果

- 边框变色：`hover:border-{color}-500`
- 阴影添加：`hover:shadow-lg`
- 轻微上移：`hover:-translate-y-0.5`
- 过渡动画：`transition-all`

### 7.3 按钮样式

#### 主按钮（Primary）

```tsx
<button className="bg-gradient-to-r from-pink-600 to-violet-600
  hover:from-pink-500 hover:to-violet-500
  text-white font-medium rounded-lg
  px-4 py-2 text-sm
  shadow-lg shadow-violet-900/20
  transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed">
  添加到任务中心
</button>
```

#### 次级按钮（Secondary - 主题色）

```tsx
<button className="bg-gradient-to-r from-violet-600/20 to-purple-600/20
  hover:from-violet-600/30 hover:to-purple-600/30
  border border-violet-500/30
  text-violet-400 font-medium rounded-lg
  px-4 py-2 text-sm
  transition-all duration-200">
  次级操作
</button>
```

#### 幽灵按钮（Ghost）

```tsx
<button className="bg-transparent hover:bg-slate-800/50
  text-slate-400 hover:text-slate-200
  font-medium rounded-lg
  px-4 py-2 text-sm
  transition-colors">
  取消
</button>
```

### 7.4 输入框样式

```tsx
<input className="w-full bg-black/50
  border border-slate-800
  rounded-lg px-3 py-2
  text-sm text-slate-300
  placeholder:text-slate-600
  focus:outline-none focus:border-{color}-500
  transition-colors" />
```

### 7.5 标签页（Tabs）

```tsx
<div className="flex items-center bg-black rounded-lg p-0.5 border border-slate-800">
  <button className="px-3 py-1.5 rounded text-xs font-medium
    bg-violet-600 text-white shadow-lg shadow-violet-900/20">
    横屏
  </button>
  <button className="px-3 py-1.5 rounded text-xs font-medium
    text-slate-400 hover:text-white transition-all">
    竖屏
  </button>
</div>
```

### 7.6 徽章（Badge）

```tsx
<!-- 更新提示徽章 -->
<span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />

<!-- 数字徽章 -->
<span className="px-2 py-0.5 bg-violet-500/20 text-violet-400
  text-xs font-medium rounded">
  3
</span>
```

### 7.7 分隔线

```tsx
<!-- 垂直分隔线 -->
<div className="w-px h-4 bg-slate-800" />

<!-- 水平分隔线 -->
<div className="h-px w-full bg-slate-800" />
```

### 7.8 图标按钮

```tsx
<button className="w-7 h-7 bg-slate-800 hover:bg-slate-700
  border border-slate-700 rounded
  flex items-center justify-center
  text-white transition-colors">
  <ZoomIn className="w-3.5 h-3.5" />
</button>
```

---

## 8. 动画系统

### 8.1 过渡动画

```css
transition-colors      /* 颜色过渡 - 150ms */
transition-all         /* 全属性过渡 - 150ms */
transition-opacity     /* 透明度过渡 */
duration-200           /* 持续时间 200ms */
```

### 8.2 关键帧动画

#### 淡入动画

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
```

#### 缩放淡入

```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.animate-scaleIn {
  animation: scaleIn 0.2s ease-out;
}
```

#### 脉冲动画

```css
.animate-pulse        /* 标准脉冲 - 2s */
.animate-pulse-fast   /* 快速脉冲 - 2s 更明显 */
```

#### 旋转加载

```css
.animate-spin         /* 360° 旋转 - 1s 线性 */
```

### 8.3 交互反馈

```css
/* 悬停轻微上移 */
hover:-translate-y-0.5

/* 点击下压 */
active:translate-y-0

/* 缩放 */
hover:scale-105
```

---

## 9. 滚动条样式

### 9.1 自定义滚动条

```css
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.4);
  border-radius: 3px;
  transition: background 0.2s ease;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.6);
}
```

### 9.2 隐藏滚动条

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

---

## 10. 第二阶段设计建议

### 10.1 保持的设计元素

✅ **必须保持：**
- 深色主题（纯黑背景）
- 功能模块主题色区分
- 渐变按钮和强调元素
- 圆角统一性
- 悬停动效和反馈
- 三栏布局结构

### 10.2 可优化的设计元素

🔧 **建议优化：**

1. **图标系统统一化**
   - 当前：使用 Lucide React 图标库
   - 建议：为 AI 功能设计专属图标（如 AI 星星、魔法棒等）

2. **加载状态**
   - 当前：`Loader2` 旋转动画
   - 建议：增加骨架屏（Skeleton）、进度条、分步指示器

3. **AI 特有元素**
   - 建议：
     - AI 生成中状态：`<div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 animate-pulse" />`
     - AI 建议卡片：使用紫蓝渐变边框
     - AI 智能提示：`text-blue-400` 文字 + 蓝色图标

4. **交互反馈增强**
   - 当前：主要依赖颜色变化
   - 建议：
     - 成功提示：绿色勾选动画
     - 错误提示：红色抖动效果
     - 生成中：紫色光晕扩散

5. **数据可视化**
   - 建议：
     - 进度圆环：`stroke-{color}-500` + 动画
     - 统计数字：`font-mono text-{color}-400 text-2xl font-bold`
     - 对比图表：使用渐变色块

### 10.3 新增组件建议

#### AI 生成状态卡片

```tsx
<div className="relative overflow-hidden bg-gradient-to-br from-purple-600/10 to-blue-600/10
  border border-purple-500/30 rounded-2xl p-6">
  <!-- 光晕效果 -->
  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20
    animate-pulse-fast" />

  <!-- 内容 -->
  <div className="relative z-10">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-purple-400" />
      </div>
      <div>
        <h3 className="text-base font-bold text-white">AI 生成中</h3>
        <p className="text-xs text-purple-300">正在生成创意分镜...</p>
      </div>
    </div>
    <div className="w-full h-1 bg-purple-900/50 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse"
        style={{ width: '60%' }} />
    </div>
  </div>
</div>
```

#### AI 建议标签

```tsx
<div className="inline-flex items-center gap-1.5 px-2 py-1
  bg-blue-500/10 border border-blue-500/30 rounded-lg">
  <Sparkles className="w-3 h-3 text-blue-400" />
  <span className="text-xs text-blue-300 font-medium">AI 推荐</span>
</div>
```

#### 智能提示卡片

```tsx
<div className="bg-slate-900/50 border border-blue-500/20 rounded-xl p-4
  hover:border-blue-500/40 transition-colors">
  <div className="flex items-start gap-3">
    <Lightbulb className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
    <div>
      <h4 className="text-sm font-bold text-white mb-1">智能建议</h4>
      <p className="text-xs text-slate-400 leading-relaxed">
        建议使用横屏 16:9 比例，适合大多数社交媒体平台
      </p>
    </div>
  </div>
</div>
```

---

## 11. 响应式设计

### 11.1 断点系统

```css
sm:640px   /* 小屏幕 */
md:768px   /* 中等屏幕 */
lg:1024px  /* 大屏幕 */
xl:1280px  /* 超大屏幕 */
2xl:1536px /* 极大屏幕 */
```

### 11.2 栅格系统

```tsx
<!-- 首页卡片栅格 -->
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4
  w-full max-w-7xl">
  <!-- 功能卡片 -->
</div>
```

---

## 12. 无障碍设计

### 12.1 焦点状态

```css
focus:outline-none
focus:ring-2
focus:ring-{color}-500
focus:ring-offset-2
focus:ring-offset-black
```

### 12.2 禁用状态

```css
disabled:opacity-50
disabled:cursor-not-allowed
```

### 12.3 语义化

- 使用正确的 HTML 标签（`button` 而非 `div`）
- 添加 `aria-label` 属性
- 使用 `type="button"` 防止表单提交

---

## 13. 设计检查清单

### 开发前检查

- [ ] 确认主题色（从 8 种预设中选择）
- [ ] 检查背景色是否为 `bg-black` 或 `bg-slate-900`
- [ ] 确认文字对比度是否足够（至少 AA 级别）
- [ ] 确认按钮使用渐变或主题色
- [ ] 检查圆角是否统一（`rounded-lg` / `rounded-xl` / `rounded-2xl`）

### 开发中检查

- [ ] 悬停效果是否平滑（`transition-all duration-200`）
- [ ] 禁用状态是否清晰（`opacity-50` + `cursor-not-allowed`）
- [ ] 加载状态是否明确（旋转动画 + 文字提示）
- [ ] 滚动条样式是否统一（`custom-scrollbar`）
- [ ] 图标颜色是否匹配主题色（`text-{color}-400`）

### 开发后检查

- [ ] 整体视觉层次是否清晰
- [ ] 颜色编码是否符合模块定位
- [ ] 交互反馈是否明确
- [ ] 响应式布局是否正常
- [ ] 动画性能是否流畅

---

## 14. 常见问题

### Q1: 如何选择主题色？

**A:** 根据功能特性选择：
- 创作/编辑类 → `violet` (紫色，代表创意)
- 图片处理类 → `amber` (琥珀色，代表图像)
- AI 功能 → `purple` + `blue` (紫蓝渐变，代表智能)
- 数据/分析类 → `cyan` (青色，代表科技)
- 文件操作类 → `pink` (粉色，代表轻盈)

### Q2: 何时使用渐变？

**A:**
- ✅ 主按钮、重要操作
- ✅ 卡片悬停效果
- ✅ 标题文字（Logo）
- ✅ AI 相关元素
- ❌ 次级按钮（使用单色半透明）
- ❌ 输入框、边框

### Q3: 如何设计 AI 特有元素？

**A:**
1. 使用紫蓝渐变：`from-purple-600 to-blue-600`
2. 添加光晕效果：`shadow-purple-500/20`
3. 使用脉冲动画：`animate-pulse-fast`
4. 添加 AI 图标：`Sparkles`, `Wand2`, `Brain`
5. 使用蓝色文字：`text-blue-400`

### Q4: 如何保持一致性？

**A:**
1. 复用现有组件（Button, FileSelector 等）
2. 遵循命名规范（主题色传递）
3. 使用相同间距体系（4px 基准）
4. 保持相同动画时长（200ms）

---

## 15. 总结

### 核心设计特征

1. **深色主题** - 纯黑背景 + slate 色系
2. **模块配色** - 8 种主题色区分功能
3. **渐变强调** - 按钮和重要元素使用渐变
4. **层次分明** - 背景/内容/交互/强调四层结构
5. **动画流畅** - 统一过渡时长（200ms）
6. **圆角统一** - lg/xl/2xl 三种规格
7. **交互反馈** - 悬停变色、位移、阴影

### 第二阶段建议

- ✅ **保持**：深色主题、模块配色、渐变系统
- 🔧 **优化**：增加 AI 专属元素、优化加载状态
- ➕ **新增**：AI 状态卡片、智能提示组件、进度可视化

---

**文档版本：** v1.0
**更新日期：** 2026-03-16
**适用范围：** VideoStitcher 第二阶段 AI 视频制作功能
