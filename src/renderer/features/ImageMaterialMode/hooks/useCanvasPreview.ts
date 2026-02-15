import { useEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";

/**
 * 预览尺寸模式
 */
export type PreviewSizeMode = "cover" | "fill" | "inside";

/**
 * 导出选项
 */
export interface ExportOptions {
  single: boolean;
  grid: boolean;
}

/**
 * Logo 位置
 */
export interface LogoPosition {
  x: number;
  y: number;
}

interface UseCanvasPreviewOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  previewImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  previewSizeMode: PreviewSizeMode;
  logoPosition: LogoPosition;
  logoScale: number;
  exportOptions: ExportOptions;
  baseSize: number;
}

interface UseCanvasPreviewReturn {
  drawPreview: () => void;
  previewTrigger: number;
  setPreviewTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export const useCanvasPreview = ({
  canvasRef,
  previewImage,
  logoImage,
  previewSizeMode,
  logoPosition,
  logoScale,
  exportOptions,
  baseSize,
}: UseCanvasPreviewOptions): UseCanvasPreviewReturn => {
  const previewTriggerRef = useRef(0);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, baseSize, baseSize);

    if (previewImage) {
      if (previewSizeMode === "fill") {
        ctx.drawImage(previewImage, 0, 0, baseSize, baseSize);
      } else if (previewSizeMode === "cover") {
        const size = Math.min(previewImage.width, previewImage.height);
        const sx = (previewImage.width - size) / 2;
        const sy = (previewImage.height - size) / 2;
        ctx.drawImage(previewImage, sx, sy, size, size, 0, 0, baseSize, baseSize);
      } else {
        const scale = Math.min(baseSize / previewImage.width, baseSize / previewImage.height);
        const w = previewImage.width * scale;
        const h = previewImage.height * scale;
        const x = (baseSize - w) / 2;
        const y = (baseSize - h) / 2;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, baseSize, baseSize);
        ctx.drawImage(previewImage, x, y, w, h);
      }
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, baseSize, baseSize);
      ctx.strokeStyle = "#1e293b";
      ctx.strokeRect(0, 0, baseSize, baseSize);
    }

    if (exportOptions.grid) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(baseSize / 3, 0);
      ctx.lineTo(baseSize / 3, baseSize);
      ctx.moveTo((baseSize * 2) / 3, 0);
      ctx.lineTo((baseSize * 2) / 3, baseSize);
      ctx.moveTo(0, baseSize / 3);
      ctx.lineTo(baseSize, baseSize / 3);
      ctx.moveTo(0, (baseSize * 2) / 3);
      ctx.lineTo(baseSize, (baseSize * 2) / 3);
      ctx.stroke();
    }

    if (logoImage) {
      const w = logoImage.width * logoScale;
      const h = logoImage.height * logoScale;

      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.strokeRect(logoPosition.x, logoPosition.y, w, h);

      ctx.drawImage(logoImage, logoPosition.x, logoPosition.y, w, h);
      ctx.restore();
    }
  }, [
    canvasRef,
    previewImage,
    logoImage,
    previewSizeMode,
    logoPosition,
    logoScale,
    exportOptions.grid,
    baseSize,
  ]);

  const setPreviewTrigger = useCallback((prev: number | ((prev: number) => number)) => {
    previewTriggerRef.current = typeof prev === "function" ? prev(previewTriggerRef.current) : prev;
  }, []);

  useEffect(() => {
    drawPreview();
  }, [
    logoImage,
    logoPosition,
    logoScale,
    exportOptions,
    previewSizeMode,
  ]);

  return {
    drawPreview,
    previewTrigger: previewTriggerRef.current,
    setPreviewTrigger,
  };
};
