# AI 统一模型管理系统 - 设计方案

## 📋 概述

**目标：** 实现配置驱动的 AI 模型管理系统，支持：
- ✅ 添加新模型只需修改配置文件
- ✅ 添加新供应商只需实现一个 Provider 适配器
- ✅ 业务代码使用统一接口，无需关心具体供应商
- ✅ 完全兼容 LangChain/LangGraph 工作流

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     业务层 (Aside 项目)                       │
│  - handleGenerateScreenplays()                              │
│  - 其他 AI 功能                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  AdapterRegistry (注册表)                    │
│  - getModel(provider, type, modelId) → UnifiedModel         │
│  - listModels(provider, type) → ModelInfo[]                 │
│  - 配置加载和验证                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  UnifiedModel (统一接口)                     │
│  - invoke(messages: UnifiedMessage[]) → UnifiedResponse     │
│  - stream(messages: UnifiedMessage[]) → AsyncIterable       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ProviderAdapter (供应商适配器)                  │
│  ├─ VolcEngineAdapter                                       │
│  │   ├─ VolcEngineLLMWrapper (文本)                         │
│  │   └─ VolcEngineImageWrapper (图片)                       │
│  ├─ OpenAIAdapter (未来)                                    │
│  └─ CustomAdapter (未来)                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              现有实现 (保留核心逻辑)                          │
│  - VolcEngineLLM (LangChain ChatOpenAI)                     │
│  - VolcEngineImage (HTTP API)                               │
│  - 其他供应商实现                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📦 核心类型定义

### 1. 统一消息格式 (`src/main/ai/types/unified.ts`)

```typescript
/**
 * 统一消息格式 - 兼容 LangChain BaseMessage
 */
export interface UnifiedMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | MessageContent[];

  // 可选元数据
  name?: string;           // 函数调用时的函数名
  id?: string;             // 消息唯一 ID
}

/**
 * 多模态消息内容
 */
export interface MessageContent {
  type: 'text' | 'image' | 'audio' | 'video';
  text?: string;           // 文本内容
  url?: string;            // 媒体 URL
  mimeType?: string;       // MIME 类型
}

/**
 * 统一响应格式
 */
export interface UnifiedResponse {
  content: string | ResponseContent[];  // 响应内容
  usage?: UsageMetrics;                 // Token 使用量
  metadata?: ResponseMetadata;          // 元数据
}

/**
 * 响应内容（多模态）
 */
export interface ResponseContent {
  type: 'text' | 'image' | 'audio' | 'video';
  text?: string;
  url?: string;
  revisedPrompt?: string;  // 图片生成时的重写提示词
}

/**
 * Token 使用量
 */
export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * 响应元数据
 */
export interface ResponseMetadata {
  provider: string;         // 供应商名称
  modelId: string;          // 模型 ID
  finishReason?: string;    // 停止原因
  created?: number;         // 创建时间戳
  latency?: number;         // 响应延迟（ms）
}

/**
 * 流式响应块
 */
export interface StreamChunk {
  content?: string;
  delta?: string;           // 增量内容
  usage?: Partial<UsageMetrics>;
  metadata?: Partial<ResponseMetadata>;
  done?: boolean;           // 是否完成
}
```

### 2. Provider 适配器接口 (`src/main/ai/types/adapter.ts`)

```typescript
/**
 * 供应商适配器接口
 * 所有供应商必须实现此接口
 */
export interface ProviderAdapter {
  /**
   * 同步调用
   */
  invoke(messages: UnifiedMessage[], options?: InvokeOptions): Promise<UnifiedResponse>;

  /**
   * 流式调用
   */
  stream(messages: UnifiedMessage[], options?: InvokeOptions): AsyncIterable<StreamChunk>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;

  /**
   * 获取模型信息
   */
  getModelInfo(): ModelInfo;
}

/**
 * 调用选项
 */
export interface InvokeOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];

  // 图片生成特定选项
  imageSize?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  imageStyle?: 'natural' | 'vivid';
  imageQuality?: 'standard' | 'hd';

  // 其他自定义选项
  [key: string]: any;
}
```

### 3. 模型信息 (`src/main/ai/types/model.ts`)

```typescript
/**
 * 模型类型
 */
export type ModelType = 'text' | 'image' | 'speech' | 'video';

/**
 * 模型能力特征
 */
export type ModelFeature =
  | 'function_calling'     // 函数调用
  | 'streaming'            // 流式响应
  | 'vision'               // 视觉理解
  | 'audio_input'          // 音频输入
  | 'audio_output'         // 音频输出
  | 'deep_reasoning'       // 深度思考
  | 'web_search'           // 网络搜索
  | 'hd_quality'           // 高清质量（图片）
  | 'revised_prompt';      // 重写提示词（图片）

/**
 * 模型信息
 */
export interface ModelInfo {
  id: string;                    // 模型 ID
  name: string;                  // 显示名称
  provider: string;              // 供应商名称
  type: ModelType;               // 模型类型
  inputTypes: string[];          // 输入类型
  outputTypes: string[];         // 输出类型
  features: ModelFeature[];      // 能力特征
  contextWindow?: number;        // 上下文窗口（tokens）
  maxOutputTokens?: number;      // 最大输出 tokens
  enabled?: boolean;             // 是否启用
}
```

## 🔧 核心实现

### 1. VolcEngine 适配器 (`src/main/ai/adapters/VolcEngineAdapter.ts`)

```typescript
import { VolcEngineLLM } from '../providers/volcengine/llm';
import { VolcEngineImage } from '../providers/volcengine/image';
import type { ProviderAdapter, UnifiedMessage, UnifiedResponse, StreamChunk, ModelInfo } from '../types';

export class VolcEngineTextAdapter implements ProviderAdapter {
  private llm: VolcEngineLLM;
  private modelInfo: ModelInfo;

  constructor(config: VolcEngineConfig, modelInfo: ModelInfo) {
    this.llm = new VolcEngineLLM(config);
    this.modelInfo = modelInfo;
  }

  async invoke(messages: UnifiedMessage[], options?: InvokeOptions): Promise<UnifiedResponse> {
    // 转换消息格式为 LangChain 格式
    const langchainMessages = this.convertMessages(messages);

    // 调用现有实现
    const result = await this.llm.generateText(
      langchainMessages[langchainMessages.length - 1].content,
      {
        systemPrompt: langchainMessages[0]?.role === 'system'
          ? langchainMessages[0].content
          : undefined,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      }
    );

    // 转换为统一响应格式
    return {
      content: result.content,
      usage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      metadata: {
        provider: 'volcengine',
        modelId: this.modelInfo.id,
        finishReason: result.finishReason,
      },
    };
  }

  async *stream(messages: UnifiedMessage[], options?: InvokeOptions): AsyncIterable<StreamChunk> {
    const langchainMessages = this.convertMessages(messages);

    const stream = this.llm.generateTextStream(
      langchainMessages[langchainMessages.length - 1].content,
      {
        systemPrompt: langchainMessages[0]?.role === 'system'
          ? langchainMessages[0].content
          : undefined,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      }
    );

    for await (const chunk of stream) {
      yield { content: chunk };
    }

    yield { done: true };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.llm.generateText('ping');
      return true;
    } catch {
      return false;
    }
  }

  getModelInfo(): ModelInfo {
    return this.modelInfo;
  }

  private convertMessages(messages: UnifiedMessage[]): Array<{role: string; content: string}> {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content[0].text || '',
    }));
  }
}

export class VolcEngineImageAdapter implements ProviderAdapter {
  // 类似实现，包装 VolcEngineImage
}
```

### 2. 适配器注册表 (`src/main/ai/registry/AdapterRegistry.ts`)

```typescript
export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters: Map<string, ProviderAdapter> = new Map();
  private config: AIConfig;

  static getInstance(): AdapterRegistry {
    if (!this.instance) {
      this.instance = new AdapterRegistry();
    }
    return this.instance;
  }

  constructor() {
    const configManager = new AIConfigManager();
    this.config = configManager.loadConfig();
    this.registerAllProviders();
  }

  /**
   * 获取模型实例
   */
  getModel(provider: string, type: ModelType, modelId: string): UnifiedModel {
    const key = `${provider}:${type}:${modelId}`;
    const adapter = this.adapters.get(key);

    if (!adapter) {
      throw new Error(`模型未注册: ${key}`);
    }

    return new UnifiedModel(adapter);
  }

  /**
   * 列出所有可用模型
   */
  listModels(provider?: string, type?: ModelType): ModelInfo[] {
    const models: ModelInfo[] = [];

    for (const [key, adapter] of this.adapters) {
      const [p, t, id] = key.split(':');
      if (provider && p !== provider) continue;
      if (type && t !== type) continue;
      models.push(adapter.getModelInfo());
    }

    return models;
  }

  /**
   * 注册所有供应商
   */
  private registerAllProviders(): void {
    // 注册火山引擎
    if (this.config.providers.volcengine?.enabled) {
      this.registerVolcEngine(this.config.providers.volcengine);
    }

    // 注册 OpenAI（如果启用）
    if (this.config.providers.openai?.enabled) {
      this.registerOpenAI(this.config.providers.openai);
    }
  }

  private registerVolcEngine(config: VolcEngineConfig): void {
    const models = config.models || {};

    // 注册文本模型
    (models.text || []).forEach(modelInfo => {
      const adapter = new VolcEngineTextAdapter(config, {
        ...modelInfo,
        provider: 'volcengine',
        type: 'text',
      });
      const key = `volcengine:text:${modelInfo.id}`;
      this.adapters.set(key, adapter);
    });

    // 注册图片模型
    (models.image || []).forEach(modelInfo => {
      const adapter = new VolcEngineImageAdapter(config, {
        ...modelInfo,
        provider: 'volcengine',
        type: 'image',
      });
      const key = `volcengine:image:${modelInfo.id}`;
      this.adapters.set(key, adapter);
    });
  }

  private registerOpenAI(config: OpenAIConfig): void {
    // 未来实现
  }
}
```

### 3. 统一模型包装器 (`src/main/ai/UnifiedModel.ts`)

```typescript
export class UnifiedModel {
  constructor(private adapter: ProviderAdapter) {}

  async invoke(messages: UnifiedMessage[], options?: InvokeOptions): Promise<UnifiedResponse> {
    return this.adapter.invoke(messages, options);
  }

  async *stream(messages: UnifiedMessage[], options?: InvokeOptions): AsyncIterable<StreamChunk> {
    return this.adapter.stream(messages, options);
  }

  getModelInfo(): ModelInfo {
    return this.adapter.getModelInfo();
  }

  async healthCheck(): Promise<boolean> {
    return this.adapter.healthCheck();
  }
}
```

## 📝 配置文件格式

### 新配置格式 (`~/Library/Application Support/video-stitcher/ai/ai-config.json`)

```json
{
  "defaultProvider": "volcengine",

  "providers": {
    "volcengine": {
      "enabled": true,
      "apiKey": "635a4f87-91d7-44f3-b09c-a580aa6ba835",
      "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",

      "models": {
        "text": [
          {
            "id": "doubao-1-5-pro-32k-250115",
            "name": "Doubao 1.5 Pro 32K",
            "inputTypes": ["text", "image"],
            "outputTypes": ["text"],
            "features": ["function_calling", "streaming"],
            "contextWindow": 32768,
            "maxOutputTokens": 32768
          }
        ],
        "image": [
          {
            "id": "doubao-seedream-3-0-t2i-250428",
            "name": "Doubao SeeDream 3.0",
            "inputTypes": ["text"],
            "outputTypes": ["image"],
            "features": [],
            "maxOutputTokens": 1
          }
        ]
      }
    }
  },

  "features": {
    "textGeneration": true,
    "imageGeneration": true,
    "speechSynthesis": false,
    "videoGeneration": true
  }
}
```

## 🚀 使用示例

### 业务代码调用（Aside 项目）

```typescript
// src/main/ipc/aside-handlers.ts

import { AdapterRegistry } from '../ai/registry/AdapterRegistry';
import type { UnifiedMessage } from '../ai/types';

async function handleGenerateScreenplays(event: IpcMainInvokeEvent, request: GenerateScreenplaysRequest) {
  const registry = AdapterRegistry.getInstance();

  // 获取模型（可以通过配置或用户选择）
  const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');

  // 构建统一消息
  const messages: UnifiedMessage[] = [
    {
      role: 'system',
      content: '你是一位专业的短视频剧本编剧...',
    },
    {
      role: 'user',
      content: `请根据以下创意方向生成剧本：${request.direction}`,
    },
  ];

  // 调用模型（统一接口）
  const response = await model.invoke(messages, {
    temperature: 0.8,
    maxTokens: 2000,
  });

  // 使用统一响应格式
  const screenplays = parseScreenplays(response.content as string);

  return {
    success: true,
    screenplays,
    usage: response.usage,
  };
}
```

### 添加新模型（仅修改配置）

```json
{
  "providers": {
    "volcengine": {
      "models": {
        "text": [
          {
            "id": "doubao-1-5-pro-32k-250115",
            "name": "Doubao 1.5 Pro 32K",
            "inputTypes": ["text"],
            "outputTypes": ["text"],
            "features": ["function_calling"],
            "contextWindow": 32768,
            "maxOutputTokens": 32768
          },
          // 添加新模型
          {
            "id": "doubao-1-5-pro-256k-250115",
            "name": "Doubao 1.5 Pro 256K",
            "inputTypes": ["text", "image"],
            "outputTypes": ["text"],
            "features": ["function_calling", "streaming", "vision"],
            "contextWindow": 256000,
            "maxOutputTokens": 4096
          }
        ]
      }
    }
  }
}
```

### 添加新供应商（实现一个适配器）

```typescript
// src/main/ai/adapters/OpenAIAdapter.ts

export class OpenAITextAdapter implements ProviderAdapter {
  private client: OpenAI;
  private modelInfo: ModelInfo;

  constructor(config: OpenAIConfig, modelInfo: ModelInfo) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.modelInfo = modelInfo;
  }

  async invoke(messages: UnifiedMessage[], options?: InvokeOptions): Promise<UnifiedResponse> {
    const openaiMessages = this.convertMessages(messages);

    const response = await this.client.chat.completions.create({
      model: this.modelInfo.id,
      messages: openaiMessages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    return {
      content: response.choices[0].message.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      metadata: {
        provider: 'openai',
        modelId: this.modelInfo.id,
        finishReason: response.choices[0].finish_reason,
      },
    };
  }

  // 实现 stream(), healthCheck(), getModelInfo()...
}
```

## 📂 文件结构

```
src/main/ai/
├── types/
│   ├── unified.ts          # 统一消息和响应类型
│   ├── adapter.ts          # 适配器接口
│   └── model.ts            # 模型信息类型
│
├── adapters/
│   ├── VolcEngineAdapter.ts    # 火山引擎适配器
│   ├── OpenAIAdapter.ts        # OpenAI 适配器（未来）
│   └── index.ts
│
├── providers/
│   ├── volcengine/
│   │   ├── llm.ts              # 现有实现（保留）
│   │   └── image.ts            # 现有实现（保留）
│   └── interface.ts
│
├── registry/
│   └── AdapterRegistry.ts      # 适配器注册表
│
├── UnifiedModel.ts             # 统一模型包装器
│
└── config/
    ├── manager.ts              # 配置管理器
    └── schema.ts               # 配置 Schema
```

## ✅ 实施步骤

### Phase 1: 核心类型定义（2 小时）
1. 创建 `types/unified.ts` - 统一消息和响应类型
2. 创建 `types/adapter.ts` - 适配器接口
3. 创建 `types/model.ts` - 模型信息类型

### Phase 2: 火山引擎适配器（4 小时）
1. 创建 `adapters/VolcEngineAdapter.ts`
2. 实现 `VolcEngineTextAdapter`（包装现有 LLM）
3. 实现 `VolcEngineImageAdapter`（包装现有 Image）
4. 单元测试

### Phase 3: 适配器注册表（3 小时）
1. 创建 `registry/AdapterRegistry.ts`
2. 实现配置加载逻辑
3. 实现模型注册和获取
4. 单元测试

### Phase 4: 配置迁移（2 小时）
1. 更新 `config/schema.ts` - 添加模型配置
2. 编写配置迁移脚本
3. 更新 `AIConfigManager`
4. 手动测试配置加载

### Phase 5: 业务集成（3 小时）
1. 更新 Aside 项目 `aside-handlers.ts`
2. 测试剧本生成功能
3. 性能测试
4. 文档更新

**总计：14 小时（约 2 个工作日）**

## 🎯 验收标准

- [x] 新模型只需修改配置文件（无需改代码）
- [x] 新供应商只需实现一个适配器类
- [x] 业务代码使用统一接口（`getModel().invoke()`）
- [x] 完全兼容 LangChain（消息格式可转换）
- [x] 现有功能不受影响（向后兼容）
- [x] 单元测试覆盖率 > 80%
- [x] 文档完整（配置指南 + 开发指南）

## 📚 后续扩展

1. **支持流式响应 UI** - 前端显示 AI 生成过程
2. **模型负载均衡** - 自动选择最快的模型
3. **成本追踪** - 记录每个请求的 token 消耗
4. **模型 A/B 测试** - 对比不同模型效果
5. **自定义模型端点** - 支持本地部署模型

---

**准备好开始实施了吗？** 确认后我将立即开始创建文件和代码。
