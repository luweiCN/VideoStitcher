# VolcEngine 适配器集成方案

## 概述

评估现有 VolcEngine 实现（LLM 和 Image）与新统一适配器接口的兼容性，并提出集成方案。

## 现有实现分析

### 1. VolcEngineLLM (文本生成)

**文件位置：** `src/main/ai/providers/volcengine/llm.ts`

**实现方式：**
- 使用 LangChain 的 `ChatOpenAI` 适配器（火山引擎兼容 OpenAI 协议）
- 实现 `generateText` 和 `generateTextStream` 方法
- 返回 `TextGenerationResult` 接口

**优点：**
- ✅ 已使用 LangChain 生态，兼容性好
- ✅ 流式实现符合 AsyncGenerator 模式
- ✅ 返回结构相对标准化

**返回格式示例：**
```typescript
interface TextGenerationResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}
```

**兼容性评估：** ⭐⭐⭐⭐ (4/5)
- 只需添加消息格式转换层
- Usage 字段可直接映射
- 保留 LangChain 调用逻辑

### 2. VolcEngineImage (图片生成)

**文件位置：** `src/main/ai/providers/volcengine/image.ts`

**实现方式：**
- 直接 HTTP API 调用（非 LangChain）
- 自定义响应解析逻辑 `VolcEngineImageResponse`
- 实现了重试机制和指数退避

**优点：**
- ✅ 完整的重试逻辑
- ✅ 支持 URL 和 base64 响应格式
- ✅ 参数构建逻辑清晰

**问题：**
- ⚠️ 使用定制 HTTP 调用，非标准化
- ⚠️ VolcEngine 特有响应格式
- ⚠️ 缺少适配器接口层

**返回格式示例：**
```typescript
interface ImageGenerationResult {
  images: Array<{
    url: string;
    revisedPrompt?: string;
  }>;
  created: number;
}
```

**兼容性评估：** ⭐⭐⭐ (3/5)
- 需要包装为 `ProviderAdapter`
- 保留重试逻辑作为内部实现
- 统一响应格式

## 集成方案

### 方案选择：**包装模式（Wrapper Pattern）**

**理由：**
1. 保留现有业务逻辑和重试机制
2. 避免重写带来的风险
3. 快速集成，渐进式重构
4. 现有实现功能稳定，无需大改

### 实施步骤

#### Phase 1: 创建适配器包装层

**1.1 实现 `VolcEngineLLMAdapter`**

```typescript
// src/main/ai/adapters/VolcEngineLLMAdapter.ts

import { VolcEngineLLM } from '../providers/volcengine/llm';
import type { ProviderAdapter, UnifiedMessage, UnifiedResponse } from '../types';

export class VolcEngineLLMAdapter implements ProviderAdapter {
  private llm: VolcEngineLLM;

  constructor(config: VolcEngineConfig) {
    this.llm = new VolcEngineLLM(config);
  }

  async invoke(messages: UnifiedMessage[]): Promise<UnifiedResponse> {
    // 转换消息格式
    const langchainMessages = this.convertMessages(messages);

    // 调用现有实现
    const result = await this.llm.generateText(
      langchainMessages[langchainMessages.length - 1].content,
      {
        systemPrompt: langchainMessages[0]?.role === 'system'
          ? langchainMessages[0].content
          : undefined,
      }
    );

    // 转换响应格式
    return {
      content: result.content,
      usage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
      metadata: {
        finishReason: result.finishReason,
        provider: 'volcengine',
      },
    };
  }

  async *stream(messages: UnifiedMessage[]): AsyncIterable<StreamChunk> {
    // 转换消息格式
    const langchainMessages = this.convertMessages(messages);

    // 调用现有流式实现
    const stream = this.llm.generateTextStream(
      langchainMessages[langchainMessages.length - 1].content,
      {
        systemPrompt: langchainMessages[0]?.role === 'system'
          ? langchainMessages[0].content
          : undefined,
      }
    );

    for await (const chunk of stream) {
      yield { content: chunk };
    }
  }

  private convertMessages(messages: UnifiedMessage[]): LangChainMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }
}
```

**1.2 实现 `VolcEngineImageAdapter`**

```typescript
// src/main/ai/adapters/VolcEngineImageAdapter.ts

import { VolcEngineImage } from '../providers/volcengine/image';
import type { ProviderAdapter, UnifiedMessage, UnifiedResponse } from '../types';

export class VolcEngineImageAdapter implements ProviderAdapter {
  private imageGen: VolcEngineImage;

  constructor(config: VolcEngineConfig) {
    this.imageGen = new VolcEngineImage(config);
  }

  async invoke(messages: UnifiedMessage[]): Promise<UnifiedResponse> {
    // 图片生成：提取提示词
    const prompt = messages[messages.length - 1].content;

    // 调用现有实现
    const result = await this.imageGen.generateImage(prompt);

    // 转换响应格式
    return {
      content: result.images.map(img => ({
        type: 'image',
        url: img.url,
        revisedPrompt: img.revisedPrompt,
      })),
      metadata: {
        provider: 'volcengine',
        created: result.created,
      },
    };
  }

  // 图片生成通常不支持流式
  async *stream(messages: UnifiedMessage[]): AsyncIterable<StreamChunk> {
    throw new Error('Image generation does not support streaming');
  }
}
```

#### Phase 2: 注册到适配器注册表

```typescript
// src/main/ai/registry/AdapterRegistry.ts

import { VolcEngineLLMAdapter } from '../adapters/VolcEngineLLMAdapter';
import { VolcEngineImageAdapter } from '../adapters/VolcEngineImageAdapter';

export class AdapterRegistry {
  registerVolcEngine(config: VolcEngineConfig) {
    // 文本模型
    this.register('volcengine', 'text', {
      'doubao-1-5-pro-32k-250115': () => new VolcEngineLLMAdapter(config),
    });

    // 图片模型
    this.register('volcengine', 'image', {
      'doubao-seedream-3-0-t2i-250428': () => new VolcEngineImageAdapter(config),
    });
  }
}
```

#### Phase 3: 配置文件迁移

**3.1 更新配置格式**

```json
{
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
            "features": ["function_calling"],
            "maxTokens": 32768,
            "contextWindow": 32768
          }
        ],
        "image": [
          {
            "id": "doubao-seedream-3-0-t2i-250428",
            "name": "Doubao SeeDream 3.0",
            "inputTypes": ["text"],
            "outputTypes": ["image"],
            "features": [],
            "maxTokens": 1,
            "contextWindow": 0
          }
        ]
      }
    }
  }
}
```

**3.2 配置迁移脚本**

```typescript
// scripts/migrate-ai-config.ts

import { AIConfigManager } from '../src/main/ai/config/manager';
import { writeFileSync } from 'fs';

function migrateConfig() {
  const oldConfig = new AIConfigManager().loadConfig();

  const newConfig = {
    providers: {
      volcengine: {
        enabled: oldConfig.providers.volcengine?.enabled ?? false,
        apiKey: oldConfig.providers.volcengine?.apiKey,
        baseUrl: oldConfig.providers.volcengine?.baseUrl,
        models: {
          text: [
            {
              id: oldConfig.providers.volcengine?.model || 'doubao-1-5-pro-32k-250115',
              name: 'Doubao 1.5 Pro 32K',
              inputTypes: ['text'],
              outputTypes: ['text'],
              features: ['function_calling'],
              maxTokens: 32768,
              contextWindow: 32768,
            },
          ],
          image: [
            {
              id: 'doubao-seedream-3-0-t2i-250428',
              name: 'Doubao SeeDream 3.0',
              inputTypes: ['text'],
              outputTypes: ['image'],
              features: [],
              maxTokens: 1,
              contextWindow: 0,
            },
          ],
        },
      },
    },
  };

  writeFileSync('config/ai-config.new.json', JSON.stringify(newConfig, null, 2));
  console.log('配置迁移完成，新配置文件: config/ai-config.new.json');
}

migrateConfig();
```

#### Phase 4: 更新调用方

**4.1 Aside 项目调用示例**

```typescript
// src/main/ipc/aside-handlers.ts

import { AdapterRegistry } from '../ai/registry/AdapterRegistry';
import type { UnifiedMessage } from '../ai/types';

async function handleGenerateScreenplays(event: IpcMainInvokeEvent, request: GenerateScreenplaysRequest) {
  const registry = AdapterRegistry.getInstance();

  // 获取统一模型
  const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');

  // 构建统一消息
  const messages: UnifiedMessage[] = [
    { role: 'system', content: '你是一位专业的短视频剧本编剧...' },
    { role: 'user', content: `请根据创意方向生成剧本...` },
  ];

  // 调用模型
  const response = await model.invoke(messages);

  // 使用统一响应格式
  const screenplays = parseScreenplays(response.content);

  return {
    success: true,
    screenplays,
    usage: response.usage,
  };
}
```

## 实施优先级

### 🔴 **P0 - 高优先级**（立即实施）

1. **定义统一类型** (`src/main/ai/types.ts`)
   - `UnifiedMessage`
   - `UnifiedResponse`
   - `StreamChunk`
   - `ProviderAdapter` 接口

2. **实现 `VolcEngineLLMAdapter`**
   - 文本生成是核心功能
   - Aside 项目立即需要

### 🟡 **P1 - 中优先级**（本周完成）

3. **实现 `VolcEngineImageAdapter`**
   - 图片生成功能已有实现
   - 需要包装以对齐接口

4. **实现 `AdapterRegistry`**
   - 模型注册和获取
   - 配置加载

### 🟢 **P2 - 低优先级**（后续迭代）

5. **配置迁移工具**
   - 自动化配置格式转换
   - 向后兼容性

6. **添加 OpenAI 适配器**
   - 作为第二个供应商示例
   - 验证适配器模式通用性

## 风险评估

### ⚠️ **风险点**

1. **消息格式转换**
   - LangChain 消息格式 vs 统一格式
   - 需要保证转换无损

2. **流式响应兼容性**
   - 现有 AsyncGenerator 需要对齐
   - 错误处理需要统一

3. **配置迁移**
   - 旧配置格式需要兼容
   - 用户需要迁移指南

### ✅ **缓解措施**

1. **渐进式迁移**
   - 保留旧接口一段时间
   - 新旧接口并存

2. **充分测试**
   - 单元测试覆盖适配器
   - 集成测试验证兼容性

3. **回滚计划**
   - 保留旧代码分支
   - 配置回滚机制

## 时间估算

| 任务 | 预计时间 | 备注 |
|------|---------|------|
| 类型定义 | 2h | `types.ts` 文件 |
| VolcEngineLLMAdapter | 4h | 包装现有实现 |
| VolcEngineImageAdapter | 3h | 包装现有实现 |
| AdapterRegistry | 3h | 注册和获取逻辑 |
| 配置迁移脚本 | 2h | 自动化工具 |
| 测试编写 | 4h | 单元和集成测试 |
| **总计** | **18h** | **约 3 个工作日** |

## 验收标准

### ✅ **完成标准**

- [ ] 统一类型定义完成并通过类型检查
- [ ] `VolcEngineLLMAdapter` 能正确调用现有 LLM 实现
- [ ] `VolcEngineImageAdapter` 能正确调用现有 Image 实现
- [ ] 消息格式转换无损且可逆
- [ ] 统一响应格式符合规范
- [ ] Aside 项目能通过新接口生成剧本
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过

### 🚫 **不包含**

- ❌ 不实现 OpenAI 适配器（后续任务）
- ❌ 不修改现有 VolcEngine 实现的核心逻辑
- ❌ 不重写配置加载机制（仅包装）

## 下一步行动

**立即开始：**

1. 创建 `src/main/ai/types.ts` 文件，定义统一类型
2. 实现 `VolcEngineLLMAdapter`
3. 编写单元测试验证适配器

**准备就绪后：**

4. 实现适配器注册表
5. 集成到 Aside 项目
6. 执行配置迁移

---

**结论：** 现有 VolcEngine 实现可以通过包装模式快速集成到新的统一适配器架构中，无需重写核心逻辑。推荐优先实施 P0 任务，确保 Aside 项目能尽快使用新接口。
