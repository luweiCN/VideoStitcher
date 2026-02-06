import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Position, LayerId, MaterialPositions, LayerConfig } from '../types';
import VideoBox, { VideoBoxProps } from './VideoBox';

/**
 * 素材配置
 */
export interface MaterialConfig {
  id: LayerId;
  label: string;
  position: Position;
  colorClass: string;
  bgClass: string;
  visible: boolean;
  locked: boolean;
  thumbnail?: string;
}

/**
 * 交互式视频编辑器属性
 */
export interface VideoEditorProps {
  mode: 'horizontal' | 'vertical';
  canvasWidth: number;
  canvasHeight: number;
  // 素材位置映射
  positions: MaterialPositions;
  onPositionChange: (id: LayerId, position: Position) => void;
  // 激活图层
  activeLayer: LayerId;
  onActiveLayerChange: (id: LayerId) => void;
  // 图层配置
  layerConfigs: LayerConfig[];
  // 素材路径（用于显示预览）
  materials?: {
    aVideo?: string;
    bVideo?: string;
    bgImage?: string;
    coverImage?: string;
  };
  // 画布缩放
  canvasZoom: number;
  onCanvasZoomChange: (zoom: number) => void;
}

const SNAP_THRESHOLD = 12; // 吸附阈值（像素）

/**
 * 交互式视频编辑器组件
 *
 * 功能：
 * - 显示画布和背景图
 * - 支持拖拽移动视频框
 * - 支持缩放视频框大小
 * - 智能吸附到中心/边缘
 * - 显示辅助对齐线
 */
const VideoEditor: React.FC<VideoEditorProps> = ({
  mode,
  canvasWidth,
  canvasHeight,
  positions,
  onPositionChange,
  onActiveLayerChange,
  activeLayer,
  layerConfigs,
  materials,
  canvasZoom,
  onCanvasZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0, scale: 1 });
  const [showVGuide, setShowVGuide] = useState(false);
  const [showHGuide, setShowHGuide] = useState(false);

  // 记录每个图层的原始宽高比（用于背景图和封面图）
  const originalAspectRatios = useRef<Partial<Record<LayerId, number>>>({});

  // 当素材位置改变时，如果是背景图或封面图，记录其原始宽高比
  useEffect(() => {
    ['bgImage', 'coverImage'].forEach(layerId => {
      const pos = positions[layerId];
      if (pos && !originalAspectRatios.current[layerId]) {
        // 只在第一次设置时记录
        originalAspectRatios.current[layerId] = pos.width / pos.height;
      }
    });
  }, [positions]);

  // 当前正在操作的图层配置
  const activeLayerConfig = layerConfigs.find((l) => l.id === activeLayer) || layerConfigs[0];
  const activePosition = positions[activeLayer];

  // 更新容器尺寸和缩放比例
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current?.parentElement) return;
      // 获取父容器的宽度
      const parentWidth = containerRef.current.parentElement.getBoundingClientRect().width;
      // 应用用户设置的缩放百分比到容器宽度
      const scaledWidth = parentWidth * (canvasZoom / 100);
      // 基于缩放后的容器宽度计算内部元素的缩放比例
      const finalScale = scaledWidth / canvasWidth;

      setContainerSize({ width: scaledWidth, height: (scaledWidth / canvasWidth) * canvasHeight, scale: finalScale });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [canvasWidth, canvasHeight, canvasZoom]);

  // 键盘事件处理 - 方向键调整位置
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 只在激活的图层未锁定时响应
      if (!activeLayerConfig || activeLayerConfig.locked) return;

      // 只响应方向键
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      e.preventDefault();

      const step = e.shiftKey ? 10 : 1; // 按住 Shift 键每次移动 10px
      let newX = activePosition.x;
      let newY = activePosition.y;

      switch (e.key) {
        case 'ArrowUp':
          newY -= step;
          break;
        case 'ArrowDown':
          newY += step;
          break;
        case 'ArrowLeft':
          newX -= step;
          break;
        case 'ArrowRight':
          newX += step;
          break;
      }

      // 边界限制
      newX = Math.max(0, Math.min(newX, canvasWidth - activePosition.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - activePosition.height));

      onPositionChange(activeLayer, {
        ...activePosition,
        x: newX,
        y: newY,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLayer, activeLayerConfig, activePosition, canvasWidth, canvasHeight, onPositionChange]);

  // 计算宽高比
  const getAspectRatio = useCallback((): number => {
    if (mode === 'horizontal') {
      // 横屏模式：视频通常是竖屏（9:16）
      return 9 / 16;
    } else {
      // 竖屏模式：视频通常是横屏（16:9）
      return 16 / 9;
    }
  }, [mode]);

  // 开始拖拽 - 不再切换激活图层，只能通过图层侧边栏选择
  const handleMouseDown = (e: React.MouseEvent, layerId: LayerId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;
    // 只允许拖拽当前激活的图层
    if (layerId !== activeLayer) return;

    setIsDragging(true);

    const rect = containerRef.current.getBoundingClientRect();

    // 转换为相对于容器内部坐标系的起始点
    const mouseX = (e.clientX - rect.left) / containerSize.scale;
    const mouseY = (e.clientY - rect.top) / containerSize.scale;

    const position = positions[layerId];
    if (position) {
      setDragOffset({
        x: mouseX - position.x,
        y: mouseY - position.y,
      });
    }
  };

  // 开始缩放 - 不再切换激活图层，只能通过图层侧边栏选择
  const handleResizeStart = (e: React.MouseEvent, layerId: LayerId) => {
    e.preventDefault();
    e.stopPropagation();

    // 只允许缩放当前激活的图层
    if (layerId !== activeLayer) return;

    setIsResizing(true);
  };

  // 全局鼠标移动事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || (!isDragging && !isResizing)) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / containerSize.scale;
      const mouseY = (e.clientY - rect.top) / containerSize.scale;

      let vGuide = false;
      let hGuide = false;

      if (isDragging && activeLayerConfig && !activeLayerConfig.locked) {
        let newX = mouseX - dragOffset.x;
        let newY = mouseY - dragOffset.y;

        const centerX = newX + activePosition.width / 2;
        const centerY = newY + activePosition.height / 2;

        // X 轴吸附
        if (Math.abs(centerX - canvasWidth / 2) < SNAP_THRESHOLD) {
          newX = canvasWidth / 2 - activePosition.width / 2;
          vGuide = true;
        } else if (Math.abs(newX) < SNAP_THRESHOLD) {
          newX = 0;
        } else if (Math.abs(newX + activePosition.width - canvasWidth) < SNAP_THRESHOLD) {
          newX = canvasWidth - activePosition.width;
        }

        // Y 轴吸附
        if (Math.abs(centerY - canvasHeight / 2) < SNAP_THRESHOLD) {
          newY = canvasHeight / 2 - activePosition.height / 2;
          hGuide = true;
        } else if (Math.abs(newY) < SNAP_THRESHOLD) {
          newY = 0;
        } else if (Math.abs(newY + activePosition.height - canvasHeight) < SNAP_THRESHOLD) {
          newY = canvasHeight - activePosition.height;
        }

        onPositionChange(activeLayer, {
          ...activePosition,
          x: newX,
          y: newY,
        });
      }

      if (isResizing && activeLayerConfig && !activeLayerConfig.locked) {
        // 根据图层类型获取宽高比
        let aspectRatio = getAspectRatio();

        // 背景图和封面图使用记录的原始宽高比
        if (activeLayer === 'bgImage' || activeLayer === 'coverImage') {
          // 如果已经有记录的原始宽高比，使用它；否则使用当前宽高比并记录
          if (originalAspectRatios.current[activeLayer]) {
            aspectRatio = originalAspectRatios.current[activeLayer]!;
          } else {
            aspectRatio = activePosition.width / activePosition.height;
            originalAspectRatios.current[activeLayer] = aspectRatio;
          }
        }

        // 计算新的宽度：取鼠标相对于物体左上角的 X 距离和 Y 距离（换算回宽度）的最大值
        const potentialWidthFromX = mouseX - activePosition.x;
        const potentialWidthFromY = (mouseY - activePosition.y) * aspectRatio;

        let newWidth = Math.max(potentialWidthFromX, potentialWidthFromY);

        // 约束：最小 200px
        newWidth = Math.max(200, newWidth);

        // 最大限制：画布宽度的 10 倍
        newWidth = Math.min(newWidth, canvasWidth * 10);

        // Resize 吸附
        if (Math.abs(activePosition.x + newWidth - canvasWidth) < SNAP_THRESHOLD) {
          newWidth = canvasWidth - activePosition.x;
        }

        const newHeight = newWidth / aspectRatio;
        if (Math.abs(activePosition.y + newHeight - canvasHeight) < SNAP_THRESHOLD) {
          newWidth = (canvasHeight - activePosition.y) * aspectRatio;
        }

        onPositionChange(activeLayer, {
          ...activePosition,
          width: newWidth,
          height: newHeight,
        });
      }

      setShowVGuide(vGuide);
      setShowHGuide(hGuide);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setShowVGuide(false);
      setShowHGuide(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    containerSize,
    dragOffset,
    activeLayerConfig,
    activeLayer,
    activePosition,
    positions,
    canvasWidth,
    canvasHeight,
    onPositionChange,
    getAspectRatio,
    mode,
  ]);

  // 从位置映射构建素材配置数组 - 只包含激活的图层
  const materialConfigs: MaterialConfig[] = layerConfigs
    .filter((layer) => layer.id === activeLayer && layer.visible)
    .map((layer) => ({
      id: layer.id,
      label: layer.label,
      position: positions[layer.id],
      colorClass: layer.colorClass,
      bgClass: layer.bgClass,
      visible: layer.visible,
      locked: layer.locked,
      thumbnail: materials?.[layer.id],
    }));

  // 获取背景图路径（如果有）
  const bgImagePath = materials?.bgImage;
  const bgPosition = positions.bgImage;

  return (
    <div
      ref={containerRef}
      style={{
        aspectRatio: `${canvasWidth} / ${canvasHeight}`,
        width: `${containerSize.width}px`,
        height: `${containerSize.height}px`,
      }}
      className="relative bg-slate-900 rounded-lg shadow-2xl border border-slate-800 overflow-visible select-none mx-auto"
    >
      {/* 裁剪容器 - 限制素材内容在画布范围内 */}
      <div
        className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none"
        style={{
          width: `${canvasWidth * containerSize.scale}px`,
          height: `${canvasHeight * containerSize.scale}px`,
        }}
      >
        {/* 背景图 - 根据控件位置实时显示 */}
        {bgImagePath && (
          <img
            src={`preview://${encodeURIComponent(bgImagePath)}`}
            alt="背景图"
            style={{
              left: `${bgPosition.x * containerSize.scale}px`,
              top: `${bgPosition.y * containerSize.scale}px`,
              width: `${bgPosition.width * containerSize.scale}px`,
              height: `${bgPosition.height * containerSize.scale}px`,
            }}
            className="absolute object-cover select-none rounded-lg"
          />
        )}
      </div>

      {/* 智能辅助对齐线 */}
      {showVGuide && (
        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 left-[50%] -translate-x-1/2 z-20 shadow-[0_0_8px_rgba(52,211,153,0.8)]">
          <div className="absolute top-2 left-2 text-[10px] font-bold text-emerald-400 bg-black/60 px-1 rounded">
            {canvasWidth / 2}px
          </div>
        </div>
      )}
      {showHGuide && (
        <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 top-[50%] -translate-y-1/2 z-20 shadow-[0_0_8px_rgba(52,211,153,0.8)]">
          <div className="absolute left-2 top-2 text-[10px] font-bold text-emerald-400 bg-black/60 px-1 rounded">
            {canvasHeight / 2}px
          </div>
        </div>
      )}

      {/* 素材框 - 只显示激活的图层 */}
      {materialConfigs.map((material) => (
        <VideoBox
          key={material.id}
          id={material.id}
          label={material.label}
          position={material.position}
          isActive={activeLayer === material.id}
          scale={containerSize.scale}
          colorClass={material.colorClass}
          bgClass={material.bgClass}
          visible={material.visible}
          locked={material.locked}
          thumbnail={material.thumbnail}
          onMouseDown={handleMouseDown}
          onResizeStart={handleResizeStart}
        />
      ))}

      {/* 刻度标记 */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-slate-500 font-mono px-1">
        <span>0</span>
        <span>{canvasWidth / 2}</span>
        <span>{canvasWidth} px</span>
      </div>

      {/* 顶部标签 */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3 py-1 rounded-full backdrop-blur-md">
          <div className={`w-2 h-2 rounded-full ${activeLayerConfig?.colorClass || 'bg-slate-500'}`}></div>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            合成画布分辨率: {canvasWidth} x {canvasHeight}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
