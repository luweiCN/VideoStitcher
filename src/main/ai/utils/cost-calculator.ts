/**
 * AI 成本计算工具
 * 根据模型定价和使用量计算成本
 */

import type { ModelPricing, UsageMetrics } from '../types';

/**
 * 计算单次请求成本
 *
 * @param usage - Token 使用量
 * @param pricing - 模型定价
 * @returns 成本（元）
 *
 * @example
 * ```typescript
 * const cost = calculateCost(
 *   { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
 *   { inputTokens: 0.3, outputTokens: 0.6, unit: 'CNY/million_tokens' }
 * );
 * console.log(`本次请求成本: ¥${cost.total}`);
 * ```
 */
export function calculateCost(
  usage: UsageMetrics,
  pricing: ModelPricing
): {
  input: number;
  output: number;
  cached?: number;
  total: number;
  currency: string;
} {
  // 价格单位：元/百万tokens
  const unit = pricing.unit || 'CNY/million_tokens';
  const multiplier = unit.includes('million') ? 1000000 : 1000;

  const inputCost = (usage.inputTokens / multiplier) * pricing.inputTokens;
  const outputCost = (usage.outputTokens / multiplier) * pricing.outputTokens;
  const cachedCost = usage.totalTokens && pricing.cachedTokens
    ? (usage.totalTokens / multiplier) * pricing.cachedTokens
    : undefined;

  return {
    input: inputCost,
    output: outputCost,
    cached: cachedCost,
    total: inputCost + outputCost + (cachedCost || 0),
    currency: pricing.currency || 'CNY',
  };
}

/**
 * 格式化成本显示
 */
export function formatCost(cost: number, currency: string = 'CNY'): string {
  if (cost < 0.01) {
    return `${(cost * 1000).toFixed(4)} 厘${currency === 'CNY' ? '元' : ''}`;
  } else if (cost < 1) {
    return `${cost.toFixed(4)} ${currency === 'CNY' ? '元' : currency}`;
  } else {
    return `${cost.toFixed(2)} ${currency === 'CNY' ? '元' : currency}`;
  }
}

/**
 * 成本累计器
 */
export class CostAccumulator {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCachedTokens = 0;
  private totalCost = 0;
  private requestCount = 0;

  /**
   * 添加一次请求的成本
   */
  addRequest(usage: UsageMetrics, pricing: ModelPricing): void {
    const cost = calculateCost(usage, pricing);

    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
    if (usage.totalTokens) {
      this.totalCachedTokens += usage.totalTokens;
    }
    this.totalCost += cost.total;
    this.requestCount++;
  }

  /**
   * 获取累计统计
   */
  getStats(): {
    requestCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    totalCost: number;
    averageCostPerRequest: number;
    averageInputTokensPerRequest: number;
    averageOutputTokensPerRequest: number;
  } {
    return {
      requestCount: this.requestCount,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCachedTokens: this.totalCachedTokens,
      totalCost: this.totalCost,
      averageCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0,
      averageInputTokensPerRequest:
        this.requestCount > 0 ? this.totalInputTokens / this.requestCount : 0,
      averageOutputTokensPerRequest:
        this.requestCount > 0 ? this.totalOutputTokens / this.requestCount : 0,
    };
  }

  /**
   * 重置累计器
   */
  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCachedTokens = 0;
    this.totalCost = 0;
    this.requestCount = 0;
  }

  /**
   * 生成报告
   */
  generateReport(): string {
    const stats = this.getStats();

    return `
成本统计报告
====================

请求次数: ${stats.requestCount}
总输入 Tokens: ${stats.totalInputTokens.toLocaleString()}
总输出 Tokens: ${stats.totalOutputTokens.toLocaleString()}
总成本: ${formatCost(stats.totalCost)}

平均成本/请求: ${formatCost(stats.averageCostPerRequest)}
平均输入 Tokens/请求: ${stats.averageInputTokensPerRequest.toFixed(0)}
平均输出 Tokens/请求: ${stats.averageOutputTokensPerRequest.toFixed(0)}
    `.trim();
  }
}

/**
 * 使用示例
 */
export function exampleUsage() {
  // 示例定价
  const pricing: ModelPricing = {
    inputTokens: 0.3,
    outputTokens: 0.6,
    cachedTokens: 0.06,
    unit: 'CNY/million_tokens',
    currency: 'CNY',
  };

  // 示例使用量
  const usage: UsageMetrics = {
    inputTokens: 1500,
    outputTokens: 800,
    totalTokens: 2300,
  };

  // 计算单次成本
  const cost = calculateCost(usage, pricing);
  console.log('单次请求成本：');
  console.log(`  输入成本: ${formatCost(cost.input)}`);
  console.log(`  输出成本: ${formatCost(cost.output)}`);
  console.log(`  总成本: ${formatCost(cost.total)}`);

  // 使用累计器
  const accumulator = new CostAccumulator();

  // 模拟多次请求
  for (let i = 0; i < 10; i++) {
    accumulator.addRequest(
      {
        inputTokens: 1000 + Math.random() * 1000,
        outputTokens: 500 + Math.random() * 500,
        totalTokens: 1500 + Math.random() * 1500,
      },
      pricing
    );
  }

  // 生成报告
  console.log('\n' + accumulator.generateReport());
}
