import React, { useEffect, useRef, useState } from "react";

interface CanvasPreviewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewSize: number;
  baseWidth: number;
  baseHeight: number;
  hasLogo: boolean;
  cursor?: string;
  onPointerDown?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  canvasRef,
  previewSize,
  baseWidth,
  baseHeight,
  hasLogo,
  cursor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: previewSize,
    height: previewSize,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateContainerSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateContainerSize();
    const observer = new ResizeObserver(updateContainerSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const availableWidth = Math.max(1, containerSize.width - 24);
  const availableHeight = Math.max(1, containerSize.height - 24);
  const preferredScale = Math.min(previewSize / baseWidth, previewSize / baseHeight);
  const availableScale = Math.min(availableWidth / baseWidth, availableHeight / baseHeight);
  const displayScale = Math.min(preferredScale, availableScale);
  const displayWidth = Math.round(baseWidth * displayScale);
  const displayHeight = Math.round(baseHeight * displayScale);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 w-full flex items-center justify-center p-3">
      <div
        className="metal-canvas-shell relative shadow-2xl shadow-black rounded-sm overflow-hidden border border-slate-800 bg-black"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <canvas
          ref={canvasRef}
          width={baseWidth}
          height={baseHeight}
          style={{
            width: "100%",
            height: "100%",
            cursor: cursor || (hasLogo ? "move" : "default"),
            touchAction: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
        />
      </div>
    </div>
  );
};

export default CanvasPreview;
