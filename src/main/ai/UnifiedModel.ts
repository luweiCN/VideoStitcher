/**
 * 统一模型包装器
 * 提供统一的模型调用接口
 */

import type {
  ProviderAdapter,
  UnifiedMessage,
  UnifiedResponse,
  StreamChunk,
  InvokeOptions,
} from './types';
import type { ModelInfo } from './types/model';

/**
 * 统一模型包装器
 *
 * 封装 ProviderAdapter，提供更友好的调用接口
 *
 * @example
 * ```typescript
 * const registry = AdapterRegistry.getInstance();
 * const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');
 *
 * // 同步调用
 * const response = await model.invoke([
 *   { role: 'system', content: '你是一个助手' },
 *   { role: 'user', content: '你好' }
 * ]);
 *
 * // 流式调用
 * for await (const chunk of model.stream(messages)) {
 *   console.log(chunk.delta);
 * }
 * ```
 */
export class UnifiedModel {
  constructor(private readonly adapter: ProviderAdapter) {}

  /**
   * 同步调用模型
   *
   * @param messages - 统一消息格式
   * @param options - 调用选项
   * @returns 统一响应格式
   */
  async invoke(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): Promise<UnifiedResponse> {
    return this.adapter.invoke(messages, options);
  }

  /**
   * 流式调用模型
   *
   * @param messages - 统一消息格式
   * @param options - 调用选项
   * @returns 流式响应块的可迭代对象
   */
  async *stream(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): AsyncIterable<StreamChunk> {
    yield* this.adapter.stream(messages, options);
  }

  /**
   * 健康检查
   *
   * @returns 模型是否可用
   */
  async healthCheck(): Promise<boolean> {
    return this.adapter.healthCheck();
  }

  /**
   * 获取模型信息
   *
   * @returns 模型信息
   */
  getModelInfo(): ModelInfo {
    return this.adapter.getModelInfo();
  }

  /**
   * 获取底层适配器（高级用法）
   *
   * @returns Provider 适配器实例
   */
  getAdapter(): ProviderAdapter {
    return this.adapter;
  }
}
