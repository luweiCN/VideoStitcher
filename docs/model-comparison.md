# 火山引擎文本模型对比

## 📊 模型对比表

| 特性 | Doubao 1.5 Lite 32K | Doubao 1.5 Pro 32K | 对比 |
|------|-------------------|-------------------|------|
| **Model ID** | `doubao-1-5-lite-32k-250115` | `doubao-1-5-pro-32k-250115` | - |
| **定位** | 轻量版，极致响应速度 | 高级版，全球领先水平 | Pro 更强 |
| **上下文窗口** | 32k (32,768 tokens) | 128k (131,072 tokens) | Pro **4倍** 🔥 |
| **最大输出** | 12k (12,288 tokens) | 12k (12,288 tokens) | 相同 |
| **版本** | 250115 | 250115 | 相同 |

## 💰 价格对比（元/百万tokens）

| 价格项 | Lite | Pro | 差异 |
|--------|------|-----|------|
| **推理输入** | ¥0.3 | ¥0.8 | Pro **贵 2.7倍** |
| **推理输出** | ¥0.6 | ¥2.0 | Pro **贵 3.3倍** |
| **缓存命中** | ¥0.06 | ¥0.16 | Pro **贵 2.7倍** |
| **缓存存储** | ¥0.017 | ¥0.017 | **相同** ✅ |
| **全量精调** | - | ¥100 | - |
| **LoRA精调** | - | ¥50 | - |

## 🚀 性能对比

### Lite 版本特点
- ✅ **极致响应速度** - 适合实时交互
- ✅ **成本优化** - 适合高频任务
- ✅ **效果一流** - 持平或超越 GPT-4o-mini, Claude 3.5 Haiku
- ✅ **综合能力强** - 推理、数学、专业知识全面

### Pro 版本特点
- ✅ **全球领先** - 综合得分优于 GPT-4o, Claude 3.5 Sonnet
- ✅ **超长上下文** - 128k 窗口，适合长文档
- ✅ **最佳成绩** - 知识、代码、推理、中文权威测评
- ✅ **企业级性能** - 适合复杂任务

## 🎯 使用场景推荐

### ✅ 使用 Lite 模型的场景

1. **实时对话系统**
   - 客服机器人
   - 在线助手
   - 快速问答

2. **批量处理任务**
   - 批量文本生成
   - 数据标注
   - 内容分类

3. **成本敏感场景**
   - 高频调用
   - 预算有限
   - 原型开发

**代码示例：**
```typescript
// 选择 Lite 模型进行简单问答
const model = registry.getModel('volcengine', 'text', 'doubao-1-5-lite-32k-250115');

const response = await model.invoke([
  { role: 'user', content: '今天天气怎么样？' }
]);

// 单次成本约 ¥0.000001 (假设 1k 输入 + 500 输出)
```

### ✅ 使用 Pro 模型的场景

1. **长文档处理**
   - 文档摘要（>32k）
   - 长篇小说分析
   - 代码库理解

2. **复杂推理任务**
   - 数学证明
   - 代码生成
   - 逻辑分析

3. **高质量要求场景**
   - 专业内容创作
   - 知识密集型任务
   - 企业级应用

**代码示例：**
```typescript
// 选择 Pro 模型处理长文档
const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');

// 处理 100k tokens 的长文档
const longDocument = await readFile('large-document.txt');

const response = await model.invoke([
  { role: 'user', content: `请总结这篇文档：\n\n${longDocument}` }
]);

// 单次成本约 ¥0.084 (假设 100k 输入 + 2k 输出)
```

## 💡 成本优化策略

### 策略 1: 根据输入长度自动切换

```typescript
function selectModelByInputLength(inputTokens: number): UnifiedModel {
  const registry = AdapterRegistry.getInstance();

  if (inputTokens > 30000) {
    // 长输入用 Pro（128k 上下文）
    return registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');
  } else {
    // 短输入用 Lite（更便宜）
    return registry.getModel('volcengine', 'text', 'doubao-1-5-lite-32k-250115');
  }
}
```

### 策略 2: 根据任务复杂度选择

```typescript
function selectModelByComplexity(task: 'simple' | 'complex'): UnifiedModel {
  const registry = AdapterRegistry.getInstance();

  if (task === 'complex') {
    // 复杂任务用 Pro
    return registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');
  } else {
    // 简单任务用 Lite
    return registry.getModel('volcengine', 'text', 'doubao-1-5-lite-32k-250115');
  }
}
```

### 策略 3: 利用缓存降低成本

```typescript
// 缓存命中价格只有原价的 1/5
// 对于重复的系统提示词，启用缓存

const systemPrompt = `你是一个专业的编剧助手...`;

// 首次调用（按原价计费）
const response1 = await model.invoke([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: '生成剧本 1' }
]);

// 后续调用（系统提示词可能被缓存，按缓存价格计费）
const response2 = await model.invoke([
  { role: 'system', content: systemPrompt },
  { role: 'user', content: '生成剧本 2' }
]);

// 成本节省：¥0.3 -> ¥0.06 (Lite) 或 ¥0.8 -> ¥0.16 (Pro)
```

## 📈 性能基准测试

### 测试场景：剧本生成

**任务：** 根据创意方向生成 3 个短视频剧本

| 模型 | 输入 Tokens | 输出 Tokens | 总成本 | 质量 |
|------|------------|------------|--------|------|
| Lite | ~1,500 | ~2,000 | ¥0.00165 | ⭐⭐⭐⭐ |
| Pro | ~1,500 | ~2,000 | ¥0.00520 | ⭐⭐⭐⭐⭐ |

**结论：** Pro 版本质量略高，但成本贵 3.15 倍。如果 Lite 能满足需求，优先选择 Lite。

### 测试场景：长文档总结

**任务：** 总结 80k tokens 的技术文档

| 模型 | 是否支持 | 输入 Tokens | 输出 Tokens | 总成本 |
|------|---------|------------|------------|--------|
| Lite | ❌ 超出上下文 | - | - | - |
| Pro | ✅ | 80,000 | 3,000 | ¥0.070 |

**结论：** 长文档场景必须使用 Pro（Lite 上下文窗口只有 32k）。

## 🔄 动态切换示例

```typescript
// 智能选择模型
async function smartModelSelection(
  inputText: string,
  taskComplexity: 'simple' | 'moderate' | 'complex'
): Promise<UnifiedResponse> {
  const registry = AdapterRegistry.getInstance();

  // 估算输入 token 数（假设 1 token ≈ 1.5 中文字符）
  const estimatedInputTokens = inputText.length / 1.5;

  let modelId: string;

  if (estimatedInputTokens > 30000 || taskComplexity === 'complex') {
    // 长输入或复杂任务 -> Pro
    modelId = 'doubao-1-5-pro-32k-250115';
    console.log('[智能选择] 使用 Pro 模型（长输入/复杂任务）');
  } else if (taskComplexity === 'moderate') {
    // 中等任务 -> 根据输入长度
    modelId = estimatedInputTokens > 10000
      ? 'doubao-1-5-pro-32k-250115'
      : 'doubao-1-5-lite-32k-250115';
    console.log(`[智能选择] 使用 ${estimatedInputTokens > 10000 ? 'Pro' : 'Lite'} 模型`);
  } else {
    // 简单任务 -> Lite
    modelId = 'doubao-1-5-lite-32k-250115';
    console.log('[智能选择] 使用 Lite 模型（简单任务）');
  }

  const model = registry.getModel('volcengine', 'text', modelId);

  return await model.invoke([
    { role: 'user', content: inputText }
  ]);
}
```

## 🎯 最终建议

### Aside 项目剧本生成场景

**推荐使用 Lite 模型：**
- ✅ 剧本生成通常是中等复杂度
- ✅ 输入不会超过 32k（创意方向 + 编剧设定）
- ✅ 成本更优（便宜 3 倍）
- ✅ 质量足够（Lite 也是一流水平）

**仅在以下情况使用 Pro：**
- 需要处理超长参考资料（>30k tokens）
- 质量要求极高，成本不敏感
- 复杂的推理和分析任务

---

**更新时间：** 2025-03-18
**配置文件：** `config/ai-config.current.json`
