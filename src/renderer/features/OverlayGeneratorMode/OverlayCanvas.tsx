import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampOverlayPosition,
  getOverlayModeConfig,
  getOverlayRegionRect,
  getOverlayWindowRect,
  type OverlayCropTransform,
  type OverlayRegionKey,
  type OverlayTemplateMode,
} from '@shared/overlay';
import { loadImageAsElement } from '@/utils/image';
import { getRegionCoverageGaps } from '@/features/OverlayGeneratorMode/geometry';
import type {
  OverlayEditingTarget,
  OverlayEditorTask,
} from '@/features/OverlayGeneratorMode/types';

interface OverlayCanvasProps {
  task: OverlayEditorTask | null;
  mode: OverlayTemplateMode;
  editingTarget: OverlayEditingTarget;
  onEditingTargetChange: (target: OverlayEditingTarget) => void;
  onTaskChange: (updater: (task: OverlayEditorTask) => OverlayEditorTask) => void;
  onDropAsset: (region: OverlayRegionKey, path: string) => void;
  disabled?: boolean;
}

interface DragState {
  kind: 'video' | 'image';
  region?: OverlayRegionKey;
  startX: number;
  startY: number;
  startPosition: number;
  startTransform?: OverlayCropTransform;
}

/** 贴片编辑画布；竖版和横版共用同一套渲染与交互。 */
const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  task,
  mode,
  editingTarget,
  onEditingTargetChange,
  onTaskChange,
  onDropAsset,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firstImageRef = useRef<HTMLImageElement | null>(null);
  const secondImageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<OverlayEditorTask | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const checkerPatternRef = useRef<CanvasPattern | null>(null);
  const isDraggingRef = useRef(false);
  const loadRequestRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const modeConfig = getOverlayModeConfig(task?.mode ?? mode);

  const draw = useCallback((previewTask?: OverlayEditorTask | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const renderedTask = previewTask === undefined ? task : previewTask;
    const config = getOverlayModeConfig(renderedTask?.mode ?? mode);

    context.clearRect(0, 0, config.canvasWidth, config.canvasHeight);
    context.fillStyle = '#020617';
    context.fillRect(0, 0, config.canvasWidth, config.canvasHeight);

    if (!renderedTask) {
      context.fillStyle = '#64748B';
      context.font = '600 42px sans-serif';
      context.textAlign = 'center';
      context.fillText('导入图片后开始制作贴片', config.canvasWidth / 2, config.canvasHeight / 2);
      return;
    }

    const drawRegion = (
      image: HTMLImageElement | null,
      region: OverlayRegionKey,
    ) => {
      const first = region === 'first';
      const rect = getOverlayRegionRect(renderedTask.position, region, renderedTask.mode);
      const asset = first ? renderedTask.firstAsset : renderedTask.secondAsset;
      const transform = first ? renderedTask.firstTransform : renderedTask.secondTransform;

      context.save();
      context.beginPath();
      context.rect(rect.x, rect.y, rect.width, rect.height);
      context.clip();
      context.fillStyle = '#0F172A';
      context.fillRect(rect.x, rect.y, rect.width, rect.height);

      if (image && asset) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = isDraggingRef.current ? 'medium' : 'high';
        context.drawImage(
          image,
          rect.x + transform.x,
          rect.y + transform.y,
          asset.width * transform.scale,
          asset.height * transform.scale,
        );
      } else if (rect.width > 0 && rect.height > 0) {
        context.fillStyle = '#475569';
        context.font = '600 30px sans-serif';
        context.textAlign = 'center';
        context.fillText(
          `${first ? config.firstLabel : config.secondLabel}暂无素材`,
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
      }
      context.restore();

      const active = editingTarget === region;
      const gaps = getRegionCoverageGaps(asset, transform, rect);
      if (active && asset && Object.values(gaps).some((gap) => gap > 0)) {
        // 缺口可能只有 1px，预览中至少绘制 8px 红色标记，便于快速定位方向。
        const markerSize = 8;
        context.fillStyle = 'rgba(244, 63, 94, 0.86)';
        if (gaps.left > 0) context.fillRect(rect.x, rect.y, markerSize, rect.height);
        if (gaps.right > 0) {
          context.fillRect(rect.x + rect.width - markerSize, rect.y, markerSize, rect.height);
        }
        if (gaps.top > 0) context.fillRect(rect.x, rect.y, rect.width, markerSize);
        if (gaps.bottom > 0) {
          context.fillRect(rect.x, rect.y + rect.height - markerSize, rect.width, markerSize);
        }
      }

      context.strokeStyle = active ? 'rgba(245, 158, 11, 0.82)' : 'rgba(148, 163, 184, 0.38)';
      context.lineWidth = active ? 3 : 2;
      context.strokeRect(
        rect.x + 2,
        rect.y + 2,
        Math.max(0, rect.width - 4),
        Math.max(0, rect.height - 4),
      );
    };

    drawRegion(firstImageRef.current, 'first');
    drawRegion(secondImageRef.current, 'second');

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
    const windowRect = getOverlayWindowRect(renderedTask.position, renderedTask.mode);
    if (checkerPatternRef.current) {
      context.fillStyle = checkerPatternRef.current;
      context.fillRect(windowRect.x, windowRect.y, windowRect.width, windowRect.height);
    }
    context.fillStyle = 'rgba(15, 23, 42, 0.68)';
    context.fillRect(windowRect.x, windowRect.y, windowRect.width, windowRect.height);
    context.strokeStyle = editingTarget === 'video' ? 'rgba(245, 158, 11, 0.82)' : 'rgba(56, 189, 248, 0.72)';
    context.lineWidth = editingTarget === 'video' ? 3 : 2;
    context.strokeRect(
      windowRect.x + 3,
      windowRect.y + 3,
      windowRect.width - 6,
      windowRect.height - 6,
    );
    const textCenterX = windowRect.x + windowRect.width / 2;
    const textCenterY = windowRect.y + windowRect.height / 2;
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.font = '700 42px sans-serif';
    context.fillText(config.transparentLabel, textCenterX, textCenterY - 42);
    context.font = '500 28px sans-serif';
    context.fillText(
      `${config.windowWidth}×${config.windowHeight} · 最终导出为透明`,
      textCenterX,
      textCenterY + 8,
    );
    context.font = '600 24px sans-serif';
    context.fillText(`${config.axisLabel} = ${renderedTask.position}`, textCenterX, textCenterY + 53);

    // 安全边界与画布中心辅助线。
    context.save();
    context.setLineDash([18, 14]);
    context.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    context.lineWidth = 2;
    context.strokeRect(28, 28, config.canvasWidth - 56, config.canvasHeight - 56);
    context.beginPath();
    context.moveTo(config.canvasWidth / 2, 0);
    context.lineTo(config.canvasWidth / 2, config.canvasHeight);
    context.moveTo(0, config.canvasHeight / 2);
    context.lineTo(config.canvasWidth, config.canvasHeight / 2);
    context.stroke();
    context.restore();
  }, [task, editingTarget, mode]);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    if (firstImageRef.current) firstImageRef.current.src = '';
    if (secondImageRef.current && secondImageRef.current !== firstImageRef.current) {
      secondImageRef.current.src = '';
    }
    firstImageRef.current = null;
    secondImageRef.current = null;
    draw();

    if (!task) return;
    const load = async () => {
      let firstImage: HTMLImageElement | null = null;
      let secondImage: HTMLImageElement | null = null;
      if (
        task.firstAsset &&
        task.secondAsset &&
        task.firstAsset.path === task.secondAsset.path
      ) {
        firstImage = await loadImageAsElement(task.firstAsset.path);
        secondImage = firstImage;
      } else {
        [firstImage, secondImage] = await Promise.all([
          task.firstAsset ? loadImageAsElement(task.firstAsset.path) : Promise.resolve(null),
          task.secondAsset ? loadImageAsElement(task.secondAsset.path) : Promise.resolve(null),
        ]);
      }
      if (requestId !== loadRequestRef.current) return;
      firstImageRef.current = firstImage;
      secondImageRef.current = secondImage;
      draw();
    };
    void load();
  }, [task?.id, task?.firstAsset?.path, task?.secondAsset?.path]);

  useEffect(() => () => {
    loadRequestRef.current += 1;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (firstImageRef.current) firstImageRef.current.src = '';
    if (secondImageRef.current && secondImageRef.current !== firstImageRef.current) {
      secondImageRef.current.src = '';
    }
    firstImageRef.current = null;
    secondImageRef.current = null;
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

  const getPoint = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (modeConfig.canvasWidth / rect.width),
      y: (event.clientY - rect.top) * (modeConfig.canvasHeight / rect.height),
    };
  }, [modeConfig.canvasHeight, modeConfig.canvasWidth]);

  const getRegionAtPoint = useCallback((point: { x: number; y: number }): OverlayEditingTarget => {
    if (!task) return 'video';
    const axisPoint = modeConfig.movementAxis === 'y' ? point.y : point.x;
    const windowSize = modeConfig.movementAxis === 'y'
      ? modeConfig.windowHeight
      : modeConfig.windowWidth;
    if (axisPoint < task.position) return 'first';
    if (axisPoint >= task.position + windowSize) return 'second';
    return 'video';
  }, [modeConfig.movementAxis, modeConfig.windowHeight, modeConfig.windowWidth, task]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!task || disabled) return;
    const point = getPoint(event);
    if (!point) return;
    const target = getRegionAtPoint(point);
    onEditingTargetChange(target);
    event.currentTarget.focus();

    if (target === 'video') {
      dragRef.current = {
        kind: 'video',
        startX: point.x,
        startY: point.y,
        startPosition: task.position,
      };
    } else {
      const locked = target === 'first' ? task.firstLocked : task.secondLocked;
      if (locked) return;
      dragRef.current = {
        kind: 'image',
        region: target,
        startX: point.x,
        startY: point.y,
        startPosition: task.position,
        startTransform: target === 'first' ? task.firstTransform : task.secondTransform,
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
      const delta = modeConfig.movementAxis === 'y' ? deltaY : deltaX;
      let nextPosition = clampOverlayPosition(drag.startPosition + delta, task.mode);
      if (Math.abs(nextPosition - modeConfig.centerPosition) <= 10) {
        nextPosition = modeConfig.centerPosition;
      }
      dragPreviewRef.current = {
        ...task,
        position: nextPosition,
        status: 'editing',
        error: null,
        progress: 0,
      };
    } else {
      if (!drag.region || !drag.startTransform) return;
      const key = drag.region === 'first' ? 'firstTransform' : 'secondTransform';
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
          ? { ...current, position: previewTask.position }
          : {
              ...current,
              [drag.region === 'first' ? 'firstTransform' : 'secondTransform']:
                drag.region === 'first'
                  ? previewTask.firstTransform
                  : previewTask.secondTransform,
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
    const target = getRegionAtPoint(point);
    if (target === 'video') return;
    const locked = target === 'first' ? task.firstLocked : task.secondLocked;
    const asset = target === 'first' ? task.firstAsset : task.secondAsset;
    if (locked || !asset) return;

    event.preventDefault();
    onEditingTargetChange(target);
    const regionRect = getOverlayRegionRect(task.position, target, task.mode);
    const localPoint = { x: point.x - regionRect.x, y: point.y - regionRect.y };
    const key = target === 'first' ? 'firstTransform' : 'secondTransform';
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
      const isPrevious = modeConfig.movementAxis === 'y'
        ? event.key === 'ArrowUp'
        : event.key === 'ArrowLeft';
      const isNext = modeConfig.movementAxis === 'y'
        ? event.key === 'ArrowDown'
        : event.key === 'ArrowRight';
      if (isPrevious || isNext) {
        onTaskChange((current) => ({
          ...current,
          position: clampOverlayPosition(current.position + (isPrevious ? -step : step), current.mode),
          status: 'editing',
          error: null,
          progress: 0,
        }));
      }
      return;
    }

    const locked = editingTarget === 'first' ? task.firstLocked : task.secondLocked;
    if (locked) return;
    const key = editingTarget === 'first' ? 'firstTransform' : 'secondTransform';
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
    const target = getRegionAtPoint(point);
    if (target === 'video') return;
    const file = event.dataTransfer.files[0];
    const filePath = window.api.getPathForFile(file);
    if (filePath) onDropAsset(target, filePath);
  };

  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-hidden p-3">
      <canvas
        ref={canvasRef}
        width={modeConfig.canvasWidth}
        height={modeConfig.canvasHeight}
        tabIndex={0}
        aria-label={`${modeConfig.canvasWidth}×${modeConfig.canvasHeight} ${modeConfig.label}预览画布`}
        className={`max-h-full max-w-full rounded-xl border border-slate-700 bg-slate-950 shadow-none outline-none focus:ring-1 focus:ring-amber-500/40 ${
          disabled
            ? 'cursor-not-allowed opacity-80'
            : isDragging
              ? 'cursor-grabbing'
              : editingTarget === 'video'
                ? modeConfig.movementAxis === 'y' ? 'cursor-ns-resize' : 'cursor-ew-resize'
                : 'cursor-grab'
        }`}
        style={{ aspectRatio: `${modeConfig.canvasWidth} / ${modeConfig.canvasHeight}` }}
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
