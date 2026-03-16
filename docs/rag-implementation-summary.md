# RAG 知识库实现总结

## 完成情况

已成功实现完整的 RAG（Retrieval-Augmented Generation）知识库系统，包括向量存储、知识库管理、IPC 通信和脚本生成集成。

## 创建的文件列表

### 1. 核心服务

- **`src/main/services/KnowledgeBase.ts`** (新建)
  - 知识库管理服务
  - 提供素材上传、检索、删除等功能
  - 实现文本分块逻辑（500 字符/块，50 字符重叠）
  - 导出单例 `knowledgeBase`

### 2. IPC 处理器

- **`src/main/ipc/aside-handlers.ts`** (修改)
  - 添加 `knowledge:upload` - 上传素材到知识库
  - 添加 `knowledge:search` - 相似度检索
  - 添加 `knowledge:stats` - 获取统计信息
  - 所有处理器均已注册到 IPC Main

### 3. 脚本生成集成

- **`src/main/langgraph/nodes/scriptNode.ts`** (修改)
  - 添加知识库检索功能
  - 在生成脚本前自动检索相关案例
  - 将检索结果注入 LLM Prompt
  - 添加 `enableKnowledgeRetrieval` 配置项

### 4. 类型定义

- **`src/main/types/knowledge.ts`** (新建)
  - `MaterialType` - 素材类型
  - `UploadMaterialParams` - 上传参数
  - `SearchResult` - 搜索结果
  - `KnowledgeStats` - 统计信息

### 5. 文档

- **`docs/rag-knowledge-base-guide.md`** (新建)
  - 完整的使用指南
  - API 使用示例
  - 技术参数说明
  - 最佳实践建议
  - 错误处理示例

- **`docs/rag-architecture.md`** (新建)
  - 系统架构图
  - 流程图（素材上传、相似度检索、脚本生成）
  - 数据流向图
  - 技术栈说明
  - 性能指标

### 6. 示例代码

- **`src/main/examples/knowledge-base-examples.ts`** (新建)
  - 单个素材上传示例
  - 批量上传示例
  - 相似度检索示例
  - 按风格检索示例
  - 统计信息查询示例

## 已存在的文件（无需修改）

以下文件已存在并正常工作：

- **`src/main/rag/vectorStore.ts`** - 向量存储（SQLite + sqlite-vec）
- **`src/main/models/embeddings/doubao.ts`** - 豆包 Embeddings 适配器

## 技术实现细节

### 1. 向量存储

```typescript
// 使用 SQLite + sqlite-vec
- 文档表: knowledge_documents (id, content, metadata, created_at)
- 向量表: knowledge_vectors (id, embedding BLOB)
- 向量维度: 1536 (豆包 Embeddings)
- 相似度算法: cosine similarity
```

### 2. 文本分块

```typescript
// 分块策略
- 块大小: 500 字符
- 重叠大小: 50 字符
- 避免语义截断，提高检索准确性
```

### 3. 知识库检索

```typescript
// 检索流程
1. 用户需求 → 生成查询向量 (1536 维)
2. sqlite-vec 执行 cosine similarity 检索
3. 返回 Top-K (默认 5) 个最相关文档
4. 按相似度排序 (0-1，越大越相似)
```

### 4. 脚本生成集成

```typescript
// RAG 增强的脚本生成
1. 检索知识库: searchSimilar(style + requirement, 5)
2. 构建上下文: 格式化检索结果为 Prompt
3. 注入 LLM: 将上下文添加到生成 Prompt
4. 生成脚本: 豆包 LLM 基于上下文生成内容
```

## IPC 通道列表

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `knowledge:upload` | `{type, content, metadata}` | `{success, materialId?, error?}` | 上传素材 |
| `knowledge:search` | `query, topK?` | `{success, results?, error?}` | 相似度检索 |
| `knowledge:stats` | - | `{success, stats?, error?}` | 获取统计信息 |

## 使用示例

### 在渲染进程中上传素材

```typescript
// 上传视频脚本素材
const result = await window.electron.ipcRenderer.invoke('knowledge:upload', {
  type: 'script',
  content: `
    标题：揭秘咖啡的制作过程
    风格：教学科普

    开场：每天早上，你都会喝一杯香浓的咖啡...
    发展：从埃塞俄比亚的高原到你的杯中...
    高潮：当 92 度的热水冲过咖啡粉...
    结尾：下次喝咖啡时，记得感谢那些咖啡农。
  `,
  metadata: {
    category: 'food',
    style: 'educational',
    views: 100000,
    likes: 5000,
  },
});

console.log('素材 ID:', result.materialId);
```

### 在渲染进程中检索素材

```typescript
// 检索相关素材
const searchResult = await window.electron.ipcRenderer.invoke(
  'knowledge:search',
  '如何制作美食教学视频',
  5
);

searchResult.results.forEach((result, index) => {
  console.log(`案例 ${index + 1}:`);
  console.log('相似度:', (result.score * 100).toFixed(1) + '%');
  console.log('内容:', result.content);
});
```

### 在脚本生成中使用（自动）

```typescript
// scriptNode 自动集成知识库检索
const result = await scriptNode(state, {
  onProgress: (progress, message) => {
    console.log(`${progress}%: ${message}`);
  },
  enableKnowledgeRetrieval: true,  // 默认启用
});

// 生成的脚本会参考知识库中的成功案例
console.log(result.scripts);
```

## RAG 检索流程图

```
用户输入需求
     │
     ▼
文本嵌入 (豆包 API)
需求 → 1536 维向量
     │
     ▼
向量相似度检索
cosine similarity
Top-K: 5
     │
     ▼
返回相关文档片段
(按相似度排序)
     │
     ▼
构建上下文
注入 LLM Prompt
     │
     ▼
豆包 LLM 生成脚本
(参考知识库案例)
     │
     ▼
返回生成的脚本
```

## 性能指标

| 指标 | 值 | 说明 |
|------|-----|------|
| 向量维度 | 1536 | 豆包 Embeddings 输出 |
| 分块大小 | 500 字符 | 平衡精度和速度 |
| 分块重叠 | 50 字符 | 避免语义截断 |
| 检索 Top-K | 5 | 默认返回 5 个结果 |
| 相似度算法 | cosine | 余弦相似度 (0-1) |

## 构建验证

```bash
npm run build
```

输出：
```
✓ built in 287ms (main)
✓ built in 18ms (preload)
✓ built in 2.22s (renderer)

成功生成：
- out/main/chunks/KnowledgeBase-BpP7dAra.js (12.43 kB)
- 所有模块正常编译
```

## 后续优化建议

1. **批量删除** - 实现根据 `materialId` 批量删除相关文档
2. **分类检索** - 支持按 `category`、`style` 等维度筛选
3. **混合检索** - 结合关键词检索和向量检索
4. **性能监控** - 添加检索耗时、命中率等指标
5. **缓存机制** - 对高频查询结果进行缓存
6. **增量更新** - 支持素材内容的更新而不重新上传
7. **相似度阈值** - 支持设置最低相似度阈值
8. **检索日志** - 记录检索历史，用于分析和优化

## 总结

✅ 完整实现 RAG 知识库系统
✅ 集成到脚本生成流程
✅ 提供完整的 IPC 通信接口
✅ 添加类型定义和示例代码
✅ 编写详细的使用文档和架构图
✅ 所有代码通过构建验证
✅ 符合项目代码规范（中文注释、日志）

系统已准备就绪，可以立即使用！
