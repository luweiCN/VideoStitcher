/**
 * TextCollapse 组件导出
 *
 * @example
 * ```tsx
 * import { TextCollapse, useTextCollapse } from './components/TextCollapse';
 *
 * // 组件使用
 * <TextCollapse lines={2}>很长的文本...</TextCollapse>
 *
 * // Hook 使用
 * const { needsCollapse, displayText } = useTextCollapse({ textRef, lines: 2 });
 * ```
 */

// 主组件
export { TextCollapse } from './TextCollapse';

// Hook
export { useTextCollapse } from './useTextCollapse';
export { useNeedsCollapse } from './useNeedsCollapse';
export type { UseNeedsCollapseOptions, UseNeedsCollapseReturn } from './useNeedsCollapse';

// ResizeObserver Hook
export { useResizeObserver, useResizeObserverRef } from './useResizeObserver';

// 类型
export type {
  TextCollapseProps,
  ExpandButtonProps,
  UseTextCollapseOptions,
  UseTextCollapseReturn,
  ResizeObserverEntry,
  ResizeObserverSize,
  MeasureResult,
  DOMMeasureInfo,
} from './types';

// 算法导出（供高级用户使用）
export { binarySearchTruncate, binarySearchTruncateByWidth } from './algorithms/binarySearch';
export {
  smartTruncate,
  optimizeTruncatePosition,
  smartTruncateMixed,
  TruncateStrategy,
} from './algorithms/smartTruncate';
export {
  getElementMeasureInfo,
  parseLineHeight,
  getMaxHeight,
  createMeasureElement,
  measureTextWidth,
  measureTextHeight,
  isTextOverflowing,
  getTextContent,
  normalizeText,
} from './algorithms/measure';

// 工具函数导出
export {
  debounce,
  throttle,
  rafThrottle,
  batchDomUpdates,
  safeGetParent,
  safeSetStyle,
} from './utils/dom';
export {
  MeasureCache,
  defaultMeasureCache,
  getCachedMeasure,
  clearMeasureCache,
} from './utils/cache';
export {
  MeasureScheduler,
  defaultScheduler,
  scheduleMeasure,
  cancelMeasure,
} from './utils/scheduler';

// 常量导出
export {
  DEFAULT_ELLIPSIS,
  DEFAULT_LINES,
  DEFAULT_MEASURE_DELAY,
  MIN_TEXT_LENGTH,
  MAX_CACHE_SIZE,
  SCHEDULER_DELAY,
  RAF_TIMEOUT,
  MAX_MEASURE_RETRIES,
  WORD_BREAK_REGEX,
  SENTENCE_BREAK_REGEX,
  PARAGRAPH_BREAK_REGEX,
  MIN_COLLAPSE_LENGTH,
} from './constants';
