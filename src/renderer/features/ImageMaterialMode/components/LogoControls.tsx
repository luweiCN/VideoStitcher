import React from "react";
import * as Slider from "@radix-ui/react-slider";
import { Move } from "lucide-react";

interface LogoControlsProps {
  logoImage: HTMLImageElement | null;
  logoScale: number;
  onScaleChange: (value: number) => void;
  onScaleCommit?: (value: number) => void;
}

const LogoControls: React.FC<LogoControlsProps> = ({
  logoImage,
  logoScale,
  onScaleChange,
  onScaleCommit,
}) => {
  if (!logoImage) return null;

  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
          <Move className="w-3 h-3" /> Logo 调整
        </div>
        <span className="text-xs text-amber-400 font-mono">
          {(logoScale * 100).toFixed(0)}%
        </span>
      </div>
      <Slider.Root
        className="relative flex items-center select-none touch-none h-4"
        value={[logoScale]}
        onValueChange={([value]) => onScaleChange(value)}
        onValueCommit={([value]) => onScaleCommit?.(value)}
        min={0.1}
        max={3}
        step={0.1}
      >
        <Slider.Track className="bg-slate-800 relative grow rounded-full h-1.5">
          <Slider.Range className="absolute h-full rounded-full bg-amber-500" />
        </Slider.Track>
        <Slider.Thumb
          className="block w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all cursor-grab active:cursor-grabbing"
          aria-label="Logo 缩放"
        />
      </Slider.Root>
    </div>
  );
};

export default LogoControls;
