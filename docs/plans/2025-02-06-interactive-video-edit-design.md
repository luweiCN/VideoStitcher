# 交互式视频编辑功能设计文档

**日期**: 2025-02-06
**项目**: VideoStitcher
**功能**: 横竖屏极速合成交互式编辑

---

## 1. 概述

为 VideoStitcher 的横屏和竖屏合成模式添加交互式编辑功能，允许用户通过拖拽和缩放来精确控制 A 面和 B 面视频的位置和大小，替代原有的自动居中逻辑。

### 1.1 核心需求

- **分别控制**: A 面和 B 面视频独立调整位置和大小
- **实时预览**: 拖拽视频框实时显示在画布上
- **智能吸附**: 视频框中心吸附到画布中心，边缘吸附到画布边缘
- **双模式支持**: 同时支持横屏（1920x1080）和竖屏（1080x1920）

---

## 2. 架构设计

### 2.1 新增组件

```
src/renderer/components/
├── VideoEditor.tsx          # 交互式视频编辑器（新建）
└── VideoBox.tsx             # 单个视频框组件（新建）
```

### 2.2 数据结构

```typescript
// 新增类型定义
interface VideoPosition {
  x: number;        // 视频框左上角 X 坐标
  y: number;        // 视频框左上角 Y 坐标
  width: number;    // 视频框宽度
  height: number;   // 视频框高度
}

interface VideoBoxConfig {
  id: 'a' | 'b';              // A 面或 B 面
  label: string;              // 显示标签
  position: VideoPosition;    // 当前位置和大小
  visible: boolean;           // 是否可见（用于切换编辑对象）
  color: string;              // 主题色（区分 A/B 面）
}
```

### 2.3 状态管理

```typescript
// 在 HorizontalMode.tsx 和 VerticalMode.tsx 中添加
const [videoBoxA, setVideoBoxA] = useState<VideoPosition>({
  x: 0,
  y: 0,
  width: canvasWidth,
  height: canvasHeight
});

const [videoBoxB, setVideoBoxB] = useState<VideoPosition>({
  x: (canvasWidth - defaultWidth) / 2,
  y: 0,
  width: defaultWidth,
  height: canvasHeight
});

const [activeBox, setActiveBox] = useState<'a' | 'b'>('b'); // 当前编辑的视频框
```

---

## 3. 组件设计

### 3.1 VideoEditor 组件

**职责**:
- 管理画布和背景图渲染
- 处理全局鼠标事件（拖拽、缩放）
- 渲染辅助对齐线
- 计算坐标转换（屏幕坐标 ↔ 画布坐标）

**Props**:
```typescript
interface VideoEditorProps {
  mode: 'horizontal' | 'vertical';
  canvasWidth: number;
  canvasHeight: number;
  bgImage?: string;
  boxes: VideoBoxConfig[];
  onBoxChange: (id: 'a' | 'b', position: VideoPosition) => void;
  onActiveBoxChange: (id: 'a' | 'b') => void;
}
```

**关键实现**:
- 使用 `useRef` 存储 container 的尺寸和缩放比例
- 监听 `mousemove`、`mouseup` 事件处理拖拽
- 实现吸附逻辑（计算距离画布中心/边缘的距离）

### 3.2 VideoBox 组件

**职责**:
- 渲染单个视频框（边框、标签、缩放手柄）
- 处理拖拽开始事件
- 显示尺寸信息（拖拽时）

**Props**:
```typescript
interface VideoBoxProps {
  config: VideoBoxConfig;
  scale: number;
  isActive: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}
```

---

## 4. FFmpeg 集成

### 4.1 修改 horizontalMerge.js

```javascript
// 新增参数
function buildArgs({
  aPath,
  bPath,
  outPath,
  bgImage,
  coverImage,
  aPosition,  // 新增：A 面位置
  bPosition   // 新增：B 面位置
}) {
  // ...

  // 使用自定义位置替代自动居中
  filters.push('[bg1][v0_raw]overlay=' +
    `${aPosition.x}:${aPosition.y}[v0];`);

  filters.push('[bg2][v1_raw]overlay=' +
    `${bPosition.x}:${bPosition.y}[v1];`);

  // ...
}
```

### 4.2 修改 verticalMerge.js

类似的修改，使用自定义位置参数。

### 4.3 修改 IPC handlers

```javascript
// video.js
async function handleHorizontalMerge(event, {
  aVideos,
  bVideos,
  bgImage,
  coverImage,
  outputDir,
  concurrency,
  aPosition,  // 新增
  bPosition   // 新增
}) {
  // ...
  const args = buildHorizontalArgs({
    aPath: a,
    bPath: b,
    outPath,
    bgImage,
    coverImage,
    aPosition,  // 传递
    bPosition   // 传递
  });
  // ...
}
```

---

## 5. 用户交互流程

### 5.1 初始状态

1. 用户选择背景图（可选）
2. 画布显示：
   - 背景图（如果有）或黑色底
   - A 面视频框（默认铺满画布，紫色边框）
   - B 面视频框（默认居中，蓝色边框）
3. 默认激活 B 面视频框

### 5.2 编辑操作

**拖拽移动**:
- 点击视频框内部并拖动
- 实时更新位置
- 中心靠近画布中心时显示绿色辅助线并自动吸附

**缩放大小**:
- 拖动视频框右下角的圆形手柄
- 保持宽高比
- 右下角实时显示尺寸

**切换编辑对象**:
- 点击 A 面或 B 面视频框
- 边框高亮表示当前选中
- 右下角快捷按钮切换

### 5.3 应用设置

1. 用户调整好 A 面和 B 面的位置和大小
2. 点击"开始批量处理"
3. 自定义位置传递给 FFmpeg
4. 所有视频使用相同的位置参数合成

---

## 6. 边界情况处理

### 6.1 最小尺寸限制

- 视频框最小宽度: 200px
- 防止视频框过小导致无法操作

### 6.2 最大尺寸限制

- 允许超出画布边界（实现放大效果）
- 最大宽度: 画布宽度的 10 倍

### 6.3 默认位置

- **横屏模式**:
  - A 面: 1920x1080（铺满）
  - B 面: 607.5x1080（居中，适合竖屏视频）
- **竖屏模式**:
  - A 面: 1080x1920（铺满）
  - B 面: 1080x607.5（居中，适合横屏视频）

---

## 7. 实现步骤

1. **创建类型定义** (`src/renderer/types.ts`)
2. **实现 VideoBox 组件** - 单个视频框
3. **实现 VideoEditor 组件** - 主编辑器
4. **修改 HorizontalMode.tsx** - 集成编辑器
5. **修改 VerticalMode.tsx** - 集成编辑器
6. **修改 horizontalMerge.js** - 添加位置参数
7. **修改 verticalMerge.js** - 添加位置参数
8. **修改 video.js** - 传递位置参数
9. **测试和调试**

---

## 8. 技术亮点

- **坐标转换**: 屏幕坐标 ↔ 画布坐标（考虑缩放比例）
- **事件代理**: 全局监听鼠标事件，避免事件丢失
- **智能吸附**: 12px 吸附阈值，绿色辅助线
- **状态同步**: React state ↔ FFmpeg 参数
- **响应式画布**: 根据容器大小自动缩放
