# RAG 知识库使用指南

## 概述

RAG（Retrieval-Augmented Generation）知识库系统用于存储和检索视频脚本、素材等知识，帮助 AI 生成更优质的内容。

## 系统架构

```
┌─────────────┐
│   用户界面   │
└──────┬──────┘
       │ IPC 通信
       ▼
┌─────────────────────────────────┐
│      KnowledgeBase Service      │
│  ┌─────────────────────────┐   │
│  │  uploadMaterial()       │   │
│  │  searchSimilar()        │   │
│  │  deleteMaterial()       │   │
│  └─────────────────────────┘   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│       VectorStore              │
│  ┌─────────────────────────┐   │
│  │  SQLite (文档存储)       │   │
│  │  sqlite-vec (向量索引)   │   │
│  └─────────────────────────┘   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   DoubaoEmbeddings (豆包 API)   │
│   向量维度: 1536                │
└─────────────────────────────────┘
```

## RAG 检索流程

```
┌──────────────┐
│ 用户输入需求  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ 文本嵌入 (豆包 API)   │
│ 需求 → 1536 维向量    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 向量相似度检索        │
│ cosine similarity    │
│ Top-K: 5             │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 返回相关文档片段      │
│ (按相似度排序)        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 构建上下文            │
│ 注入 LLM Prompt       │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 豆包 LLM 生成脚本     │
└──────────────────────┘
```

## API 使用示例

### 1. 上传素材到知识库

```typescript
// 在渲染进程中
const result = await window.electron.ipcRenderer.invoke('knowledge:upload', {
  type: 'script',
  content: `
    这是一个成功的视频脚本案例：

    标题：揭秘咖啡的制作过程
    风格：教学科普

    开场：每天早上，你都会喝一杯香浓的咖啡。但你知道吗？一杯咖啡背后，有超过 50 个人的努力...

    发展：从埃塞俄比亚的高原到你的杯中，咖啡豆经历了采摘、发酵、烘焙、研磨...

    高潮：当 92 度的热水冲过咖啡粉，那一刻，芳香物质被瞬间释放...

    结尾：下次喝咖啡时，记得感谢那些辛勤的咖啡农。
  `,
  metadata: {
    category: 'food',
    views: 10000,
    likes: 500,
  },
});

console.log('素材 ID:', result.materialId);
```

### 2. 检索相关素材

```typescript
// 检索与"美食制作"相关的素材
const searchResult = await window.electron.ipcRenderer.invoke(
  'knowledge:search',
  '如何制作美食视频脚本',
  5  // topK
);

console.log('找到', searchResult.results.length, '个相关案例');

searchResult.results.forEach((result, index) => {
  console.log(`\n案例 ${index + 1}:`);
  console.log('相似度:', (result.score * 100).toFixed(1) + '%');
  console.log('内容:', result.content.substring(0, 100) + '...');
});
```

### 3. 获取知识库统计信息

```typescript
const stats = await window.electron.ipcRenderer.invoke('knowledge:stats');

console.log('总文档数:', stats.totalDocuments);
console.log('总素材数:', stats.totalMaterials);
```

### 4. 在脚本生成中使用知识库

```typescript
// 脚本生成节点会自动检索知识库
const result = await scriptNode(state, {
  onProgress: (progress, message) => {
    console.log(`${progress}%: ${message}`);
  },
  enableKnowledgeRetrieval: true,  // 启用知识库检索（默认启用）
});

// 生成的脚本会参考知识库中的成功案例
console.log(result.scripts);
```

## 技术参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 向量维度 | 1536 | 豆包 Embeddings API 输出维度 |
| 分块大小 | 500 字符 | 长文本自动分块存储 |
| 分块重叠 | 50 字符 | 避免信息丢失 |
| 检索 Top-K | 5 | 默认返回最相似的 5 个结果 |
| 相似度算法 | cosine | 余弦相似度（0-1，越大越相似） |

## 最佳实践

### 1. 素材内容格式

```typescript
// ✅ 推荐：结构化的脚本内容
{
  type: 'script',
  content: `
    标题：XXX
    风格：幽默搞笑

    开场：（3 秒）吸引注意力的开场白
    发展：（15 秒）主要内容展开
    高潮：（10 秒）情感爆发点
    结尾：（5 秒）行动号召

    数据：播放量 10W+，点赞 5000+
  `,
}

// ❌ 不推荐：无结构的文本
{
  type: 'script',
  content: '这是一个关于咖啡的视频...',
}
```

### 2. 元数据使用

```typescript
// 添加丰富的元数据，便于后续筛选
{
  type: 'script',
  content: '...',
  metadata: {
    // 基本信息
    category: 'food',           // 分类
    style: 'educational',       // 风格

    // 性能指标
    views: 10000,               // 播放量
    likes: 500,                 // 点赞数
    shares: 50,                 // 分享数

    // 制作信息
    duration: 30,               // 时长（秒）
    createdAt: '2024-01-01',    // 创建时间
    author: '张三',              // 作者

    // 标签
    tags: ['咖啡', '科普', '美食'],
  },
}
```

### 3. 检索优化

```typescript
// ✅ 推荐：具体的查询语句
await knowledgeBase.searchSimilar('美食教学类视频的开场技巧', 5);

// ❌ 不推荐：过于宽泛的查询
await knowledgeBase.searchSimilar('视频', 5);
```

## 文件结构

```
src/main/
├── services/
│   └── KnowledgeBase.ts        # 知识库管理服务
├── rag/
│   └── vectorStore.ts          # 向量存储（SQLite + sqlite-vec）
├── models/embeddings/
│   └── doubao.ts               # 豆包 Embeddings 适配器
├── langgraph/nodes/
│   └── scriptNode.ts           # 脚本生成节点（已集成 RAG）
└── ipc/
    └── aside-handlers.ts       # IPC 处理器（已添加知识库通道）
```

## 数据库表结构

### documents 表（文档存储）

```sql
CREATE TABLE knowledge_documents (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  metadata TEXT,                -- JSON 格式
  created_at INTEGER NOT NULL
);
```

### vectors 表（向量索引）

```sql
CREATE VIRTUAL TABLE knowledge_vectors USING vec0(
  id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL       -- Float32 数组
);
```

## 性能考虑

1. **批量上传**：一次性上传多个素材时，会逐个处理，避免 API 限流
2. **向量缓存**：已生成的向量会存储在数据库中，无需重复计算
3. **索引优化**：sqlite-vec 使用虚拟表实现高效的向量检索
4. **内存管理**：使用 Buffer 存储 Float32 向量，减少内存占用

## 错误处理

```typescript
try {
  const result = await knowledgeBase.uploadMaterial(params);
} catch (error) {
  if (error.message.includes('API Key')) {
    console.error('请配置 VOLCANO_ENGINE_API_KEY 环境变量');
  } else if (error.message.includes('素材内容不能为空')) {
    console.error('请提供有效的素材内容');
  } else {
    console.error('上传失败:', error.message);
  }
}
```

## 后续优化方向

1. **增量更新**：支持根据 materialId 批量删除和更新素材
2. **分类检索**：支持按 category、style 等维度筛选
3. **混合检索**：结合关键词检索和向量检索，提升准确率
4. **性能监控**：添加检索耗时、命中率等指标
5. **缓存机制**：对高频查询结果进行缓存
