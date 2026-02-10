/**
 * useNeedsCollapse Hook
 *
 * 简化版的文本折叠检测 Hook
 * 专门用于配合 CSS line-clamp 使用
 * 检测文本是否溢出指定行数
 *
 * @example
 * ```tsx
 * const textRef = useRef<HTMLSpanElement>(null);
 * const { needsCollapse, isMeasuring } = useNeedsCollapse({
 *   textRef,
 *   lines: 2,
 *   collapseButtonWidth: 12, // 折叠按钮宽度
 * });
 *
 * return (
 *   <span
 *     ref={textRef}
 *     className={!isExpanded && needsCollapse ? 'line-clamp-2' : ''}
 *   >
 *     {text}
 *   </span>
 * );
 * ```
 */

import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import { DEFAULT_LINES } from './constants';
import { getMaxHeight, isTextOverflowing } from './algorithms/measure';

/**
 * Hook 选项
 */
export interface UseNeedsCollapseOptions {
  /** 文本内容 ref */
  textRef: React.RefObject<HTMLElement>;
  /** 最大显示行数 */
  lines?: number;
  /** 测量延迟（毫秒） */
  measureDelay?: number;
  /** 是否禁用测量 */
  disabled?: boolean;
  /** 折叠按钮宽度（px），用于二次判断 */
  collapseButtonWidth?: number;
}

/**
 * Hook 返回值
 */
export interface UseNeedsCollapseReturn {
  /** 是否需要折叠（内容溢出） */
  needsCollapse: boolean;
  /** 是否正在测量中 */
  isMeasuring: boolean;
  /** 重新测量 */
  remeasure: () => void;
}

/**
 * useNeedsCollapse Hook
 *
 * 用于配合 CSS line-clamp 检测文本是否溢出
 *
 * 判断逻辑：
 * 1. 第一次测量：当前容器宽度下是否溢出
 * 2. 第二次测量：如果溢出，预留按钮宽度后再测一次
 * 3. 只有两次都溢出才返回 true
 */
export function useNeedsCollapse(
  options: UseNeedsCollapseOptions
): UseNeedsCollapseReturn {
  const {
    textRef,
    lines = DEFAULT_LINES,
    measureDelay = 0,
    disabled = false,
    collapseButtonWidth = 0,
  } = options;

  // 使用 null 表示"未测量"，true/false 表示已测量的结果
  const [collapseState, setCollapseState] = useState<boolean | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const measureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 执行测量
  const performMeasure = useCallback(() => {
    const element = textRef.current;
    if (!element) return;

    // 清除之前的测量任务
    if (measureTimeoutRef.current) {
      clearTimeout(measureTimeoutRef.current);
      measureTimeoutRef.current = null;
    }

    setIsMeasuring(true);

    // 使用 RAF 确保 DOM 完全更新后再测量
    const rafId = requestAnimationFrame(() => {
      // 再加一帧延迟，确保布局完全稳定
      const rafId2 = requestAnimationFrame(() => {
        try {
          // 检查元素是否仍在 DOM 中
          if (!element.isConnected) {
            setIsMeasuring(false);
            return;
          }

          // 保存原始的 maxWidth 样式
          const computedStyle = window.getComputedStyle(element);
          const originalMaxWidth = computedStyle.maxWidth;

          // 第一次测量：当前容器宽度
          const firstOverflow = isTextOverflowing(element, lines);

          // 如果第一次就不溢出，直接返回 false
          if (!firstOverflow) {
            setCollapseState(false);
            setIsMeasuring(false);
            return;
          }

          // 如果第一次溢出了，且没有设置按钮宽度，直接返回 true
          if (collapseButtonWidth <= 0) {
            setCollapseState(true);
            setIsMeasuring(false);
            return;
          }

          // 第二次测量：预留按钮宽度后是否还溢出
          const currentWidth = element.getBoundingClientRect().width;
          element.style.maxWidth = `${currentWidth - collapseButtonWidth}px`;
          const secondOverflow = isTextOverflowing(element, lines);

          // 恢复原始样式
          if (originalMaxWidth && originalMaxWidth !== 'none') {
            element.style.maxWidth = originalMaxWidth;
          } else {
            element.style.maxWidth = '';
          }

          // 只有两次都溢出才返回 true
          setCollapseState(secondOverflow);
        } catch (error) {
          console.error('[useNeedsCollapse] 测量失败:', error);
          setCollapseState(false);
        } finally {
          setIsMeasuring(false);
        }
      });

      // 保存 rafId 用于清理
      measureTimeoutRef.current = setTimeout(() => {
        cancelAnimationFrame(rafId2);
      }, 100);
    });

    // 保存 rafId 用于清理
    measureTimeoutRef.current = setTimeout(() => {
      cancelAnimationFrame(rafId);
    }, 100);
  }, [textRef, lines, collapseButtonWidth]);

  // 重新测量
  const remeasure = useCallback(() => {
    performMeasure();
  }, [performMeasure]);

  // 初始化测量
  useLayoutEffect(() => {
    if (disabled) {
      setCollapseState(null);
      setIsMeasuring(false);
      return;
    }

    // 如果有延迟，使用 setTimeout
    if (measureDelay > 0) {
      const timer = setTimeout(performMeasure, measureDelay);
      return () => clearTimeout(timer);
    }

    // 否则立即测量
    performMeasure();

    // 清理函数
    return () => {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
    };
  }, [disabled, performMeasure, measureDelay]);

  // 监听容器尺寸变化
  useEffect(() => {
    if (disabled) return;

    const element = textRef.current;
    if (!element) return;

    const container = element.parentElement;
    if (!container) return;

    // 使用 RAF 节流，避免频繁测量
    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        remeasure();
        rafId = null;
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [disabled, textRef, remeasure]);

  // 监听内容变化
  useEffect(() => {
    if (disabled) return;

    const element = textRef.current;
    if (!element) return;

    // 使用 MutationObserver 监听文本内容变化
    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        remeasure();
        rafId = null;
      });
    });

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [disabled, textRef, remeasure]);

  // 未测量时默认返回 true（应用折叠防止闪烁）
  // 测量完成后返回实际结果
  const needsCollapse = collapseState === null ? true : collapseState;

  return {
    needsCollapse,
    isMeasuring,
    remeasure,
  };
}
