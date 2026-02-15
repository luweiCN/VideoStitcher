import { useState, useCallback, RefObject } from "react";
import type { MouseEvent } from "react";

/**
 * Logo 位置状态 (相对于 800x800 画布)
 */
export interface LogoPosition {
  x: number;
  y: number;
}

interface UseLogoControlsOptions {
  logoImage: HTMLImageElement | null;
  baseSize: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onDrawPreview: () => void;
}

interface UseLogoControlsReturn {
  logoPosition: LogoPosition;
  logoScale: number;
  isDragging: boolean;
  setLogoPosition: React.Dispatch<React.SetStateAction<LogoPosition>>;
  setLogoScale: React.Dispatch<React.SetStateAction<number>>;
  clearLogo: () => void;
  handleMouseDown: (e: MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: () => void;
}

export const useLogoControls = ({
  logoImage,
  baseSize,
  canvasRef,
  onDrawPreview,
}: UseLogoControlsOptions): UseLogoControlsReturn => {
  const [logoPosition, setLogoPosition] = useState<LogoPosition>({
    x: 50,
    y: 50,
  });
  const [logoScale, setLogoScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const clearLogo = useCallback(() => {
    setLogoPosition({ x: 50, y: 50 });
    setLogoScale(1);
    onDrawPreview();
  }, [onDrawPreview]);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!logoImage || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleFactor = baseSize / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleFactor;
      const mouseY = (e.clientY - rect.top) * scaleFactor;

      const w = logoImage.width * logoScale;
      const h = logoImage.height * logoScale;

      if (
        mouseX >= logoPosition.x &&
        mouseX <= logoPosition.x + w &&
        mouseY >= logoPosition.y &&
        mouseY <= logoPosition.y + h
      ) {
        setIsDragging(true);
        setDragStart({ x: mouseX - logoPosition.x, y: mouseY - logoPosition.y });
      }
    },
    [logoImage, logoScale, logoPosition, baseSize, canvasRef],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !logoImage || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleFactor = baseSize / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleFactor;
      const mouseY = (e.clientY - rect.top) * scaleFactor;

      setLogoPosition({
        x: mouseX - dragStart.x,
        y: mouseY - dragStart.y,
      });
    },
    [isDragging, logoImage, dragStart, baseSize, canvasRef],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    logoPosition,
    logoScale,
    isDragging,
    setLogoPosition,
    setLogoScale,
    clearLogo,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
};
