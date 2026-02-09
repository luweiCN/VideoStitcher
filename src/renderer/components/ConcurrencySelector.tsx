import React, { useEffect, useState } from 'react';
import { Zap, Cpu } from 'lucide-react';

interface ConcurrencySelectorProps {
  /** 当前并发数 */
  value: number;
  /** 并发数变化回调 */
  onChange: (value: number) => void;
  /** 最大值（如果不提供，会自动获取系统信息） */
  max?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 是否紧凑模式 */
  compact?: boolean;
  /** 是否显示滑块 */
  showSlider?: boolean;
  /** 自定义主题色 */
  themeColor?: string;
}

/**
 * 并发线程数选择组件
 *
 * 用于各功能模块设置并发处理线程数
 * - 显示当前值和系统推荐值
 * - 支持数字输入和滑块调节
 * - 自动获取系统 CPU 信息计算推荐值
 */
const ConcurrencySelector: React.FC<ConcurrencySelectorProps> = ({
  value,
  onChange,
  max: propMax,
  disabled = false,
  className = '',
  compact = false,
  showSlider = false,
  themeColor = 'violet',
}) => {
  const [systemMax, setSystemMax] = useState(4);
  const [recommended, setRecommended] = useState(2);

  // 获取系统信息
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const memInfo = await window.api.getSystemMemory();
        const cpuCount = memInfo?.cpuCount || 4;
        const calculatedMax = Math.max(1, cpuCount - 1);
        const calculatedRecommended = Math.max(1, Math.floor(cpuCount / 2));

        setSystemMax(calculatedMax);
        setRecommended(calculatedRecommended);
      } catch (err) {
        console.error('获取系统信息失败:', err);
      }
    };

    fetchSystemInfo();
  }, []);

  const effectiveMax = propMax || systemMax;
  const effectiveRecommended = propMax ? Math.max(1, Math.floor(propMax / 2)) : recommended;

  // 紧凑模式：只显示数字输入
  if (compact) {
    return (
      <div className={className}>
        <label className="text-xs font-medium text-slate-400 mb-1 block">并发进程</label>
        <input
          type="number"
          min="1"
          max={effectiveMax}
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(effectiveMax, parseInt(e.target.value) || 1)))}
          disabled={disabled}
          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-center text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-[9px] text-slate-500 mt-1">推荐: {effectiveRecommended}</p>
      </div>
    );
  }

  // 标准模式：带滑块
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-400">并发进程数</label>
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] text-slate-500">推荐: {effectiveRecommended}</span>
        </div>
      </div>

      {showSlider ? (
        <>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max={effectiveMax}
              value={value}
              onChange={(e) => onChange(parseInt(e.target.value) || 1)}
              disabled={disabled}
              className={`flex-1 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-${themeColor}-600 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-${themeColor}-900/30
              `}
            />
            <input
              type="number"
              min="1"
              max={effectiveMax}
              value={value}
              onChange={(e) => onChange(Math.max(1, Math.min(effectiveMax, parseInt(e.target.value) || 1)))}
              disabled={disabled}
              className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-center text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-slate-500">
            <span>1</span>
            <span className={`text-${themeColor}-400`}>{effectiveRecommended}</span>
            <span>{effectiveMax}</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900/50 rounded-lg px-3 py-1.5 border border-slate-800">
              <Zap className="w-3.5 h-3.5 text-slate-400" />
              <span className={`text-lg font-bold text-${themeColor}-400`}>{value}</span>
            </div>
            <span className="text-xs text-slate-500">/ {effectiveMax} 线程</span>
          </div>
          <input
            type="range"
            min="1"
            max={effectiveMax}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 1)}
            disabled={disabled}
            className={`w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-${themeColor}-600 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
              [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-${themeColor}-900/30
            `}
          />
          <div className="flex justify-between mt-1.5 text-[9px] text-slate-500">
            <span>1 线程</span>
            <span className={`text-${themeColor}-400`}>推荐: {effectiveRecommended}</span>
            <span>{effectiveMax} 线程</span>
          </div>
        </>
      )}
    </div>
  );
};

export default ConcurrencySelector;
