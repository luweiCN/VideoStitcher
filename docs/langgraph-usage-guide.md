# LangGraph 状态机框架使用指南

## 快速开始

### 1. 配置环境变量

复制 `.env.example` 到 `.env` 并配置火山引擎 API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
VOLCANO_ENGINE_API_KEY=your_actual_api_key
```

### 2. 使用 LangGraph 应用

```typescript
import { langgraphApp, createInitialState } from './langgraph';

// 脚本生成场景
const initialState = createInitialState({
  userRequirement: '为咖啡店制作宣传视频',
  selectedStyle: '幽默',
  batchSize: 3,
});

// 调用状态机
const result = await langgraphApp.invoke(initialState);

console.log('生成的脚本:', result.scripts);
```

### 3. 导演模式

```typescript
import { langgraphApp, createDirectorState } from './langgraph';

// 从选中的脚本进入导演模式
const directorState = createDirectorState({
  selectedScriptId: 'script-id',
  scripts: existingScripts,
  videoConfig: {
    length: 30,
    ratio: '16:9',
  },
});

// 执行导演模式流程
const result = await langgraphApp.invoke(directorState);

console.log('生成的视频:', result.videos);
```

### 4. 向量存储（知识库）

```typescript
import { vectorStore } from './rag/vectorStore';

// 添加文档
const docId = await vectorStore.addDocument({
  content: '这是一段高转化率的营销文案...',
  metadata: {
    source: '实机转化视频',
    conversionRate: 0.15,
  },
});

// 相似度搜索
const results = await vectorStore.similaritySearch('咖啡店宣传', 5);

console.log('相似文档:', results);
```

## 架构说明

### 状态流转

```
ScriptNode (脚本生成)
    ↓
    ├─→ END (等待用户选择)
    └─→ CharacterNode (角色设定)
            ↓
        StoryboardNode (分镜生成)
            ↓
        VideoNode (视频生成)
            ↓
            END
```

### 节点说明

#### 1. ScriptNode - 脚本生成节点
- 输入：用户需求、风格、数量
- 输出：脚本列表
- 功能：调用豆包 LLM API 批量生成脚本

#### 2. CharacterNode - 角色设定节点
- 输入：选中的脚本
- 输出：角色设定列表
- 功能：调用豆包 Vision API 生成角色概念图

#### 3. StoryboardNode - 分镜生成节点
- 输入：角色设定
- 输出：分镜场景列表
- 功能：调用豆包 Vision API 生成分镜图像

#### 4. VideoNode - 视频生成节点
- 输入：分镜场景
- 输出：视频 URL
- 功能：调用火山视频 API 渲染视频

## API 参考

### langgraphApp

编译后的 LangGraph 应用实例。

```typescript
import { langgraphApp } from './langgraph';

// 同步调用
const result = await langgraphApp.invoke(state);

// 流式调用（TODO）
const stream = await langgraphApp.stream(state);
```

### createInitialState

创建脚本生成的初始状态。

```typescript
function createInitialState(input: {
  userRequirement: string;
  selectedStyle: string;
  batchSize: number;
}): Partial<GraphStateType>;
```

### createDirectorState

创建导演模式的初始状态。

```typescript
function createDirectorState(input: {
  selectedScriptId: string;
  scripts: Script[];
  videoConfig: VideoConfig;
}): Partial<GraphStateType>;
```

### VectorStore

向量存储类。

```typescript
class VectorStore {
  // 添加文档
  async addDocument(doc: {
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<string>;

  // 批量添加
  async addDocuments(docs: Array<{...}>): Promise<string[]>;

  // 相似度搜索
  async similaritySearch(query: string, topK?: number): Promise<SimilaritySearchResult[]>;

  // 删除文档
  async deleteDocument(id: string): Promise<void>;

  // 获取文档
  async getDocument(id: string): Promise<VectorDocument | null>;

  // 获取文档数量
  async getDocumentCount(): Promise<number>;

  // 清空所有文档
  async clear(): Promise<void>;
}
```

### DoubaoLLM

豆包 LLM 适配器。

```typescript
import { createDoubaoLLM } from './models/llm/doubao';

const llm = createDoubaoLLM({
  apiKey: 'your-api-key', // 可选，默认从环境变量读取
  temperature: 0.7,
  maxTokens: 2000,
});

// 生成文本
const text = await llm._call('你的提示词');
```

### DoubaoEmbeddings

豆包 Embeddings 适配器。

```typescript
import { createDoubaoEmbeddings } from './models/embeddings/doubao';

const embeddings = createDoubaoEmbeddings({
  apiKey: 'your-api-key', // 可选，默认从环境变量读取
});

// 嵌入查询
const vector = await embeddings.embedQuery('你的文本');

// 嵌入文档
const vectors = await embeddings.embedDocuments(['文本1', '文本2']);
```

## 错误处理

所有节点函数都包含错误处理：

```typescript
const result = await langgraphApp.invoke(state);

if (result.error) {
  console.error('执行失败:', result.error);
} else {
  console.log('执行成功:', result);
}
```

## 日志

所有模块都使用统一的 logger：

```typescript
import { logger } from './utils/logger';

logger.info('[模块名] 操作描述', { 关键数据 });
logger.error('[模块名] 错误描述', error);
```

## 测试

```bash
# 编译检查
npm run build

# 运行测试（TODO）
npm test
```

## 注意事项

1. **API Key 安全**
   - 不要将 API Key 提交到代码仓库
   - 使用环境变量管理敏感信息

2. **速率限制**
   - 火山引擎 API 有调用频率限制
   - 批量操作时注意控制并发

3. **错误重试**
   - 网络错误会自动重试
   - 最大重试次数由 maxRetry 控制

4. **资源清理**
   - 定期清理已完成的任务进度
   - 定期备份知识库数据

## 后续开发

参考 `docs/langgraph-implementation-summary.md` 了解后续开发计划。
