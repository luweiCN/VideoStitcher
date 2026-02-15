import React from "react";

interface QualitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  themeColor?: string;
}

const QualitySelector: React.FC<QualitySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  themeColor = "fuchsia",
}) => {
  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-4">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
        输出质量
      </label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="60"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`flex-1 accent-${themeColor}-500`}
          disabled={disabled}
        />
        <span className="text-sm font-mono bg-slate-800 px-3 py-1 rounded-lg w-16 text-center">
          {value}%
        </span>
      </div>
    </div>
  );
};

export default QualitySelector;
