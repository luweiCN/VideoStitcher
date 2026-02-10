/**
 * TextCollapse 组件类型定义
 *
 * 提供完整的 TypeScript 类型支持
 */

import type { ReactNode } from 'react';

/**
 * 组件 Props
 */
export interface TextCollapseProps {
  /** 子节点内容 */
  children: ReactNode;
  /** 最大显示行数，默认 2 */
  lines?: number;
  /** 省略号文本，默认 '...' */
  ellipsis?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 受控模式：是否展开 */
  expanded?: boolean;
  /** 展开/收起变化回调 */
  onExpandedChange?: (expanded: boolean) => void;
  /** 自定义展开按钮 */
  expandButton?: (props: ExpandButtonProps) => ReactNode;
  /** 自定义容器类名 */
  className?: string;
  /** 自定义容器样式 */
  style?: React.CSSProperties;
  /** 文本内容的 ref */
  textRef?: React.RefObject<HTMLSpanElement>;
  /** 容器内容的 ref */
  containerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * 展开按钮 Props
 */
export interface ExpandButtonProps {
  /** 是否已展开 */
  expanded: boolean;
  /** 点击展开/收起 */
  onClick: () => void;
  /** 是否需要折叠（有溢出内容） */
  needsCollapse: boolean;
}

/**
 * useTextCollapse Hook 选项
 */
export interface UseTextCollapseOptions {
  /** 文本内容 ref */
  textRef: React.RefObject<HTMLSpanElement>;
  /** 容器 ref（可选，用于测量容器宽度） */
  containerRef?: React.RefObject<HTMLElement>;
  /** 最大显示行数 */
  lines?: number;
  /** 省略号文本 */
  ellipsis?: string;
  /** 是否禁用折叠（始终显示全部） */
  disabled?: boolean;
  /** 测量节流延迟（毫秒） */
  measureDelay?: number;
}

/**
 * useTextCollapse Hook 返回值
 */
export interface UseTextCollapseReturn {
  /** 是否需要折叠（内容溢出） */
  needsCollapse: boolean;
  /** 是否正在测量中 */
  isMeasuring: boolean;
  /** 截断后的文本内容 */
  displayText: string;
  /** 重新测量 */
  remeasure: () => void;
  /** 强制刷新测量 */
  forceMeasure: () => void;
}

/**
 * ResizeObserver 回调参数
 */
export interface ResizeObserverEntry {
  /** 目标元素 */
  target: HTMLElement;
  /** 内容矩形 */
  contentRect: DOMRectReadOnly;
  /** 边框矩形 */
  borderBoxSize: ResizeObserverSize[];
  /** 内容矩形 */
  contentBoxSize: ResizeObserverSize[];
  /** 设备像素比 */
  devicePixelContentBoxSize: ResizeObserverSize[];
}

/**
 * ResizeObserver Size
 */
export interface ResizeObserverSize {
  /** 内联尺寸（宽度） */
  inlineSize: number;
  /** 块级尺寸（高度） */
  blockSize: number;
}

/**
 * 测量结果
 */
export interface MeasureResult {
  /** 是否溢出 */
  overflow: boolean;
  /** 截断位置 */
  truncateAt: number;
  /** 实际显示的文本 */
  displayText: string;
}

/**
 * DOM 测量信息
 */
export interface DOMMeasureInfo {
  /** 元素宽度 */
  width: number;
  /** 元素高度 */
  height: number;
  /** 行高 */
  lineHeight: number;
  /** 字体信息 */
  font: string;
  /** 计算后的样式 */
  computedStyle: CSSStyleDeclaration;
}
