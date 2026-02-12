import React from 'react';
import * as Switch from '@radix-ui/react-switch';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { LogThemeColor } from './types';

/**
 * Switch 主题样式配置
 */
interface SwitchThemeConfig {
  /** Focus ring 样式 */
  focusRing: string;
  /** 选中时的背景样式 */
  checkedBg: string;
  /** 选中时的边框样式 */
  checkedBorder: string;
  /** 选中时的阴影样式 */
  shadow: string;
}

/**
 * Switch 主题样式映射表
 * 预定义所有主题色的完整 Tailwind 类名，避免动态拼接
 */
const SWITCH_THEME_MAP: Record<LogThemeColor, SwitchThemeConfig> = {
  pink: {
    focusRing: 'focus:ring-pink-500/50',
    checkedBg: 'bg-pink-500',
    checkedBorder: 'border-pink-500',
    shadow: 'shadow-[0_0_8px_rgba(236,72,153,0.5)]'
  },
  violet: {
    focusRing: 'focus:ring-violet-500/50',
    checkedBg: 'bg-violet-500',
    checkedBorder: 'border-violet-500',
    shadow: 'shadow-[0_0_8px_rgba(139,92,246,0.5)]'
  },
  indigo: {
    focusRing: 'focus:ring-indigo-500/50',
    checkedBg: 'bg-indigo-500',
    checkedBorder: 'border-indigo-500',
    shadow: 'shadow-[0_0_8px_rgba(99,102,241,0.5)]'
  },
  cyan: {
    focusRing: 'focus:ring-cyan-500/50',
    checkedBg: 'bg-cyan-500',
    checkedBorder: 'border-cyan-500',
    shadow: 'shadow-[0_0_8px_rgba(34,211,238,0.5)]'
  },
  emerald: {
    focusRing: 'focus:ring-emerald-500/50',
    checkedBg: 'bg-emerald-500',
    checkedBorder: 'border-emerald-500',
    shadow: 'shadow-[0_0_8px_rgba(52,211,153,0.5)]'
  },
  amber: {
    focusRing: 'focus:ring-amber-500/50',
    checkedBg: 'bg-amber-500',
    checkedBorder: 'border-amber-500',
    shadow: 'shadow-[0_0_8px_rgba(245,158,11,0.5)]'
  },
  rose: {
    focusRing: 'focus:ring-rose-500/50',
    checkedBg: 'bg-rose-500',
    checkedBorder: 'border-rose-500',
    shadow: 'shadow-[0_0_8px_rgba(244,63,94,0.5)]'
  },
  gray: {
    focusRing: 'focus:ring-gray-500/50',
    checkedBg: 'bg-gray-500',
    checkedBorder: 'border-gray-500',
    shadow: 'shadow-[0_0_8px_rgba(156,163,175,0.5)]'
  },
};

/**
 * 开关组件属性
 */
interface SwitchProps {
  /** 是否选中 */
  checked: boolean;
  /** 选中变化回调 */
  onCheckedChange: (checked: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外类名 */
  className?: string;
  /** 主题颜色 */
  themeColor: LogThemeColor;
}

/**
 * 开关组件 - 基于 Radix UI Switch
 *
 * 直接接收 themeColor 枚举，避免不必要的字符串推断
 */
export const SwitchControl: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className = '',
  themeColor,
}) => {
  // 直接从预定义映射表获取样式，无需运行时计算
  const styles = SWITCH_THEME_MAP[themeColor];

  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={`
        relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 ${styles.focusRing} focus:ring-offset-2 focus:ring-offset-gray-900
        ${checked
          ? `${styles.checkedBg} ${styles.checkedBorder} ${styles.shadow}`
          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        data-state={checked ? 'checked' : 'unchecked'}
        ${className}
      `}
    >
      <Switch.Thumb
        className={`
          pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out
          ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}
        `}
      />
    </Switch.Root>
  );
};

/**
 * 日志组件 Footer 属性
 */
export interface LogFooterProps {
  /** 是否启用自动滚动 */
  autoScrollEnabled: boolean;
  /** 设置自动滚动开关 */
  setAutoScrollEnabled: (enabled: boolean) => void;
  /** 是否暂停自动滚动 */
  autoScrollPaused: boolean;
  /** 恢复自动滚动 */
  resumeAutoScroll: () => void;
  /** 滚动到底部 */
  scrollToBottom: () => void;
  /** 滚动到顶部 */
  scrollToTop: () => void;
  /** 是否可滚动（是否有滚动条） */
  isScrollable: boolean;
  /** 主题颜色 */
  themeColor?: LogThemeColor;
}

/**
 * 日志组件 Footer
 *
 * 只在有滚动条时显示
 * 包含自动滚动开关和导航按钮
 */
export const LogFooter: React.FC<LogFooterProps> = ({
  autoScrollEnabled,
  setAutoScrollEnabled,
  autoScrollPaused,
  resumeAutoScroll,
  scrollToBottom,
  scrollToTop,
  isScrollable,
  themeColor = 'gray',
}) => {
  // 不可滚动时不显示 footer
  if (!isScrollable) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-black/80 backdrop-blur-sm border-t border-slate-800">
      {/* 左侧：自动滚动开关 */}
      <div className="flex items-center gap-2">
        <SwitchControl
          checked={autoScrollEnabled}
          onCheckedChange={setAutoScrollEnabled}
          themeColor={themeColor}
        />
        {/* 开关打开时显示暂停/恢复状态，关闭时只显示"自动滚动" */}
        {autoScrollEnabled && autoScrollPaused ? (
          <button
            onClick={resumeAutoScroll}
            className="text-xs text-gray-400 hover:text-pink-400 hover:font-medium transition-colors cursor-pointer"
            title="恢复自动滚动"
          >
            点击恢复自动滚动
          </button>
        ) : (
          <span className="text-xs text-gray-400 font-medium">
            自动滚动
          </span>
        )}
      </div>

      {/* 右侧：导航按钮 */}
      <div className="flex items-center gap-1">
        {/* 向上按钮 */}
        <button
          onClick={scrollToTop}
          className="group relative p-1.5 text-gray-500 hover:text-gray-300 transition-all duration-200"
          title="滚动到顶部"
        >
          <ChevronUp className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
          <span className="absolute inset-0 rounded-lg bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </button>

        {/* 向下按钮 */}
        <button
          onClick={scrollToBottom}
          className="group relative p-1.5 text-gray-500 hover:text-gray-300 transition-all duration-200"
          title="滚动到底部"
        >
          <ChevronDown className="w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5" />
          <span className="absolute inset-0 rounded-lg bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </button>
      </div>
    </div>
  );
};
