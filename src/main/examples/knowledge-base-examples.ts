/**
 * 知识库使用示例
 * 演示如何使用 RAG 知识库系统
 */

import { knowledgeBase } from './services/KnowledgeBase';
import { logger } from './utils/logger';

/**
 * 示例 1：上传视频脚本素材
 */
async function uploadScriptExample() {
  logger.info('=== 示例 1：上传视频脚本素材 ===');

  const materialId = await knowledgeBase.uploadMaterial({
    type: 'script',
    content: `
标题：揭秘咖啡的制作过程
风格：教学科普

开场（3 秒）：
每天早上，你都会喝一杯香浓的咖啡。但你知道吗？一杯咖啡背后，有超过 50 个人的努力...

发展（15 秒）：
从埃塞俄比亚的高原到你的杯中，咖啡豆经历了漫长的旅程。
第一步，采摘：只有完全成熟的咖啡果才能被选中。
第二步，处理：水洗法能保留咖啡的清爽酸度，日晒法则带来浓郁甜感。
第三步，烘焙：200 度的高温下，咖啡豆膨胀、裂开，释放出 800 多种芳香物质。

高潮（10 秒）：
当 92 度的热水冲过新鲜研磨的咖啡粉，那一刻，芳香物质被瞬间释放...
深吸一口气，你能闻到花香、果香、坚果香...

结尾（5 秒）：
下次喝咖啡时，记得感谢那些辛勤的咖啡农。
关注我，带你看更多美食背后的故事。

数据：播放量 10W+，点赞 5000+，分享 500+
    `,
    metadata: {
      category: 'food',
      style: 'educational',
      views: 100000,
      likes: 5000,
      shares: 500,
      duration: 33,
      author: '美食探秘',
      tags: ['咖啡', '科普', '美食', '制作过程'],
    },
  });

  logger.info('素材上传成功', { materialId });
  return materialId;
}

/**
 * 示例 2：批量上传素材
 */
async function batchUploadExample() {
  logger.info('=== 示例 2：批量上传素材 ===');

  const materials = [
    {
      type: 'script' as const,
      content: `
标题：30 秒学会做番茄炒蛋
风格：教学科普

开场：番茄炒蛋，中国家庭最常见的家常菜。
发展：但 90% 的人都做错了！
高潮：先炒蛋还是先炒番茄？答案是...先炒蛋！
结尾：关注我，学会更多家常菜做法。
      `,
      metadata: {
        category: 'cooking',
        style: 'educational',
        views: 50000,
        likes: 2000,
      },
    },
    {
      type: 'script' as const,
      content: `
标题：悬疑故事：午夜的电话
风格：悬疑推理

开场：凌晨 3 点，电话响了。显示的是...已故母亲的号码。
发展：颤抖着接起电话，听筒里传来熟悉的声音："孩子，别去那个地方..."
高潮：她猛然想起，今晚本该去那座废弃的老宅探险。
结尾：电话断了，窗外传来脚步声...
      `,
      metadata: {
        category: 'story',
        style: 'suspense',
        views: 80000,
        likes: 4000,
      },
    },
    {
      type: 'script' as const,
      content: `
标题：搞笑：当程序员遇到 Bug
风格：幽默搞笑

开场：程序员的一天：早上充满信心，晚上怀疑人生。
发展：Bug 就在那里，不增不减...等等，怎么又多了两个？
高潮：终于找到 Bug 了！原来是少了个分号...
结尾：程序员的快乐就是这么简单。
      `,
      metadata: {
        category: 'comedy',
        style: 'humorous',
        views: 200000,
        likes: 10000,
      },
    },
  ];

  const materialIds = [];
  for (const material of materials) {
    const id = await knowledgeBase.uploadMaterial(material);
    materialIds.push(id);
    logger.info('素材上传成功', { materialId: id });
  }

  return materialIds;
}

/**
 * 示例 3：相似度检索
 */
async function searchExample() {
  logger.info('=== 示例 3：相似度检索 ===');

  // 检索与"美食教学"相关的脚本
  const query = '如何制作美食教学视频的开场';
  const results = await knowledgeBase.searchSimilar(query, 5);

  logger.info('检索结果', { query, resultCount: results.length });

  results.forEach((result, index) => {
    logger.info(`案例 ${index + 1}`, {
      相似度: `${(result.score * 100).toFixed(1)}%`,
      内容预览: result.content.substring(0, 100) + '...',
      元数据: result.metadata,
    });
  });

  return results;
}

/**
 * 示例 4：按风格检索
 */
async function searchByStyleExample() {
  logger.info('=== 示例 4：按风格检索 ===');

  // 检索"幽默搞笑"风格的脚本
  const query = '幽默搞笑 风格 视频脚本';
  const results = await knowledgeBase.searchSimilar(query, 3);

  logger.info('幽默搞笑风格检索结果', { resultCount: results.length });

  results.forEach((result, index) => {
    logger.info(`幽默案例 ${index + 1}`, {
      相似度: `${(result.score * 100).toFixed(1)}%`,
      标题: result.metadata?.title || '无标题',
    });
  });

  return results;
}

/**
 * 示例 5：获取知识库统计信息
 */
async function statsExample() {
  logger.info('=== 示例 5：获取知识库统计信息 ===');

  const stats = await knowledgeBase.getStats();

  logger.info('知识库统计', {
    总文档数: stats.totalDocuments,
    总素材数: stats.totalMaterials,
  });

  return stats;
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  try {
    logger.info('开始运行知识库示例');

    // 1. 上传单个素材
    const materialId1 = await uploadScriptExample();

    // 2. 批量上传素材
    const materialIds = await batchUploadExample();

    // 3. 相似度检索
    const searchResults = await searchExample();

    // 4. 按风格检索
    const styleResults = await searchByStyleExample();

    // 5. 获取统计信息
    const stats = await statsExample();

    logger.info('所有示例运行完成', {
      上传素材数: 1 + materialIds.length,
      检索结果数: searchResults.length + styleResults.length,
      知识库统计: stats,
    });
  } catch (error) {
    logger.error('示例运行失败', error);
    throw error;
  }
}

// 导出示例函数
export {
  uploadScriptExample,
  batchUploadExample,
  searchExample,
  searchByStyleExample,
  statsExample,
  runAllExamples,
};
