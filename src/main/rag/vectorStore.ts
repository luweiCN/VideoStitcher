/**
 * 向量存储
 * 使用 SQLite + sqlite-vec 实现向量存储和检索
 */

import { getDatabase } from '../database/index';
import { logger } from '../utils/logger';
import { createDoubaoEmbeddings } from '../models/embeddings/doubao';
import type { Database } from 'better-sqlite3';

/**
 * 向量文档结构
 */
export interface VectorDocument {
  /** 文档 ID */
  id: string;
  /** 文档内容 */
  content: string;
  /** 向量（查询时可能为空） */
  embedding?: number[];
  /** 元数据 */
  metadata?: Record<string, unknown>;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 相似度搜索结果
 */
export interface SimilaritySearchResult {
  /** 文档 ID */
  id: string;
  /** 文档内容 */
  content: string;
  /** 相似度分数 (0-1，越大越相似) */
  score: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 向量存储类
 */
export class VectorStore {
  private db: Database;
  private embeddings = createDoubaoEmbeddings();
  private initialized = false;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 初始化向量存储
   * 创建必要的表和索引
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 创建知识库文档表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata TEXT,
          created_at INTEGER NOT NULL
        )
      `);

      // 创建向量表（使用 sqlite-vec 扩展）
      // 注意：sqlite-vec 需要在数据库初始化时加载扩展
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vectors USING vec0(
          id TEXT PRIMARY KEY,
          embedding BLOB NOT NULL
        )
      `);

      // 创建索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at
        ON knowledge_documents(created_at DESC)
      `);

      logger.info('[向量存储] 初始化完成');
      this.initialized = true;
    } catch (error) {
      logger.error('[向量存储] 初始化失败', error);
      throw error;
    }
  }

  /**
   * 添加文档
   */
  async addDocument(doc: Omit<VectorDocument, 'id' | 'createdAt'>): Promise<string> {
    await this.initialize();

    try {
      // 生成向量
      const embedding = await this.embeddings.embedQuery(doc.content);

      // 生成 ID
      const id = this.generateId();

      // 插入文档
      const stmt = this.db.prepare(`
        INSERT INTO knowledge_documents (id, content, metadata, created_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        id,
        doc.content,
        doc.metadata ? JSON.stringify(doc.metadata) : null,
        Date.now()
      );

      // 插入向量
      // 注意：sqlite-vec 使用 BLOB 存储向量
      const vectorStmt = this.db.prepare(`
        INSERT INTO knowledge_vectors (id, embedding)
        VALUES (?, ?)
      `);

      const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);
      vectorStmt.run(id, embeddingBuffer);

      logger.info('[向量存储] 文档添加成功', { id, contentLength: doc.content.length });

      return id;
    } catch (error) {
      logger.error('[向量存储] 添加文档失败', error);
      throw error;
    }
  }

  /**
   * 批量添加文档
   */
  async addDocuments(docs: Array<Omit<VectorDocument, 'id' | 'createdAt'>>): Promise<string[]> {
    const ids: string[] = [];

    for (const doc of docs) {
      const id = await this.addDocument(doc);
      ids.push(id);
    }

    return ids;
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(
    query: string,
    topK: number = 5
  ): Promise<SimilaritySearchResult[]> {
    await this.initialize();

    try {
      // 生成查询向量
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const queryBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);

      // 使用 sqlite-vec 进行向量相似度搜索
      const stmt = this.db.prepare(`
        SELECT
          v.id,
          d.content,
          d.metadata,
          vec_distance_cosine(v.embedding, ?) as distance
        FROM knowledge_vectors v
        JOIN knowledge_documents d ON v.id = d.id
        ORDER BY distance ASC
        LIMIT ?
      `);

      const rows = stmt.all(queryBuffer, topK) as Array<{
        id: string;
        content: string;
        metadata: string | null;
        distance: number;
      }>;

      // 转换为结果格式
      const results: SimilaritySearchResult[] = rows.map((row) => ({
        id: row.id,
        content: row.content,
        score: 1 - row.distance, // 距离转换为相似度（0-1，越大越相似）
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

      logger.info('[向量存储] 相似度搜索完成', {
        query: query.substring(0, 50),
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error('[向量存储] 相似度搜索失败', error);
      throw error;
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(id: string): Promise<void> {
    await this.initialize();

    try {
      // 删除向量
      const vectorStmt = this.db.prepare('DELETE FROM knowledge_vectors WHERE id = ?');
      vectorStmt.run(id);

      // 删除文档
      const docStmt = this.db.prepare('DELETE FROM knowledge_documents WHERE id = ?');
      docStmt.run(id);

      logger.info('[向量存储] 文档删除成功', { id });
    } catch (error) {
      logger.error('[向量存储] 删除文档失败', error);
      throw error;
    }
  }

  /**
   * 获取文档
   */
  async getDocument(id: string): Promise<VectorDocument | null> {
    await this.initialize();

    try {
      const stmt = this.db.prepare(`
        SELECT id, content, metadata, created_at
        FROM knowledge_documents
        WHERE id = ?
      `);

      const row = stmt.get(id) as {
        id: string;
        content: string;
        metadata: string | null;
        created_at: number;
      } | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        content: row.content,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('[向量存储] 获取文档失败', error);
      throw error;
    }
  }

  /**
   * 获取所有文档数量
   */
  async getDocumentCount(): Promise<number> {
    await this.initialize();

    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM knowledge_documents');
    const row = stmt.get() as { count: number };

    return row.count;
  }

  /**
   * 清空所有文档
   */
  async clear(): Promise<void> {
    await this.initialize();

    try {
      this.db.exec('DELETE FROM knowledge_vectors');
      this.db.exec('DELETE FROM knowledge_documents');

      logger.info('[向量存储] 已清空所有文档');
    } catch (error) {
      logger.error('[向量存储] 清空文档失败', error);
      throw error;
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// 导出单例
export const vectorStore = new VectorStore();
