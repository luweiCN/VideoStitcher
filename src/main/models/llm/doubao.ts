/**
 * 火山引擎豆包 LLM 适配器
 * 封装火山引擎 API 调用，实现 LangChain BaseLLM 接口
 */

import { BaseLLM, type BaseLLMParams } from '@langchain/core/language_models/llms';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { logger } from '../../utils/logger';

/**
 * 火山引擎 API 配置
 */
interface VolcanoEngineConfig {
  /** API Key */
  apiKey: string;
  /** API 端点 */
  endpoint?: string;
  /** 模型名称 */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大 Token 数 */
  maxTokens?: number;
  /** Top P 参数 */
  topP?: number;
}

/**
 * 火山引擎聊天消息
 */
interface VolcanoEngineMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 火山引擎 API 响应
 */
interface VolcanoEngineResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 豆包 LLM 适配器
 */
export class DoubaoLLM extends BaseLLM {
  /** API 配置 */
  private config: Required<VolcanoEngineConfig>;

  constructor(config: VolcanoEngineConfig & BaseLLMParams) {
    super(config);
    this.config = {
      apiKey: config.apiKey,
      endpoint: config.endpoint || 'https://ark.cn-beijing.volces.com/api/v3/chat',
      model: config.model || 'doubao-pro-4k',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2000,
      topP: config.topP ?? 0.9,
    };
  }

  /**
   * 调用 LLM 生成文本
   */
  async _call(
    prompt: string,
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    logger.info('[豆包LLM] 开始调用', { prompt: prompt.substring(0, 100) });

    try {
      const messages: VolcanoEngineMessage[] = [
        {
          role: 'user',
          content: prompt,
        },
      ];

      const response = await this.callVolcanoEngine(messages);

      logger.info('[豆包LLM] 调用成功', {
        tokens: response.usage.total_tokens,
      });

      return response.choices[0].message.content;
    } catch (error) {
      logger.error('[豆包LLM] 调用失败', error);
      throw error;
    }
  }

  /**
   * 批量生成
   */
  async _generate(
    prompts: string[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<{ generations: Array<{ text: string }> }> {
    logger.info('[豆包LLM] 批量生成', { count: prompts.length });

    const generations = [];

    for (const prompt of prompts) {
      const text = await this._call(prompt, options, runManager);
      generations.push({ text });
    }

    return { generations };
  }

  /**
   * 调用火山引擎 API
   */
  private async callVolcanoEngine(
    messages: VolcanoEngineMessage[]
  ): Promise<VolcanoEngineResponse> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: this.config.topP,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`火山引擎 API 错误: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * LLM 类型标识
   */
  _llmType(): string {
    return 'doubao-llm';
  }

  /**
   * 识别参数
   */
  _identify(params: Record<string, unknown>): string {
    return `doubao-${JSON.stringify(params)}`;
  }
}

/**
 * 创建豆包 LLM 实例
 */
export function createDoubaoLLM(config?: Partial<VolcanoEngineConfig>): DoubaoLLM {
  // 从环境变量读取配置
  const apiKey = config?.apiKey || process.env.VOLCANO_ENGINE_API_KEY || '';

  if (!apiKey) {
    logger.warn('[豆包LLM] 未配置 API Key，请设置 VOLCANO_ENGINE_API_KEY 环境变量');
  }

  return new DoubaoLLM({
    apiKey,
    ...config,
  });
}
