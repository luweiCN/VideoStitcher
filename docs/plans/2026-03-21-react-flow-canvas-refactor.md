# React Flow 画布重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 React Flow（@xyflow/react）替换 `NodeCanvas.tsx` 中 800 行手写无限画布实现，改为**命令式 API**（`ref.addNode / addEdge`），消除拖拽/点击冲突，并 1:1 复现当前所有视觉样式。

**Architecture:**
画布改为命令式：父组件持有 `canvasRef`，通过 `ref.addNode()` / `ref.addEdge()` 推送节点，画布内部用 `useNodesState` / `useEdgesState` 管理自身状态。父组件的 `useMemo` 计算 canvasNodes/canvasEdges 的逻辑迁移为 `useEffect` + `useImperativeHandle` 调用。6 种节点类型拆成独立组件，样式完全复现现有设计。

**Tech Stack:** `@xyflow/react` v12，React `forwardRef` + `useImperativeHandle`，Tailwind CSS，Lucide 图标

---

## 现有样式规格（必须 1:1 还原）

### 画布背景
```
background-image: radial-gradient(circle, #1a1b2e 1px, transparent 1px)
background-size: (24 × scale)px
background-position: 跟随 pan 偏移
```
→ 用 React Flow `<Background variant="dots" gap={24} size={1} color="#1a1b2e" />`

### 节点卡片（通用）
| 状态 | Tailwind 类 |
|------|-------------|
| 正常 | `p-5 rounded-2xl border shadow-xl bg-slate-800 border-slate-700` |
| hover | `hover:shadow-orange-500/10`（轻微橙色阴影） |
| 选中 | `ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500 bg-slate-800` |

### 节点宽度
| 类型 | 宽度 |
|------|------|
| script / character / character-image / scene / video | 320px |
| storyboard | 640px |

### 节点标题图标颜色
| 类型 | 图标 | 颜色 |
|------|------|------|
| script | FileText | `text-blue-500` |
| character | UserCircle | `text-orange-500` |
| character-image | UserCircle | `text-purple-500` |
| scene | Film | `text-green-500` |
| storyboard | Film | `text-blue-500` |
| video | Play | `text-red-500` |

### 连线（Edge）
```
stroke:          #f97316（橙，普通）
                 #3b82f6（蓝，source 为 storyboard 或 video 时）
strokeWidth:     3（普通）/ 4（选中）
strokeDasharray: "8,8"
opacity:         60%（普通）/ 100%（选中）
animation:       flow 1s linear infinite（stroke-dashoffset 16→0）
```
该动画定义在 `src/renderer/index.css`:
```css
@keyframes flow {
  from { stroke-dashoffset: 16; }
  to   { stroke-dashoffset: 0;  }
}
```

### 控制台（右上角）
```
位置:  absolute top-6 right-6
背景:  bg-slate-800/80 backdrop-blur-md
边框:  border border-slate-700
圆角:  rounded-full（按钮）
图标:  MousePointer2（选择模式）/ Hand（拖动模式）
缩放显示: px-4 py-2 rounded-full text-xs font-bold text-slate-300
```

---

## 命令式 API 设计

```typescript
// NodeCanvas 对外暴露的句柄
interface NodeCanvasHandle {
  addNode: (node: CanvasNode) => void;
  addEdge: (edge: CanvasEdge) => void;
  updateNode: (nodeId: string, updates: Partial<CanvasNode['data']>) => void;
  removeNode: (nodeId: string) => void;
  clearAll: () => void;
  fitView: () => void;
}
```

父组件 `index.tsx` 的改动：
- 删除 `canvasNodes` / `canvasEdges` 两个 `useMemo`
- 删除 `nodePositions` state
- 添加 `canvasRef = useRef<NodeCanvasHandle>(null)`
- 改为 `useEffect` 监听每种数据变化，调用 `canvasRef.current.addNode()` 等

---

## 文件结构

```
DirectorMode/
├── index.tsx                     # 改：删 useMemo 改用 useEffect + canvasRef
├── NodeCanvas.tsx                # 重写：forwardRef + React Flow + useImperativeHandle
└── nodes/                        # 新建目录：6 种自定义节点组件
    ├── ScriptNode.tsx
    ├── CharacterNode.tsx
    ├── CharacterImageNode.tsx
    ├── SceneNode.tsx
    ├── StoryboardNode.tsx
    └── VideoNode.tsx
```

---

## Task 1: 安装 @xyflow/react

**Files:**
- Modify: `package.json`

**Step 1: 安装依赖**

```bash
cd /Users/luwei/code/freelance/VideoStitcher/.worktrees/aside-video-production
npm install @xyflow/react
```

Expected: `package.json` 出现 `"@xyflow/react": "^12.x.x"`

**Step 2: 确认安装成功**

```bash
node -e "console.log(require('./node_modules/@xyflow/react/package.json').version)"
```

Expected: 输出版本号 12.x.x

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: 安装 @xyflow/react 用于画布重构"
```

---

## Task 2: 创建 6 个自定义节点组件

每个节点组件规则：
- 接收 `NodeProps`（from `@xyflow/react`），`data` 字段就是我们自定义的内容
- 通过 `data.onUpdate` / `data.onRegenerate` / `data.onPreview` 回调与外部通信（父组件注入）
- `selected` prop 由 React Flow 传入，用于切换选中样式
- 必须渲染 `<Handle>` 供连线使用

**Files:**
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/ScriptNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/CharacterNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/CharacterImageNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/SceneNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/StoryboardNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/VideoNode.tsx`

### 节点卡片通用样式（所有节点共用）

```tsx
// 正常
`p-5 rounded-2xl border shadow-xl bg-slate-800 border-slate-700 transition-all`
// 选中（selected=true 时追加）
`ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500`
```

**Step 1: 创建 ScriptNode.tsx**

```tsx
/**
 * 剧本节点 - React Flow 自定义节点
 */
import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText, Pencil, Check, X } from 'lucide-react';
import { ScreenplayCard } from '../../ScreenplayGenerator/ScreenplayCard';

export function ScriptNode({ data, selected }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-orange-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} className="text-blue-500" />
          剧本
        </h4>
        {!isEditing && (
          <button
            onClick={() => { setIsEditing(true); setEditText((data.text as string) ?? ''); }}
            className="text-slate-400 hover:text-orange-500 transition-colors p-1"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full p-3 text-sm font-medium rounded-xl border bg-slate-900 border-slate-600 text-white focus:border-orange-500 outline-none resize-none"
            rows={4}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-slate-500 hover:text-slate-300 px-3 py-1.5 flex items-center gap-1">
              <X size={14} /> 取消
            </button>
            <button
              onClick={() => { (data.onUpdate as Function)?.({ text: editText }); setIsEditing(false); }}
              className="text-xs font-bold bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 shadow-md flex items-center gap-1"
            >
              <Check size={14} /> 保存
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-[60px]">
          <ScreenplayCard content={(data.text as string) ?? ''} showFull />
        </div>
      )}
    </div>
  );
}
```

**Step 2: 创建 CharacterNode.tsx**

```tsx
/**
 * 人物设定节点
 */
import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle, RefreshCcw, Pencil, Check, X } from 'lucide-react';

export function CharacterNode({ data, selected }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-orange-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-orange-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <UserCircle size={14} className="text-orange-500" />
          {data.name as string}
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => (data.onRegenerate as Function)?.()}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
            title="重新生图"
          >
            <RefreshCcw size={12} className={data.isGeneratingImage ? 'animate-spin text-orange-500' : ''} />
          </button>
          {!isEditing && (
            <button
              onClick={() => { setIsEditing(true); setEditName((data.name as string) ?? ''); setEditDesc((data.description as string) ?? ''); }}
              className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="角色名称"
            className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="角色描述" rows={3}
            className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-white"><X size={14} /></button>
            <button onClick={() => { (data.onUpdate as Function)?.({ name: editName, description: editDesc }); setIsEditing(false); }}
              className="p-1 text-orange-500 hover:text-orange-400"><Check size={14} /></button>
          </div>
        </div>
      ) : (
        <>
          <h5 className="text-sm font-bold mb-2">{data.charName as string}</h5>
          <p className="text-xs text-slate-400 whitespace-pre-wrap">{data.description as string}</p>
        </>
      )}
    </div>
  );
}
```

**Step 3: 创建 CharacterImageNode.tsx**

```tsx
/**
 * 人物形象图片节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle } from 'lucide-react';

export function CharacterImageNode({ data, selected }: NodeProps) {
  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-purple-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-purple-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <UserCircle size={14} className="text-purple-500" />
          人物形象
        </h4>
      </div>

      <div className="w-full h-56 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt={data.name as string}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => (data.onPreview as Function)?.({ type: 'image', src: data.imageUrl, title: data.name })}
          />
        ) : (
          <UserCircle className="w-16 h-16 text-slate-700" />
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400 text-center">{data.name as string}</div>
    </div>
  );
}
```

**Step 4: 创建 SceneNode.tsx**

```tsx
/**
 * 场景设定节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Film } from 'lucide-react';

export function SceneNode({ data, selected }: NodeProps) {
  const locationLabel = data.location_type === 'indoor' ? '室内' : data.location_type === 'outdoor' ? '室外' : '';
  const timeLabel = { day: '白天', night: '夜晚', dusk: '黄昏', dawn: '清晨' }[(data.time_of_day as string) ?? ''] ?? (data.time_of_day as string) ?? '';

  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-green-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-green-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Film size={14} className="text-green-500" />
          场景设定
        </h4>
        <span className="text-xs text-slate-600">
          {locationLabel}{timeLabel ? ` · ${timeLabel}` : ''}
        </span>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-bold text-green-400">{data.name as string}</h5>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{data.environment as string}</p>
        {data.atmosphere && <p className="text-xs text-slate-500 italic">氛围：{data.atmosphere as string}</p>}
        {Array.isArray(data.props) && data.props.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(data.props as string[]).slice(0, 4).map((prop, i) => (
              <span key={i} className="px-1.5 py-0.5 text-xs rounded bg-green-900/30 text-green-400 border border-green-800/40">
                {prop}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 5: 创建 StoryboardNode.tsx**

```tsx
/**
 * 分镜矩阵节点（宽 640px）
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Film } from 'lucide-react';

export function StoryboardNode({ data, selected }: NodeProps) {
  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      {/* 宽度由父级传入 style.width=640 控制，节点内部不设 w-* */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Film size={14} className="text-blue-500" />
          {(data.label as string) ?? '分镜矩阵'}
        </h4>
      </div>

      <div className="w-full rounded-xl overflow-hidden bg-slate-900">
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt="分镜图"
            className="w-full h-auto object-contain cursor-zoom-in"
            style={{ maxHeight: 400 }}
            onClick={() => (data.onPreview as Function)?.({ type: 'image', src: data.imageUrl, title: data.label ?? '分镜矩阵' })}
          />
        ) : (
          <div className="h-32 flex items-center justify-center">
            <Film className="w-12 h-12 text-slate-700" />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 6: 创建 VideoNode.tsx**

```tsx
/**
 * 视频输出节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

export function VideoNode({ data, selected }: NodeProps) {
  const src = data.localPath ? `file://${data.localPath as string}` : data.url as string | undefined;

  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-red-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Play size={14} className="text-red-500" />
          视频输出
        </h4>
      </div>

      <div
        className="w-full h-40 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center relative group cursor-pointer"
        onClick={() => src && (data.onPreview as Function)?.({ type: 'video', src, title: data.label })}
      >
        {src ? (
          <>
            <video src={src} className="w-full h-full object-cover" preload="metadata" muted />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-10 h-10 text-white drop-shadow-lg" fill="white" />
            </div>
          </>
        ) : (
          <Play className="w-12 h-12 text-slate-700" />
        )}
      </div>

      <div className="mt-2 text-xs text-slate-400">
        {data.label as string} {data.duration ? `(${data.duration as string})` : ''}
      </div>
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/nodes/
git commit -m "feat: 新增 React Flow 6 种自定义节点组件（样式 1:1 复现）"
```

---

## Task 3: 创建自定义 Edge 组件（复现流动虚线动画）

React Flow 内置的 `animated` edge 效果与现有的 `@keyframes flow` 不同。必须用自定义边复现。

**Files:**
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/FlowEdge.tsx`

**Step 1: 创建 FlowEdge.tsx**

```tsx
/**
 * 自定义连线 - 复现现有流动橙色虚线效果
 *
 * 颜色规则：
 * - 普通：#f97316（橙），opacity 60%
 * - 选中：#f97316，opacity 100%，strokeWidth 4
 * - source 类型为 storyboard/video：#3b82f6（蓝）
 */
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

export function FlowEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  // source 节点类型由父组件注入到 data
  const isBlueEdge = data?.sourceType === 'storyboard' || data?.sourceType === 'video';
  const stroke = isBlueEdge ? '#3b82f6' : '#f97316';
  const strokeWidth = selected ? 4 : 3;
  const opacity = selected ? 1 : 0.6;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke,
        strokeWidth,
        strokeDasharray: '8,8',
        opacity,
        animation: 'flow 1s linear infinite',
      }}
    />
  );
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/nodes/FlowEdge.tsx
git commit -m "feat: 自定义 FlowEdge 复现流动橙色虚线动画"
```

---

## Task 4: 重写 NodeCanvas.tsx（命令式 API + React Flow）

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/NodeCanvas.tsx`（完整重写）

关键设计要点：
1. `forwardRef` + `useImperativeHandle` 暴露 `addNode / addEdge / updateNode / removeNode / clearAll / fitView`
2. 内部用 `useNodesState` / `useEdgesState` 管理状态
3. 注入 `onUpdate` / `onRegenerate` / `onPreview` 到每个节点的 `data` 字段
4. `useReactFlow()` 的 `fitView` 方法包装到 handle 里
5. 控制台（右上角）保持原样：模式按钮 + 缩放比 + 重置按钮

**Step 1: 重写 NodeCanvas.tsx**

```tsx
/**
 * 节点画布组件 - 导演模式可视化画板
 * 使用 @xyflow/react 实现，命令式 API（forwardRef + useImperativeHandle）
 */

import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useRef,
} from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ScriptNode } from './nodes/ScriptNode';
import { CharacterNode } from './nodes/CharacterNode';
import { CharacterImageNode } from './nodes/CharacterImageNode';
import { SceneNode } from './nodes/SceneNode';
import { StoryboardNode } from './nodes/StoryboardNode';
import { VideoNode } from './nodes/VideoNode';
import { FlowEdge } from './nodes/FlowEdge';

// ==================== 类型定义（与旧版接口保持兼容） ====================

export type NodeType = 'script' | 'character' | 'character-image' | 'scene' | 'storyboard' | 'video';

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  data: {
    text?: string;
    name?: string;
    charName?: string;
    description?: string;
    role_type?: string;
    imageUrl?: string;
    isGeneratingImage?: boolean;
    characterId?: string;
    location_type?: string;
    time_of_day?: string;
    environment?: string;
    props?: string[];
    atmosphere?: string;
    key_visual_elements?: string[];
    label?: string;
    frames?: any[];
    isHorizontal?: boolean;
    url?: string;
    localPath?: string;
    duration?: string;
    isFinal?: boolean;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

/** 命令式句柄，父组件通过 ref 调用 */
export interface NodeCanvasHandle {
  addNode: (node: CanvasNode) => void;
  addEdge: (edge: CanvasEdge) => void;
  updateNode: (nodeId: string, updates: Partial<CanvasNode['data']>) => void;
  removeNode: (nodeId: string) => void;
  clearAll: () => void;
  fitView: () => void;
}

interface NodeCanvasProps {
  onNodeRegenerate: (nodeId: string) => void;
  onPreview?: (item: { type: 'image' | 'video'; src: string; title?: string }) => void;
}

// ==================== 自定义类型映射（组件外定义，避免重渲染导致闪烁） ====================

const NODE_TYPES = {
  script: ScriptNode,
  character: CharacterNode,
  'character-image': CharacterImageNode,
  scene: SceneNode,
  storyboard: StoryboardNode,
  video: VideoNode,
} as const;

const EDGE_TYPES = {
  flowEdge: FlowEdge,
} as const;

// ==================== 内部 Canvas（需要 ReactFlowProvider 的方法放这里） ====================

const NodeCanvasInner = forwardRef<NodeCanvasHandle, NodeCanvasProps>(
  function NodeCanvasInner({ onNodeRegenerate, onPreview }, ref) {
    const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
    const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const { fitView } = useReactFlow();

    // 回调 refs（避免 useImperativeHandle 依赖变化）
    const onNodeRegenerateRef = useRef(onNodeRegenerate);
    onNodeRegenerateRef.current = onNodeRegenerate;
    const onPreviewRef = useRef(onPreview);
    onPreviewRef.current = onPreview;

    /** 将 CanvasNode 转为 React Flow Node 格式，注入回调 */
    const toRFNode = useCallback((cn: CanvasNode): Node => ({
      id: cn.id,
      type: cn.type,
      position: { x: cn.x, y: cn.y },
      data: {
        ...cn.data,
        onUpdate: (updates: Partial<CanvasNode['data']>) => {
          setRfNodes((prev) =>
            prev.map((n) => n.id === cn.id ? { ...n, data: { ...n.data, ...updates } } : n)
          );
        },
        onRegenerate: () => onNodeRegenerateRef.current(cn.id),
        onPreview: (item: any) => onPreviewRef.current?.(item),
      },
      style: { width: cn.width },
    }), [setRfNodes]);

    /** 将 CanvasEdge 转为 React Flow Edge 格式 */
    const toRFEdge = useCallback((ce: CanvasEdge, sourceType?: NodeType): Edge => ({
      id: ce.id,
      source: ce.source,
      target: ce.target,
      type: 'flowEdge',
      data: { sourceType },
    }), []);

    // ==================== 命令式 API ====================

    useImperativeHandle(ref, () => ({
      addNode(cn: CanvasNode) {
        setRfNodes((prev) => {
          // 已存在则更新，否则追加
          const exists = prev.some((n) => n.id === cn.id);
          if (exists) {
            return prev.map((n) => n.id === cn.id ? toRFNode(cn) : n);
          }
          return [...prev, toRFNode(cn)];
        });
      },

      addEdge(ce: CanvasEdge) {
        setRfEdges((prev) => {
          // 获取 source 节点类型（从 rfNodes 最新快照）
          const exists = prev.some((e) => e.id === ce.id);
          if (exists) return prev;
          return [...prev, toRFEdge(ce)];
        });
      },

      updateNode(nodeId: string, updates: Partial<CanvasNode['data']>) {
        setRfNodes((prev) =>
          prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)
        );
      },

      removeNode(nodeId: string) {
        setRfNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setRfEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
      },

      clearAll() {
        setRfNodes([]);
        setRfEdges([]);
      },

      fitView() {
        fitView({ padding: 0.2, duration: 300 });
      },
    }), [toRFNode, toRFEdge, fitView, setRfNodes, setRfEdges]);

    // 节点拖拽结束：位置已由 React Flow 内部管理，无需回调父组件
    const handleNodeDragStop = useCallback((_evt: React.MouseEvent, node: Node) => {
      console.log('[NodeCanvas] 节点拖拽结束:', node.id, node.position);
    }, []);

    return (
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES as any}
          edgeTypes={EDGE_TYPES as any}
          onNodeDragStop={handleNodeDragStop}
          fitView={false}
          minZoom={0.1}
          maxZoom={3}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          // 禁用连线拖拽（画布是只读拓扑展示，不允许用户手动连线）
          nodesConnectable={false}
          // 保留节点拖拽，关闭多选框选
          selectionOnDrag={false}
        >
          {/* 点阵背景，完全对应原来的 radial-gradient dot 效果 */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#1a1b2e"
          />
          {/* 控制条（左下角，深色主题） */}
          <Controls
            showInteractive={false}
            className="!bg-slate-800/80 !border-slate-700 !rounded-xl !backdrop-blur-md"
          />
          {/* 小地图 */}
          <MiniMap
            nodeColor={(node) => ({
              script: '#3b82f6',
              character: '#f97316',
              'character-image': '#a855f7',
              scene: '#22c55e',
              storyboard: '#3b82f6',
              video: '#ef4444',
            }[node.type ?? ''] ?? '#64748b')}
            maskColor="rgba(15, 23, 42, 0.7)"
            style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: 12 }}
          />
        </ReactFlow>
      </div>
    );
  }
);

// ==================== 对外组件（包裹 Provider） ====================

/**
 * NodeCanvas - 导演模式无限画布
 *
 * 使用命令式 API:
 *   const ref = useRef<NodeCanvasHandle>(null);
 *   ref.current.addNode({ id, type, x, y, width, data });
 *   ref.current.addEdge({ id, source, target });
 */
export const NodeCanvas = forwardRef<NodeCanvasHandle, NodeCanvasProps>(
  function NodeCanvas(props, ref) {
    return (
      <ReactFlowProvider>
        <NodeCanvasInner ref={ref} {...props} />
      </ReactFlowProvider>
    );
  }
);
```

**Step 2: 编译检查**

```bash
cd /Users/luwei/code/freelance/VideoStitcher/.worktrees/aside-video-production
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 错误，或仅有其他文件的已有错误

**Step 3: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/NodeCanvas.tsx
git commit -m "feat: 用 React Flow 重写 NodeCanvas，改为命令式 API（forwardRef + useImperativeHandle）"
```

---

## Task 5: 改造 index.tsx（useMemo → useEffect + ref 调用）

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/index.tsx`

改动范围：
1. 引入 `useRef<NodeCanvasHandle>`
2. 删除 `canvasNodes` / `canvasEdges` 两个 `useMemo`
3. 删除 `nodePositions` state 和 `nodesWithPositions` memo
4. 把节点/连线构建逻辑从 useMemo 挪进 `useEffect`，改为调用 `canvasRef.current.addNode()`
5. `<NodeCanvas>` 改为 `ref={canvasRef}`，不再传 nodes/edges props

**Step 1: 修改 index.tsx**

在 `DirectorMode` 组件顶部找到这几个 useMemo，整体替换为下方版本：

```tsx
// 删除这些：
// const canvasNodes = useMemo<CanvasNode[]>(() => { ... }, [...]);
// const canvasEdges = useMemo<CanvasEdge[]>(() => { ... }, [...]);
// const [nodePositions, setNodePositions] = useState<...>({});
// const nodesWithPositions = useMemo(...);

// 添加 ref
const canvasRef = useRef<NodeCanvasHandle>(null);
```

然后把原来的 `useMemo` 逻辑拆分为多个 `useEffect`，分别监听各数据源：

```tsx
// ── 常量（布局参数，与旧版保持一致） ──────────────────────────────
const NODE_WIDTH = 320;
const NODE_HEIGHT_CHARACTER = 380;
const PADDING_X = 380;
const PADDING_Y = 480;
const CANVAS_CENTER_X = 500;

// ── 剧本节点：有 selectedScreenplay 就添加 ──────────────────────
useEffect(() => {
  if (!selectedScreenplay || !canvasRef.current) return;
  canvasRef.current.addNode({
    id: 'node_script',
    type: 'script',
    x: CANVAS_CENTER_X - NODE_WIDTH / 2,
    y: 50,
    width: NODE_WIDTH,
    data: { text: selectedScreenplay.content },
  });
}, [selectedScreenplay]);

// ── 人物节点 + 连线 ──────────────────────────────────────────────
useEffect(() => {
  if (!characters?.length || !canvasRef.current) return;
  const canvas = canvasRef.current;
  const count = characters.length;
  const y = 50 + PADDING_Y;

  characters.forEach((char, index) => {
    let x: number;
    if (count === 1) x = CANVAS_CENTER_X - NODE_WIDTH / 2;
    else if (count === 2) x = CANVAS_CENTER_X - PADDING_X / 2 - NODE_WIDTH / 2 + index * PADDING_X;
    else if (count === 3) x = CANVAS_CENTER_X - PADDING_X - NODE_WIDTH / 2 + index * PADDING_X;
    else { const tw = (count - 1) * PADDING_X; x = CANVAS_CENTER_X - tw / 2 + index * PADDING_X; }

    const roleTypeLabel = char.role_type === 'protagonist' ? '主角' : char.role_type === 'antagonist' ? '反派' : '配角';

    canvas.addNode({
      id: `node_char_${char.id}`,
      type: 'character',
      x, y,
      width: NODE_WIDTH,
      data: {
        name: `人物设定-${roleTypeLabel}`,
        charName: char.name,
        description: char.description,
        role_type: char.role_type,
      },
    });

    canvas.addEdge({ id: `edge_script_${char.id}`, source: 'node_script', target: `node_char_${char.id}` });
  });

  // 共享形象节点
  const sharedImageUrl = characters.find(c => c.imageUrl)?.imageUrl;
  if (sharedImageUrl) {
    canvas.addNode({
      id: 'node_char_image_shared',
      type: 'character-image',
      x: CANVAS_CENTER_X - NODE_WIDTH / 2,
      y: y + NODE_HEIGHT_CHARACTER + 50,
      width: NODE_WIDTH,
      data: { name: characters.map(c => c.name).join(' / '), imageUrl: sharedImageUrl, characterId: 'shared' },
    });
    characters.forEach((char) => {
      canvas.addEdge({ id: `edge_char_${char.id}_image`, source: `node_char_${char.id}`, target: 'node_char_image_shared' });
    });
  }
}, [characters]);

// ── 人物形象图片更新（imageUrl 到来时更新已有节点） ──────────────
useEffect(() => {
  if (!characters || !canvasRef.current) return;
  const sharedImageUrl = characters.find(c => c.imageUrl)?.imageUrl;
  if (sharedImageUrl) {
    canvasRef.current.updateNode('node_char_image_shared', { imageUrl: sharedImageUrl });
  }
}, [characters]);

// ── 场景节点 + 连线 ──────────────────────────────────────────────
useEffect(() => {
  if (!sceneBreakdowns?.length || !canvasRef.current) return;
  const canvas = canvasRef.current;
  const sceneY = 50 + PADDING_Y * 2;
  const count = sceneBreakdowns.length;

  sceneBreakdowns.forEach((scene, index) => {
    let x: number;
    if (count === 1) x = CANVAS_CENTER_X - NODE_WIDTH / 2;
    else { const tw = (count - 1) * PADDING_X; x = CANVAS_CENTER_X - tw / 2 + index * PADDING_X; }

    canvas.addNode({
      id: `node_scene_${scene.scene_number}`,
      type: 'scene',
      x, y: sceneY,
      width: NODE_WIDTH,
      data: {
        name: scene.scene_name,
        description: scene.environment,
        environment: scene.environment,
        atmosphere: scene.atmosphere,
        props: scene.props,
        location_type: scene.location_type,
        time_of_day: scene.time_of_day,
        key_visual_elements: scene.key_visual_elements,
      },
    });

    canvas.addEdge({ id: `edge_script_scene_${scene.scene_number}`, source: 'node_script', target: `node_scene_${scene.scene_number}` });
  });
}, [sceneBreakdowns]);

// ── 分镜节点 + 连线 ──────────────────────────────────────────────
useEffect(() => {
  if (!storyboard?.scenes?.length || !canvasRef.current) return;
  const canvas = canvasRef.current;
  const y = 50 + PADDING_Y * 3;

  canvas.addNode({
    id: 'node_storyboard',
    type: 'storyboard',
    x: CANVAS_CENTER_X - 320,
    y,
    width: 640,
    data: {
      label: `分镜矩阵 (${storyboard.rows}×${storyboard.cols})`,
      imageUrl: storyboard.imageUrl,
      frames: storyboard.scenes,
      isHorizontal: true,
    },
  });

  // 连线：优先从场景节点来，否则从共享形象节点
  if (sceneBreakdowns?.length) {
    canvas.addEdge({ id: 'edge_scene_storyboard', source: `node_scene_${sceneBreakdowns[0].scene_number}`, target: 'node_storyboard' });
  } else if (characters?.some(c => c.imageUrl)) {
    canvas.addEdge({ id: 'edge_char_image_storyboard', source: 'node_char_image_shared', target: 'node_storyboard' });
  }
}, [storyboard, sceneBreakdowns, characters]);

// ── 视频节点 + 连线 ──────────────────────────────────────────────
useEffect(() => {
  if (!videos?.length || !canvasRef.current) return;
  const canvas = canvasRef.current;
  const videoY = 50 + PADDING_Y * 4;
  const count = videos.length;

  videos.forEach((video, index) => {
    let x: number;
    if (count === 1) x = CANVAS_CENTER_X - NODE_WIDTH / 2;
    else { const tw = (count - 1) * PADDING_X; x = CANVAS_CENTER_X - tw / 2 + index * PADDING_X; }

    canvas.addNode({
      id: `node_video_${video.id}`,
      type: 'video',
      x, y: videoY,
      width: NODE_WIDTH,
      data: {
        label: video.description ?? '生成的视频',
        url: video.url,
        localPath: video.localPath,
        duration: video.duration ? `${video.duration}s` : undefined,
      },
    });

    if (storyboard?.scenes?.length) {
      canvas.addEdge({ id: `edge_storyboard_video_${video.id}`, source: 'node_storyboard', target: `node_video_${video.id}` });
    }
  });
}, [videos, storyboard]);
```

**Step 2: 更新 JSX 中的 NodeCanvas 用法**

把原来受控的 `<NodeCanvas nodes=... edges=... />` 改为：

```tsx
// 删除原来的 nodesWithPositions.length === 0 判断（画布始终显示，空时显示点阵背景）
// 删除原来的 handleNodeUpdate、handleNodeRegenerate 定义（位置由 React Flow 内部管理，regenerate 通过 prop 传入）

// JSX 改为：
<NodeCanvas
  ref={canvasRef}
  onNodeRegenerate={handleNodeRegenerate}
  onPreview={setPreviewItem}
/>
```

**Step 3: 删除 handleNodeUpdate（位置由 React Flow 内部管理）**

```tsx
// 删除整个 handleNodeUpdate 函数
// 保留 handleNodeRegenerate（逻辑不变）
```

**Step 4: 确认 import 更新**

```tsx
// index.tsx 顶部添加：
import { useRef, useEffect, useState, useMemo } from 'react'; // 删除 useMemo 如果不再使用
import { NodeCanvas, type NodeCanvasHandle } from './NodeCanvas';
// 删除：CanvasNode, CanvasEdge 的 import（index.tsx 不再直接构造这些类型的变量）
```

**Step 5: 编译检查**

```bash
npx tsc --noEmit 2>&1 | head -40
```

**Step 6: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/index.tsx
git commit -m "refactor: DirectorMode 改用命令式 API 驱动画布（useEffect + canvasRef）"
```

---

## Task 6: 覆盖 React Flow 默认样式（深色主题）

React Flow 自带样式会覆盖我们的 Tailwind 主题，需要在导入后覆盖。

**Files:**
- Modify: `src/renderer/index.css`（追加，不改动已有内容）

**Step 1: 在 index.css 末尾追加**

```css
/* ====================================================================
 * React Flow 深色主题覆盖
 * ==================================================================== */

/* 隐藏 React Flow attribution logo */
.react-flow__attribution {
  display: none;
}

/* Controls 按钮深色主题 */
.react-flow__controls {
  background: rgba(30, 41, 59, 0.85) !important;
  border: 1px solid #334155 !important;
  border-radius: 12px !important;
  overflow: hidden;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}

.react-flow__controls-button {
  background: transparent !important;
  border: none !important;
  border-bottom: 1px solid #334155 !important;
  color: #94a3b8 !important;
  fill: #94a3b8 !important;
  width: 32px !important;
  height: 32px !important;
}

.react-flow__controls-button:hover {
  background: #1e293b !important;
  color: #f97316 !important;
  fill: #f97316 !important;
}

.react-flow__controls-button:last-child {
  border-bottom: none !important;
}

/* Handle（连接点）始终隐藏，hover 时显示 */
.react-flow__handle {
  opacity: 0;
  transition: opacity 0.2s;
}

.react-flow__node:hover .react-flow__handle {
  opacity: 1;
}

/* 选中框线（多选矩形）橙色 */
.react-flow__selection {
  border: 1px solid #f97316 !important;
  background: rgba(249, 115, 22, 0.05) !important;
}

/* 节点整体不加额外边框（用 Tailwind 控制） */
.react-flow__node-default,
.react-flow__node-input,
.react-flow__node-output {
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
```

**Step 2: Commit**

```bash
git add src/renderer/index.css
git commit -m "style: React Flow 深色主题 CSS 覆盖"
```

---

## Task 7: 运行验证

**Step 1: 启动应用**

```bash
npm run dev
```

**Step 2: 进入导演模式，触发工作流**

**Step 3: 视觉对比验证**

| 功能 | 期望效果 | 对应原版 |
|------|----------|----------|
| 画布背景 | 深色点阵，跟随缩放 | `radial-gradient(#1a1b2e 1px)` |
| 节点卡片 | 圆角卡片，深灰背景，灰色边框 | `rounded-2xl bg-slate-800 border-slate-700` |
| 选中节点 | 橙色光圈 + 轻微放大 | `ring-2 ring-orange-500 scale-[1.02]` |
| 连线 | 橙色流动虚线 | `stroke #f97316 strokeDasharray 8,8` |
| 拖拽平移 | 画布可拖动，无点击冲突 | React Flow 内置 |
| 点击图片/视频 | 弹出预览 | `data.onPreview` 回调 |
| 节点拖拽 | 节点可单独拖动 | React Flow 内置 |
| MiniMap | 右下角小地图，深色 | `<MiniMap>` |
| Controls | 左下角缩放按钮，深色 | `<Controls>` |

**Step 4: 如有样式异常**

常见问题：
```
节点宽度不对 → 检查 style: { width: cn.width } 传入 toRFNode
节点用的 w-80（320px）覆盖了 style → 节点内部不要写 w-80，宽度由父级 style 控制
连线不显示 → 检查 FlowEdge 类型是否在 EDGE_TYPES 中注册，source/target id 是否正确
Handle 不连接 → 检查节点上 Position.Top / Position.Bottom 的 Handle
动画不生效 → 确认 @keyframes flow 在 index.css 中已存在（Task 2 完成后）
```

**Step 5: Commit（修复后）**

```bash
git add -A
git commit -m "fix: 修复 React Flow 画布视觉/交互问题"
```

---

## 完成标准

- [ ] 画布背景：深色点阵，缩放时跟随（视觉无差异）
- [ ] 节点卡片：圆角、深色、选中橙色光圈（视觉无差异）
- [ ] 连线：橙色流动虚线贝塞尔曲线（视觉无差异）
- [ ] 拖拽节点、画布平移、滚轮缩放无冲突
- [ ] 点击图片/视频触发预览弹窗
- [ ] MiniMap + Controls 正常显示
- [ ] TypeScript 编译无新增错误
- [ ] `NodeCanvas.tsx` 代码量从 ~800 行降至 ~200 行
