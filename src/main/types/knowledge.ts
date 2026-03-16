/**
 * 知识库相关类型定义
 */

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
 * 知识库统计信息
 */
export interface KnowledgeStats {
  /** 总文档数 */
  totalDocuments: number;
  /** 总素材数 */
  totalMaterials: number;
}
