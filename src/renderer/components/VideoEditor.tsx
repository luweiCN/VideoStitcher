import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Position, MaterialPositions } from '@/types';
import VideoBox from './VideoBox';

/**
 * 交互式视频编辑器属性
 */
export interface VideoEditorProps {
  canvasWidth: number;
  canvasHeight: number;
  // 素材位置映射
  positions: MaterialPositions;
  onBVideoPositionChange: (position: Position) => void;
  // 素材路径（用于显示预览）
  materials?: {
    aVideo?: string;
    bVideo?: string;
    bgImage?: string;
    coverImage?: string;
  };
  // 视频元数据（用于获取实际宽高比）
  videoMetadata?: {
    width: number;
    height: number;
  };
  // 画布缩放
  canvasZoom: number;
}

const SNAP_THRESHOLD = 12; // 吸附阈值（像素）

/**
 * 交互式视频编辑器组件
 * 只支持编辑 B 面视频的位置和大小
 */
const VideoEditor: React.FC<VideoEditorProps> = ({
  canvasWidth,
  canvasHeight,
  positions,
  onBVideoPositionChange,
  materials,
  videoMetadata,
  canvasZoom,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0, scale: 1 });
  const [showVGuide, setShowVGuide] = useState(false);
  const [showHGuide, setShowHGuide] = useState(false);

  // B 面视频位置
  const bVideoPosition = positions.bVideo;

  // 更新容器尺寸和缩放比例
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current?.parentElement) return;
      const parentWidth = containerRef.current.parentElement.getBoundingClientRect().width;
      const scaledWidth = parentWidth * (canvasZoom / 100);
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
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      let newX = bVideoPosition.x;
      let newY = bVideoPosition.y;

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
      newX = Math.max(0, Math.min(newX, canvasWidth - bVideoPosition.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - bVideoPosition.height));

      onBVideoPositionChange({
        ...bVideoPosition,
        x: newX,
        y: newY,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bVideoPosition, canvasWidth, canvasHeight, onBVideoPositionChange]);

  // 计算宽高比
  const getAspectRatio = useCallback((): number => {
    // 优先使用视频的实际宽高比
    if (videoMetadata) {
      return videoMetadata.width / videoMetadata.height;
    }
    // 没有视频元数据时，使用当前视频框的宽高比
    return bVideoPosition.width / bVideoPosition.height;
  }, [videoMetadata, bVideoPosition]);

  // 开始拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;

    setIsDragging(true);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / containerSize.scale;
    const mouseY = (e.clientY - rect.top) / containerSize.scale;

    setDragOffset({
      x: mouseX - bVideoPosition.x,
      y: mouseY - bVideoPosition.y,
    });
  };

  // 开始缩放
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

      if (isDragging) {
        let newX = mouseX - dragOffset.x;
        let newY = mouseY - dragOffset.y;

        const centerX = newX + bVideoPosition.width / 2;
        const centerY = newY + bVideoPosition.height / 2;

        // X 轴吸附
        if (Math.abs(centerX - canvasWidth / 2) < SNAP_THRESHOLD) {
          newX = canvasWidth / 2 - bVideoPosition.width / 2;
          vGuide = true;
        } else if (Math.abs(newX) < SNAP_THRESHOLD) {
          newX = 0;
        } else if (Math.abs(newX + bVideoPosition.width - canvasWidth) < SNAP_THRESHOLD) {
          newX = canvasWidth - bVideoPosition.width;
        }

        // Y 轴吸附
        if (Math.abs(centerY - canvasHeight / 2) < SNAP_THRESHOLD) {
          newY = canvasHeight / 2 - bVideoPosition.height / 2;
          hGuide = true;
        } else if (Math.abs(newY) < SNAP_THRESHOLD) {
          newY = 0;
        } else if (Math.abs(newY + bVideoPosition.height - canvasHeight) < SNAP_THRESHOLD) {
          newY = canvasHeight - bVideoPosition.height;
        }

        onBVideoPositionChange({
          ...bVideoPosition,
          x: newX,
          y: newY,
        });
      }

      if (isResizing) {
        const aspectRatio = getAspectRatio();

        const potentialWidthFromX = mouseX - bVideoPosition.x;
        const potentialWidthFromY = (mouseY - bVideoPosition.y) * aspectRatio;

        let newWidth = Math.max(potentialWidthFromX, potentialWidthFromY);

        // 约束：最小 200px
        newWidth = Math.max(200, newWidth);

        // 最大限制：画布宽度的 10 倍
        newWidth = Math.min(newWidth, canvasWidth * 10);

        // Resize 吸附
        if (Math.abs(bVideoPosition.x + newWidth - canvasWidth) < SNAP_THRESHOLD) {
          newWidth = canvasWidth - bVideoPosition.x;
        }

        const newHeight = newWidth / aspectRatio;
        if (Math.abs(bVideoPosition.y + newHeight - canvasHeight) < SNAP_THRESHOLD) {
          newWidth = (canvasHeight - bVideoPosition.y) * aspectRatio;
        }

        onBVideoPositionChange({
          ...bVideoPosition,
          width: newWidth,
          height: newWidth / aspectRatio,
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
    bVideoPosition,
    canvasWidth,
    canvasHeight,
    onBVideoPositionChange,
    getAspectRatio,
  ]);

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

      {/* B 面视频框 - 可拖拽和缩放 */}
      <VideoBox
        id="bVideo"
        label="B 面"
        position={bVideoPosition}
        isActive={true}
        scale={containerSize.scale}
        colorClass="bg-fuchsia-500"
        bgClass="bg-fuchsia-500/20"
        visible={true}
        locked={false}
        thumbnail={materials?.bVideo}
        onMouseDown={handleMouseDown}
        onResizeStart={handleResizeStart}
      />

      {/* 刻度标记 */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] text-slate-500 font-mono px-1">
        <span>0</span>
        <span>{canvasWidth / 2}</span>
        <span>{canvasWidth} px</span>
      </div>

      {/* 顶部标签 */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3 py-1 rounded-full backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-fuchsia-500"></div>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            合成画布分辨率: {canvasWidth} x {canvasHeight}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoEditor;
