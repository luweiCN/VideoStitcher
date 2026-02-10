/**
 * 智能截断算法
 *
 * 在词边界、句子边界进行智能截断
 * 提升可读性和用户体验
 */

import { WORD_BREAK_REGEX, SENTENCE_BREAK_REGEX, PARAGRAPH_BREAK_REGEX } from '../constants';

/**
 * 截断策略
 */
export enum TruncateStrategy {
  /** 精确截断（不优化） */
  EXACT = 'exact',
  /** 词边界截断 */
  WORD = 'word',
  /** 句子边界截断 */
  SENTENCE = 'sentence',
  /** 段落边界截断 */
  PARAGRAPH = 'paragraph',
}

/**
 * 查找最近的词边界
 * 向后查找最近的空格/词边界
 */
export function findWordBoundary(text: string, position: number): number {
  // 从位置向前查找最近的词边界
  for (let i = position; i >= 0; i--) {
    if (WORD_BREAK_REGEX.test(text[i])) {
      return i;
    }
  }
  return 0;
}

/**
 * 查找最近的句子边界
 * 向后查找最近的句号、问号、感叹号
 */
export function findSentenceBoundary(text: string, position: number): number {
  for (let i = position; i >= 0; i--) {
    if (SENTENCE_BREAK_REGEX.test(text[i])) {
      return i + 1; // 包含标点符号
    }
  }
  return 0;
}

/**
 * 查找最近的段落边界
 * 向后查找最近的换行符
 */
export function findParagraphBoundary(text: string, position: number): number {
  for (let i = position; i >= 0; i--) {
    if (PARAGRAPH_BREAK_REGEX.test(text[i])) {
      return i + 1;
    }
  }
  return 0;
}

/**
 * 智能截断优化
 * 根据策略在最佳位置截断
 */
export function smartTruncate(
  text: string,
  position: number,
  strategy: TruncateStrategy = TruncateStrategy.WORD
): number {
  // 精确截断
  if (strategy === TruncateStrategy.EXACT || position <= 0) {
    return position;
  }

  // 确保不超过文本长度
  const safePosition = Math.min(position, text.length);

  switch (strategy) {
    case TruncateStrategy.PARAGRAPH:
      return findParagraphBoundary(text, safePosition);

    case TruncateStrategy.SENTENCE:
      return findSentenceBoundary(text, safePosition);

    case TruncateStrategy.WORD:
      return findWordBoundary(text, safePosition);

    default:
      return safePosition;
  }
}

/**
 * 智能截断（带策略选择）
 * 优先级：段落 > 句子 > 词 > 精确
 */
export function optimizeTruncatePosition(
  text: string,
  position: number,
  maxRetries: number = 3
): number {
  let bestPosition = position;
  let bestScore = 0;

  const strategies = [
    TruncateStrategy.PARAGRAPH,
    TruncateStrategy.SENTENCE,
    TruncateStrategy.WORD,
  ];

  for (const strategy of strategies) {
    const candidatePosition = smartTruncate(text, position, strategy);

    // 计算保留比例
    const retainRatio = candidatePosition / text.length;

    // 评分：优先保留更多内容，但要在合理边界
    const score = retainRatio * getStrategyScore(strategy);

    if (score > bestScore && candidatePosition > 0) {
      bestPosition = candidatePosition;
      bestScore = score;
    }
  }

  // 如果最佳位置太小（少于原位置的 50%），使用精确截断
  if (bestPosition < position * 0.5) {
    return position;
  }

  return bestPosition;
}

/**
 * 获取策略评分权重
 */
function getStrategyScore(strategy: TruncateStrategy): number {
  switch (strategy) {
    case TruncateStrategy.PARAGRAPH:
      return 1.0;
    case TruncateStrategy.SENTENCE:
      return 0.9;
    case TruncateStrategy.WORD:
      return 0.8;
    default:
      return 0.7;
  }
}

/**
 * 中英文混合智能截断
 * 同时考虑中英文断句规则
 */
export function smartTruncateMixed(text: string, position: number): number {
  // 检查是否主要是中文
  const chineseRatio = (text.match(/[\u4e00-\u9fa5]/g) || []).length / text.length;

  if (chineseRatio > 0.5) {
    // 中文优先：句子边界
    return smartTruncate(text, position, TruncateStrategy.SENTENCE);
  }

  // 英文优先：词边界
  return smartTruncate(text, position, TruncateStrategy.WORD);
}
