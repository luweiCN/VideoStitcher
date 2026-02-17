# UI 样式指南

## 配色标准 ⚠️ 重要

### 核心原则

**纯黑主题 + slate 色系边框和文字**

### 颜色方案

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
| 禁用文字 | `text-slate-700` | |

### 禁止使用的颜色

| 禁止 | 替代 |
|------|------|
| ❌ `bg-gray-*` | ✅ `bg-black`, `bg-neutral-*`, `bg-slate-*` |
| ❌ `bg-[#0a0a0f]` | ✅ `bg-black` |
| ❌ `bg-[#12121a]` | ✅ `bg-neutral-900` 或 `bg-black` |

---

## 组件示例

### 主容器

```tsx
<div className="bg-black text-slate-100">...</div>
```

### 卡片

```tsx
<div className="bg-black/50 border border-slate-800 rounded-xl">...</div>
```

### 输入框

```tsx
<input className="bg-black/50 border border-slate-800 text-slate-300" />
```

### 按钮

```tsx
<button className="bg-gradient-to-r from-pink-600 to-violet-600 text-white" />
```

### 页面 Header

```tsx
<header className="bg-black/50 border-b border-slate-800">...</header>
```

### Tooltip

```tsx
<div className="bg-black border border-slate-700/50">...</div>
```

---

## 功能模块配色

不同功能模块使用不同的主题色区分：

| 模块 | 主题色 | Tailwind 类 |
|------|--------|-------------|
| 视频拼接 | 青色 | `cyan` |
| 视频合成 | 紫色 | `violet` |
| 图片处理 | 琥珀色 | `amber` |
| 封面格式 | 玫瑰色 | `rose` |
| 智能改尺寸 | 绿宝石 | `emerald` |
| 无损拼图 | 粉色 | `pink` |
