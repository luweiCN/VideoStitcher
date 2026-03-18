/**
 * 火山引擎适配器
 * 包装现有的 VolcEngineLLM 和 VolcEngineImage 实现
 */

import { VolcEngineLLM, type VolcEngineLLMConfig } from '../providers/volcengine/llm';
import { VolcEngineImage, type VolcEngineImageConfig } from '../providers/volcengine/image';
import type {
  ProviderAdapter,
  UnifiedMessage,
  UnifiedResponse,
  StreamChunk,
  InvokeOptions,
} from '../types';
import type { ModelInfo } from '../types/model';

/**
 * 火山引擎统一配置
 */
export interface VolcEngineConfig {
  /** API 密钥 */
  apiKey: string;

  /** 基础 URL */
  baseUrl?: string;

  /** 文本模型 ID */
  textModel?: string;

  /** 图片模型 ID */
  imageModel?: string;
}

/**
 * 火山引擎文本适配器
 * 包装 VolcEngineLLM 以提供统一接口
 */
export class VolcEngineTextAdapter implements ProviderAdapter {
  private llm: VolcEngineLLM;
  private modelInfo: ModelInfo;
  private config: VolcEngineConfig;

  constructor(config: VolcEngineConfig, modelInfo: ModelInfo) {
    this.config = config;
    this.modelInfo = modelInfo;

    // 创建 LLM 实例
    const llmConfig: VolcEngineLLMConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: modelInfo.id, // 使用配置中的模型 ID
    };

    this.llm = new VolcEngineLLM(llmConfig);
  }

  async invoke(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): Promise<UnifiedResponse> {
    try {
      // 转换消息格式为 LangChain 格式
      const langchainMessages = this.convertMessages(messages);

      // 提取系统提示词（如果有）
      const systemPrompt =
        langchainMessages[0]?.role === 'system'
          ? langchainMessages[0].content
          : undefined;

      // 提取用户消息（最后一条非系统消息）
      const userMessage = langchainMessages[langchainMessages.length - 1].content;

      // 调用现有实现
      const result = await this.llm.generateText(userMessage, {
        systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        topP: options?.topP,
        stop: options?.stopSequences,
      });

      // 转换为统一响应格式
      return {
        content: result.content,
        usage: {
          inputTokens: result.usage.promptTokens,
          outputTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        metadata: {
          provider: 'volcengine',
          modelId: this.modelInfo.id,
          finishReason: result.finishReason,
        },
      };
    } catch (error) {
      console.error('[VolcEngineTextAdapter] 调用失败:', error);
      throw error;
    }
  }

  async *stream(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): AsyncIterable<StreamChunk> {
    try {
      // 转换消息格式
      const langchainMessages = this.convertMessages(messages);

      // 提取系统提示词
      const systemPrompt =
        langchainMessages[0]?.role === 'system'
          ? langchainMessages[0].content
          : undefined;

      // 提取用户消息
      const userMessage = langchainMessages[langchainMessages.length - 1].content;

      // 调用现有流式实现
      const stream = this.llm.generateTextStream(userMessage, {
        systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        topP: options?.topP,
        stop: options?.stopSequences,
      });

      // 迭代流式响应
      for await (const chunk of stream) {
        yield { delta: chunk };
      }

      // 发送完成信号
      yield { done: true };
    } catch (error) {
      console.error('[VolcEngineTextAdapter] 流式调用失败:', error);
      yield { error: (error as Error).message, done: true };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 简单的 ping 测试
      await this.llm.generateText('ping', { maxTokens: 10 });
      return true;
    } catch (error) {
      console.error('[VolcEngineTextAdapter] 健康检查失败:', error);
      return false;
    }
  }

  getModelInfo(): ModelInfo {
    return this.modelInfo;
  }

  /**
   * 转换消息格式为 LangChain 格式
   */
  private convertMessages(
    messages: UnifiedMessage[]
  ): Array<{ role: string; content: string }> {
    return messages.map((msg) => {
      // 处理字符串内容
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content,
        };
      }

      // 处理多模态内容（暂时只提取文本）
      const textContent = msg.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');

      return {
        role: msg.role,
        content: textContent,
      };
    });
  }
}

/**
 * 火山引擎图片适配器
 * 包装 VolcEngineImage 以提供统一接口
 */
export class VolcEngineImageAdapter implements ProviderAdapter {
  private imageGen: VolcEngineImage;
  private modelInfo: ModelInfo;
  private config: VolcEngineConfig;

  constructor(config: VolcEngineConfig, modelInfo: ModelInfo) {
    this.config = config;
    this.modelInfo = modelInfo;

    // 创建图片生成实例
    const imageConfig: VolcEngineImageConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: modelInfo.id,
    };

    this.imageGen = new VolcEngineImage(imageConfig);
  }

  async invoke(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): Promise<UnifiedResponse> {
    try {
      // 提取提示词（最后一条用户消息）
      const lastMessage = messages[messages.length - 1];
      const prompt =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : lastMessage.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n');

      // 调用图片生成
      const result = await this.imageGen.generateImage(prompt, {
        size: options?.imageSize,
        style: options?.imageStyle,
        quality: options?.imageQuality,
        n: options?.imageCount || 1,
      });

      // 转换为统一响应格式
      const images = result.images.map((img) => ({
        type: 'image' as const,
        url: img.url,
        revisedPrompt: img.revisedPrompt,
      }));

      return {
        content: images,
        metadata: {
          provider: 'volcengine',
          modelId: this.modelInfo.id,
          created: result.created,
        },
      };
    } catch (error) {
      console.error('[VolcEngineImageAdapter] 调用失败:', error);
      throw error;
    }
  }

  async *stream(
    messages: UnifiedMessage[],
    options?: InvokeOptions
  ): AsyncIterable<StreamChunk> {
    // 图片生成不支持流式
    throw new Error('图片生成不支持流式调用');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 简单的测试生成
      await this.imageGen.generateImage('test', { n: 1 });
      return true;
    } catch (error) {
      console.error('[VolcEngineImageAdapter] 健康检查失败:', error);
      return false;
    }
  }

  getModelInfo(): ModelInfo {
    return this.modelInfo;
  }
}
