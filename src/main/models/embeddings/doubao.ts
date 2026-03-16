/**
 * 火山引擎豆包 Embeddings 适配器
 * 封装火山引擎 Embeddings API 调用，实现 LangChain Embeddings 接口
 */

import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import logger from '../../utils/logger';

/**
 * 火山引擎 Embeddings 配置
 */
interface VolcanoEngineEmbeddingsConfig {
  /** API Key */
  apiKey: string;
  /** API 端点 */
  endpoint?: string;
  /** 模型名称 */
  model?: string;
  /** 批处理大小 */
  batchSize?: number;
}

/**
 * 火山引擎 Embeddings API 响应
 */
interface VolcanoEngineEmbeddingsResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * 豆包 Embeddings 适配器
 */
export class DoubaoEmbeddings extends Embeddings {
  /** API 配置 */
  private config: Required<VolcanoEngineEmbeddingsConfig>;

  constructor(config: VolcanoEngineEmbeddingsConfig & EmbeddingsParams) {
    super(config);
    this.config = {
      apiKey: config.apiKey,
      endpoint: config.endpoint || 'https://ark.cn-beijing.volces.com/api/v3/embeddings',
      model: config.model || 'doubao-embedding',
      batchSize: config.batchSize ?? 20,
    };
  }

  /**
   * 嵌入文档
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    logger.info('[豆包Embeddings] 开始嵌入文档', { count: texts.length });

    const embeddings: number[][] = [];

    // 批处理
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      const batchEmbeddings = await this.embedBatch(batch);
      embeddings.push(...batchEmbeddings);

      logger.info('[豆包Embeddings] 批次完成', {
        batch: Math.floor(i / this.config.batchSize) + 1,
        total: Math.ceil(texts.length / this.config.batchSize),
      });
    }

    logger.info('[豆包Embeddings] 文档嵌入完成', { count: embeddings.length });

    return embeddings;
  }

  /**
   * 嵌入单个查询
   */
  async embedQuery(query: string): Promise<number[]> {
    logger.info('[豆包Embeddings] 嵌入查询', { query: query.substring(0, 50) });

    const embeddings = await this.embedBatch([query]);
    return embeddings[0];
  }

  /**
   * 批量嵌入
   */
  private async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`火山引擎 Embeddings API 错误: ${response.status} - ${error}`);
      }

      const result: VolcanoEngineEmbeddingsResponse = await response.json();

      // 按索引排序
      result.data.sort((a, b) => a.index - b.index);

      return result.data.map((item) => item.embedding);
    } catch (error) {
      logger.error('[豆包Embeddings] 批量嵌入失败', error);
      throw error;
    }
  }

  /**
   * Embeddings 类型标识
   */
  _embeddingsType(): string {
    return 'doubao-embeddings';
  }

  /**
   * 识别参数
   */
  _identify(params: Record<string, unknown>): string {
    return `doubao-embeddings-${JSON.stringify(params)}`;
  }
}

/**
 * 创建豆包 Embeddings 实例
 */
export function createDoubaoEmbeddings(
  config?: Partial<VolcanoEngineEmbeddingsConfig>
): DoubaoEmbeddings {
  // 从环境变量读取配置
  const apiKey = config?.apiKey || process.env.VOLCANO_ENGINE_API_KEY || '';

  if (!apiKey) {
    logger.warn('[豆包Embeddings] 未配置 API Key，请设置 VOLCANO_ENGINE_API_KEY 环境变量');
  }

  return new DoubaoEmbeddings({
    apiKey,
    ...config,
  });
}
