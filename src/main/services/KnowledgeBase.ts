/**
 * 知识库管理服务
 * 负责知识库的上传、检索和管理
 */

import { v4 as uuidv4 } from 'uuid';
import { vectorStore, type SimilaritySearchResult } from '../rag/vectorStore';
import logger from '../utils/logger';

/**
 * 素材类型
 */
export type MaterialType = 'video' | 'script' | 'image' | 'text';

/**
 * 上传素材参数
 */
export interface UploadMaterialParams {
  /** 素材类型 */
  type: MaterialType;
  /** 素材内容（文本） */
  content: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 素材 ID */
  materialId: string;
  /** 内容片段 */
  content: string;
  /** 相似度分数 (0-1) */
  score: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 块索引 */
  chunkIndex?: number;
}

/**
 * 知识库管理类
 */
export class KnowledgeBase {
  /**
   * 上传素材到知识库
   * @param params 上传参数
   * @returns 素材 ID
   */
  async uploadMaterial(params: UploadMaterialParams): Promise<string> {
    logger.info('[知识库] 开始上传素材', {
      type: params.type,
      contentLength: params.content.length,
    });

    try {
      // 验证输入
      if (!params.content || params.content.trim().length === 0) {
        throw new Error('素材内容不能为空');
      }

      // 1. 文本预处理和分块
      const chunks = await this.splitText(params.content);

      logger.info('[知识库] 文本分块完成', {
        chunkCount: chunks.length,
        avgChunkSize:
          chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length,
      });

      // 2. 生成素材 ID
      const materialId = uuidv4();

      // 3. 存储到向量数据库
      for (let i = 0; i < chunks.length; i++) {
        await vectorStore.addDocument({
          content: chunks[i],
          metadata: {
            materialId,
            type: params.type,
            chunkIndex: i,
            totalChunks: chunks.length,
            uploadedAt: Date.now(),
            ...params.metadata,
          },
        });

        logger.info('[知识库] 块存储完成', {
          materialId,
          chunkIndex: i + 1,
          totalChunks: chunks.length,
        });
      }

      logger.info('[知识库] 素材上传完成', { materialId });

      return materialId;
    } catch (error) {
      logger.error('[知识库] 上传素材失败', error);
      throw error;
    }
  }

  /**
   * 相似度检索
   * @param query 查询文本
   * @param topK 返回数量（默认 5）
   * @returns 搜索结果列表
   */
  async searchSimilar(query: string, topK: number = 5): Promise<SearchResult[]> {
    logger.info('[知识库] 开始相似度检索', {
      query: query.substring(0, 50),
      topK,
    });

    try {
      // 验证输入
      if (!query || query.trim().length === 0) {
        throw new Error('查询文本不能为空');
      }

      // 调用向量存储检索
      const results = await vectorStore.similaritySearch(query, topK);

      // 转换为 SearchResult 格式
      const searchResults: SearchResult[] = results.map((result) => ({
        materialId: result.metadata?.materialId as string,
        content: result.content,
        score: result.score,
        metadata: result.metadata,
        chunkIndex: result.metadata?.chunkIndex as number,
      }));

      logger.info('[知识库] 相似度检索完成', {
        resultCount: searchResults.length,
        avgScore:
          searchResults.reduce((sum, r) => sum + r.score, 0) /
          searchResults.length,
      });

      return searchResults;
    } catch (error) {
      logger.error('[知识库] 相似度检索失败', error);
      throw error;
    }
  }

  /**
   * 批量删除素材
   * @param materialId 素材 ID
   */
  async deleteMaterial(materialId: string): Promise<void> {
    logger.info('[知识库] 开始删除素材', { materialId });

    try {
      // TODO: 实现根据 materialId 批量删除
      // 当前实现需要先查询所有文档，然后逐个删除
      // 可以考虑在 vectorStore 中添加 deleteByMaterialId 方法
      logger.warn('[知识库] 删除功能待实现');
    } catch (error) {
      logger.error('[知识库] 删除素材失败', error);
      throw error;
    }
  }

  /**
   * 获取知识库统计信息
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalMaterials: number;
  }> {
    try {
      const totalDocuments = await vectorStore.getDocumentCount();

      // TODO: 实现统计唯一素材数量
      const totalMaterials = totalDocuments;

      return {
        totalDocuments,
        totalMaterials,
      };
    } catch (error) {
      logger.error('[知识库] 获取统计信息失败', error);
      throw error;
    }
  }

  /**
   * 文本分块
   * @param text 原始文本
   * @returns 分块后的文本数组
   */
  private async splitText(text: string): Promise<string[]> {
    const chunks: string[] = [];
    const chunkSize = 500; // 块大小：500 字符
    const overlap = 50; // 重叠大小：50 字符

    // 如果文本很短，直接返回
    if (text.length <= chunkSize) {
      return [text];
    }

    // 按照重叠窗口切分
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize);

      // 确保块不为空
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }

      // 如果已经到达文本末尾，停止
      if (i + chunkSize >= text.length) {
        break;
      }
    }

    return chunks;
  }
}

// 导出单例
export const knowledgeBase = new KnowledgeBase();
