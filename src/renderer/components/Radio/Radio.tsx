import React, { forwardRef } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';

// Radio 单选项的 Props
interface RadioItemProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  /** 标签内容 */
  label?: React.ReactNode;
  /** 描述文字 */
  description?: React.ReactNode;
}

/**
 * Radio 单选项组件
 */
const RadioItem = forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Item>, RadioItemProps>(
  ({ label, description, className = '', children, ...props }, ref) => {
    return (
      <div className="flex items-start gap-3">
        <RadioGroupPrimitive.Item
          ref={ref}
          className={`group w-5 h-5 rounded-full border-2 border-slate-600 bg-black/30
            focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-black
            data-[state=checked]:border-cyan-400 data-[state=checked]:bg-cyan-400/10
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200 flex items-center justify-center
            ${className}`}
          {...props}
        >
          <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
            <Circle className="w-2.5 h-2.5 text-cyan-400 fill-current" />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
        {(label || description || children) && (
          <div className="flex-1 min-w-0 pt-0.5">
            {label && (
              <span className="text-sm font-medium text-slate-200 group-data-[state=checked]:text-cyan-400 transition-colors">
                {label}
              </span>
            )}
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
            {children}
          </div>
        )}
      </div>
    );
  }
);

RadioItem.displayName = 'RadioItem';

// Radio Group 的 Props
interface RadioGroupProps extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  /** 子元素 */
  children: React.ReactNode;
}

/**
 * Radio 组组件 - 基于 Radix UI
 *
 * 无样式组件，使用 Tailwind CSS 自定义样式
 */
const RadioGroup = forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Root>, RadioGroupProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <RadioGroupPrimitive.Root
        ref={ref}
        className={`flex flex-col gap-3 ${className}`}
        {...props}
      />
    );
  }
);

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup, RadioItem };
export type { RadioGroupProps, RadioItemProps };
