/**
 * DOM 测量工具函数
 *
 * 用于精确测量文本元素尺寸和计算行高
 */

import type { DOMMeasureInfo } from '../types';
import { DEFAULT_LINES } from '../constants';

/**
 * 获取元素的计算样式信息
 */
export function getElementMeasureInfo(element: HTMLElement): DOMMeasureInfo | null {
  if (!element || !element.parentElement) {
    return null;
  }

  const computedStyle = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return {
    width: rect.width,
    height: rect.height,
    lineHeight: parseLineHeight(computedStyle.lineHeight, computedStyle.fontSize),
    font: computedStyle.font,
    computedStyle,
  };
}

/**
 * 解析 line-height 值
 * 支持：normal、数字、px 单位、百分比
 */
export function parseLineHeight(lineHeight: string, fontSize: string): number {
  const fontSizeNum = parseFloat(fontSize) || 16;

  if (lineHeight === 'normal') {
    return fontSizeNum * 1.2;
  }

  const value = parseFloat(lineHeight);

  if (isNaN(value)) {
    return fontSizeNum * 1.2;
  }

  // 无单位或数字：乘以 font-size
  if (!lineHeight.includes('px') && !lineHeight.includes('%')) {
    return fontSizeNum * value;
  }

  // 百分比
  if (lineHeight.includes('%')) {
    return fontSizeNum * (value / 100);
  }

  // px 值
  return value;
}

/**
 * 计算指定行数的最大高度
 */
export function getMaxHeight(element: HTMLElement, lines: number = DEFAULT_LINES): number {
  const info = getElementMeasureInfo(element);
  if (!info) {
    return 0;
  }

  return info.lineHeight * lines;
}

/**
 * 创建临时测量元素
 * 使用与目标元素相同的样式
 */
export function createMeasureElement(container: HTMLElement, text: string): HTMLElement {
  const span = document.createElement('span');
  const computedStyle = window.getComputedStyle(container);

  // 复制关键样式
  span.style.position = 'absolute';
  span.style.visibility = 'hidden';
  span.style.whiteSpace = 'pre';
  span.style.wordWrap = 'normal';
  span.style.overflow = 'hidden';
  span.style.font = computedStyle.font;
  span.style.fontSize = computedStyle.fontSize;
  span.style.fontFamily = computedStyle.fontFamily;
  span.style.fontWeight = computedStyle.fontWeight;
  span.style.fontStyle = computedStyle.fontStyle;
  span.style.letterSpacing = computedStyle.letterSpacing;
  span.style.textTransform = computedStyle.textTransform;
  span.style.maxWidth = computedStyle.maxWidth !== 'none' ? computedStyle.maxWidth : '';

  span.textContent = text;
  return span;
}

/**
 * 测量文本在指定容器中的实际宽度
 */
export function measureTextWidth(container: HTMLElement, text: string): number {
  const measureEl = createMeasureElement(container, text);
  container.appendChild(measureEl);
  const width = measureEl.getBoundingClientRect().width;
  container.removeChild(measureEl);
  return width;
}

/**
 * 测量文本在指定容器中的实际高度
 */
export function measureTextHeight(container: HTMLElement, text: string, maxWidth: number): number {
  const measureEl = createMeasureElement(container, text);
  measureEl.style.maxWidth = `${maxWidth}px`;
  measureEl.style.whiteSpace = 'normal';
  container.appendChild(measureEl);
  const height = measureEl.getBoundingClientRect().height;
  container.removeChild(measureEl);
  return height;
}

/**
 * 检查文本是否在容器中溢出
 */
export function isTextOverflowing(element: HTMLElement, maxLines: number = DEFAULT_LINES): boolean {
  const maxHeight = getMaxHeight(element, maxLines);
  return element.scrollHeight > maxHeight;
}

/**
 * 获取文本内容（递归处理文本节点）
 */
export function getTextContent(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return Array.from(node.childNodes).map(getTextContent).join('');
  }
  return '';
}

/**
 * 规范化文本内容（去除多余空白）
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
