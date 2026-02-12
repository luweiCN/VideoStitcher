/**
 * ResizeObserver Hook
 *
 * 封装 ResizeObserver API，处理浏览器兼容性
 * 提供节流和清理功能
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ResizeObserverEntry } from './types';

/**
 * Hook 选项
 */
export interface UseResizeObserverOptions {
  /** 节流延迟（毫秒） */
  throttle?: number;
  /** 是否启用 RAF 节流 */
  rafThrottle?: boolean;
  /** 首次是否触发回调 */
  triggerOnMount?: boolean;
}

/**
 * Hook 返回值
 */
export interface UseResizeObserverReturn {
  /** 元素 ref */
  ref: React.RefObject<HTMLElement>;
  /** 强制触发一次测量 */
  trigger: () => void;
}

/**
 * 检查 ResizeObserver 是否可用
 */
function isResizeObserverAvailable(): boolean {
  return typeof window !== 'undefined' && 'ResizeObserver' in window;
}

/**
 * 使用 RAF 节流包装回调
 */
function withRafThrottle<T extends (...args: any[]) => void>(fn: T): T {
  let rafId: number | null = null;

  return ((...args: Parameters<T>) => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;
    });
  }) as T;
}

/**
 * 使用标准节流包装回调
 */
function withThrottle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let lastCall = 0;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

/**
 * ResizeObserver Hook
 *
 * @example
 * ```tsx
 * const { ref } = useResizeObserver((entries) => {
 *   for (const entry of entries) {
 *     console.log('Size:', entry.contentRect);
 *   }
 * });
 *
 * return <div ref={ref}>Content</div>;
 * ```
 */
export function useResizeObserver(
  callback: (entries: ResizeObserverEntry[]) => void,
  options: UseResizeObserverOptions = {}
): UseResizeObserverReturn {
  const { throttle = 100, rafThrottle = true, triggerOnMount = false } = options;

  const ref = useRef<HTMLElement>(null);
  const callbackRef = useRef(callback);
  const observerRef = useRef<ResizeObserver | null>(null);
  const triggerRef = useRef<(() => void) | null>(null);

  // 更新回调引用
  callbackRef.current = callback;

  // 应用节流
  const throttledCallback = useCallback(
    (entries: ResizeObserverEntry[]) => {
      // 类型转换：标准 ResizeObserverEntry 到我们的类型
      const typedEntries = entries as unknown as ResizeObserverEntry[];
      callbackRef.current(typedEntries);
    },
    []
  );

  // 创建最终的节流回调
  const finalCallback = useCallback(
    rafThrottle
      ? withRafThrottle(throttledCallback)
      : withThrottle(throttledCallback, throttle),
    [rafThrottle, throttle, throttledCallback]
  );

  // 强制触发测量
  const trigger = useCallback(() => {
    if (ref.current && triggerRef.current) {
      triggerRef.current();
    }
  }, []);

  useEffect(() => {
    if (!isResizeObserverAvailable()) {
      console.warn('[useResizeObserver] ResizeObserver not supported');
      return;
    }

    const element = ref.current;
    if (!element) return;

    // 创建 observer
    const observer = new ResizeObserver(finalCallback);
    observer.observe(element);
    observerRef.current = observer;

    // 创建触发函数（模拟一次 resize 事件）
    triggerRef.current = () => {
      const rect = element.getBoundingClientRect();
      const entry: ResizeObserverEntry = {
        target: element,
        contentRect: rect,
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
      };
      finalCallback([entry]);
    };

    // 首次触发
    if (triggerOnMount && triggerRef.current) {
      // 使用 requestAnimationFrame 确保 DOM 已渲染
      const rafId = requestAnimationFrame(() => {
        triggerRef.current?.();
      });
      return () => {
        cancelAnimationFrame(rafId);
      };
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
      triggerRef.current = null;
    };
  }, [finalCallback, triggerOnMount]);

  return { ref, trigger };
}

/**
 * 简化版本：只需要 ref
 */
export function useResizeObserverRef(options?: UseResizeObserverOptions): React.RefObject<HTMLElement> {
  const { ref } = useResizeObserver(() => {}, options);
  return ref;
}
