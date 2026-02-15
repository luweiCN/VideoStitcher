import React from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

/**
 * 导出选项
 */
interface ExportOptions {
  single: boolean;
  grid: boolean;
}

interface ExportOptionsPanelProps {
  value: ExportOptions;
  onChange: (options: ExportOptions) => void;
}

const ExportOptionsPanel: React.FC<ExportOptionsPanelProps> = ({
  value,
  onChange,
}) => {
  const handleSingleChange = (checked: boolean) => {
    onChange({ ...value, single: checked });
  };

  const handleGridChange = (checked: boolean) => {
    onChange({ ...value, grid: checked });
  };

  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-3 space-y-2">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        导出选项
      </h3>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <Checkbox.Root
          className="w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=unchecked]:border-slate-600 data-[state=unchecked]:bg-black/50"
          checked={value.single}
          onCheckedChange={handleSingleChange}
        >
          <Checkbox.Indicator className="text-white">
            <Check className="w-3 h-3" strokeWidth={3} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <span className="text-sm text-slate-300">单张完整图</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <Checkbox.Root
          className="w-4 h-4 rounded flex items-center justify-center border transition-all cursor-pointer data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 data-[state=unchecked]:border-slate-600 data-[state=unchecked]:bg-black/50"
          checked={value.grid}
          onCheckedChange={handleGridChange}
        >
          <Checkbox.Indicator className="text-white">
            <Check className="w-3 h-3" strokeWidth={3} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <span className="text-sm text-slate-300">九宫格切片</span>
      </label>
    </div>
  );
};

export type { ExportOptions };
export default ExportOptionsPanel;
