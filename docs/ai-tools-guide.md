# AI 模型管理工具

## 📦 包含的工具

### 1. 模型信息提取器 (`model-info-extractor.ts`)

**功能：** 从火山引擎控制台复制的信息中自动提取模型配置

**使用方法：**
```typescript
import { extractVolcEngineModelInfo } from '../utils/model-info-extractor';

// 从控制台复制文本
const text = `
Doubao-1.5-pro
文本模型
Model ID: doubao-1-5-pro-32k-250115
...
`;

// 自动提取配置
const config = extractVolcEngineModelInfo(text);
console.log(config);
```

**提取的信息：**
- ✅ Model ID
- ✅ 模型名称
- ✅ 描述
- ✅ 版本号
- ✅ 输入/输出类型
- ✅ 能力特征（function_calling, deep_reasoning 等）
- ✅ 上下文窗口大小
- ✅ 最大输出 tokens
- ✅ 定价信息（输入、输出、缓存价格）
- ✅ 限制信息（TPM, RPM）

---

### 2. 成本计算器 (`cost-calculator.ts`)

**功能：** 根据模型定价和 token 使用量计算成本

**使用方法：**
```typescript
import { calculateCost, CostAccumulator } from '../utils/cost-calculator';

// 计算单次请求成本
const cost = calculateCost(
  { inputTokens: 1500, outputTokens: 800, totalTokens: 2300 },
  { inputTokens: 0.3, outputTokens: 0.6, unit: 'CNY/million_tokens' }
);

console.log(`本次请求成本: ¥${cost.total}`);

// 使用累计器追踪总成本
const accumulator = new CostAccumulator();

// 每次请求后添加
accumulator.addRequest(usage, pricing);

// 生成报告
console.log(accumulator.generateReport());
```

**报告示例：**
```
成本统计报告
====================

请求次数: 10
总输入 Tokens: 12,345
总输出 Tokens: 6,789
总成本: ¥0.0167

平均成本/请求: ¥0.0017
平均输入 Tokens/请求: 1234
平均输出 Tokens/请求: 679
```

---

## 🚀 快速开始：添加新模型

### 步骤 1: 从控制台复制信息

1. 打开火山引擎控制台
2. 进入模型详情页面
3. 复制页面上所有文字（从模型名称开始到限制信息结束）

### 步骤 2: 使用提取工具

```typescript
import { extractVolcEngineModelInfo } from './utils/model-info-extractor';

const text = `粘贴你复制的内容...`;
const config = extractVolcEngineModelInfo(text);
console.log(config);
```

### 步骤 3: 添加到配置文件

将提取的配置添加到 `config/ai-config.json`:

```json
{
  "providers": {
    "volcengine": {
      "models": {
        "text": [
          {
            "id": "doubao-1-5-lite-32k-250115",
            "name": "Doubao 1.5 Lite 32K",
            ...提取的配置...
          },
          {
            "id": "doubao-1-5-pro-256k-250115",
            "name": "Doubao 1.5 Pro 256K",
            ...新模型的配置...
          }
        ]
      }
    }
  }
}
```

### 步骤 4: 重新加载配置

```typescript
const registry = AdapterRegistry.getInstance();
registry.reload();
```

---

## 💡 最佳实践

### 1. 成本追踪

在应用中集成成本追踪：

```typescript
// 创建全局成本累计器
const costTracker = new CostAccumulator();

// 每次模型调用后
const response = await model.invoke(messages);
costTracker.addRequest(response.usage, model.getModelInfo().pricing);

// 定期生成报告
setInterval(() => {
  console.log(costTracker.generateReport());
  costTracker.reset();
}, 24 * 60 * 60 * 1000); // 每天
```

### 2. 成本预警

```typescript
const COST_LIMIT = 100; // 元

if (costTracker.getStats().totalCost > COST_LIMIT) {
  console.warn('成本已超过阈值！');
  // 发送通知或暂停服务
}
```

### 3. 模型选择优化

根据成本和性能选择最合适的模型：

```typescript
function selectBestModel(task: 'simple' | 'complex'): UnifiedModel {
  const registry = AdapterRegistry.getInstance();
  const models = registry.listModels('volcengine', 'text');

  if (task === 'simple') {
    // 简单任务用便宜的模型
    return models.sort((a, b) =>
      a.pricing.inputTokens - b.pricing.inputTokens
    )[0];
  } else {
    // 复杂任务用上下文窗口大的模型
    return models.sort((a, b) =>
      b.contextWindow - a.contextWindow
    )[0];
  }
}
```

---

## 📊 示例：火山引擎模型对比

| 模型 | 输入价格 | 输出价格 | 缓存价格 | 上下文 | 适用场景 |
|------|---------|---------|---------|--------|---------|
| Doubao 1.5 Lite 32K | ¥0.3/M | ¥0.6/M | ¥0.06/M | 32k | 简单任务、高并发 |
| Doubao 1.5 Pro 256K | ? | ? | ? | 256k | 复杂任务、长文档 |

---

## 🔧 工具扩展

### 添加新的提取器

如果要支持其他供应商（如 OpenAI、Anthropic），可以创建类似的提取器：

```typescript
// openai-model-extractor.ts
export function extractOpenAIModelInfo(text: string): Partial<ModelConfig> {
  // 实现 OpenAI 特定的提取逻辑
}
```

### 自定义成本计算

```typescript
// 批量任务成本计算
export function calculateBatchCost(
  requests: Array<{ usage: UsageMetrics; pricing: ModelPricing }>
): number {
  return requests.reduce((total, { usage, pricing }) => {
    return total + calculateCost(usage, pricing).total;
  }, 0);
}
```

---

## 📝 配置文件完整示例

查看 `config/ai-config.current.json` 获取包含所有详细信息的完整配置示例。

---

## 🐛 常见问题

### Q: 提取的信息不完整怎么办？

A: 检查复制的文本是否包含完整的模型信息（从模型名称到限制信息）。提取器依赖特定的文本格式，如果格式变化可能需要调整。

### Q: 价格单位是什么？

A: 火山引擎的价格单位是"元/百万tokens"，即 ¥/1,000,000 tokens。

### Q: 如何处理缓存命中的价格？

A: 在使用量统计中，如果有缓存命中，可以将缓存 tokens 计入 `usage.totalTokens`，成本计算器会自动使用缓存价格。

---

## 🎯 下一步

1. ✅ 使用提取器添加更多模型
2. ✅ 在应用中集成成本追踪
3. ✅ 根据成本优化模型选择策略
4. ✅ 设置成本预警和限制

---

**如有问题，查看主文档：** `docs/ai-system-usage-guide.md`
