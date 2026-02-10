/**
 * TextCollapse 组件
 *
 * 现代化的文本折叠组件
 * 支持多行文本溢出显示省略号和展开/收起功能
 *
 * @example
 * ```tsx
 * <TextCollapse lines={2} ellipsis="...">
 *   这是一段很长的文本内容...
 * </TextCollapse>
 * ```
 */

import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import type { TextCollapseProps, ExpandButtonProps } from './types';
import { DEFAULT_ELLIPSIS, DEFAULT_LINES } from './constants';
import { useTextCollapse } from './useTextCollapse';
import { useResizeObserver } from './useResizeObserver';
import { scheduleMeasure } from './utils/scheduler';

/**
 * 默认展开按钮组件
 */
function DefaultExpandButton({ expanded, onClick, needsCollapse }: ExpandButtonProps) {
  if (!needsCollapse) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
      aria-expanded={expanded}
    >
      {expanded ? '收起' : '展开'}
    </button>
  );
}

/**
 * TextCollapse 主组件
 */
export const TextCollapse: React.FC<TextCollapseProps> = ({
  children,
  lines = DEFAULT_LINES,
  ellipsis = DEFAULT_ELLIPSIS,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  expandButton: ExpandButton = DefaultExpandButton,
  className = '',
  style,
  textRef: externalTextRef,
  containerRef: externalContainerRef,
}) => {
  // 内部 refs
  const internalTextRef = useRef<HTMLSpanElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);

  // 合并外部和内部 refs
  const textRef = externalTextRef || internalTextRef;
  const containerRef = externalContainerRef || internalContainerRef;

  // 展开状态
  const [isInternalExpanded, setIsInternalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : isInternalExpanded;

  // 使用 useTextCollapse hook
  const { needsCollapse, isMeasuring, displayText, remeasure } = useTextCollapse({
    textRef,
    containerRef,
    lines,
    ellipsis,
    disabled: isExpanded, // 展开状态下禁用折叠
  });

  // 监听容器尺寸变化
  useResizeObserver(
    useCallback(() => {
      if (!isExpanded) {
        remeasure();
      }
    }, [isExpanded, remeasure]),
    { triggerOnMount: true }
  );

  // 处理展开/收起
  const handleToggle = useCallback(() => {
    const newExpanded = !isExpanded;

    if (controlledExpanded === undefined) {
      setIsInternalExpanded(newExpanded);
    }

    onExpandedChange?.(newExpanded);
  }, [isExpanded, controlledExpanded, onExpandedChange]);

  // 渲染内容
  const renderContent = () => {
    if (typeof children === 'string' || typeof children === 'number') {
      // 简单文本：使用 hook 的 displayText
      if (!isExpanded && needsCollapse) {
        return displayText;
      }
      return children;
    }

    // 复杂子元素：直接渲染，使用 CSS
    return children;
  };

  // 计算类名
  const containerClassName = [
    'text-collapse-container',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const textClassName = [
    'text-collapse-content',
    !isExpanded && needsCollapse && typeof children === 'string' ? '' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={style}
    >
      <span
        ref={textRef}
        className={textClassName}
        style={{
          display: 'block',
          // 只有在展开状态或不需要折叠时才应用 line-clamp
          ...(isExpanded || !needsCollapse ? {} : {
            display: '-webkit-box',
            WebkitLineClamp: lines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }),
        }}
      >
        {renderContent()}
      </span>

      {/* 展开按钮 */}
      {ExpandButton && (
        <ExpandButton
          expanded={isExpanded}
          onClick={handleToggle}
          needsCollapse={needsCollapse}
        />
      )}
    </div>
  );
};

TextCollapse.displayName = 'TextCollapse';

/**
 * 导出类型
 */
export type { TextCollapseProps, ExpandButtonProps };
