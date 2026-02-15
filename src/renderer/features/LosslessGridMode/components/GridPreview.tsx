import React, { useEffect, useRef, useCallback } from "react";

/**
 * 九宫格配置
 */
const GRID_CONFIG = {
  cols: 3,
  rows: 3,
};

/**
 * 画布基础尺寸
 */
const BASE_SIZE = 800;

interface ImageInfo {
  path: string;
  name: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

interface GridPreviewProps {
  imageInfo: ImageInfo | null;
  previewSize: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

const GridPreview: React.FC<GridPreviewProps> = ({
  imageInfo,
  previewSize,
  containerRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const drawGridPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imageRef.current;
    if (!img) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const canvasSize = canvas.width;

    const scale = Math.min(
      canvasSize / img.naturalWidth,
      canvasSize / img.naturalHeight,
    );
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    const x = (canvasSize - scaledWidth) / 2;
    const y = (canvasSize - scaledHeight) / 2;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const gridWidth = scaledWidth / GRID_CONFIG.cols;
    const gridHeight = scaledHeight / GRID_CONFIG.rows;

    ctx.beginPath();
    for (let col = 1; col < GRID_CONFIG.cols; col++) {
      const lineX = x + gridWidth * col;
      ctx.moveTo(lineX, y);
      ctx.lineTo(lineX, y + scaledHeight);
    }
    for (let row = 1; row < GRID_CONFIG.rows; row++) {
      const lineY = y + gridHeight * row;
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + scaledWidth, lineY);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const originalTileWidth = Math.floor(img.naturalWidth / GRID_CONFIG.cols);
    const originalTileHeight = Math.floor(img.naturalHeight / GRID_CONFIG.rows);

    for (let row = 0; row < GRID_CONFIG.rows; row++) {
      for (let col = 0; col < GRID_CONFIG.cols; col++) {
        const cellX = x + gridWidth * col;
        const cellY = y + gridHeight * row;
        const cellCenterX = cellX + gridWidth / 2;
        const cellCenterY = cellY + gridHeight / 2;

        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(cellX + 2, cellY + 2, gridWidth - 4, gridHeight - 4);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(
          `${originalTileWidth}×${originalTileHeight}`,
          cellCenterX,
          cellCenterY - 8,
        );
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(
          `第 ${row * 3 + col + 1} 张`,
          cellCenterX,
          cellCenterY + 10,
        );
      }
    }
  }, []);

  useEffect(() => {
    if (imageInfo?.thumbnailUrl) {
      const img = new Image();
      img.src = imageInfo.thumbnailUrl;
      img.onload = () => {
        imageRef.current = img;
        requestAnimationFrame(() => drawGridPreview());
      };
    } else {
      imageRef.current = null;
      drawGridPreview();
    }
  }, [imageInfo?.thumbnailUrl, drawGridPreview]);

  useEffect(() => {
    drawGridPreview();
  }, [previewSize, drawGridPreview]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col items-center justify-center border-t border-slate-800 bg-black p-4 min-h-0"
    >
      <div
        className="relative shadow-2xl shadow-black rounded-sm overflow-hidden border border-slate-800 bg-black"
        style={{ width: previewSize, height: previewSize }}
      >
        <canvas
          ref={canvasRef}
          width={BASE_SIZE}
          height={BASE_SIZE}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      {imageInfo && (
        <div className="text-center mt-2 text-xs text-slate-500 whitespace-nowrap">
          <span className="text-cyan-400 font-medium">九宫格切割预览</span>
          <span className="mx-2">|</span>
          <span>
            每张约{" "}
            {imageInfo.width
              ? Math.floor(imageInfo.width / 3)
              : "?"}
            ×
            {imageInfo.height ? Math.floor(imageInfo.height / 3) : "?"} 像素
          </span>
        </div>
      )}
    </div>
  );
};

export default GridPreview;
