# 火山引擎 AI 提供商

完整的火山引擎 AI 服务集成实现。

## 功能概述

### ✅ 已实现功能

| 功能 | 状态 | 模型 | 说明 |
|------|------|------|------|
| 文本生成 | ✅ | 豆包大模型 (doubao-pro-32k) | 支持流式生成 |
| 图片生成 | ✅ | Seedream 3.0 | 支持多种尺寸和质量 |
| 语音合成 | ⏳ | - | 占位实现（未来扩展） |
| 视频生成 | ⏳ | - | 占位实现（未来扩展） |

## 快速开始

### 1. 导入模块

```typescript
import { createVolcEngineProvider } from './ai/providers/volcengine';
import type { ProviderConfig } from './ai/providers/interface';
```

### 2. 配置提供商

```typescript
const config: ProviderConfig = {
  type: 'volcengine',
  apiKey: 'your-api-key-here',  // 火山引擎 API Key
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',  // 可选，默认值
  model: 'doubao-pro-32k',  // 可选，默认值
  features: {
    textGeneration: true,   // 启用文本生成
    imageGeneration: true,  // 启用图片生成
    speechSynthesis: false, // 禁用语音合成
    videoGeneration: false, // 禁用视频生成
  },
};

const provider = createVolcEngineProvider(config);
```

### 3. 使用文本生成

```typescript
// 基础用法
const result = await provider.generateText('写一首关于秋天的诗');

console.log('生成内容:', result.content);
console.log('Token 使用:', result.usage);
console.log('完成原因:', result.finishReason);

// 高级选项
const advancedResult = await provider.generateText(
  '解释量子计算的基本原理',
  {
    temperature: 0.8,      // 控制随机性（0-1）
    maxTokens: 1000,       // 最大 token 数
    topP: 0.9,            // Top-p 采样
    systemPrompt: '你是一个物理学教授',  // 系统提示词
  }
);
```

### 4. 使用流式生成

```typescript
// 流式输出
for await (const chunk of provider.generateTextStream('讲一个简短的故事')) {
  process.stdout.write(chunk);  // 实时输出
}
```

### 5. 生成图片

```typescript
// 基础用法
const imageResult = await provider.generateImage(
  '一只可爱的橘猫在阳光下打盹'
);

console.log('图片 URL:', imageResult.images[0].url);
console.log('优化后的提示词:', imageResult.images[0].revisedPrompt);

// 高级选项
const advancedImageResult = await provider.generateImage(
  '未来城市的天际线',
  {
    size: '1792x1024',        // 图片尺寸
    quality: 'hd',            // 质量：standard 或 hd
    numberOfImages: 2,        // 生成数量（1-4）
    style: '写实',            // 风格
  }
);
```

### 6. 健康检查

```typescript
const isHealthy = await provider.healthCheck();

if (isHealthy) {
  console.log('火山引擎服务正常');
} else {
  console.log('火山引擎服务异常');
}
```

## API 参考

### VolcEngineProvider

#### 构造函数

```typescript
constructor(config: ProviderConfig)
```

**参数：**
- `config` - 提供商配置
  - `type` - 提供商类型（固定为 'volcengine'）
  - `apiKey` - 火山引擎 API Key（必填）
  - `baseUrl` - API 基础 URL（可选）
  - `model` - 模型名称（可选）
  - `features` - 功能标志

#### 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `generateText` | prompt, options? | Promise\<TextGenerationResult\> | 生成文本 |
| `generateTextStream` | prompt, options? | AsyncIterable\<string\> | 流式生成文本 |
| `generateImage` | prompt, options? | Promise\<ImageGenerationResult\> | 生成图片 |
| `synthesizeSpeech` | text, options? | Promise\<SpeechSynthesisResult\> | 合成语音（未实现） |
| `generateVideo` | prompt, options? | Promise\<VideoGenerationResult\> | 生成视频（未实现） |
| `healthCheck` | - | Promise\<boolean\> | 健康检查 |

## 支持的图片尺寸

| 尺寸 | 适用场景 |
|------|---------|
| 512x512 | 小图标、头像 |
| 768x768 | 中等尺寸图片 |
| 1024x1024 | 标准方形图片 |
| 1024x1792 | 竖版海报 |
| 1792x1024 | 横版封面 |

## 错误处理

### 常见错误

```typescript
try {
  await provider.generateText('测试');
} catch (error) {
  if (error.message.includes('认证失败')) {
    // API Key 错误
  } else if (error.message.includes('配额不足')) {
    // 超出配额
  } else if (error.message.includes('功能未启用')) {
    // 功能标志为 false
  } else {
    // 其他错误
  }
}
```

## 配置验证

提供商在初始化时会验证配置：

1. **API Key 验证**：不能为空
2. **功能验证**：至少启用一个功能
3. **参数验证**：各个子模块的参数验证

```typescript
// ❌ 错误示例：空 API Key
new VolcEngineProvider({
  type: 'volcengine',
  apiKey: '',
  features: { ... }
});
// 抛出错误：API 密钥不能为空

// ❌ 错误示例：没有启用任何功能
new VolcEngineProvider({
  type: 'volcengine',
  apiKey: 'test-key',
  features: {
    textGeneration: false,
    imageGeneration: false,
    speechSynthesis: false,
    videoGeneration: false,
  }
});
// 抛出错误：至少需要启用一个 AI 功能
```

## 架构设计

```
VolcEngineProvider (主入口)
├── VolcEngineLLM (文本生成)
│   └── LangChain ChatOpenAI
└── VolcEngineImage (图片生成)
    └── Fetch API
```

### 模块职责

- **VolcEngineProvider**：统一入口，功能路由，健康检查
- **VolcEngineLLM**：文本生成和流式生成
- **VolcEngineImage**：图片生成和参数验证

## 最佳实践

### 1. 合理设置温度参数

```typescript
// 创意任务（写诗、故事）
await provider.generateText('...', { temperature: 0.9 });

// 平衡任务（翻译、总结）
await provider.generateText('...', { temperature: 0.7 });

// 精确任务（代码、逻辑）
await provider.generateText('...', { temperature: 0.3 });
```

### 2. 使用系统提示词

```typescript
await provider.generateText('解释相对论', {
  systemPrompt: '你是一个物理学教授，擅长用通俗的语言解释复杂的物理概念',
});
```

### 3. 错误重试机制

图片生成模块已内置重试机制：
- 最多重试 3 次
- 指数退避策略（1s, 2s, 4s）
- 自动重试网络错误和服务器错误

### 4. 超时控制

```typescript
// 图片生成默认超时：30 秒
// 可以通过配置调整（需要修改源码）
```

## 测试

运行测试文件：

```bash
cd src/main/ai/providers/volcengine
npx tsx test.ts
```

测试覆盖：
- ✅ 实例创建
- ✅ 配置验证
- ✅ 功能启用检查
- ✅ 接口完整性
- ✅ 错误处理

## 未来扩展

### 语音合成（Task #42）

```typescript
// 待实现
await provider.synthesizeSpeech('你好，世界', {
  voice: 'zh-CN-XiaoxiaoNeural',
  speed: 1.0,
  pitch: 0,
  format: 'mp3',
});
```

### 视频生成（Task #43）

```typescript
// 待实现
await provider.generateVideo('一只猫在草地上奔跑', {
  duration: 5,
  aspectRatio: '16:9',
  fps: 30,
  resolution: '1080p',
});
```

## 相关文档

- [统一 AI 提供商接口](../interface.ts)
- [豆包大语言模型实现](./llm.ts)
- [图片生成实现](./image.ts)
- [配置管理器](../../config/manager.ts)（Task #41）

## 常见问题

**Q: 如何获取火山引擎 API Key？**
A: 访问火山引擎控制台，创建应用并获取 API Key。

**Q: 支持哪些模型？**
A: 默认使用 doubao-pro-32k（文本）和 seedream-3.0（图片），可以通过配置修改。

**Q: 流式生成如何使用？**
A: 使用 `generateTextStream` 方法，返回 AsyncIterable，可以用 for-await-of 遍历。

**Q: 图片生成的配额限制是多少？**
A: 取决于您的火山引擎账户配额，请查看火山引擎控制台。

**Q: 健康检查会消耗配额吗？**
A: 会。健康检查会实际调用 API（使用最小请求），建议不要频繁调用。

## 更新日志

### v0.1.0（Task #40）
- ✅ 实现完整的 VolcEngineProvider
- ✅ 整合 LLM 和图片生成
- ✅ 实现健康检查
- ✅ 配置验证
- ✅ 语音合成和视频生成占位
- ✅ 完整的类型定义
- ✅ 中文注释和日志

---

**维护者**: VideoStitcher Team
**最后更新**: 2026-03-17
