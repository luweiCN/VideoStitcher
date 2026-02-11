import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

// 按钮变体类型
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';
type ThemeColor = 'pink' | 'violet' | 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'fuchsia';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** 主题颜色（仅 secondary 变体生效） */
  themeColor?: ThemeColor;
}

/**
 * 按钮组件 - 基于 Radix UI 设计原则
 *
 * 无样式组件，使用 Tailwind CSS 自定义样式
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    themeColor = 'cyan',
    children,
    className = '',
    ...props
  }, ref) => {
    // 基础样式
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed';

    // 尺寸样式
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    };

    // 主题色配置（用于 secondary 变体）
    const themeColors: Record<ThemeColor, { bg: string; border: string; text: string }> = {
      pink: {
        bg: 'from-pink-600/20 to-pink-600/20 hover:from-pink-600/30 hover:to-pink-600/30',
        border: 'border-pink-500/30',
        text: 'text-pink-400',
      },
      violet: {
        bg: 'from-violet-600/20 to-violet-600/20 hover:from-violet-600/30 hover:to-violet-600/30',
        border: 'border-violet-500/30',
        text: 'text-violet-400',
      },
      indigo: {
        bg: 'from-indigo-600/20 to-indigo-600/20 hover:from-indigo-600/30 hover:to-indigo-600/30',
        border: 'border-indigo-500/30',
        text: 'text-indigo-400',
      },
      blue: {
        bg: 'from-blue-600/20 to-blue-600/20 hover:from-blue-600/30 hover:to-blue-600/30',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
      },
      emerald: {
        bg: 'from-emerald-600/20 to-emerald-600/20 hover:from-emerald-600/30 hover:to-emerald-600/30',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
      },
      rose: {
        bg: 'from-rose-600/20 to-rose-600/20 hover:from-rose-600/30 hover:to-rose-600/30',
        border: 'border-rose-500/30',
        text: 'text-rose-400',
      },
      amber: {
        bg: 'from-amber-600/20 to-amber-600/20 hover:from-amber-600/30 hover:to-amber-600/30',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
      },
      cyan: {
        bg: 'from-cyan-600/20 to-blue-600/20 hover:from-cyan-600/30 hover:to-blue-600/30',
        border: 'border-cyan-500/30',
        text: 'text-cyan-400',
      },
      fuchsia: {
        bg: 'from-fuchsia-600/20 to-fuchsia-600/20 hover:from-fuchsia-600/30 hover:to-fuchsia-600/30',
        border: 'border-fuchsia-500/30',
        text: 'text-fuchsia-400',
      },
    };

    // 变体样式
    const getVariantStyles = () => {
      if (variant === 'secondary') {
        const color = themeColors[themeColor];
        return `bg-gradient-to-r ${color.bg} border ${color.border} ${color.text}`;
      }
      return {
        primary: 'bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white shadow-lg',
        ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200',
        danger: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg',
      }[variant];
    };

    // 宽度样式
    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles[size]} ${getVariantStyles()} ${widthStyles} ${className}`}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
