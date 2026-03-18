# 统一 AI 模型管理系统 - 使用指南

## 📚 快速开始

### 1. 基本使用

```typescript
import { AdapterRegistry } from '../ai/registry/AdapterRegistry';

// 获取注册表实例（单例）
const registry = AdapterRegistry.getInstance();

// 获取模型
const model = registry.getModel(
  'volcengine',        // 供应商
  'text',              // 模型类型
  'doubao-1-5-pro-32k-250115'  // 模型 ID
);

// 调用模型
const response = await model.invoke([
  { role: 'system', content: '你是一个助手' },
  { role: 'user', content: '你好' }
]);

console.log(response.content);
```

### 2. 使用默认模型

```typescript
// 获取默认文本模型
const model = registry.getDefaultModel('text');

// 获取默认图片模型
const imageModel = registry.getDefaultModel('image');
```

### 3. 流式调用

```typescript
// 流式生成文本
for await (const chunk of model.stream(messages)) {
  if (chunk.delta) {
    process.stdout.write(chunk.delta);
  }
  if (chunk.done) {
    console.log('\n完成');
  }
}
```

### 4. 列出可用模型

```typescript
// 列出所有模型
const allModels = registry.listModels();

// 列出特定供应商的模型
const volcengineModels = registry.listModels('volcengine');

// 列出特定类型的模型
const textModels = registry.listModels('volcengine', 'text');
```

---

## 📝 配置文件

### 配置文件位置

- **macOS**: `~/Library/Application Support/video-stitcher/ai/ai-config.json`
- **Windows**: `%APPDATA%\video-stitcher\ai\ai-config.json`
- **Linux**: `~/.config/video-stitcher/ai/ai-config.json`

### 配置格式

```json
{
  "defaultProvider": "volcengine",

  "providers": {
    "volcengine": {
      "enabled": true,
      "apiKey": "${VOLCENGINE_API_KEY}",
      "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",

      "models": {
        "text": [
          {
            "id": "doubao-1-5-pro-32k-250115",
            "name": "Doubao 1.5 Pro 32K",
            "inputTypes": ["text"],
            "outputTypes": ["text"],
            "features": ["function_calling", "streaming"],
            "contextWindow": 32768,
            "maxOutputTokens": 32768,
            "enabled": true
          }
        ],
        "image": [
          {
            "id": "doubao-seedream-3-0-t2i-250428",
            "name": "Doubao SeeDream 3.0",
            "inputTypes": ["text"],
            "outputTypes": ["image"],
            "features": [],
            "maxOutputTokens": 1,
            "enabled": true
          }
        ]
      }
    }
  }
}
```

### 环境变量

推荐使用环境变量存储 API Key：

```bash
# .env 文件
VOLCENGINE_API_KEY=your-api-key-here
OPENAI_API_KEY=your-openai-key-here
```

---

## 🔧 添加新模型

### 方法 1: 修改配置文件

只需在配置文件的 `models` 数组中添加新模型：

```json
{
  "providers": {
    "volcengine": {
      "models": {
        "text": [
          {
            "id": "doubao-1-5-pro-256k-250115",
            "name": "Doubao 1.5 Pro 256K",
            "inputTypes": ["text", "image"],
            "outputTypes": ["text"],
            "features": ["function_calling", "streaming", "vision"],
            "contextWindow": 256000,
            "maxOutputTokens": 4096,
            "enabled": true
          }
        ]
      }
    }
  }
}
```

保存后，重新加载配置：

```typescript
const registry = AdapterRegistry.getInstance();
registry.reload();
```

### 方法 2: 使用代码动态添加（未来支持）

```typescript
// TODO: 动态注册模型
registry.registerModel('volcengine', 'text', modelConfig, adapterFactory);
```

---

## 🚀 添加新供应商

### 步骤 1: 创建适配器

```typescript
// src/main/ai/adapters/MyProviderAdapter.ts

import type { ProviderAdapter, UnifiedMessage, UnifiedResponse, StreamChunk } from '../types';
import type { ModelInfo } from '../types/model';

export class MyProviderTextAdapter implements ProviderAdapter {
  constructor(config: any, modelInfo: ModelInfo) {
    // 初始化你的供应商客户端
  }

  async invoke(messages: UnifiedMessage[], options?: any): Promise<UnifiedResponse> {
    // 1. 转换消息格式为你的供应商格式
    // 2. 调用供应商 API
    // 3. 转换响应为统一格式
    return {
      content: '...',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      metadata: { provider: 'myprovider', modelId: 'xxx' }
    };
  }

  async *stream(messages: UnifiedMessage[], options?: any): AsyncIterable<StreamChunk> {
    // 实现流式调用
    yield { delta: 'chunk1' };
    yield { delta: 'chunk2' };
    yield { done: true };
  }

  async healthCheck(): Promise<boolean> {
    // 实现健康检查
    return true;
  }

  getModelInfo(): ModelInfo {
    return this.modelInfo;
  }
}
```

### 步骤 2: 在注册表中注册

```typescript
// src/main/ai/registry/AdapterRegistry.ts

private registerMyProvider(config: MyProviderConfig): void {
  const models = config.models || {};

  (models.text || []).forEach((modelConfig) => {
    const modelInfo: ModelInfo = {
      ...modelConfig,
      provider: 'myprovider',
      type: 'text',
    };

    const adapter = new MyProviderTextAdapter(config, modelInfo);
    const key = `myprovider:text:${modelConfig.id}`;

    this.adapters.set(key, adapter);
  });
}
```

### 步骤 3: 更新配置 Schema

```typescript
// src/main/ai/config/schema.ts

export interface MyProviderConfig extends ProviderConfig {
  models?: ProviderModelsConfig;
}

export interface AIConfig {
  providers: {
    volcengine?: VolcEngineConfig;
    openai?: OpenAIConfig;
    myprovider?: MyProviderConfig;  // 添加你的供应商
  };
}
```

### 步骤 4: 添加配置

```json
{
  "providers": {
    "myprovider": {
      "enabled": true,
      "apiKey": "${MYPROVIDER_API_KEY}",
      "models": {
        "text": [
          {
            "id": "model-1",
            "name": "My Model 1",
            "inputTypes": ["text"],
            "outputTypes": ["text"],
            "features": ["streaming"],
            "enabled": true
          }
        ]
      }
    }
  }
}
```

---

## 🎯 最佳实践

### 1. 使用环境变量存储 API Key

```bash
# .env
VOLCENGINE_API_KEY=xxx
```

```json
{
  "providers": {
    "volcengine": {
      "apiKey": "${VOLCENGINE_API_KEY}"
    }
  }
}
```

### 2. 使用默认模型简化代码

```typescript
// 不需要记住具体的模型 ID
const model = registry.getDefaultModel('text');
```

### 3. 流式响应提升用户体验

```typescript
// 对于长文本生成，使用流式
for await (const chunk of model.stream(messages)) {
  updateUI(chunk.delta);
}
```

### 4. 错误处理

```typescript
try {
  const response = await model.invoke(messages);
  // 处理响应
} catch (error) {
  console.error('模型调用失败:', error);
  // 降级到备用模型或显示错误
}
```

### 5. 健康检查

```typescript
// 在应用启动时检查模型可用性
const model = registry.getDefaultModel('text');
const isHealthy = await model.healthCheck();

if (!isHealthy) {
  console.warn('默认模型不可用，请检查配置');
}
```

---

## 🐛 故障排查

### 问题 1: 找不到模型

**错误**: `模型未注册: volcengine:text:doubao-1-5-pro-32k-250115`

**解决**:
1. 检查配置文件中是否配置了该模型
2. 确认模型 ID 拼写正确
3. 调用 `registry.reload()` 重新加载配置

### 问题 2: API Key 无效

**错误**: `401 Unauthorized`

**解决**:
1. 检查环境变量是否正确设置
2. 确认 API Key 有效且未过期
3. 查看配置文件中 `apiKey` 字段

### 问题 3: 配置文件损坏

**解决**:
1. 备份并删除现有配置文件
2. 重启应用，系统会创建默认配置
3. 重新配置 API Key

---

## 📖 API 参考

### AdapterRegistry

```typescript
class AdapterRegistry {
  // 获取单例实例
  static getInstance(): AdapterRegistry;

  // 获取模型
  getModel(provider: string, type: ModelType, modelId: string): UnifiedModel;

  // 获取默认模型
  getDefaultModel(type: ModelType): UnifiedModel | null;

  // 列出所有模型
  listModels(provider?: string, type?: ModelType): ModelInfo[];

  // 获取默认供应商
  getDefaultProvider(): string;

  // 重新加载配置
  reload(): void;
}
```

### UnifiedModel

```typescript
class UnifiedModel {
  // 同步调用
  invoke(messages: UnifiedMessage[], options?: InvokeOptions): Promise<UnifiedResponse>;

  // 流式调用
  stream(messages: UnifiedMessage[], options?: InvokeOptions): AsyncIterable<StreamChunk>;

  // 健康检查
  healthCheck(): Promise<boolean>;

  // 获取模型信息
  getModelInfo(): ModelInfo;
}
```

---

## 🔄 迁移指南

### 从旧配置迁移到新配置

1. **自动迁移**（推荐）

```typescript
import { migrateConfig } from '../ai/config/migration';

const oldConfig = loadOldConfig();
const newConfig = migrateConfig(oldConfig);
saveConfig(newConfig);
```

2. **手动迁移**

将旧配置：
```json
{
  "providers": {
    "volcengine": {
      "model": "doubao-1-5-pro-32k-250115",
      "imageModel": "doubao-seedream-3-0-t2i-250428"
    }
  }
}
```

转换为新配置：
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
            "features": []
          }
        ]
      }
    }
  }
}
```

---

## 🎉 完成！

你现在掌握了统一 AI 模型管理系统的使用方法。如有问题，请查看示例代码或联系开发团队。
