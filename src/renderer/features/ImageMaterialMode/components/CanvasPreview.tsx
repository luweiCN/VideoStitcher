import React from "react";

interface CanvasPreviewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewSize: number;
  baseSize: number;
  hasLogo: boolean;
  onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
}

const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  canvasRef,
  previewSize,
  baseSize,
  hasLogo,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div
        className="relative shadow-2xl shadow-black rounded-sm overflow-hidden border border-slate-800 bg-black"
        style={{ width: previewSize, height: previewSize }}
      >
        <canvas
          ref={canvasRef}
          width={baseSize}
          height={baseSize}
          style={{
            width: "100%",
            height: "100%",
            cursor: hasLogo ? "move" : "default",
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        />
      </div>
    </div>
  );
};

export default CanvasPreview;
