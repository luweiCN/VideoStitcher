import React, { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * 输入源配置
 */
export interface TaskSource {
  /** 源名称（如 A、B、C） */
  name: string;
  /** 当前数量 */
  count: number;
  /** 主题色（Tailwind 类名） */
  color: string;
  /** 是否必选 */
  required: boolean;
}

interface TaskCountSliderProps {
  /** 当前选择的任务数量 */
  value: number;
  /** 最大任务数量 */
  max: number;
  /** 值变化回调 */
  onChange: (value: number) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 输入源配置列表 */
  sources: TaskSource[];
  /** 标题 */
  title?: string;
  /** 主题色 */
  themeColor?: string;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  violet: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  pink: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
};

/**
 * 任务数量选择器组件
 *
 * 通用组件，支持多个输入源的组合计算
 * - 支持必选/非必选源
 * - 只要有必选源有数量就开始计算
 * - 非必选源有数量后重新计算
 */
export const TaskCountSlider: React.FC<TaskCountSliderProps> = ({
  value,
  max,
  onChange,
  disabled = false,
  sources,
  title = '生成数量',
  themeColor = 'pink',
}) => {
  const [inputValue, setInputValue] = useState(String(value));
  
  // 同步外部 value 变化
  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const allRequiredHaveCount = sources.filter(s => s.required).every(s => s.count > 0);
  const canGenerate = allRequiredHaveCount && max > 0;
  const themeColors = colorMap[themeColor] || colorMap.pink;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInputValue(newVal);
  };

  const handleInputBlur = () => {
    const newValue = parseInt(inputValue, 10);
    if (isNaN(newValue) || newValue < 1) {
      setInputValue(String(value));
      onChange(1);
    } else if (newValue > max) {
      setInputValue(String(max));
      onChange(max);
    } else {
      setInputValue(String(newValue));
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  const adjust = (delta: number) => {
    const newValue = value + delta;
    if (newValue >= 1 && newValue <= max) {
      onChange(newValue);
    }
  };

  // 未选择素材时的空状态
  if (!canGenerate) {
    const missingRequired = sources.filter(s => s.required && s.count === 0).map(s => s.name);
    return (
      <div className="bg-black/40 border border-slate-800/60 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">{title}</span>
          <div className="flex items-center gap-1">
            {sources.map((source) => {
              const colors = colorMap[source.color] || colorMap.pink;
              return (
                <span
                  key={source.name}
                  className={`px-2 py-0.5 rounded text-sm font-medium ${colors.bg} ${colors.text} ${source.count === 0 ? 'opacity-40' : ''}`}
                >
                  {source.name}×{source.count}
                </span>
              );
            })}
          </div>
        </div>
        <div className="mt-2 text-center text-sm text-slate-500 py-2">
          {missingRequired.length > 0 ? `请选择 ${missingRequired.join('、')} 素材` : '请选择素材'}
        </div>
      </div>
    );
  }

  // 正常状态
  return (
    <div className="bg-black/40 border border-slate-800/60 rounded-lg p-3 space-y-2">
      {/* 顶部：标题 + 源标签 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{title}</span>
        <div className="flex items-center gap-0.5">
          {sources.map((source, index) => {
            const colors = colorMap[source.color] || colorMap.pink;
            return (
              <React.Fragment key={source.name}>
                {index > 0 && <span className="text-slate-600 text-sm mx-0.5">×</span>}
                <span
                  className={`px-1.5 py-0.5 rounded text-sm font-medium ${colors.bg} ${colors.text}`}
                >
                  {source.name}×{source.count}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 中间：数字控制器 */}
      <div className="flex items-center justify-center gap-2">
        {/* 减少按钮 */}
        <button
          onClick={() => adjust(-1)}
          disabled={disabled || value <= 1}
          className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50
                     flex items-center justify-center text-slate-400
                     hover:bg-slate-700/80 hover:text-slate-200
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* 数字输入 */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              min={1}
              max={max}
              className={`w-20 h-10 bg-slate-900 border border-slate-700/70 rounded-lg
                         text-center text-2xl font-mono font-bold ${themeColors.text}
                         focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/30
                         disabled:opacity-50 disabled:cursor-not-allowed
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                         [&::-webkit-inner-spin-button]:appearance-none`}
            />
          </div>
        </div>

        {/* 增加按钮 */}
        <button
          onClick={() => adjust(1)}
          disabled={disabled || value >= max}
          className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50
                     flex items-center justify-center text-slate-400
                     hover:bg-slate-700/80 hover:text-slate-200
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 底部：最大值提示 */}
      <div className="text-center">
        <span className="text-sm text-slate-500">
          最大 <span className="text-slate-400 font-mono">{max}</span> 个
        </span>
      </div>
    </div>
  );
};

export default TaskCountSlider;
