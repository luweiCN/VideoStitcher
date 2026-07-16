import React from "react";
import { Image as ImageIcon, Layers3, Scissors, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useImageWorkshopMode,
  type ImageWorkshopMode,
} from "./ImageWorkshopModeContext";

export type { ImageWorkshopMode } from "./ImageWorkshopModeContext";

interface ImageWorkshopModeSwitcherProps {
  mode: ImageWorkshopMode;
}

/** 图片素材工坊模式切换器，明确隔离标准素材和专业切片两套流程。 */
const ImageWorkshopModeSwitcher: React.FC<ImageWorkshopModeSwitcherProps> = ({ mode }) => {
  const navigate = useNavigate();
  const workshopMode = useImageWorkshopMode();
  const activeMode = workshopMode?.mode ?? mode;

  const switchMode = (nextMode: ImageWorkshopMode) => {
    if (workshopMode) {
      workshopMode.setMode(nextMode);
      return;
    }

    navigate(`/imageWorkshop?mode=${nextMode}`, { replace: true });
  };

  return (
    <div
      className="image-workshop-mode-switcher flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-950/70 p-1"
      aria-label="图片素材工坊模式"
    >
      <button
        type="button"
        onClick={() => switchMode("standard")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
          activeMode === "standard"
            ? "metal-primary image-workshop-mode-active bg-[#FF385C] text-white shadow-[0_4px_12px_rgba(255,56,92,0.28)]"
            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        }`}
        style={activeMode === "standard" ? { backgroundColor: "#FF385C", color: "#FFFFFF" } : undefined}
        title="标准素材生产：尺寸、Logo、标准九宫格与压缩"
      >
        <Sparkles className="h-3.5 w-3.5" />
        标准素材
      </button>
      <button
        type="button"
        onClick={() => switchMode("lossless")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
          activeMode === "lossless"
            ? "metal-primary image-workshop-mode-active bg-[#FF385C] text-white shadow-[0_4px_12px_rgba(255,56,92,0.28)]"
            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        }`}
        style={activeMode === "lossless" ? { backgroundColor: "#FF385C", color: "#FFFFFF" } : undefined}
        title="专业切片：自定义切线、原尺寸提取与无损输出"
      >
        <Scissors className="h-3.5 w-3.5" />
        专业切片
      </button>
      <button
        type="button"
        onClick={() => switchMode("cover")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
          activeMode === "cover"
            ? "metal-primary image-workshop-mode-active bg-[#FF385C] text-white shadow-[0_4px_12px_rgba(255,56,92,0.28)]"
            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        }`}
        style={activeMode === "cover" ? { backgroundColor: "#FF385C", color: "#FFFFFF" } : undefined}
        title="封面工具：格式转换与压缩优化"
      >
        <ImageIcon className="h-3.5 w-3.5" />
        封面工具
      </button>
      <button
        type="button"
        onClick={() => switchMode("overlay")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
          activeMode === "overlay"
            ? "metal-primary image-workshop-mode-active bg-[#FF385C] text-white shadow-[0_4px_12px_rgba(255,56,92,0.28)]"
            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        }`}
        style={activeMode === "overlay" ? { backgroundColor: "#FF385C", color: "#FFFFFF" } : undefined}
        title="贴片生成器：批量制作竖版与横版透明视频贴片"
      >
        <Layers3 className="h-3.5 w-3.5" />
        贴片生成器
      </button>
    </div>
  );
};

export default ImageWorkshopModeSwitcher;
