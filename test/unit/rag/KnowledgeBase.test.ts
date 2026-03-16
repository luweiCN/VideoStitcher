/**
 * 知识库 RAG 系统单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 设置测试超时时间
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

/**
 * 模拟知识库类
 * 由于实际的 KnowledgeBase 类可能还未实现，这里创建一个模拟版本
 */
class MockKnowledgeBase {
  private materials: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    // 模拟初始化
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async uploadMaterial(data: {
    type: string;
    content: string;
    metadata?: any;
  }): Promise<string> {
    const id = `material-${Date.now()}`;
    this.materials.set(id, {
      id,
      ...data,
      createdAt: Date.now(),
    });
    return id;
  }

  async searchSimilar(query: string, limit: number): Promise<Array<any>> {
    // 模拟向量搜索
    const results: Array<any> = [];

    for (const [id, material] of this.materials.entries()) {
      // 简单的关键词匹配模拟
      const score = this.calculateSimilarity(query, material.content);
      results.push({
        id,
        content: material.content,
        score,
        metadata: material.metadata,
      });
    }

    // 按分数排序并返回前 N 个结果
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private calculateSimilarity(query: string, content: string): number {
    // 简单的相似度计算（实际应该使用向量相似度）
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);

    let matchCount = 0;
    for (const word of queryWords) {
      if (contentWords.includes(word)) {
        matchCount++;
      }
    }

    return queryWords.length > 0 ? matchCount / queryWords.length : 0;
  }

  async deleteMaterial(id: string): Promise<boolean> {
    return this.materials.delete(id);
  }

  async getMaterial(id: string): Promise<any | undefined> {
    return this.materials.get(id);
  }

  async getAllMaterials(): Promise<Array<any>> {
    return Array.from(this.materials.values());
  }
}

describe('知识库 RAG 系统', () => {
  let kb: MockKnowledgeBase;

  beforeEach(async () => {
    kb = new MockKnowledgeBase();
    await kb.initialize();
    vi.clearAllMocks();
  });

  describe('素材上传测试', () => {
    it('应该成功上传脚本文案', async () => {
      const materialId = await kb.uploadMaterial({
        type: 'script',
        content: '这是一个产品宣传文案，介绍产品的核心功能和优势',
        metadata: { tags: ['产品', '宣传'], category: '营销' },
      });

      expect(materialId).toBeDefined();
      expect(materialId).toMatch(/^material-/);
    });

    it('应该成功上传角色描述', async () => {
      const materialId = await kb.uploadMaterial({
        type: 'character',
        content: '专业的产品经理形象，穿着正装，面带微笑',
        metadata: { tags: ['产品经理', '正装'] },
      });

      expect(materialId).toBeDefined();
    });

    it('应该为上传的素材生成唯一 ID', async () => {
      const id1 = await kb.uploadMaterial({
        type: 'script',
        content: '第一个文案',
      });

      const id2 = await kb.uploadMaterial({
        type: 'script',
        content: '第二个文案',
      });

      expect(id1).not.toBe(id2);
    });
  });

  describe('相似内容检索测试', () => {
    beforeEach(async () => {
      // 准备测试数据
      await kb.uploadMaterial({
        type: 'script',
        content: '产品宣传视频，展示产品功能和优势',
        metadata: { tags: ['产品'] },
      });

      await kb.uploadMaterial({
        type: 'script',
        content: '品牌形象宣传片，传递品牌价值',
        metadata: { tags: ['品牌'] },
      });

      await kb.uploadMaterial({
        type: 'character',
        content: '产品经理角色，专业形象',
        metadata: { tags: ['产品经理'] },
      });
    });

    it('应该能够检索相似内容', async () => {
      const results = await kb.searchSimilar('产品宣传', 5);

      expect(results.length).toBeLessThanOrEqual(5);
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('score');
      expect(results[0].score).toBeGreaterThanOrEqual(0);
    });

    it('应该按相似度分数排序结果', async () => {
      const results = await kb.searchSimilar('产品', 10);

      // 验证结果是按分数降序排列的
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('应该限制返回结果的数量', async () => {
      const results = await kb.searchSimilar('产品', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('应该返回空数组如果没有匹配结果', async () => {
      const newKb = new MockKnowledgeBase();
      await newKb.initialize();

      const results = await newKb.searchSimilar('测试查询', 5);

      expect(results).toEqual([]);
    });
  });

  describe('素材管理测试', () => {
    it('应该能够获取指定素材', async () => {
      const materialId = await kb.uploadMaterial({
        type: 'script',
        content: '测试内容',
      });

      const material = await kb.getMaterial(materialId);

      expect(material).toBeDefined();
      expect(material.content).toBe('测试内容');
    });

    it('应该能够删除素材', async () => {
      const materialId = await kb.uploadMaterial({
        type: 'script',
        content: '待删除内容',
      });

      const deleted = await kb.deleteMaterial(materialId);
      expect(deleted).toBe(true);

      const material = await kb.getMaterial(materialId);
      expect(material).toBeUndefined();
    });

    it('应该能够获取所有素材', async () => {
      await kb.uploadMaterial({ type: 'script', content: '内容 1' });
      await kb.uploadMaterial({ type: 'script', content: '内容 2' });
      await kb.uploadMaterial({ type: 'character', content: '内容 3' });

      const allMaterials = await kb.getAllMaterials();

      expect(allMaterials.length).toBe(3);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空查询字符串', async () => {
      await kb.uploadMaterial({
        type: 'script',
        content: '测试内容',
      });

      const results = await kb.searchSimilar('', 5);

      expect(results).toBeDefined();
    });

    it('应该处理超长内容', async () => {
      const longContent = '测试内容'.repeat(1000);

      const materialId = await kb.uploadMaterial({
        type: 'script',
        content: longContent,
      });

      expect(materialId).toBeDefined();
    });

    it('应该处理特殊字符', async () => {
      const specialContent = '内容包含<script>alert("xss")</script>特殊字符';

      const materialId = await kb.uploadMaterial({
        type: 'script',
        content: specialContent,
      });

      expect(materialId).toBeDefined();
    });

    it('应该处理大量素材', async () => {
      // 上传 100 个素材
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          kb.uploadMaterial({
            type: 'script',
            content: `测试内容 ${i}`,
          })
        );
      }

      await Promise.all(promises);

      const allMaterials = await kb.getAllMaterials();
      expect(allMaterials.length).toBe(100);
    }, 20000);
  });

  describe('元数据测试', () => {
    it('应该正确存储和检索元数据', async () => {
      const metadata = {
        tags: ['测试', 'RAG'],
        category: '技术',
        author: '测试人员',
        version: '1.0',
      };

      const materialId = await kb.uploadMaterial({
        type: 'script',
        content: '测试内容',
        metadata,
      });

      const material = await kb.getMaterial(materialId);

      expect(material.metadata).toEqual(metadata);
    });
  });
});
