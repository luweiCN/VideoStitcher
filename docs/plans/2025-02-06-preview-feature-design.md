# 预览功能设计方案

## 日期
2025-02-06

## 功能概述

为以下三个工具添加预览功能：
- 横版极速合成 (HorizontalMode)
- 竖屏极速合成 (VerticalMode)
- 图片素材处理 (ImageMaterialMode)

## 需求确认

1. **预览类型**：视频可播放预览（图片也支持预览）
2. **布局方式**：左右布局 - 左侧预览框，右侧现有内容
3. **切换方式**：左右箭头按钮切换素材

---

## 第一部分：整体架构

### 布局结构

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header (返回标题 + 帮助按钮)                                          │
├──────────────┬──────────────────────────────────────────────────────┤
│              │  左侧输入区域 (bgImage, videos, sideAVideos...)       │
│   预览面板    │  ┌────────────────────────────────────────────────┐  │
│              │  │ 背景图输入框                                     │  │
│  ┌────────┐  │  └────────────────────────────────────────────────┘  │
│  │        │  │  ┌────────────────────────────────────────────────┐  │
│  │ 视频/  │  │  │ 主视频输入框                                    │  │
│  │ 图片   │  │  └────────────────────────────────────────────────┘  │
│  │ 预览   │  │  ...                                               │
│  │        │  │                                                      │
│  │        │  │  右侧设置/进度/日志区域                              │
│  │        │  │                                                      │
│  └────────┘  │                                                      │
│  ◀ ▶ 切换    │                                                      │
│              │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

### 组件层次

```
HorizontalMode/VerticalMode/ImageMaterialMode
├── PreviewPanel (新组件 - 左侧固定)
│   ├── PreviewPlayer (视频/图片播放器)
│   ├── PreviewControls (切换控制按钮)
│   └── PreviewInfo (当前显示信息)
└── MainContent (现有内容 - 右侧滚动)
    ├── InputsSection
    └── RightPanel
```

---

## 第二部分：PreviewPanel 组件设计

### 组件接口

```typescript
interface PreviewPanelProps {
  // 所有素材类型的文件列表
  bgImage?: string;
  videos?: string[];
  sideAVideos?: string[];
  covers?: string[];

  // 当前激活的素材类型（用于切换）
  activeSource?: 'bgImage' | 'videos' | 'sideAVideos' | 'covers';

  // 当切换素材类型时回调
  onSourceChange?: (source: PreviewPanelProps['activeSource']) => void;
}
```

### 内部状态

```typescript
interface PreviewPanelState {
  currentFileIndex: number;  // 当前显示的文件索引
  isPlaying: boolean;        // 视频播放状态
  error: string | null;      // 加载错误信息
}
```

### 功能说明

1. **素材切换**
   - 上方显示当前素材类型名称（如「主视频 (3)」）
   - 点击可切换到下一个有文件的素材类型
   - 左右箭头切换同类型内的不同文件

2. **播放器**
   - 图片：直接显示，支持缩放
   - 视频：HTML5 video 标签，支持播放/暂停

3. **加载本地文件**
   - 使用 `file://` 协议或 Electron 的协议
   - 需要确认主进程是否需要特殊处理

---

## 第三部分：数据流

### 文件路径处理

```
用户选择文件 → 存储绝对路径 → PreviewPanel 读取
                    ↓
              需要确保安全性
```

**重要问题**：Electron 渲染进程直接访问本地文件路径可能受限

### 解决方案

**方案 A：使用 Custom Protocol**
- 主进程注册 `local-file://` 协议
- 渲染进程通过协议访问本地文件

**方案 B：转为 Data URL**
- 主进程读取文件转为 base64
- 通过 IPC 传递给渲染进程（大文件不推荐）

**推荐方案 A**，性能更好且适合大文件

---

## 第四部分：各工具的具体差异

### 横版极速合成 (HorizontalMode)
- 预览素材：bgImage, videos, sideAVideos, covers
- 输出尺寸：1920x1080
- 主题色：violet

### 竖屏极速合成 (VerticalMode)
- 预览素材：bgImage, videos, sideAVideos, covers
- 输出尺寸：1080x1920
- 主题色：indigo

### 图片素材处理 (ImageMaterialMode)
- 预览素材：images, logoPath
- 特殊处理：九宫格预览？（可选）
- 主题色：amber

---

## 第五部分：实现步骤

### Step 1: 创建共享的 PreviewPanel 组件
- 文件位置：`src/renderer/components/PreviewPanel.tsx`
- 支持图片和视频预览
- 支持切换控制

### Step 2: 修改主进程（如需要）
- 添加本地文件访问协议
- 或添加获取文件 thumbnail 的 API

### Step 3: 修改三个模式组件
- 调整布局为左右结构
- 集成 PreviewPanel 组件
- 传递各自的素材列表

### Step 4: 样式调整
- 确保响应式布局
- 小屏幕下的适配（可能折叠预览面板）

---

## 第六部分：边界情况

1. **没有选择任何文件**
   - 显示空状态占位符

2. **文件格式不支持**
   - 显示错误提示

3. **文件路径无效/文件不存在**
   - 显示加载失败提示

4. **视频加载慢**
   - 显示加载中状态

---

## 第七部分：待确认问题

1. [ ] Electron 安全策略是否允许直接访问本地文件？
2. [ ] 是否需要主进程添加 thumbnail 生成 API？
3. [ ] 预览面板的默认宽度？建议：320px-400px
4. [ ] 是否支持小屏幕下隐藏预览面板？
