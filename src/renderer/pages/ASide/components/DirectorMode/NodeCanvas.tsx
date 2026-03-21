/**
 * 节点画布组件 - 导演模式可视化画板
 * 无限画布 + 节点拖拽 + SVG 连线
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { FileText, UserCircle, Film, Play, RefreshCcw, Pencil, Check, X, MousePointer2, Hand } from 'lucide-react';
import { ScreenplayCard } from '../ScreenplayGenerator/ScreenplayCard';

// 节点类型
export type NodeType = 'script' | 'character' | 'character-image' | 'scene' | 'storyboard' | 'video';

// 节点数据
export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  data: {
    // Script
    text?: string;

    // Character
    name?: string;
    charName?: string; // 角色真实名字
    description?: string;
    role_type?: string;
    imageUrl?: string;
    isGeneratingImage?: boolean;

    // Character Image
    characterId?: string;

    // Scene
    location_type?: string;
    time_of_day?: string;
    environment?: string;
    props?: string[];
    atmosphere?: string;
    key_visual_elements?: string[];

    // Storyboard
    label?: string;
    frames?: any[]; // 分镜帧数据
    isHorizontal?: boolean;

    // Video
    url?: string;
    localPath?: string;   // 本地缓存路径（file:// 播放）
    duration?: string;
    isFinal?: boolean;
  };
}

// 连线数据
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

interface NodeCanvasProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodeUpdate: (nodeId: string, updates: Partial<CanvasNode['data'] | { x: number; y: number }>) => void;
  onNodeRegenerate: (nodeId: string) => void;
  selectedNodeIds: string[];
  onSelectionChange: (nodeIds: string[]) => void;
  /** 点击图片/视频触发预览弹窗 */
  onPreview?: (item: { type: 'image' | 'video'; src: string; title?: string }) => void;
}

export function NodeCanvas({
  nodes,
  edges,
  onNodeUpdate,
  onNodeRegenerate,
  selectedNodeIds,
  onSelectionChange,
  onPreview,
}: NodeCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  // 模式状态：select = 选择/编辑节点，pan = 拖动画布
  const [mode, setMode] = useState<'select' | 'pan'>('select');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [modeBeforeSpace, setModeBeforeSpace] = useState<'select' | 'pan' | null>(null);

  // 调试:追踪 props 接收
  useEffect(() => {
    console.log('[NodeCanvas] 接收到的节点数据:', {
      nodesCount: nodes?.length || 0,
      edgesCount: edges?.length || 0,
      nodes: nodes,
      edges: edges,
    });
  }, [nodes, edges]);

  // 空格键临时切换模式（类似 PS）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 空格键临时切换到拖动模式
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
        setModeBeforeSpace(mode); // 保存当前模式
      }
      // V 键切换到选择模式
      if (e.code === 'KeyV') {
        setMode('select');
      }
      // H 键切换到拖动模式
      if (e.code === 'KeyH') {
        setMode('pan');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        // 恢复之前的模式
        if (modeBeforeSpace !== null) {
          setMode(modeBeforeSpace);
          setModeBeforeSpace(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed, mode, modeBeforeSpace]);

  // 当前实际模式（考虑空格键临时切换）
  const effectiveMode = isSpacePressed ? 'pan' : mode;

  // 调试:追踪模式变化
  useEffect(() => {
    console.log('[NodeCanvas] 模式变化:', { mode, isSpacePressed, effectiveMode });
  }, [mode, isSpacePressed, effectiveMode]);

  // 画布变换状态
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  // 用 ref 追踪是否真正移动（避免 click 被误判为 drag）
  const dragMovedRef = useRef(false);
  const DRAG_THRESHOLD = 5; // 像素，超过此值才认定为拖拽

  // 编辑状态
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // 画布缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    let newScale = transform.scale * (1 + delta);
    newScale = Math.max(0.2, Math.min(newScale, 3));

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const ratio = newScale / transform.scale;
    const newX = mouseX - (mouseX - transform.x) * ratio;
    const newY = mouseY - (mouseY - transform.y) * ratio;

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [transform]);

  // 画布拖拽开始
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // 检查点击的是否是控制按钮
    const targetElement = e.target as HTMLElement;
    const isControlButton = targetElement.closest('button');

    console.log('[NodeCanvas] 画布点击', {
      target: e.target,
      targetClassList: targetElement?.classList?.value,
      isControlButton: isControlButton ? '是' : '否',
      currentTarget: e.currentTarget,
      effectiveMode,
    });

    // 如果点击的是控制按钮，不触发画布拖动
    if (isControlButton) {
      console.log('[NodeCanvas] 点击了控制按钮，不触发画布拖动');
      return;
    }

    // 检查点击的是否是节点或节点内的元素
    const clickedNode = targetElement.closest('.canvas-node');

    // 如果是选择模式且点击了节点，不触发画布拖动
    if (effectiveMode === 'select' && clickedNode) {
      console.log('[NodeCanvas] 选择模式 - 点击了节点，不触发画布拖动');
      return;
    }

    // 拖动模式或点击空白区域，触发画布拖动
    if (effectiveMode === 'pan' || e.target === e.currentTarget) {
      console.log('[NodeCanvas] ✅ 触发画布拖动');
      setIsDraggingCanvas(true);
      setDragStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      e.currentTarget.setPointerCapture(e.pointerId);
      onSelectionChange([]);
    }
  }, [transform, onSelectionChange, effectiveMode]);

  // 画布拖拽移动（优化流畅度）
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDraggingCanvas) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStartPos.x,
        y: e.clientY - dragStartPos.y,
      }));
    } else if (dragNodeId) {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;

      // 未超阈值前不激活拖拽，保留 onClick 正常触发
      if (!dragMovedRef.current && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return;
      }

      // 超阈值后确认为拖拽
      if (!dragMovedRef.current) {
        dragMovedRef.current = true;
        setIsDraggingNode(true);
        setIsDraggingCanvas(false);
      }

      const node = nodes.find(n => n.id === dragNodeId);
      if (node) {
        const scaledDx = dx / transform.scale;
        const scaledDy = dy / transform.scale;
        onNodeUpdate(dragNodeId, { x: node.x + scaledDx, y: node.y + scaledDy });
        setDragStartPos({ x: e.clientX, y: e.clientY });
      }
    }
  }, [isDraggingCanvas, dragNodeId, dragStartPos, transform, nodes, onNodeUpdate]);

  // 拖拽结束
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDraggingCanvas(false);
    setIsDraggingNode(false);
    setDragNodeId(null);
    dragMovedRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }, []);

  // 节点拖拽开始
  const handleNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    // 拖动模式下不触发节点拖动（但允许切换模式）
    if (effectiveMode === 'pan') {
      return;
    }

    e.stopPropagation();
    // 注意：不调用 e.preventDefault()，保留 onClick 冒泡，由 dragMovedRef 决定是否拦截

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // 记录按下起始位置，等 pointermove 超过阈值后才真正激活拖拽
    dragMovedRef.current = false;
    setDragNodeId(nodeId);
    setDragStartPos({
      x: e.clientX,
      y: e.clientY,
    });

    if (!selectedNodeIds.includes(nodeId)) {
      onSelectionChange([nodeId]);
    }

    e.currentTarget.setPointerCapture(e.pointerId);
  }, [nodes, effectiveMode, selectedNodeIds, onSelectionChange]);

  // 获取节点高度
  const getNodeHeight = (type: NodeType) => {
    switch (type) {
      case 'script': return 140;
      case 'character': return 380;
      case 'character-image': return 320;
      case 'scene': return 260;
      case 'storyboard': return 200;
      case 'video': return 280;
      default: return 120;
    }
  };

  // 渲染连线
  const renderEdges = () => {
    return edges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);

      console.log('[NodeCanvas] 渲染连线:', {
        edgeId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        sourceNodeFound: !!sourceNode,
        targetNodeFound: !!targetNode,
        sourceNodeData: sourceNode?.data,
        targetNodeData: targetNode?.data,
      });

      if (!sourceNode || !targetNode) return null;

      const startX = sourceNode.x + sourceNode.width / 2;
      const startY = sourceNode.y + getNodeHeight(sourceNode.type) / 2;  // 从节点中心出发
      const endX = targetNode.x + targetNode.width / 2;
      const endY = targetNode.y + getNodeHeight(targetNode.type) / 2;    // 到节点中心

      const yOffset = Math.max(60, Math.abs(endY - startY) / 2);
      const path = `M ${startX} ${startY} C ${startX} ${startY + yOffset}, ${endX} ${endY - yOffset}, ${endX} ${endY}`;

      const isSelected = selectedNodeIds.includes(sourceNode.id) || selectedNodeIds.includes(targetNode.id);

      return (
        <path
          key={edge.id}
          d={path}
          stroke={isSelected ? '#f97316' : sourceNode.type === 'storyboard' || sourceNode.type === 'video' ? '#3b82f6' : '#f97316'}
          strokeWidth={isSelected ? 4 : 3}
          fill="none"
          strokeDasharray="8,8"
          className={`${isSelected ? 'opacity-100' : 'opacity-60'}`}
          style={{
            animation: 'flow 1s linear infinite',
          }}
        />
      );
    });
  };

  // 渲染节点
  const renderNode = (node: CanvasNode) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isEditing = editingNodeId === node.id;
    const isThisDragging = isDraggingNode && dragNodeId === node.id;

    return (
      <div
        key={node.id}
        data-id={node.id}
        className={`canvas-node absolute p-5 rounded-2xl border shadow-xl ${
          effectiveMode === 'pan' ? 'cursor-grab' : 'cursor-grab active:cursor-grabbing'
        } ${
          isThisDragging ? '' : 'transition-all' // 拖动时移除过渡效果，提升流畅度
        } ${
          isSelected
            ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500 bg-slate-800'
            : 'bg-slate-800 border-slate-700 hover:shadow-orange-500/10'
        }`}
        style={{
          transform: `translate(${node.x}px, ${node.y}px)`,
          width: `${node.width}px`,
          pointerEvents: 'auto', // 覆盖父容器的 pointer-events-none
        }}
        onPointerDown={(e) => handleNodePointerDown(e, node.id)}
      >
        {/* Script 节点 */}
        {node.type === 'script' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-blue-500" />
                剧本
              </h4>
              {!isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingNodeId(node.id);
                    setEditText(node.data.text || '');
                  }}
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNodeId(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-300 px-3 py-1.5"
                  >
                    取消
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeUpdate(node.id, { text: editText });
                      setEditingNodeId(null);
                    }}
                    className="text-xs font-bold bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 shadow-md"
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[60px]">
                <ScreenplayCard content={node.data.text || ''} showFull />
              </div>
            )}
          </>
        )}

        {/* Character 节点 */}
        {node.type === 'character' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <UserCircle size={14} className="text-orange-500" />
                {node.data.name}
              </h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeRegenerate(node.id);
                  }}
                  className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
                  title="重新生图"
                  disabled={node.data.isGeneratingImage}
                >
                  <RefreshCcw
                    size={12}
                    className={node.data.isGeneratingImage ? 'animate-spin text-orange-500' : ''}
                  />
                </button>
                {!isEditing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNodeId(node.id);
                      setEditName(node.data.name || '');
                      setEditDesc(node.data.description || '');
                    }}
                    className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
                    title="编辑人物"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* 人物信息 */}
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="角色名称"
                  className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none"
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="角色描述"
                  className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none resize-none"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNodeId(null);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeUpdate(node.id, { name: editName, description: editDesc });
                      setEditingNodeId(null);
                    }}
                    className="p-1 text-orange-500 hover:text-orange-400"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h5 className="text-sm font-bold mb-2">{node.data.charName}</h5>
                <p className="text-xs text-slate-400 whitespace-pre-wrap">{node.data.description}</p>
              </>
            )}
          </>
        )}

        {/* Character Image 节点 - 人物形象图片 */}
        {node.type === 'character-image' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <UserCircle size={14} className="text-purple-500" />
                人物形象
              </h4>
            </div>
            <div className="w-full h-56 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
              {node.data.imageUrl ? (
                <img
                  src={node.data.imageUrl}
                  alt={node.data.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => onPreview?.({ type: 'image', src: node.data.imageUrl!, title: node.data.name })}
                />
              ) : (
                <UserCircle className="w-16 h-16 text-slate-700" />
              )}
            </div>
            <div className="mt-2 text-xs text-slate-400 text-center">
              {node.data.name}
            </div>
          </>
        )}

        {/* Scene 节点 - 场景设定 */}
        {node.type === 'scene' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Film size={14} className="text-green-500" />
                场景设定
              </h4>
              <span className="text-xs text-slate-600">
                {node.data.location_type === 'indoor' ? '室内' : node.data.location_type === 'outdoor' ? '室外' : ''}
                {node.data.time_of_day ? ` · ${
                  node.data.time_of_day === 'day' ? '白天' :
                  node.data.time_of_day === 'night' ? '夜晚' :
                  node.data.time_of_day === 'dusk' ? '黄昏' :
                  node.data.time_of_day === 'dawn' ? '清晨' : node.data.time_of_day
                }` : ''}
              </span>
            </div>
            <div className="space-y-2">
              <h5 className="text-sm font-bold text-green-400">{node.data.name}</h5>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{node.data.environment}</p>
              {node.data.atmosphere && (
                <p className="text-xs text-slate-500 italic">氛围：{node.data.atmosphere}</p>
              )}
              {node.data.props && node.data.props.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {node.data.props.slice(0, 4).map((prop, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-xs rounded bg-green-900/30 text-green-400 border border-green-800/40">
                      {prop}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Storyboard 节点 */}
        {node.type === 'storyboard' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Film size={14} className="text-blue-500" />
                {node.data.label || '分镜矩阵'}
              </h4>
            </div>
            <div className="w-full rounded-xl overflow-hidden bg-slate-900">
              {node.data.imageUrl ? (
                <img
                  src={node.data.imageUrl}
                  alt="分镜图"
                  className="w-full h-auto object-contain cursor-zoom-in"
                  style={{ maxHeight: '400px' }}
                  onClick={() => onPreview?.({ type: 'image', src: node.data.imageUrl!, title: node.data.label || '分镜矩阵' })}
                />
              ) : (
                <div className="h-32 flex items-center justify-center">
                  <Film className="w-12 h-12 text-slate-700" />
                </div>
              )}
            </div>
          </>
        )}

        {/* Video 节点 */}
        {node.type === 'video' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Play size={14} className="text-red-500" />
                视频输出
              </h4>
            </div>
            <div
              className="w-full h-40 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center relative group cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const src = node.data.localPath ? `file://${node.data.localPath}` : node.data.url;
                if (src) onPreview?.({ type: 'video', src, title: node.data.label });
              }}
            >
              {(node.data.localPath || node.data.url) ? (
                <>
                  {/* 用 video 元素静默预览第一帧，不带 controls */}
                  <video
                    src={node.data.localPath ? `file://${node.data.localPath}` : node.data.url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                  />
                  {/* 播放图标遮罩 */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-10 h-10 text-white drop-shadow-lg" fill="white" />
                  </div>
                </>
              ) : (
                <Play className="w-12 h-12 text-slate-700" />
              )}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {node.data.label} ({node.data.duration})
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      ref={canvasRef}
      className="flex-1 h-full relative overflow-hidden select-none"
      style={{
        touchAction: 'none',
        backgroundImage: 'radial-gradient(circle, #1a1b2e 1px, transparent 1px)',
        backgroundSize: (24 * transform.scale) + 'px ' + (24 * transform.scale) + 'px',
        backgroundPosition: transform.x + 'px ' + transform.y + 'px',
      } as React.CSSProperties}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="absolute top-0 left-0 w-full h-full origin-top-left pointer-events-none"
        style={{
          transform: 'translate(' + transform.x + 'px, ' + transform.y + 'px) scale(' + transform.scale + ')',
        }}
      >
        {/* SVG 连线层 */}
        <svg className="absolute inset-0 pointer-events-none z-0" style={{ overflow: 'visible' }}>
          {renderEdges()}
        </svg>

        {/* 节点层 */}
        {nodes.map(renderNode)}
      </div>

      {/* 控制台 - 右上角 */}
      <div className="absolute top-6 right-6 flex items-center gap-2 z-20">
        {/* 模式切换 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            console.log('[NodeCanvas] 按钮点击, 当前模式:', mode);
            if (mode === 'pan') {
              console.log('[NodeCanvas] 切换到选择模式');
              setMode('select');
            } else {
              console.log('[NodeCanvas] 切换到拖动模式');
              setMode('pan');
            }
          }}
          className="p-2 rounded-full border backdrop-blur-md transition-all bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-300 focus:outline-none"
          title={effectiveMode === 'select' ? '选择模式' : '拖动模式'}
        >
          {effectiveMode === 'select' ? <MousePointer2 size={16} /> : <Hand size={16} />}
        </button>

        <div className="w-px h-6 bg-slate-700" />

        {/* 缩放控制台 */}
        <div className="px-4 py-2 rounded-full border text-xs font-bold backdrop-blur-md cursor-default bg-slate-800/80 border-slate-700 text-slate-300">
          缩放: {Math.round(transform.scale * 100)}%
        </div>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="p-2 rounded-full border backdrop-blur-md bg-slate-800/80 border-slate-700 hover:bg-slate-700 text-slate-300"
          title="重置视图"
        >
          <FileText size={16} />
        </button>
      </div>
    </div>
  );
}
