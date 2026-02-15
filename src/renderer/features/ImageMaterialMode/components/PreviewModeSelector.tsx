import React from "react";

/**
 * 预览尺寸模式
 */
export type PreviewSizeMode = "cover" | "fill" | "inside";

/**
 * 预览尺寸模式配置
 */
const PREVIEW_SIZE_MODES: Record<
  PreviewSizeMode,
  { name: string; desc: string }
> = {
  cover: { name: "裁剪正方形", desc: "裁剪为800x800正方形（取中心）" },
  fill: { name: "拉伸填充", desc: "强制拉伸到800x800（可能变形）" },
  inside: { name: "保持比例", desc: "按比例缩放，留白填充" },
};

interface PreviewModeSelectorProps {
  value: PreviewSizeMode;
  onChange: (mode: PreviewSizeMode) => void;
}

const PreviewModeSelector: React.FC<PreviewModeSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-2">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        预览模式
      </h3>
      <div className="space-y-2">
        {(Object.keys(PREVIEW_SIZE_MODES) as PreviewSizeMode[]).map(
          (mode) => (
            <button
              key={mode}
              onClick={() => onChange(mode)}
              className={`w-full p-3 rounded-lg border text-left transition-all text-sm ${
                value === mode
                  ? "border-amber-500 bg-amber-500/20 text-amber-400"
                  : "border-slate-800 bg-black/50 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="font-medium">
                {PREVIEW_SIZE_MODES[mode].name}
              </div>
              <div className="text-xs opacity-70 mt-0.5">
                {PREVIEW_SIZE_MODES[mode].desc}
              </div>
            </button>
          ),
        )}
      </div>
    </div>
  );
};

export { PREVIEW_SIZE_MODES };
export default PreviewModeSelector;
