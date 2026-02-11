import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';

/**
 * 功能信息 Tooltip 组件
 *
 * 使用 Radix UI Tooltip 实现的功能描述悬浮提示
 * - 支持标题和详细描述
 * - 支持不同主题颜色
 * - 完整的键盘导航和无障碍支持
 */
interface FeatureInfoTooltipProps {
  /** 功能标题 */
  title: string;
  /** 功能描述 */
  description: string;
  /** 详细说明列表（可选） */
  details?: string[];
  /** 图标颜色 */
  iconColor?: string;
  /** 主题颜色 */
  themeColor?: 'pink' | 'violet' | 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan';
}

const FeatureInfoTooltip: React.FC<FeatureInfoTooltipProps> = ({
  title,
  description,
  details,
  iconColor = 'text-gray-400',
  themeColor = 'violet',
}) => {
  // 主题颜色配置
  const themeColors = {
    pink: {
      title: 'text-pink-500',
      dot: 'bg-pink-500',
    },
    violet: {
      title: 'text-violet-500',
      dot: 'bg-violet-500',
    },
    indigo: {
      title: 'text-indigo-500',
      dot: 'bg-indigo-500',
    },
    blue: {
      title: 'text-blue-500',
      dot: 'bg-blue-500',
    },
    emerald: {
      title: 'text-emerald-500',
      dot: 'bg-emerald-500',
    },
    rose: {
      title: 'text-rose-500',
      dot: 'bg-rose-500',
    },
    amber: {
      title: 'text-amber-500',
      dot: 'bg-amber-500',
    },
    cyan: {
      title: 'text-cyan-500',
      dot: 'bg-cyan-500',
    },
  };

  const colors = themeColors[themeColor];

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-lg
              ${iconColor}
              hover:bg-slate-800/50
              transition-all duration-200
              hover:scale-105
            `}
            type="button"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="text-xs">功能说明</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className={`
              max-w-sm
              bg-black
              border border-slate-700/50
              shadow-xl shadow-black/40
              rounded-lg px-4 py-3
              z-50
            `}
            side="bottom"
            align="end"
            sideOffset={8}
          >
            <Tooltip.Arrow className="fill-black stroke-slate-700/50 stroke-2" />
            <div className="space-y-3">
              {/* 标题 */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
                <div className={`w-1 h-4 rounded ${colors.dot}`} />
                <span className={`font-semibold ${colors.title} text-sm`}>{title}</span>
              </div>

              {/* 描述 */}
              <p className="text-slate-300 text-xs leading-relaxed">{description}</p>

              {/* 详细说明列表 */}
              {details && details.length > 0 && (
                <ul className="space-y-2 pt-2 border-t border-slate-700/50">
                  {details.map((detail, index) => (
                    <li key={index} className="text-[12px] text-slate-400 leading-relaxed flex items-start gap-2">
                      <span className={`${colors.dot} w-1 h-1 rounded-full mt-1.5 shrink-0`} />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default FeatureInfoTooltip;
