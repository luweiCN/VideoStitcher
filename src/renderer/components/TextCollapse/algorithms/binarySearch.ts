/**
 * 二分查找算法
 *
 * 使用 O(log n) 时间复杂度查找最佳截断位置
 * 优于 react-dotdotdot 的 O(n) 线性查找
 */

import type { MeasureResult } from '../types';
import { measureTextHeight } from './measure';
import { DEFAULT_ELLIPSIS, MIN_TEXT_LENGTH } from '../constants';

/**
 * 二分查找配置
 */
export interface BinarySearchOptions {
  /** 容器元素 */
  container: HTMLElement;
  /** 完整文本 */
  text: string;
  /** 最大高度 */
  maxHeight: number;
  /** 最大宽度 */
  maxWidth: number;
  /** 省略号 */
  ellipsis?: string;
  /** 迭代上限 */
  maxIterations?: number;
}

/**
 * 使用二分查找找到最佳截断位置
 *
 * 时间复杂度: O(log n)
 * 空间复杂度: O(1)
 */
export function binarySearchTruncate(options: BinarySearchOptions): MeasureResult {
  const {
    container,
    text,
    maxHeight,
    maxWidth,
    ellipsis = DEFAULT_ELLIPSIS,
    maxIterations = 20,
  } = options;

  // 文本太短，不需要截断
  if (text.length <= MIN_TEXT_LENGTH) {
    const height = measureTextHeight(container, text, maxWidth);
    return {
      overflow: height > maxHeight,
      truncateAt: text.length,
      displayText: text,
    };
  }

  // 首先检查完整文本是否溢出
  const fullTextHeight = measureTextHeight(container, text, maxWidth);
  if (fullTextHeight <= maxHeight) {
    return {
      overflow: false,
      truncateAt: text.length,
      displayText: text,
    };
  }

  // 二分查找最佳截断位置
  let left = 0;
  let right = text.length;
  let bestFit = 0;
  let iterations = 0;

  while (left <= right && iterations < maxIterations) {
    iterations++;
    const mid = Math.floor((left + right) / 2);

    // 构造测试文本
    const testText = text.slice(0, mid) + ellipsis;
    const testHeight = measureTextHeight(container, testText, maxWidth);

    if (testHeight <= maxHeight) {
      // 可以放下，尝试更多
      bestFit = mid;
      left = mid + 1;
    } else {
      // 放不下，减少文本
      right = mid - 1;
    }
  }

  const truncateText = text.slice(0, bestFit) + ellipsis;

  return {
    overflow: true,
    truncateAt: bestFit,
    displayText: truncateText,
  };
}

/**
 * 使用 canvas 测量文本宽度（更快但不准确行高）
 * 适用于单行文本场景
 */
export function binarySearchTruncateByWidth(options: {
  text: string;
  maxWidth: number;
  font: string;
  ellipsis?: string;
}): MeasureResult {
  const { text, maxWidth, font, ellipsis = DEFAULT_ELLIPSIS } = options;

  // 创建 canvas 上下文
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      overflow: false,
      truncateAt: text.length,
      displayText: text,
    };
  }

  ctx.font = font;

  // 测量完整文本宽度
  const fullTextWidth = ctx.measureText(text).width;
  if (fullTextWidth <= maxWidth) {
    return {
      overflow: false,
      truncateAt: text.length,
      displayText: text,
    };
  }

  // 二分查找
  let left = 0;
  let right = text.length;
  let bestFit = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const testText = text.slice(0, mid) + ellipsis;
    const testWidth = ctx.measureText(testText).width;

    if (testWidth <= maxWidth) {
      bestFit = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return {
    overflow: true,
    truncateAt: bestFit,
    displayText: text.slice(0, bestFit) + ellipsis,
  };
}
