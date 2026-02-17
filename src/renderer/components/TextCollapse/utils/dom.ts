/**
 * DOM 工具函数
 *
 * 提供安全的 DOM 操作和测量辅助函数
 */

import { getTextContent, normalizeText } from '@/components/TextCollapse/algorithms/measure';

/**
 * 安全地获取元素的父容器
 */
export function safeGetParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  // 防止访问 shadow root 等特殊场景
  try {
    return element.parentElement;
  } catch {
    return null;
  }
}

/**
 * 安全地设置元素样式
 */
export function safeSetStyle(
  element: HTMLElement | null,
  styles: Partial<CSSStyleDeclaration>
): boolean {
  if (!element) return false;

  try {
    Object.assign(element.style, styles);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全地移除元素类名
 */
export function safeRemoveClass(
  element: HTMLElement | null,
  className: string
): boolean {
  if (!element) return false;

  try {
    element.classList.remove(className);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全地添加元素类名
 */
export function safeAddClass(
  element: HTMLElement | null,
  className: string
): boolean {
  if (!element) return false;

  try {
    element.classList.add(className);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查元素是否在视口中
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * 获取元素的文本内容（安全处理）
 */
export function safeGetTextContent(node: Node | null): string {
  if (!node) return '';
  try {
    return normalizeText(getTextContent(node));
  } catch {
    return '';
  }
}

/**
 * 创建防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 创建节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * RAF 节流（用于动画场景）
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return function executedFunction(...args: Parameters<T>) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

/**
 * 批量更新 DOM（避免多次重排）
 */
export function batchDomUpdates(updates: () => void): void {
  // 使用 requestAnimationFrame 批量更新
  requestAnimationFrame(() => {
    // 先读取所有需要的值
    updates();
  });
}

/**
 * 等待元素渲染完成
 */
export function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}
