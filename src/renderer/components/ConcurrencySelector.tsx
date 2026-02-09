import React, { useEffect, useState, useMemo } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Zap, Cpu, Check, AlertTriangle, Lightbulb } from 'lucide-react';

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
  /** 自定义主题色 */
  themeColor?: string;
}

// 主题色配置
const themeColors = {
  cyan: {
    primary: 'cyan',
    gradient: 'from-cyan-500 to-blue-500',
    shadow: 'shadow-cyan-500/30',
    track: 'bg-cyan-500',
  },
  pink: {
    primary: 'pink',
    gradient: 'from-pink-500 to-rose-500',
    shadow: 'shadow-pink-500/30',
    track: 'bg-pink-500',
  },
  violet: {
    primary: 'violet',
    gradient: 'from-violet-500 to-purple-500',
    shadow: 'shadow-violet-500/30',
    track: 'bg-violet-500',
  },
  rose: {
    primary: 'rose',
    gradient: 'from-rose-500 to-red-500',
    shadow: 'shadow-rose-500/30',
    track: 'bg-rose-500',
  },
  amber: {
    primary: 'amber',
    gradient: 'from-amber-500 to-orange-500',
    shadow: 'shadow-amber-500/30',
    track: 'bg-amber-500',
  },
  emerald: {
    primary: 'emerald',
    gradient: 'from-emerald-500 to-green-500',
    shadow: 'shadow-emerald-500/30',
    track: 'bg-emerald-500',
  },
  fuchsia: {
    primary: 'fuchsia',
    gradient: 'from-fuchsia-500 to-pink-500',
    shadow: 'shadow-fuchsia-500/30',
    track: 'bg-fuchsia-500',
  },
  slate: {
    primary: 'slate',
    gradient: 'from-slate-500 to-gray-500',
    shadow: 'shadow-slate-500/30',
    track: 'bg-slate-500',
  },
} as const;

/**
 * 并发线程数选择组件 - 使用 Radix UI Slider
 *
 * 用于各功能模块设置并发处理线程数
 * - 基于系统 CPU 核心数自动计算合理范围
 * - Radix UI Slider 提供完整的键盘导航和无障碍支持
 * - 智能推荐值和性能提示
 */
const ConcurrencySelector: React.FC<ConcurrencySelectorProps> = ({
  value,
  onChange,
  max: propMax,
  disabled = false,
  className = '',
  themeColor = 'violet',
}) => {
  const [systemCpuCount, setSystemCpuCount] = useState(4);
  const [isAnimating, setIsAnimating] = useState(false);

  const theme = themeColors[themeColor as keyof typeof themeColors] || themeColors.violet;

  // 获取系统 CPU 核心数
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const memInfo = await window.api.getSystemMemory();
        const cpuCount = memInfo?.cpuCount || navigator.hardwareConcurrency || 4;
        setSystemCpuCount(cpuCount);
      } catch (err) {
        const cpuCount = navigator.hardwareConcurrency || 4;
        setSystemCpuCount(cpuCount);
      }
    };

    fetchSystemInfo();
  }, []);

  // 计算最大值和推荐值（方案C）
  const effectiveMax = propMax || Math.min(systemCpuCount, 16);
  const recommended = Math.max(1, Math.floor(systemCpuCount / 2));

  // 性能等级和建议
  const performanceLevel = useMemo(() => {
    const ratio = value / effectiveMax;
    if (ratio <= 0.4) {
      return {
        label: '节能',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        tip: '低 CPU 占用，适合后台运行'
      };
    }
    if (ratio <= 0.7) {
      return {
        label: '平衡',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        tip: '性能与响应的最佳平衡'
      };
    }
    return {
      label: '极速',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      tip: '最大处理速度，系统可能变慢'
    };
  }, [value, effectiveMax]);

  // 处理值变化
  const handleValueChange = (values: number[]) => {
    const newValue = values[0];
    if (newValue !== value) {
      setIsAnimating(true);
      onChange(newValue);
      setTimeout(() => setIsAnimating(false), 200);
    }
  };

  return (
    <div className={className}>
      {/* 标签栏 */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3 h-3" />
          并发进程
        </label>
        <div className="flex items-center gap-1.5">
          {/* 性能徽章 */}
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${performanceLevel.bg} ${performanceLevel.color} ${performanceLevel.borderColor} border`}>
            {performanceLevel.label}
          </span>
        </div>
      </div>

      {/* 滑轨容器 */}
      <div className="bg-slate-900/50 rounded-xl px-3 pt-3 pb-5 border border-slate-800">
        {/* 值显示 */}
        <div className="flex items-center justify-between mb-3">
          <div className={`
            px-3 py-1.5 rounded-lg font-mono font-bold text-lg
            bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent
            transition-transform duration-200
            ${isAnimating ? 'scale-125' : ''}
          `}>
            {value}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">最大: {effectiveMax}</span>

            {/* 信息提示按钮 */}
            <Tooltip.Provider delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    className={`
                      p-1 rounded
                      flex items-center justify-center
                      transition-all duration-200
                      text-${theme.primary}-400
                      hover:text-${theme.primary}-300
                      hover:bg-${theme.primary}-500/10
                      cursor-pointer
                    `}
                  >
                    {/* 信息图标 */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    align="end"
                    sideOffset={8}
                    className="z-50"
                  >
                    <div className="px-4 py-3.5 bg-slate-950/95 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-2xl max-w-[360px]">
                      {/* 标题 */}
                      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-800">
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center
                          bg-${theme.primary}-500/20
                        `}>
                          <svg className="w-3.5 h-3.5 text-${theme.primary}-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                        </div>
                        <span className="text-sm font-bold text-slate-200">线程设置指南</span>
                      </div>

                      {/* 内容列表 */}
                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-slate-200 font-medium">推荐值 {recommended} (CPU 核心数 ÷ 2)</span>
                            <span className="text-slate-400 block mt-0.5">平衡性能与响应</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-slate-200 font-medium">
                              最大值 {effectiveMax} (CPU 核心数但最高不超过 16)
                            </span>
                            <span className="text-slate-400 block mt-0.5">最快速度，系统可能变慢</span>
                          </div>
                        </div>
                        {effectiveMax === 16 && (
                          <div className={`
                            mt-1 p-2 rounded-lg border
                            bg-amber-500/10 border-amber-500/30
                          `}>
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-amber-200 leading-snug">
                                达安全上限，可能导致系统卡顿或应用无响应
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 底部建议 */}
                      <div className="mt-3 pt-2 border-t border-slate-800 space-y-2">
                        <p className="text-xs text-slate-400 flex items-start gap-1.5 leading-relaxed">
                          <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                          <span>日常使用推荐值，批量任务可适当提高</span>
                        </p>
                        <p className="text-xs text-slate-400 flex items-start gap-1.5 leading-relaxed">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                          <span>视频和图片处理是 CPU、内存和硬盘密集型任务。线程数过高时，即使 CPU 核心充足，也可能因内存容量或硬盘 I/O 瓶颈导致处理速度下降，甚至应用崩溃。请根据实际机器性能谨慎设置。</span>
                        </p>
                      </div>
                    </div>
                    <Tooltip.Arrow className="fill-slate-950/95" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
        </div>

        {/* Radix UI Slider */}
        <Slider.Root
          className="relative flex items-center select-none touch-none h-5"
          value={[value]}
          onValueChange={handleValueChange}
          max={effectiveMax}
          min={1}
          step={1}
          disabled={disabled}
        >
          <Slider.Track className="bg-slate-800 relative grow rounded-full h-2 shadow-inner">
            <Slider.Range className={`
              absolute h-full rounded-full
              bg-gradient-to-r ${theme.gradient}
              relative
            `}>
              {/* 光晕效果 */}
              <div className={`
                absolute inset-0 bg-gradient-to-r ${theme.gradient}
                blur-sm opacity-50
              `} />
            </Slider.Range>
          </Slider.Track>
          {/* 主题色拇指 */}
          <Slider.Thumb
            className={`
              block w-3 h-3 rounded-full
              bg-${theme.primary}-500
              hover:scale-125 focus:outline-none focus:scale-125 active:scale-110
              transition-transform duration-150
              shadow-lg ${theme.shadow}
              cursor-grab active:cursor-grabbing
            `}
            aria-label="并发线程数"
          />
        </Slider.Root>

        {/* 刻度 */}
        <Tooltip.Provider delayDuration={300}>
          <div className="relative mt-1.5 text-[9px] font-mono">
            {/* 最小值 */}
            <span className="absolute left-0 text-slate-600">1</span>

            {/* 推荐值 - 真实位置 */}
            <span
              className={`
                absolute -translate-x-1/2
                text-${theme.primary}-400 font-bold
              `}
              style={{ left: `${((recommended - 1) / (effectiveMax - 1)) * 100}%` }}
            >
              {recommended} 推荐
            </span>

            {/* 最大值 */}
            <span className={`
              absolute right-0
              text-${theme.primary}-400 font-medium
            `}>
              {effectiveMax}
            </span>
          </div>
        </Tooltip.Provider>
      </div>

      {/* 说明文字 */}
      <p className="text-[9px] text-slate-600 mt-2 flex items-center gap-1">
        <Cpu className="w-3 h-3" />
        系统 {systemCpuCount} 核心 · {performanceLevel.tip}
      </p>
    </div>
  );
};

export default ConcurrencySelector;
