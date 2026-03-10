import React, { useEffect, useRef, useCallback, useState } from "react";

interface ImageInfo {
  path: string;
  name: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  horizontalLines?: number[];
  verticalLines?: number[];
}

interface GridPreviewProps {
  imageInfo: ImageInfo | null;
  previewRect: { width: number; height: number };
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onHorizontalLinesChange?: (lines: number[]) => void;
  onVerticalLinesChange?: (lines: number[]) => void;
}

const GridPreview: React.FC<GridPreviewProps> = ({
  imageInfo,
  previewRect,
  containerRef,
  onHorizontalLinesChange,
  onVerticalLinesChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // 缓存实时数据
  const linesRef = useRef({
    h: imageInfo?.horizontalLines || [],
    v: imageInfo?.verticalLines || []
  });

  const [dragging, setDragging] = useState<{ type: "h" | "v"; index: number } | null>(null);
  const [hovering, setHovering] = useState<{ type: "h" | "v"; index: number } | null>(null);

  useEffect(() => {
    linesRef.current = {
      h: imageInfo?.horizontalLines || [],
      v: imageInfo?.verticalLines || []
    };
  }, [imageInfo?.horizontalLines, imageInfo?.verticalLines]);

  // 获取实时校准后的鼠标坐标与边界
  const getCalibration = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;

    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const x = (rect.width - w) / 2;
    const y = (rect.height - h) / 2;

    return { rect, bounds: { x, y, w, h } };
  }, []);

  const drawGridPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imageRef.current;
    const dpr = window.devicePixelRatio || 1;
    
    // 强制使用 CSS 容器的实时尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.save();
    ctx.scale(dpr, dpr);

    if (!img) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.restore();
      return;
    }

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, rect.width, rect.height);

    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    const x = (rect.width - scaledWidth) / 2;
    const y = (rect.height - scaledHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    const { h: horizontalLines, v: verticalLines } = linesRef.current;

    const drawLine = (pos: number, type: 'h' | 'v', index: number) => {
      const isDragging = dragging?.type === type && dragging?.index === index;
      const isHovering = hovering?.type === type && hovering?.index === index;
      const isSelected = isDragging || isHovering;

      ctx.beginPath();
      if (type === 'v') {
        const lineX = x + scaledWidth * pos;
        ctx.moveTo(lineX, y);
        ctx.lineTo(lineX, y + scaledHeight);
      } else {
        const lineY = y + scaledHeight * pos;
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + scaledWidth, lineY);
      }

      // 选中的线变亮黄色
      ctx.strokeStyle = isSelected ? "#fbbf24" : "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      // 发光热区
      ctx.setLineDash([]);
      ctx.fillStyle = isSelected ? "rgba(251, 191, 36, 0.4)" : "rgba(34, 211, 238, 0.25)";
      if (type === 'v') {
        ctx.fillRect(x + scaledWidth * pos - 4, y, 8, scaledHeight);
      } else {
        ctx.fillRect(x, y + scaledHeight * pos - 4, scaledWidth, 8);
      }
    };

    verticalLines.forEach((pos, i) => drawLine(pos, 'v', i));
    horizontalLines.forEach((pos, i) => drawLine(pos, 'h', i));

    // 绘制信息文本... (保持之前的块显示逻辑)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const vPoints = [0, ...verticalLines, 1].sort((a, b) => a - b);
    const hPoints = [0, ...horizontalLines, 1].sort((a, b) => a - b);
    for (let i = 0; i < hPoints.length - 1; i++) {
      for (let j = 0; j < vPoints.length - 1; j++) {
        const cellX = x + scaledWidth * vPoints[j];
        const cellY = y + scaledHeight * hPoints[i];
        const cellW = scaledWidth * (vPoints[j+1] - vPoints[j]);
        const cellH = scaledHeight * (hPoints[i+1] - hPoints[i]);
        const centerX = cellX + cellW / 2;
        const centerY = cellY + cellH / 2;
        const realW = Math.floor(img.naturalWidth * (vPoints[j+1] - vPoints[j]));
        const realH = Math.floor(img.naturalHeight * (hPoints[i+1] - hPoints[i]));
        if (cellW > 50 && cellH > 40) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(centerX - 35, centerY - 15, 70, 30, 4);
          else ctx.rect(centerX - 35, centerY - 15, 70, 30);
          ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "500 11px sans-serif";
          ctx.fillText(`${realW}×${realH}`, centerX, centerY - 6);
          ctx.font = "9px sans-serif"; ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fillText(`块 ${i * (vPoints.length - 1) + j + 1}`, centerX, centerY + 8);
        }
      }
    }
    ctx.restore();
  }, [dragging, hovering, previewRect]);

  useEffect(() => {
    if (imageInfo?.thumbnailUrl) {
      const img = new Image();
      img.src = imageInfo.thumbnailUrl;
      img.onload = () => { imageRef.current = img; drawGridPreview(); };
    } else {
      imageRef.current = null; drawGridPreview();
    }
  }, [imageInfo?.thumbnailUrl, drawGridPreview]);

  useEffect(() => { drawGridPreview(); }, [imageInfo?.horizontalLines, imageInfo?.verticalLines, previewRect, drawGridPreview]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const calib = getCalibration();
    if (!calib) return;
    const { rect, bounds } = calib;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 优先检测横线，且扩大判定区
    for (let i = linesRef.current.h.length - 1; i >= 0; i--) {
      const lineY = bounds.y + bounds.h * linesRef.current.h[i];
      if (Math.abs(mouseY - lineY) < 16) {
        setDragging({ type: "h", index: i });
        return;
      }
    }
    for (let i = linesRef.current.v.length - 1; i >= 0; i--) {
      const lineX = bounds.x + bounds.w * linesRef.current.v[i];
      if (Math.abs(mouseX - lineX) < 16) {
        setDragging({ type: "v", index: i });
        return;
      }
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const calib = getCalibration();
    if (!calib) return;
    const { rect, bounds } = calib;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 处理悬停
    let found = false;
    for (let i = linesRef.current.h.length - 1; i >= 0; i--) {
      const lineY = bounds.y + bounds.h * linesRef.current.h[i];
      if (Math.abs(mouseY - lineY) < 16) {
        setHovering({ type: "h", index: i });
        if (canvasRef.current) canvasRef.current.style.cursor = "ns-resize";
        found = true; break;
      }
    }
    if (!found) {
      for (let i = linesRef.current.v.length - 1; i >= 0; i--) {
        const lineX = bounds.x + bounds.w * linesRef.current.v[i];
        if (Math.abs(mouseX - lineX) < 16) {
          setHovering({ type: "v", index: i });
          if (canvasRef.current) canvasRef.current.style.cursor = "ew-resize";
          found = true; break;
        }
      }
    }
    if (!found) {
      setHovering(null);
      if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
    }

    // 处理拖拽
    if (!dragging) return;
    if (dragging.type === "v") {
      const val = Math.max(0.001, Math.min(0.999, (mouseX - bounds.x) / bounds.w));
      const next = [...linesRef.current.v];
      next[dragging.index] = val;
      onVerticalLinesChange?.(next);
    } else {
      const val = Math.max(0.001, Math.min(0.999, (mouseY - bounds.y) / bounds.h));
      const next = [...linesRef.current.h];
      next[dragging.index] = val;
      onHorizontalLinesChange?.(next);
    }
  }, [dragging, onHorizontalLinesChange, onVerticalLinesChange, getCalibration]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      if (dragging.type === "v") onVerticalLinesChange?.([...linesRef.current.v].sort((a, b) => a - b));
      else onHorizontalLinesChange?.([...linesRef.current.h].sort((a, b) => a - b));
      setDragging(null);
    }
  }, [dragging, onHorizontalLinesChange, onVerticalLinesChange]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    const calib = getCalibration();
    if (!calib) return;
    const { rect, bounds } = calib;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    for (let i = linesRef.current.h.length - 1; i >= 0; i--) {
      if (Math.abs(mouseY - (bounds.y + bounds.h * linesRef.current.h[i])) < 16) {
        onHorizontalLinesChange?.(linesRef.current.h.filter((_, idx) => idx !== i));
        return;
      }
    }
    for (let i = linesRef.current.v.length - 1; i >= 0; i--) {
      if (Math.abs(mouseX - (bounds.x + bounds.w * linesRef.current.v[i])) < 16) {
        onVerticalLinesChange?.(linesRef.current.v.filter((_, idx) => idx !== i));
        return;
      }
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col items-center justify-center border-t border-slate-800 bg-black p-4 min-h-0"
    >
      <div
        className="relative shadow-2xl shadow-black rounded-sm overflow-hidden border border-slate-800 bg-black"
        style={{ width: previewRect.width, height: previewRect.height }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: 'block' }} />
        {dragging && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-1 rounded border border-amber-500/50 backdrop-blur-sm">
              正在挪动切割线...
            </div>
          </div>
        )}
      </div>
      {imageInfo && (
        <div className="text-center mt-2 text-xs text-slate-500 whitespace-nowrap">
          <span className="text-cyan-400 font-medium font-sans tracking-wide">多宫格裁切预览</span>
          <span className="mx-2 text-slate-800">|</span>
          <span className="text-slate-400">亮黄色为选中状态，支持拖拽和双击删除</span>
        </div>
      )}
    </div>
  );
};

export default GridPreview;
