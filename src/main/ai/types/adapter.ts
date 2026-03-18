/**
 * Provider 适配器接口
 * 所有供应商适配器必须实现此接口
 */

import type {
  UnifiedMessage,
  UnifiedResponse,
  StreamChunk,
} from './unified';
import type { ModelInfo } from './model';

/**
 * 调用选项
 */
export interface InvokeOptions {
  /** 温度参数（0-2），控制随机性 */
  temperature?: number;

  /** 最大输出 tokens */
  maxTokens?: number;

  /** Top-P 采样参数 */
  topP?: number;

  /** 停止序列 */
  stopSequences?: string[];

  // ===== 图片生成特定选项 =====

  /** 图片尺寸 */
  imageSize?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

  /** 图片风格 */
  imageStyle?: 'natural' | 'vivid';

  /** 图片质量 */
  imageQuality?: 'standard' | 'hd';

  /** 生成数量（图片） */
  imageCount?: number;

  // ===== 其他自定义选项 =====

  /** 额外参数 */
  [key: string]: any;
}

/**
 * 供应商适配器接口
 *
 * 所有供应商适配器必须实现此接口，以提供统一的调用方式。
 *
 * @example 实现示例
 * ```typescript
 * export class VolcEngineTextAdapter implements ProviderAdapter {
 *   async invoke(messages: UnifiedMessage[], options?: InvokeOptions): Promise<UnifiedResponse> {
 *     // 1. 转换消息格式
 *     // 2. 调用供应商 API
 *     // 3. 转换响应格式
 *     return response;
 *   }
 *
 *   async *stream(messages: UnifiedMessage[], options?: InvokeOptions): AsyncIterable<StreamChunk> {
 *     // 流式调用实现
 *   }
 *
 *   async healthCheck(): Promise<boolean> {
 *     // 健康检查实现
 *   }
 *
 *   getModelInfo(): ModelInfo {
 *     return this.modelInfo;
 *   }
 * }
 * ```
 */
export interface ProviderAdapter {
  /**
   * 同步调用模型
   *
   * @param messages - 统一消息格式
   * @param options - 调用选项
   * @returns 统一响应格式
   */
  invoke(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): Promise<UnifiedResponse>;

  /**
   * 流式调用模型
   *
   * @param messages - 统一消息格式
   * @param options - 调用选项
   * @returns 流式响应块的可迭代对象
   */
  stream(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): AsyncIterable<StreamChunk>;

  /**
   * 健康检查
   *
   * @returns 模型是否可用
   */
  healthCheck(): Promise<boolean>;

  /**
   * 获取模型信息
   *
   * @returns 模型信息
   */
  getModelInfo(): ModelInfo;
}

/**
 * 供应商适配器工厂函数类型
 */
export type AdapterFactory = (
  config: any,
  modelInfo: ModelInfo
) => ProviderAdapter;
