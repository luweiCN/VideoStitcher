import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  OVERLAY_CANVAS_HEIGHT,
  OVERLAY_CANVAS_WIDTH,
  OVERLAY_CENTER_Y,
  OVERLAY_MAX_VIDEO_Y,
  OVERLAY_VIDEO_HEIGHT,
  clampOverlayVideoY,
  type OverlayCropTransform,
} from '@shared/overlay';
import { loadImageAsElement } from '@/utils/image';
import { getRegionCoverageGaps } from '@/features/OverlayGeneratorMode/geometry';
import type {
  OverlayEditingTarget,
  OverlayEditorTask,
} from '@/features/OverlayGeneratorMode/types';

interface OverlayCanvasProps {
  task: OverlayEditorTask | null;
  editingTarget: OverlayEditingTarget;
  onEditingTargetChange: (target: OverlayEditingTarget) => void;
  onTaskChange: (updater: (task: OverlayEditorTask) => OverlayEditorTask) => void;
  onDropAsset: (region: 'top' | 'bottom', path: string) => void;
  disabled?: boolean;
}

interface DragState {
  kind: 'video' | 'image';
  region?: 'top' | 'bottom';
  startX: number;
  startY: number;
  startVideoY: number;
  startTransform?: OverlayCropTransform;
}

/** 贴片编辑画布；始终只复用一个 1080×1920 Canvas。 */
const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  task,
  editingTarget,
  onEditingTargetChange,
  onTaskChange,
  onDropAsset,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topImageRef = useRef<HTMLImageElement | null>(null);
  const bottomImageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<OverlayEditorTask | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const checkerPatternRef = useRef<CanvasPattern | null>(null);
  const isDraggingRef = useRef(false);
  const loadRequestRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const draw = useCallback((previewTask?: OverlayEditorTask | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const renderedTask = previewTask === undefined ? task : previewTask;

    context.clearRect(0, 0, OVERLAY_CANVAS_WIDTH, OVERLAY_CANVAS_HEIGHT);
    context.fillStyle = '#020617';
    context.fillRect(0, 0, OVERLAY_CANVAS_WIDTH, OVERLAY_CANVAS_HEIGHT);

    if (!renderedTask) {
      context.fillStyle = '#64748B';
      context.font = '600 42px sans-serif';
      context.textAlign = 'center';
      context.fillText('导入图片后开始制作贴片', OVERLAY_CANVAS_WIDTH / 2, OVERLAY_CANVAS_HEIGHT / 2);
      return;
    }

    const drawRegion = (
      image: HTMLImageElement | null,
      region: 'top' | 'bottom',
    ) => {
      const isTop = region === 'top';
      const regionTop = isTop ? 0 : renderedTask.videoY + OVERLAY_VIDEO_HEIGHT;
      const regionHeight = isTop
        ? renderedTask.videoY
        : OVERLAY_CANVAS_HEIGHT - regionTop;
      const asset = isTop ? renderedTask.topAsset : renderedTask.bottomAsset;
      const transform = isTop ? renderedTask.topTransform : renderedTask.bottomTransform;

      context.save();
      context.beginPath();
      context.rect(0, regionTop, OVERLAY_CANVAS_WIDTH, regionHeight);
      context.clip();
      context.fillStyle = '#0F172A';
      context.fillRect(0, regionTop, OVERLAY_CANVAS_WIDTH, regionHeight);

      if (image && asset) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = isDraggingRef.current ? 'medium' : 'high';
        context.drawImage(
          image,
          transform.x,
          regionTop + transform.y,
          asset.width * transform.scale,
          asset.height * transform.scale,
        );
      } else if (regionHeight > 0) {
        context.fillStyle = '#475569';
        context.font = '600 30px sans-serif';
        context.textAlign = 'center';
        context.fillText(`${isTop ? '上' : '下'}半部分暂无素材`, OVERLAY_CANVAS_WIDTH / 2, regionTop + regionHeight / 2);
      }
      context.restore();

      const active = editingTarget === region;
      const gaps = getRegionCoverageGaps(asset, transform, regionHeight);
      if (active && asset && Object.values(gaps).some((gap) => gap > 0)) {
        // 缺口可能只有 1px，预览中至少绘制 8px 红色标记，便于快速定位方向。
        const markerSize = 8;
        context.fillStyle = 'rgba(244, 63, 94, 0.86)';
        if (gaps.left > 0) context.fillRect(0, regionTop, markerSize, regionHeight);
        if (gaps.right > 0) context.fillRect(OVERLAY_CANVAS_WIDTH - markerSize, regionTop, markerSize, regionHeight);
        if (gaps.top > 0) context.fillRect(0, regionTop, OVERLAY_CANVAS_WIDTH, markerSize);
        if (gaps.bottom > 0) context.fillRect(0, regionTop + regionHeight - markerSize, OVERLAY_CANVAS_WIDTH, markerSize);
      }

      context.strokeStyle = active ? 'rgba(245, 158, 11, 0.82)' : 'rgba(148, 163, 184, 0.38)';
      context.lineWidth = active ? 3 : 2;
      context.strokeRect(2, regionTop + 2, OVERLAY_CANVAS_WIDTH - 4, Math.max(0, regionHeight - 4));
    };

    drawRegion(topImageRef.current, 'top');
    drawRegion(bottomImageRef.current, 'bottom');

    // 棋盘格缓存为纹理，拖动时只需一次填充，避免逐格绘制拖慢每一帧。
    if (!checkerPatternRef.current) {
      const checkerSize = 36;
      const checkerCanvas = document.createElement('canvas');
      checkerCanvas.width = checkerSize * 2;
      checkerCanvas.height = checkerSize * 2;
      const checkerContext = checkerCanvas.getContext('2d');
      if (checkerContext) {
        checkerContext.fillStyle = '#CBD5E1';
        checkerContext.fillRect(0, 0, checkerCanvas.width, checkerCanvas.height);
        checkerContext.fillStyle = '#F8FAFC';
        checkerContext.fillRect(checkerSize, 0, checkerSize, checkerSize);
        checkerContext.fillRect(0, checkerSize, checkerSize, checkerSize);
        checkerPatternRef.current = context.createPattern(checkerCanvas, 'repeat');
      }
    }
    if (checkerPatternRef.current) {
      context.save();
      context.translate(0, renderedTask.videoY);
      context.fillStyle = checkerPatternRef.current;
      context.fillRect(0, 0, OVERLAY_CANVAS_WIDTH, OVERLAY_VIDEO_HEIGHT);
      context.restore();
    }
    context.fillStyle = 'rgba(15, 23, 42, 0.68)';
    context.fillRect(0, renderedTask.videoY, OVERLAY_CANVAS_WIDTH, OVERLAY_VIDEO_HEIGHT);
    context.strokeStyle = editingTarget === 'video' ? 'rgba(245, 158, 11, 0.82)' : 'rgba(56, 189, 248, 0.72)';
    context.lineWidth = editingTarget === 'video' ? 3 : 2;
    context.strokeRect(3, renderedTask.videoY + 3, OVERLAY_CANVAS_WIDTH - 6, OVERLAY_VIDEO_HEIGHT - 6);
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.font = '700 42px sans-serif';
    context.fillText('横版视频区域', OVERLAY_CANVAS_WIDTH / 2, renderedTask.videoY + 270);
    context.font = '500 28px sans-serif';
    context.fillText('1080×608 · 最终导出为透明', OVERLAY_CANVAS_WIDTH / 2, renderedTask.videoY + 320);
    context.font = '600 24px sans-serif';
    context.fillText(`Y = ${renderedTask.videoY}`, OVERLAY_CANVAS_WIDTH / 2, renderedTask.videoY + 365);

    // 安全边界与垂直中心辅助线。
    context.save();
    context.setLineDash([18, 14]);
    context.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    context.lineWidth = 2;
    context.strokeRect(28, 28, OVERLAY_CANVAS_WIDTH - 56, OVERLAY_CANVAS_HEIGHT - 56);
    context.beginPath();
    context.moveTo(OVERLAY_CANVAS_WIDTH / 2, 0);
    context.lineTo(OVERLAY_CANVAS_WIDTH / 2, OVERLAY_CANVAS_HEIGHT);
    context.stroke();
    context.restore();
  }, [task, editingTarget]);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    if (topImageRef.current) topImageRef.current.src = '';
    if (bottomImageRef.current && bottomImageRef.current !== topImageRef.current) {
      bottomImageRef.current.src = '';
    }
    topImageRef.current = null;
    bottomImageRef.current = null;
    draw();

    if (!task) return;
    const load = async () => {
      let topImage: HTMLImageElement | null = null;
      let bottomImage: HTMLImageElement | null = null;
      if (task.topAsset && task.bottomAsset && task.topAsset.path === task.bottomAsset.path) {
        topImage = await loadImageAsElement(task.topAsset.path);
        bottomImage = topImage;
      } else {
        [topImage, bottomImage] = await Promise.all([
          task.topAsset ? loadImageAsElement(task.topAsset.path) : Promise.resolve(null),
          task.bottomAsset ? loadImageAsElement(task.bottomAsset.path) : Promise.resolve(null),
        ]);
      }
      if (requestId !== loadRequestRef.current) return;
      topImageRef.current = topImage;
      bottomImageRef.current = bottomImage;
      draw();
    };
    void load();
  }, [task?.id, task?.topAsset?.path, task?.bottomAsset?.path]);

  useEffect(() => () => {
    loadRequestRef.current += 1;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (topImageRef.current) topImageRef.current.src = '';
    if (bottomImageRef.current && bottomImageRef.current !== topImageRef.current) {
      bottomImageRef.current.src = '';
    }
    topImageRef.current = null;
    bottomImageRef.current = null;
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

  const getPoint = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (OVERLAY_CANVAS_WIDTH / rect.width),
      y: (event.clientY - rect.top) * (OVERLAY_CANVAS_HEIGHT / rect.height),
    };
  }, []);

  const getRegionAtY = useCallback((y: number): OverlayEditingTarget => {
    if (!task) return 'video';
    if (y < task.videoY) return 'top';
    if (y >= task.videoY + OVERLAY_VIDEO_HEIGHT) return 'bottom';
    return 'video';
  }, [task]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!task || disabled) return;
    const point = getPoint(event);
    if (!point) return;
    const target = getRegionAtY(point.y);
    onEditingTargetChange(target);
    event.currentTarget.focus();

    if (target === 'video') {
      dragRef.current = {
        kind: 'video',
        startX: point.x,
        startY: point.y,
        startVideoY: task.videoY,
      };
    } else {
      const locked = target === 'top' ? task.topLocked : task.bottomLocked;
      if (locked) return;
      dragRef.current = {
        kind: 'image',
        region: target,
        startX: point.x,
        startY: point.y,
        startVideoY: task.videoY,
        startTransform: target === 'top' ? task.topTransform : task.bottomTransform,
      };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragPreviewRef.current = null;
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const point = getPoint(event);
    if (!task || disabled || !drag || !point) return;
    const deltaX = point.x - drag.startX;
    const deltaY = point.y - drag.startY;

    if (drag.kind === 'video') {
      let nextY = clampOverlayVideoY(drag.startVideoY + deltaY);
      if (Math.abs(nextY - OVERLAY_CENTER_Y) <= 10) nextY = OVERLAY_CENTER_Y;
      dragPreviewRef.current = {
        ...task,
        videoY: nextY,
        status: 'editing',
        error: null,
        progress: 0,
      };
    } else {
      if (!drag.region || !drag.startTransform) return;
      const key = drag.region === 'top' ? 'topTransform' : 'bottomTransform';
      dragPreviewRef.current = {
        ...task,
        [key]: {
          ...drag.startTransform,
          x: drag.startTransform.x + deltaX,
          y: drag.startTransform.y + deltaY,
        },
        status: 'editing',
        error: null,
        progress: 0,
      };
    }

    // 高频指针事件合并到下一帧，只重绘画布，不触发整页 React 更新。
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null;
        draw(dragPreviewRef.current);
      });
    }
  };

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const drag = dragRef.current;
    const previewTask = dragPreviewRef.current;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (drag && previewTask) {
      draw(previewTask);
      onTaskChange((current) => {
        const nextTask = drag.kind === 'video'
          ? { ...current, videoY: previewTask.videoY }
          : {
              ...current,
              [drag.region === 'top' ? 'topTransform' : 'bottomTransform']:
                drag.region === 'top' ? previewTask.topTransform : previewTask.bottomTransform,
            };
        return {
          ...nextTask,
          status: 'editing',
          error: null,
          progress: 0,
        };
      });
    }
    dragRef.current = null;
    dragPreviewRef.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!task || disabled) return;
    const point = getPoint(event);
    if (!point) return;
    const target = getRegionAtY(point.y);
    if (target === 'video') return;
    const locked = target === 'top' ? task.topLocked : task.bottomLocked;
    const asset = target === 'top' ? task.topAsset : task.bottomAsset;
    if (locked || !asset) return;

    event.preventDefault();
    onEditingTargetChange(target);
    const regionTop = target === 'top' ? 0 : task.videoY + OVERLAY_VIDEO_HEIGHT;
    const localPoint = { x: point.x, y: point.y - regionTop };
    const key = target === 'top' ? 'topTransform' : 'bottomTransform';
    const transform = task[key];
    const zoomFactor = event.deltaY < 0 ? 1.06 : 1 / 1.06;
    const nextScale = Math.min(10, Math.max(0.005, transform.scale * zoomFactor));
    const ratio = nextScale / transform.scale;
    onTaskChange((current) => ({
      ...current,
      [key]: {
        ...transform,
        scale: nextScale,
        x: localPoint.x - (localPoint.x - transform.x) * ratio,
        y: localPoint.y - (localPoint.y - transform.y) * ratio,
      },
      status: 'editing',
      error: null,
      progress: 0,
    }));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!task || disabled || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    if (editingTarget === 'video') {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const delta = event.key === 'ArrowUp' ? -step : step;
        onTaskChange((current) => ({
          ...current,
          videoY: clampOverlayVideoY(current.videoY + delta),
          status: 'editing',
          error: null,
          progress: 0,
        }));
      }
      return;
    }

    const locked = editingTarget === 'top' ? task.topLocked : task.bottomLocked;
    if (locked) return;
    const key = editingTarget === 'top' ? 'topTransform' : 'bottomTransform';
    onTaskChange((current) => {
      const transform = current[key];
      return {
        ...current,
        [key]: {
          ...transform,
          x: transform.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
          y: transform.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
        },
        status: 'editing',
        error: null,
        progress: 0,
      };
    });
  };

  const handleDrop = (event: React.DragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!task || disabled || event.dataTransfer.files.length === 0) return;
    const point = getPoint(event);
    if (!point) return;
    const target = getRegionAtY(point.y);
    if (target === 'video') return;
    const file = event.dataTransfer.files[0];
    const filePath = window.api.getPathForFile(file);
    if (filePath) onDropAsset(target, filePath);
  };

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-hidden p-3">
      <canvas
        ref={canvasRef}
        width={OVERLAY_CANVAS_WIDTH}
        height={OVERLAY_CANVAS_HEIGHT}
        tabIndex={0}
        aria-label="1080×1920 贴片预览画布"
        className={`max-h-full max-w-full rounded-xl border border-slate-700 bg-slate-950 shadow-none outline-none focus:ring-1 focus:ring-amber-500/40 ${
          disabled ? 'cursor-not-allowed opacity-80' : isDragging ? 'cursor-grabbing' : editingTarget === 'video' ? 'cursor-ns-resize' : 'cursor-grab'
        }`}
        style={{ aspectRatio: `${OVERLAY_CANVAS_WIDTH} / ${OVERLAY_CANVAS_HEIGHT}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      />
    </div>
  );
};

export default OverlayCanvas;
