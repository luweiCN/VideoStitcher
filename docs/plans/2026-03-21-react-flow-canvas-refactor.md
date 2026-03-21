# React Flow 画布重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 React Flow（@xyflow/react）替换 `NodeCanvas.tsx` 中 800 行手写的无限画布实现，消除拖拽/点击事件冲突，获得成熟的连线、缩放、选中等能力。

**Architecture:** 保留现有的节点数据格式（`CanvasNode` / `CanvasEdge`）和父组件（`DirectorMode/index.tsx`）不动；仅替换 `NodeCanvas.tsx` 内部实现，把 6 种节点渲染拆分为独立的 React Flow 自定义节点组件。`CanvasPanel.tsx` 不参与本次重构（它是旧的面板组件，已被 `NodeCanvas.tsx` 取代，不用动）。

**Tech Stack:** `@xyflow/react` v12（Electron renderer 进程，Vite + React 18），Tailwind CSS，Lucide 图标

---

## 文件结构

```
DirectorMode/
├── index.tsx                     # 不改（数据转换和连线逻辑保留）
├── NodeCanvas.tsx                # 重写：改为 React Flow 画布外壳
├── nodes/                        # 新建：6 种自定义节点组件
│   ├── ScriptNode.tsx            # 剧本节点
│   ├── CharacterNode.tsx         # 人物设定节点
│   ├── CharacterImageNode.tsx    # 人物形象图片节点
│   ├── SceneNode.tsx             # 场景设定节点
│   ├── StoryboardNode.tsx        # 分镜矩阵节点
│   └── VideoNode.tsx             # 视频输出节点
└── canvas.css                    # React Flow 样式覆盖（dot grid 等）
```

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`（通过 npm 安装）

**Step 1: 安装 @xyflow/react**

```bash
cd /Users/luwei/code/freelance/VideoStitcher/.worktrees/aside-video-production
npm install @xyflow/react
```

Expected: 安装成功，`package.json` 出现 `"@xyflow/react": "^12.x.x"`

**Step 2: 确认版本**

```bash
node -e "const p = require('./node_modules/@xyflow/react/package.json'); console.log(p.version)"
```

Expected: 输出版本号（12.x.x）

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: 安装 @xyflow/react 用于画布重构"
```

---

## Task 2: 创建 canvas.css（React Flow 全局样式）

**Files:**
- Create: `src/renderer/pages/ASide/components/DirectorMode/canvas.css`

**Step 1: 创建样式文件**

```css
/* 覆盖 React Flow 默认样式，适配深色主题 */

/* 重置背景 - 使用 Tailwind 管理 */
.react-flow {
  background: transparent;
}

/* 连线颜色 */
.react-flow__edge-path {
  stroke: #f97316;
  stroke-width: 2;
  stroke-dasharray: 8 8;
  animation: flow-dash 1s linear infinite;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: #fb923c;
  stroke-width: 3;
}

/* 连线动画（流动虚线） */
@keyframes flow-dash {
  from { stroke-dashoffset: 16; }
  to   { stroke-dashoffset: 0;  }
}

/* 控制条（右下角）深色主题 */
.react-flow__controls {
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid #334155;
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.react-flow__controls-button {
  background: transparent;
  border: none;
  border-bottom: 1px solid #334155;
  color: #94a3b8;
  fill: #94a3b8;
}

.react-flow__controls-button:hover {
  background: #1e293b;
  color: #f97316;
  fill: #f97316;
}

.react-flow__controls-button:last-child {
  border-bottom: none;
}

/* MiniMap 深色主题 */
.react-flow__minimap {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #334155;
  border-radius: 12px;
  overflow: hidden;
}

/* 节点选中光环（全局） */
.react-flow__node.selected > div {
  ring: 2px solid #f97316;
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.25);
}

/* 连接点（handle）隐藏，仅在 hover 时显示 */
.react-flow__handle {
  width: 8px;
  height: 8px;
  background: #f97316;
  border: 2px solid #0f172a;
  opacity: 0;
  transition: opacity 0.2s;
}

.react-flow__node:hover .react-flow__handle {
  opacity: 1;
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/canvas.css
git commit -m "style: 添加 React Flow 深色主题样式覆盖"
```

---

## Task 3: 创建 ScriptNode（剧本节点）

**Files:**
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/ScriptNode.tsx`

React Flow 自定义节点的规则：
- 组件接收 `NodeProps`（来自 `@xyflow/react`）
- `props.data` 就是 `CanvasNode.data`（我们自定义的字段）
- 必须在组件内渲染 `<Handle>` 以供连线使用
- 不需要管理拖拽、位置、选中状态 —— React Flow 自动处理

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

  const handleSave = () => {
    data.onUpdate?.({ text: editText });
    setIsEditing(false);
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-xl w-80 bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] border-orange-500'
        : 'border-slate-700'
    }`}>
      {/* 连接点 */}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500" />

      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} className="text-blue-500" />
          剧本
        </h4>
        {!isEditing && (
          <button
            onClick={() => { setIsEditing(true); setEditText(data.text ?? ''); }}
            className="text-slate-400 hover:text-orange-500 transition-colors p-1"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {/* 内容 */}
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
            <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-slate-500 hover:text-slate-300 px-3 py-1.5">
              <X size={14} />
            </button>
            <button onClick={handleSave} className="text-xs font-bold bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 shadow-md flex items-center gap-1">
              <Check size={14} />
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-[60px]">
          <ScreenplayCard content={data.text ?? ''} showFull />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/nodes/ScriptNode.tsx
git commit -m "feat: 添加 React Flow ScriptNode 剧本节点"
```

---

## Task 4: 创建 CharacterNode（人物设定节点）

**Files:**
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/CharacterNode.tsx`

**Step 1: 创建 CharacterNode.tsx**

```tsx
/**
 * 人物设定节点 - React Flow 自定义节点
 */
import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle, RefreshCcw, Pencil, Check, X } from 'lucide-react';

export function CharacterNode({ data, selected }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleSave = () => {
    data.onUpdate?.({ name: editName, description: editDesc });
    setIsEditing(false);
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-xl w-80 bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] border-orange-500'
        : 'border-slate-700'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-orange-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500" />

      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <UserCircle size={14} className="text-orange-500" />
          {data.name}
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => data.onRegenerate?.()}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
            title="重新生图"
            disabled={!!data.isGeneratingImage}
          >
            <RefreshCcw size={12} className={data.isGeneratingImage ? 'animate-spin text-orange-500' : ''} />
          </button>
          {!isEditing && (
            <button
              onClick={() => { setIsEditing(true); setEditName(data.name ?? ''); setEditDesc(data.description ?? ''); }}
              className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 内容 */}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="角色名称"
            className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="角色描述" rows={3}
            className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-white"><X size={14} /></button>
            <button onClick={handleSave} className="p-1 text-orange-500 hover:text-orange-400"><Check size={14} /></button>
          </div>
        </div>
      ) : (
        <>
          <h5 className="text-sm font-bold mb-2">{data.charName}</h5>
          <p className="text-xs text-slate-400 whitespace-pre-wrap">{data.description}</p>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/nodes/CharacterNode.tsx
git commit -m "feat: 添加 React Flow CharacterNode 人物设定节点"
```

---

## Task 5: 创建其余 4 个节点组件

**Files:**
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/CharacterImageNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/SceneNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/StoryboardNode.tsx`
- Create: `src/renderer/pages/ASide/components/DirectorMode/nodes/VideoNode.tsx`

**Step 1: 创建 CharacterImageNode.tsx**

```tsx
/**
 * 人物形象图片节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle } from 'lucide-react';

export function CharacterImageNode({ data, selected }: NodeProps) {
  return (
    <div className={`p-5 rounded-2xl border shadow-xl w-80 bg-slate-800 transition-all ${
      selected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-slate-700'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <UserCircle size={14} className="text-purple-500" />
          人物形象
        </h4>
      </div>

      <div className="w-full h-56 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => data.onPreview?.({ type: 'image', src: data.imageUrl, title: data.name })}
          />
        ) : (
          <UserCircle className="w-16 h-16 text-slate-700" />
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400 text-center">{data.name}</div>
    </div>
  );
}
```

**Step 2: 创建 SceneNode.tsx**

```tsx
/**
 * 场景设定节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Film } from 'lucide-react';

export function SceneNode({ data, selected }: NodeProps) {
  const locationLabel = data.location_type === 'indoor' ? '室内' : data.location_type === 'outdoor' ? '室外' : '';
  const timeLabel = data.time_of_day === 'day' ? '白天' : data.time_of_day === 'night' ? '夜晚' :
    data.time_of_day === 'dusk' ? '黄昏' : data.time_of_day === 'dawn' ? '清晨' : data.time_of_day ?? '';

  return (
    <div className={`p-5 rounded-2xl border shadow-xl w-80 bg-slate-800 transition-all ${
      selected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-slate-700'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-green-500" />

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
        <h5 className="text-sm font-bold text-green-400">{data.name}</h5>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{data.environment}</p>
        {data.atmosphere && <p className="text-xs text-slate-500 italic">氛围：{data.atmosphere}</p>}
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

**Step 3: 创建 StoryboardNode.tsx**

```tsx
/**
 * 分镜矩阵节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Film } from 'lucide-react';

export function StoryboardNode({ data, selected }: NodeProps) {
  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-slate-700'
    }`} style={{ width: 640 }}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Film size={14} className="text-blue-500" />
          {data.label ?? '分镜矩阵'}
        </h4>
      </div>

      <div className="w-full rounded-xl overflow-hidden bg-slate-900">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt="分镜图"
            className="w-full h-auto object-contain cursor-zoom-in"
            style={{ maxHeight: 400 }}
            onClick={() => data.onPreview?.({ type: 'image', src: data.imageUrl, title: data.label ?? '分镜矩阵' })}
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

**Step 4: 创建 VideoNode.tsx**

```tsx
/**
 * 视频输出节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

export function VideoNode({ data, selected }: NodeProps) {
  const src = data.localPath ? `file://${data.localPath}` : data.url;

  const handleClick = () => {
    if (src) data.onPreview?.({ type: 'video', src, title: data.label });
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-xl w-80 bg-slate-800 transition-all ${
      selected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-slate-700'
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-red-500" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Play size={14} className="text-red-500" />
          视频输出
        </h4>
      </div>

      <div
        className="w-full h-40 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center relative group cursor-pointer"
        onClick={handleClick}
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
        {data.label} {data.duration ? `(${data.duration})` : ''}
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/nodes/
git commit -m "feat: 添加 React Flow 四种节点组件（CharacterImage/Scene/Storyboard/Video）"
```

---

## Task 6: 重写 NodeCanvas.tsx 使用 React Flow

这是核心替换步骤。替换后 `NodeCanvas.tsx` 的职责变为：
1. 将 `CanvasNode[]` 转为 React Flow 的 `Node[]` 格式（把 `onUpdate` / `onRegenerate` / `onPreview` 注入进 `data`）
2. 将 `CanvasEdge[]` 转为 React Flow 的 `Edge[]` 格式
3. 渲染 `<ReactFlow>` 组件

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/NodeCanvas.tsx`（完整重写）

**注意事项：**
- React Flow v12 的导入路径是 `@xyflow/react`（不是旧版 `reactflow`）
- 必须在组件外导入 React Flow 的 CSS：`import '@xyflow/react/dist/style.css'`
- 自定义节点类型必须在组件外定义为常量（否则每次渲染会重新创建，导致节点闪烁）
- `onNodeUpdate` 回调需要透传给 data，但 React Flow 不允许直接从节点内修改父级 state，应通过 `useReactFlow()` 的 `setNodes` 或在父组件使用 `onNodesChange` 处理

**Step 1: 重写 NodeCanvas.tsx**

```tsx
/**
 * 节点画布组件 - 导演模式可视化画板
 * 使用 React Flow（@xyflow/react）替代手写无限画布实现
 */

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './canvas.css';

import { ScriptNode } from './nodes/ScriptNode';
import { CharacterNode } from './nodes/CharacterNode';
import { CharacterImageNode } from './nodes/CharacterImageNode';
import { SceneNode } from './nodes/SceneNode';
import { StoryboardNode } from './nodes/StoryboardNode';
import { VideoNode } from './nodes/VideoNode';

// 类型定义（与旧版保持兼容，供父组件使用）
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

interface NodeCanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodeUpdate: (nodeId: string, updates: Partial<CanvasNode['data']> | { x: number; y: number }) => void;
  onNodeRegenerate: (nodeId: string) => void;
  selectedNodeIds: string[];
  onSelectionChange: (nodeIds: string[]) => void;
  onPreview?: (item: { type: 'image' | 'video'; src: string; title?: string }) => void;
}

// 自定义节点类型映射 —— 必须在组件外定义，避免每次渲染重建（导致闪烁）
const NODE_TYPES = {
  script: ScriptNode,
  character: CharacterNode,
  'character-image': CharacterImageNode,
  scene: SceneNode,
  storyboard: StoryboardNode,
  video: VideoNode,
} as const;

export function NodeCanvas({
  nodes: canvasNodes,
  edges: canvasEdges,
  onNodeUpdate,
  onNodeRegenerate,
  selectedNodeIds,
  onSelectionChange,
  onPreview,
}: NodeCanvasProps) {
  // 将 CanvasNode[] 转为 React Flow Node[]
  // 把回调函数注入进 data，让节点内部可以调用
  const flowNodes = useMemo<Node[]>(() => {
    return canvasNodes.map((cn) => ({
      id: cn.id,
      type: cn.type,
      position: { x: cn.x, y: cn.y },
      data: {
        ...cn.data,
        onUpdate: (updates: Partial<CanvasNode['data']>) => onNodeUpdate(cn.id, updates),
        onRegenerate: () => onNodeRegenerate(cn.id),
        onPreview,
      },
      selected: selectedNodeIds.includes(cn.id),
      style: { width: cn.width },
    }));
  }, [canvasNodes, onNodeUpdate, onNodeRegenerate, onPreview, selectedNodeIds]);

  // 将 CanvasEdge[] 转为 React Flow Edge[]
  const flowEdges = useMemo<Edge[]>(() => {
    return canvasEdges.map((ce) => ({
      id: ce.id,
      source: ce.source,
      target: ce.target,
      animated: true,
      style: { stroke: '#f97316', strokeWidth: 2, strokeDasharray: '8 8' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' },
    }));
  }, [canvasEdges]);

  const [rfNodes, , onNodesChange] = useNodesState(flowNodes);
  const [rfEdges, , onEdgesChange] = useEdgesState(flowEdges);

  // 节点拖拽结束后同步位置到父组件
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    onNodeUpdate(node.id, { x: node.position.x, y: node.position.y });
  }, [onNodeUpdate]);

  // 选中变化
  const handleSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    onSelectionChange(nodes.map((n) => n.id));
  }, [onSelectionChange]);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        {/* 点阵背景 */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1e293b"
        />
        {/* 缩放/居中控件 */}
        <Controls showInteractive={false} />
        {/* 小地图 */}
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'script': return '#3b82f6';
              case 'character': return '#f97316';
              case 'character-image': return '#a855f7';
              case 'scene': return '#22c55e';
              case 'storyboard': return '#3b82f6';
              case 'video': return '#ef4444';
              default: return '#64748b';
            }
          }}
          maskColor="rgba(15, 23, 42, 0.7)"
          style={{ background: 'rgba(15, 23, 42, 0.9)' }}
        />
      </ReactFlow>
    </div>
  );
}
```

**Step 2: 验证 TypeScript 编译**

```bash
cd /Users/luwei/code/freelance/VideoStitcher/.worktrees/aside-video-production
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 错误，或仅有非本次改动文件的错误

**Step 3: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/NodeCanvas.tsx
git commit -m "feat: 用 React Flow 重写 NodeCanvas 画布（替换手写画布实现）"
```

---

## Task 7: 修复 useNodesState 同步问题

**问题分析：** `useNodesState` 初始化后不会随 `flowNodes` prop 变化自动更新（内部有自己的状态）。需要使用 `useEffect` 在 `flowNodes` 变化时重置节点。

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/NodeCanvas.tsx`

**Step 1: 添加 useEffect 同步**

在 `NodeCanvas` 组件内，找到 `useNodesState` 和 `useEdgesState` 的调用，改为：

```tsx
import { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeChange,
  MarkerType,
} from '@xyflow/react';

// 在 NodeCanvas 函数内：
const [rfNodes, setRfNodes, onNodesChange] = useNodesState(flowNodes);
const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(flowEdges);

// 当父组件数据变化时，同步更新 React Flow 内部状态
useEffect(() => {
  setRfNodes(flowNodes);
}, [flowNodes, setRfNodes]);

useEffect(() => {
  setRfEdges(flowEdges);
}, [flowEdges, setRfEdges]);
```

**Step 2: 编译验证**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/NodeCanvas.tsx
git commit -m "fix: 同步 React Flow 内部节点状态（useEffect + setRfNodes）"
```

---

## Task 8: 验证运行效果

**Step 1: 启动开发服务器**

```bash
npm run dev
```

**Step 2: 打开应用，进入导演模式**

在应用中：
1. 创建或选择一个剧本
2. 进入导演模式
3. 触发工作流执行

**Step 3: 验证以下交互**

- [ ] 画布可以平移（拖拽空白区域）
- [ ] 画布可以缩放（滚轮）
- [ ] 节点可以拖拽移动（不影响点击）
- [ ] 点击图片/视频可以触发预览弹窗
- [ ] 连线正确显示（从 source 到 target）
- [ ] 小地图正常显示
- [ ] Controls 控件可用（居中/缩放）
- [ ] 无控制台 TypeScript/运行时错误

**Step 4: 如有问题，检查以下常见错误**

```
React Flow: Node type not found: xxx
→ 检查 NODE_TYPES 中是否包含该类型

节点不显示
→ 检查 flowNodes 的 position 格式（应为 { x, y }，不是 x/y 字段）

点击没反应
→ 确认节点组件内没有阻止事件冒泡到 React Flow
→ 确认 onPreview 已通过 data 注入

样式异常（节点宽度不对）
→ 检查 style: { width: cn.width } 是否正确传入
```

**Step 5: Commit（修复后）**

```bash
git add -A
git commit -m "fix: 修复 React Flow 画布运行时问题"
```

---

## 完成标准

- [ ] 所有 6 种节点类型正常渲染
- [ ] 拖拽、缩放、平移交互流畅，无点击/拖拽冲突
- [ ] 图片和视频点击触发预览弹窗
- [ ] 节点拖拽后位置正确同步到父组件
- [ ] TypeScript 编译无新增错误
- [ ] `NodeCanvas.tsx` 代码量从 ~800 行降至 ~120 行
