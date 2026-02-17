/**
 * useTextCollapse Hook
 *
 * 核心逻辑 Hook，整合测量和状态管理
 * 提供文本折叠的完整功能
 */

import { useState, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import type { UseTextCollapseOptions, UseTextCollapseReturn } from './types';
import { DEFAULT_ELLIPSIS, DEFAULT_LINES, MIN_COLLAPSE_LENGTH } from './constants';
import { getMaxHeight, isTextOverflowing, getElementMeasureInfo } from './algorithms/measure';
import { binarySearchTruncate } from './algorithms/binarySearch';
import { optimizeTruncatePosition } from './algorithms/smartTruncate';
import { useResizeObserver } from './useResizeObserver';
import { scheduleMeasure, cancelMeasure } from './utils/scheduler';
import { getCachedMeasure, clearMeasureCache } from './utils/cache';

/**
 * useTextCollapse Hook
 *
 * @example
 * ```tsx
 * const textRef = useRef<HTMLSpanElement>(null);
 * const { needsCollapse, isMeasuring, displayText, remeasure } = useTextCollapse({
 *   textRef,
 *   lines: 2,
 * });
 *
 * return <span ref={textRef}>{displayText}</span>;
 * ```
 */
export function useTextCollapse(options: UseTextCollapseOptions): UseTextCollapseReturn {
  const {
    textRef,
    containerRef,
    lines = DEFAULT_LINES,
    ellipsis = DEFAULT_ELLIPSIS,
    disabled = false,
    measureDelay = 0,
  } = options;

  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const measureIdRef = useRef<string | undefined>(undefined);
  const textRefCurrent = useRef('');
  const lastLinesRef = useRef(lines);

  // 获取实际文本内容
  const getText = useCallback((): string => {
    const element = textRef.current;
    if (!element) return '';

    // 获取 innerText 或 textContent
    const text = element.innerText || element.textContent || '';
    return text.trim();
  }, [textRef]);

  // 执行测量
  const performMeasure = useCallback(() => {
    const element = textRef.current;
    const container = containerRef?.current || element?.parentElement;

    if (!element || !container) {
      return;
    }

    const text = getText();
    textRefCurrent.current = text;

    // 文本太短不需要折叠
    if (text.length <= MIN_COLLAPSE_LENGTH) {
      setNeedsCollapse(false);
      setDisplayText(text);
      setIsMeasuring(false);
      return;
    }

    setIsMeasuring(true);

    try {
      // 获取容器信息
      const measureInfo = getElementMeasureInfo(element);
      if (!measureInfo) {
        setNeedsCollapse(false);
        setDisplayText(text);
        return;
      }

      const maxWidth = element.parentElement?.getBoundingClientRect().width || 0;
      const maxHeight = getMaxHeight(element, lines);

      // 检查是否溢出
      const overflow = isTextOverflowing(element, lines);

      if (!overflow) {
        setNeedsCollapse(false);
        setDisplayText(text);
        setIsMeasuring(false);
        return;
      }

      // 使用缓存的测量结果
      const cached = getCachedMeasure(text, maxWidth, measureInfo.font, () => {
        // 二分查找最佳截断位置
        const result = binarySearchTruncate({
          container,
          text,
          maxHeight,
          maxWidth,
          ellipsis,
        });

        // 优化截断位置
        const optimizedPosition = optimizeTruncatePosition(text, result.truncateAt);

        return {
          truncateAt: optimizedPosition,
          overflow: true,
        };
      });

      setNeedsCollapse(cached.overflow);

      // 构造显示文本
      if (cached.overflow) {
        setDisplayText(text.slice(0, cached.truncateAt) + ellipsis);
      } else {
        setDisplayText(text);
      }
    } catch (error) {
      console.error('[useTextCollapse] 测量失败:', error);
      setNeedsCollapse(false);
      setDisplayText(text);
    } finally {
      setIsMeasuring(false);
    }
  }, [textRef, containerRef, lines, ellipsis, getText]);

  // 使用调度器执行测量
  const scheduleMeasurement = useCallback(() => {
    const id = `measure-${Date.now()}-${Math.random()}`;
    measureIdRef.current = id;

    scheduleMeasure(id, () => {
      performMeasure();
    }, 0);
  }, [performMeasure]);

  // 重新测量
  const remeasure = useCallback(() => {
    scheduleMeasurement();
  }, [scheduleMeasurement]);

  // 强制测量（跳过调度）
  const forceMeasure = useCallback(() => {
    performMeasure();
  }, [performMeasure]);

  // 初始化测量
  useLayoutEffect(() => {
    if (disabled) {
      setNeedsCollapse(false);
      const text = getText();
      setDisplayText(text);
      return;
    }

    // 延迟测量，确保 DOM 已渲染
    const timer = setTimeout(() => {
      performMeasure();
    }, measureDelay);

    return () => clearTimeout(timer);
  }, [disabled, performMeasure, measureDelay, getText]);

  // 监听容器尺寸变化
  useEffect(() => {
    if (disabled) return;

    const container = containerRef?.current || textRef.current?.parentElement;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      remeasure();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [disabled, containerRef, textRef, remeasure]);

  // 监听 lines 变化
  useEffect(() => {
    if (lastLinesRef.current !== lines) {
      lastLinesRef.current = lines;
      remeasure();
    }
  }, [lines, remeasure]);

  // 清理
  useEffect(() => {
    return () => {
      if (measureIdRef.current) {
        cancelMeasure(measureIdRef.current);
      }
    };
  }, []);

  return {
    needsCollapse,
    isMeasuring,
    displayText,
    remeasure,
    forceMeasure,
  };
}
