import React, { useState, useRef } from 'react';
import { Root, Indicator } from '@radix-ui/react-checkbox';
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import type { LogEntryProps } from './types';
import { useNeedsCollapse } from '../TextCollapse';

/**
 * 获取日志类型的颜色类名
 */
function getLogTypeColor(type: string): string {
  switch (type) {
    case 'error':
      return 'text-rose-400';
    case 'success':
      return 'text-emerald-400';
    case 'warning':
      return 'text-amber-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * 单条日志组件
 */
export const LogEntry: React.FC<LogEntryProps> = ({
  log,
  selectionState,
  isExpanded,
  canExpand: propCanExpand,
  onClick,
  onToggleExpand,
  onCopySingle,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  const textColor = getLogTypeColor(log.type);
  const hasCheckbox = selectionState !== 'none';
  const isSelected = selectionState === 'in-range';
  const isStart = selectionState === 'start';

  // 使用 useNeedsCollapse Hook 检测文本是否溢出
  // 折叠按钮宽度 12px，用于二次判断
  const { needsCollapse: measuredNeedsCollapse } = useNeedsCollapse({
    textRef,
    lines: 2,
    collapseButtonWidth: 12,
  });

  // 优先使用传入的 canExpand，否则使用实际测量结果
  const needsCollapse = propCanExpand ?? measuredNeedsCollapse;

  return (
    <div
      className={`
        group relative flex items-start gap-2 py-1 px-2 rounded-lg transition-all cursor-pointer
        hover:bg-gray-800/30
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 选框 - 12px 与文本行高对齐 */}
      {hasCheckbox && (
        <div className="h-3 flex items-center shrink-0 mt-[1px]" onClick={(e) => e.stopPropagation()}>
          {isStart ? (
            // 起点：实心粉色矩形（无勾）
            <div className="w-3 h-3 rounded-sm bg-pink-500" />
          ) : (
            // 使用 Radix UI Checkbox
            <Root
              className={`
                w-3 h-3 rounded-sm flex items-center justify-center transition-colors cursor-pointer
                data-[state=checked]:bg-pink-500
                data-[state=unchecked]:bg-gray-700
                hover:data-[state=unchecked]:bg-gray-600
              `}
              checked={isSelected}
              disabled={isStart}
            >
              <Indicator className="text-white flex items-center justify-center">
                <Check className="w-2 h-2" strokeWidth={2.5} />
              </Indicator>
            </Root>
          )
          }
        </div>
      )}

      {/* 日志内容 */}
      <div className="flex-1 min-w-0">
        <span
          ref={textRef}
          className={`
            block font-mono text-[10px] leading-[12px]
            ${textColor}
            ${!isExpanded && needsCollapse ? 'line-clamp-2' : ''}
          `}
        >
          <span className="text-gray-600 shrink-0">[{log.timestamp}]</span>
          {' '}
          <span>{log.message}</span>
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* 悬浮显示的复制单条按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopySingle();
          }}
          className="h-3 w-3 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
          title="复制这条"
        >
          <Copy className="w-3 h-3" strokeWidth={2} />
        </button>

        {/* 展开/收起按钮 */}
        {needsCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="h-3 w-3 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            title={isExpanded ? '收起' : '展开'}
          >
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" strokeWidth={2} />
            ) : (
              <ChevronDown className="w-3 h-3" strokeWidth={2} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
