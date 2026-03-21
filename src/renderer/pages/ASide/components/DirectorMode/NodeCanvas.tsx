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

// ==================== 自定义类型映射（组件外定义，避免重渲染导致节点闪烁） ====================

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

// ==================== 内部 Canvas（需要在 ReactFlowProvider 内部才能用 useReactFlow） ====================

const NodeCanvasInner = forwardRef<NodeCanvasHandle, NodeCanvasProps>(
  function NodeCanvasInner({ onNodeRegenerate, onPreview }, ref) {
    const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
    const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const { fitView } = useReactFlow();

    // 用 ref 保存回调，避免 useImperativeHandle 因回调变化而重建
    const onNodeRegenerateRef = useRef(onNodeRegenerate);
    onNodeRegenerateRef.current = onNodeRegenerate;
    const onPreviewRef = useRef(onPreview);
    onPreviewRef.current = onPreview;

    /** 将 CanvasNode 转为 React Flow Node 格式，注入交互回调 */
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
    const toRFEdge = useCallback((ce: CanvasEdge, nodes: Node[]): Edge => {
      // 从当前节点列表中找到 source 节点类型，决定连线颜色
      const sourceNode = nodes.find((n) => n.id === ce.source);
      const sourceType = sourceNode?.type as NodeType | undefined;
      return {
        id: ce.id,
        source: ce.source,
        target: ce.target,
        type: 'flowEdge',
        data: { sourceType },
      };
    }, []);

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
          // 已存在则跳过（幂等）
          if (prev.some((e) => e.id === ce.id)) return prev;
          return [...prev, toRFEdge(ce, [])];
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

    const handleNodeDragStop = useCallback((_evt: React.MouseEvent, node: Node) => {
      console.log('[NodeCanvas] 节点拖拽结束:', node.id, node.position);
    }, []);

    return (
      <div className="flex-1 h-full bg-slate-950">
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
          nodesConnectable={false}
          selectionOnDrag={false}
          style={{ background: 'transparent' }}
        >
          {/* 点阵背景：与应用整体背景 slate-950(#020617) 统一，点色 #1e2235 形成柔和点阵纹理 */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color="#1e2235"
          />
          {/* 缩放控制条（左下角） */}
          <Controls
            showInteractive={false}
            className="!bg-slate-800/80 !border-slate-700 !rounded-xl !backdrop-blur-md"
          />
          {/* 小地图（右下角） */}
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
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid #334155',
              borderRadius: 12,
            }}
          />
        </ReactFlow>
      </div>
    );
  }
);

// ==================== 对外组件（包裹 Provider，使内部可用 useReactFlow） ====================

/**
 * NodeCanvas - 导演模式无限画布
 *
 * 命令式 API 示例：
 *   const ref = useRef<NodeCanvasHandle>(null);
 *   ref.current?.addNode({ id, type, x, y, width, data });
 *   ref.current?.addEdge({ id, source, target });
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
