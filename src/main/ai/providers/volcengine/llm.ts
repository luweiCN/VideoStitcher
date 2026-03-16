/**
 * 火山引擎 - 豆包大语言模型实现
 *
 * 使用 LangChain OpenAI adapter 调用豆包大模型
 * 火山引擎兼容 OpenAI API 协议
 */

import { ChatOpenAI } from '@langchain/openai';
import type {
  AIProvider,
  TextGenerationOptions,
  TextGenerationResult,
} from '../interface';

/**
 * 火山引擎 LLM 配置
 */
export interface VolcEngineLLMConfig {
  /** API 密钥 */
  apiKey: string;
  /** 基础 URL */
  baseUrl?: string;
  /** 模型名称（默认：doubao-pro-32k） */
  model?: string;
}

/**
 * 火山引擎 - 豆包大语言模型
 *
 * 实现文本生成和流式文本生成功能
 */
export class VolcEngineLLM implements Pick<AIProvider, 'generateText' | 'generateTextStream'> {
  /** 提供商名称 */
  readonly name = 'volcengine-llm';

  /** 配置信息 */
  private config: Required<VolcEngineLLMConfig>;

  /** LangChain ChatOpenAI 客户端 */
  private client: ChatOpenAI;

  /**
   * 构造函数
   * @param config 配置参数
   */
  constructor(config: VolcEngineLLMConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
      model: config.model || 'doubao-pro-32k',
    };

    this.client = this.createClient();
  }

  /**
   * 创建 ChatOpenAI 客户端
   * @param options 生成选项（可选）
   * @returns ChatOpenAI 客户端
   */
  private createClient(options?: TextGenerationOptions): ChatOpenAI {
    return new ChatOpenAI({
      modelName: this.config.model,
      openAIApiKey: this.config.apiKey,
      configuration: {
        baseURL: this.config.baseUrl,
      },
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2048,
      topP: options?.topP,
    });
  }

  /**
   * 文本生成
   *
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成结果
   */
  async generateText(
    prompt: string,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    try {
      console.log('[VolcEngineLLM] 开始文本生成', { prompt: prompt.substring(0, 50) });

      // 构建消息
      const messages = options?.systemPrompt
        ? [
            { role: 'system' as const, content: options.systemPrompt },
            { role: 'user' as const, content: prompt },
          ]
        : [{ role: 'user' as const, content: prompt }];

      // 创建客户端（应用选项）
      const client = this.createClient(options);

      // 调用 LLM
      const response = await client.invoke(messages, {
        stop: options?.stopSequences,
      });

      // 提取结果
      const content = response.content.toString();
      const usageMetadata = response.usage_metadata as {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      } | undefined;

      // 提取 token 使用情况
      const usage = {
        promptTokens: usageMetadata?.input_tokens || 0,
        completionTokens: usageMetadata?.output_tokens || 0,
        totalTokens: usageMetadata?.total_tokens || 0,
      };

      console.log('[VolcEngineLLM] 文本生成完成', {
        contentLength: content.length,
        usage,
      });

      // 提取完成原因
      const responseMetadata = response.response_metadata as {
        finish_reason?: string;
      } | undefined;
      const finishReason = (responseMetadata?.finish_reason as TextGenerationResult['finishReason']) || 'stop';

      return {
        content,
        usage,
        finishReason,
      };
    } catch (error) {
      console.error('[VolcEngineLLM] 文本生成失败:', error);
      throw new Error(`文本生成失败: ${error}`);
    }
  }

  /**
   * 流式文本生成
   *
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 文本流
   */
  async *generateTextStream(
    prompt: string,
    options?: TextGenerationOptions
  ): AsyncIterable<string> {
    try {
      console.log('[VolcEngineLLM] 开始流式文本生成', { prompt: prompt.substring(0, 50) });

      // 构建消息
      const messages = options?.systemPrompt
        ? [
            { role: 'system' as const, content: options.systemPrompt },
            { role: 'user' as const, content: prompt },
          ]
        : [{ role: 'user' as const, content: prompt }];

      // 创建客户端（应用选项）
      const client = this.createClient(options);

      // 调用流式 LLM
      const stream = await client.stream(messages, {
        stop: options?.stopSequences,
      });

      // 流式输出
      for await (const chunk of stream) {
        const content = chunk.content.toString();
        if (content) {
          yield content;
        }
      }

      console.log('[VolcEngineLLM] 流式文本生成完成');
    } catch (error) {
      console.error('[VolcEngineLLM] 流式生成失败:', error);
      throw new Error(`流式生成失败: ${error}`);
    }
  }
}
