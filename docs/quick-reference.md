# AI 模型配置快速参考

> **更新时间:** 2026-03-19
> **配置文件:** `config/ai-config.current.json`

## 📊 当前配置概览

**总计:** 6 个模型
- 文本模型: 2 个
- 图片模型: 1 个（Seedream 5.0 Lite，按张计费）
- 视频模型: 3 个

---

## 📝 文本模型

### 1. Doubao 1.5 Lite 32K ⚡ 推荐

**用途:** 快速响应、成本优化、批量处理

```typescript
import { AdapterRegistry } from './src/main/ai/registry/AdapterRegistry';

const registry = AdapterRegistry.getInstance();
const model = registry.getModel('volcengine', 'text', 'doubao-1-5-lite-32k-250115');

const response = await model.invoke([
  { role: 'user', content: '生成一个短视频剧本' }
]);
```

**规格:**
- Model ID: `doubao-1-5-lite-32k-250115`
- 上下文窗口: 32k (32,768 tokens)
- 最大输出: 12k (12,288 tokens)

**定价 (元/百万tokens):**
- 推理输入: ¥0.3
- 推理输出: ¥0.6
- 缓存命中: ¥0.06 (5 折)
- 缓存存储: ¥0.017/小时

**适用场景:**
- ✅ 实时对话系统
- ✅ 批量文本生成
- ✅ 成本敏感场景
- ✅ Aside 剧本生成（推荐）

---

### 2. Doubao 1.5 Pro 32K 🚀

**用途:** 长文档、复杂推理、高质量要求

```typescript
const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');

// 处理长文档
const longDoc = await readFile('large-document.txt');
const response = await model.invoke([
  { role: 'user', content: `总结这篇文档：\n\n${longDoc}` }
]);
```

**规格:**
- Model ID: `doubao-1-5-pro-32k-250115`
- 上下文窗口: **128k** (131,072 tokens) 🔥
- 最大输出: 12k (12,288 tokens)

**定价 (元/百万tokens):**
- 推理输入: ¥0.8 (Lite 的 2.7 倍)
- 推理输出: ¥2.0 (Lite 的 3.3 倍)
- 缓存命中: ¥0.16
- 缓存存储: ¥0.017/小时

**适用场景:**
- ✅ 长文档处理 (>32k)
- ✅ 复杂推理任务
- ✅ 高质量要求场景
- ❌ 不推荐用于简单任务（成本高）

**成本对比:**
| 任务 | Lite | Pro | 差异 |
|------|------|-----|------|
| 剧本生成 (1.5k 输入 + 2k 输出) | ¥0.00165 | ¥0.00520 | 3.15 倍 |
| 长文档总结 (80k 输入 + 3k 输出) | ❌ 超出上下文 | ¥0.070 | - |

---

## 🎨 图片模型

### 3. Doubao Seedream 5.0 Lite ✨ 升级版

**用途:** AI 图片生成，支持文本、单图和多图输入

```typescript
const model = registry.getModel('volcengine', 'image', 'doubao-seedream-5-0-260128');

// 文生图
const response = await model.invoke([
  { role: 'user', content: '一只可爱的小猫在草地上玩耍' }
]);

// 图生图
const response2 = await model.invoke([
  {
    role: 'user',
    content: [
      { type: 'text', text: '将这张图片转换为油画风格' },
      { type: 'image', url: 'https://example.com/photo.jpg' }
    ]
  }
]);

// 多图输入生成组图
const response3 = await model.invoke([
  {
    role: 'user',
    content: [
      { type: 'text', text: '融合这些图片的风格生成新图片' },
      { type: 'image', url: 'https://example.com/style1.jpg' },
      { type: 'image', url: 'https://example.com/style2.jpg' }
    ]
  }
]);

// 获取图片 URL
if (Array.isArray(response.content)) {
  const image = response.content.find(c => c.type === 'image');
  console.log('生成的图片:', image?.url);
}
```

**规格:**
- Model ID: `doubao-seedream-5-0-260128`
- 输入类型: 文本, 图片
- 输出类型: 图片
- 版本: 260128 (2026-01-28)

**定价 (元/张):**
- 文生图: **¥0.22** 🔥
- 图生图: **¥0.22** 🔥

**特点:**
- ✅ **按张计费**（价格清晰）
- ✅ 支持文本、单图、多图输入
- ✅ 支持生成组图
- ✅ 超高性价比（¥0.22/张）

**限制:**
- IPM: 500 张/分钟

**适用场景:**
- ✅ 剧本配图生成
- ✅ 图片风格转换
- ✅ 批量图片生成
- ✅ 多图融合创作

**成本示例:**
```typescript
// 生成 10 张配图
const cost = 10 * 0.22;
console.log('总成本:', cost, '元'); // ¥2.2

// 生成 100 张图片
const batchCost = 100 * 0.22;
console.log('批量成本:', batchCost, '元'); // ¥22
```

---

## 🎬 视频模型

### 4. Doubao Seedance 1.0 Pro Fast ⚡⚡ 极致性价比

**用途:** 纯视频生成（无音频），极致性价比，快速预览

```typescript
const model = registry.getModel('volcengine', 'video', 'doubao-seedance-1-0-pro-fast-251015');

// 文生视频 - 极致性价比
const response = await model.invoke([
  { role: 'user', content: '一只小猫在草地上奔跑，阳光明媚' }
], {
  resolution: '720P',
  duration: '6s',
  withAudio: false
});

// 图生视频
const response2 = await model.invoke([
  {
    role: 'user',
    content: [
      { type: 'text', text: '让这张图片动起来' },
      { type: 'image', url: 'https://example.com/image.jpg' }
    ]
  }
], {
  resolution: '720P',
  duration: '4s'
});
```

**规格:**
- Model ID: `doubao-seedance-1-0-pro-fast-251015`
- 输入类型: 文本, 图片
- 输出类型: 视频
- 分辨率: 480P, 720P, 1080P
- 时长: **2-12 秒** ⚡
- 帧率: 24 fps
- 并发数: 10
- RPM: 600

**定价 (元/百万tokens):**
- 图生视频: **¥4.2** 🔥
- 文生视频: **¥4.2** 🔥
- 批量图生视频: **¥2.1** (再打 5 折)
- 批量文生视频: **¥2.1** (再打 5 折)
- 精调图生视频: ¥8.4

**特点:**
- ✅ **极致性价比**（比标准版便宜 72%）
- ✅ 时长支持 2-12s（最短）
- ✅ 批量价格再打 5 折
- ✅ 快速生成，适合预览
- ❌ 无音频生成

**成本对比:**
| 模型 | 单次价格 | 批量价格 | 节省 |
|------|---------|---------|------|
| 1.0 Pro Fast | ¥4.2 | ¥2.1 | 基准 |
| 1.0 Pro 标准 | ¥15.0 | ¥7.5 | Fast 节省 72% |
| 1.5 Pro | ¥16.0 | ¥8.0 | Fast 节省 74% |

**适用场景:**
- ✅ **快速预览**（强烈推荐）
- ✅ 批量生成（价格优势明显）
- ✅ 成本敏感场景
- ✅ 测试和实验

---

### 5. Doubao Seedance 1.0 Pro 💰 标准版

**用途:** 纯视频生成（无音频），成本优化，支持首尾帧

```typescript
const model = registry.getModel('volcengine', 'video', 'doubao-seedance-1-0-pro-250528');

// 文生视频
const response = await model.invoke([
  { role: 'user', content: '一只小猫在草地上奔跑，阳光明媚' }
], {
  resolution: '720P',
  duration: '8s',
  withAudio: false
});

// 首尾帧图生视频
const response2 = await model.invoke([
  {
    role: 'user',
    content: [
      { type: 'text', text: '让这两张图片过渡生成视频' },
      { type: 'image', url: 'https://example.com/start.jpg' },
      { type: 'image', url: 'https://example.com/end.jpg' }
    ]
  }
], {
  resolution: '1080P',
  duration: '10s'
});
```

**规格:**
- Model ID: `doubao-seedance-1-0-pro-250528`
- 输入类型: 文本, 图片
- 输出类型: 视频
- 分辨率: 480P, 720P, 1080P
- 时长: **2-12 秒**
- 帧率: 24 fps
- 并发数: 10
- RPM: 600

**定价 (元/百万tokens):**
- 图生视频: ¥15.0
- 文生视频: ¥15.0
- 批量图生视频: ¥7.5 (5 折)
- 批量文生视频: ¥7.5 (5 折)
- 精调图生视频: ¥30.0

**特点:**
- ✅ 纯视频版本（不支持音频）
- ✅ **支持首尾帧图生视频**
- ✅ 时长支持 2-12s（最短）
- ✅ 比 Fast 版本功能更全
- ❌ 无音频生成
- ❌ 价格比 Fast 贵 257%

**适用场景:**
- ✅ 需要首尾帧控制
- ✅ 不需要音频的场景
- ✅ Fast 版本无法满足时

---

### 6. Doubao Seedance 1.5 Pro 🎵 专业版

**用途:** 音画一体视频生成，专业级质量

```typescript
const model = registry.getModel('volcengine', 'video', 'doubao-seedance-1-5-pro-251215');

// 文生音画
const response = await model.invoke([
  { role: 'user', content: '森林中的小溪，鸟鸣声，宁静的氛围' }
], {
  resolution: '1080P',
  duration: '10s',
  withAudio: true // 启用音频生成
});

// 图生音画
const response2 = await model.invoke([
  {
    role: 'user',
    content: [
      { type: 'text', text: '为这张风景照添加风声和自然环境音' },
      { type: 'image', url: 'https://example.com/landscape.jpg' }
    ]
  }
], {
  resolution: '1080P',
  duration: '12s',
  withAudio: true
});
```

**规格:**
- Model ID: `doubao-seedance-1-5-pro-251215`
- 输入类型: 文本, 图片
- 输出类型: 视频（含音频）
- 分辨率: 480P, 720P, 1080P
- 时长: **4-12 秒**
- 帧率: 24 fps
- 并发数: 10
- RPM: 600

**定价 (元/百万tokens):**
- 有声视频: ¥16.0
- 无声视频: ¥8.0
- 批量有声视频: ¥8.0 (5 折)
- 批量无声视频: ¥4.0 (5 折)

**特点:**
- ✅ **音画一体版本**
- ✅ 支持音频生成
- ✅ 专业级质量
- ❌ 时长最短 4 秒
- ❌ 价格最高

**适用场景:**
- ✅ **最终成品视频**（推荐）
- ✅ 需要音效的视频
- ✅ 高质量要求
- ❌ 快速预览（成本高）

---

## 💡 使用建议

### 文本模型选择

```typescript
function selectTextModel(inputTokens: number, taskComplexity: 'simple' | 'complex'): UnifiedModel {
  const registry = AdapterRegistry.getInstance();

  if (inputTokens > 30000 || taskComplexity === 'complex') {
    // 长输入或复杂任务 -> Pro
    return registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');
  } else {
    // 短输入或简单任务 -> Lite
    return registry.getModel('volcengine', 'text', 'doubao-1-5-lite-32k-250115');
  }
}
```

### 视频模型选择（已更新）

```typescript
function selectVideoModel(
  needsAudio: boolean,
  minDuration: number,
  useCase: 'preview' | 'production' | 'controlled'
): UnifiedModel {
  const registry = AdapterRegistry.getInstance();

  if (needsAudio) {
    // 需要音频 -> 1.5 Pro（必须）
    return registry.getModel('volcengine', 'video', 'doubao-seedance-1-5-pro-251215');
  } else if (useCase === 'preview' || minDuration >= 2) {
    // 快速预览或 >=2 秒 -> 1.0 Pro Fast（性价比之王）
    return registry.getModel('volcengine', 'video', 'doubao-seedance-1-0-pro-fast-251015');
  } else if (useCase === 'controlled') {
    // 需要首尾帧控制 -> 1.0 Pro 标准
    return registry.getModel('volcengine', 'video', 'doubao-seedance-1-0-pro-250528');
  } else {
    // 默认 -> Fast（最便宜）
    return registry.getModel('volcengine', 'video', 'doubao-seedance-1-0-pro-fast-251015');
  }
}
```

### Aside 项目推荐配置（已更新）

```typescript
// 剧本生成 -> Lite（成本优化）
const screenplayModel = registry.getModel('volcengine', 'text', 'doubao-1-5-lite-32k-250115');

// 剧本配图 -> Seedream 5.0 Lite（按张计费，价格清晰）
const imageModel = registry.getModel('volcengine', 'image', 'doubao-seedream-5-0-260128');

// 视频预览 -> 1.0 Pro Fast（极致性价比）
const previewModel = registry.getModel('volcengine', 'video', 'doubao-seedance-1-0-pro-fast-251015');

// 最终成品 -> 1.5 Pro（音画一体）
const finalModel = registry.getModel('volcengine', 'video', 'doubao-seedance-1-5-pro-251215');
```

**完整工作流示例:**

```typescript
async function generateVideoWithImages(prompt: string) {
  // 1. 生成剧本
  const screenplay = await screenplayModel.invoke([
    { role: 'user', content: `生成剧本：${prompt}` }
  ]);

  // 2. 为每个场景生成配图
  const scenes = ['场景1', '场景2', '场景3'];
  const images = await Promise.all(
    scenes.map(scene =>
      imageModel.invoke([
        { role: 'user', content: `${screenplay.content} - ${scene}` }
      ])
    )
  );

  // 3. 生成预览视频
  const preview = await previewModel.invoke([
    { role: 'user', content: screenplay.content.toString() }
  ], {
    resolution: '480P',
    duration: '4s'
  });

  // 4. 生成最终成品
  const final = await finalModel.invoke([
    { role: 'user', content: screenplay.content.toString() }
  ], {
    resolution: '1080P',
    duration: '10s',
    withAudio: true
  });

  // 成本计算
  const textCost = 0.00165; // 剧本
  const imageCost = 3 * 0.22; // 3 张配图
  const previewCost = 0.0168; // 预览
  const finalCost = 0.16; // 最终

  const totalCost = textCost + imageCost + previewCost + finalCost;
  console.log('总成本:', totalCost.toFixed(4), '元'); // ¥0.8453

  return { screenplay, images, preview, final };
}
```

---

## 🔧 工具使用

### 提取模型信息

```typescript
import { extractVolcEngineModelInfo, modelConfigToJSON } from './src/main/ai/utils/model-info-extractor';

// 从火山引擎控制台复制文本
const consoleText = `
Doubao-Seedance-1.0-pro-fast
Model ID: doubao-seedance-1-0-pro-fast-251015
图生视频4.2元/百万tokens
...
`;

const config = extractVolcEngineModelInfo(consoleText);
console.log(modelConfigToJSON(config));

// 输出:
// {
//   "id": "doubao-seedance-1-0-pro-fast-251015",
//   "pricing": {
//     "imageToVideo": 4.2,
//     "textToVideo": 4.2,
//     ...
//   }
// }
```

### 计算成本

```typescript
import { calculateCost, CostAccumulator } from './src/main/ai/utils/cost-calculator';

// 单次成本
const cost = calculateCost(
  { inputTokens: 1500, outputTokens: 2000 },
  { inputTokens: 0.3, outputTokens: 0.6 }
);
console.log(cost);
// { input: 0.00045, output: 0.0012, total: 0.00165, currency: 'CNY' }

// 累计成本
const accumulator = new CostAccumulator();
accumulator.addRequest(usage1, pricing1);
accumulator.addRequest(usage2, pricing2);
console.log(accumulator.generateReport());
```

---

## 📚 相关文档

- [AI 系统使用指南](./ai-system-usage-guide.md)
- [AI 工具使用指南](./ai-tools-guide.md)
- [模型对比详解](./model-comparison.md)
- [视频生成指南](./video-generation-guide.md)
- [统一 AI 系统设计](./design/unified-ai-system-design.md)

---

## ⚠️ 注意事项

1. **定价备注:** 视频模型标注为 "元/百万tokens"，但实际计费可能按视频秒数或生成次数
2. **时长限制:**
   - 1.0 Pro Fast: 2-12 秒
   - 1.0 Pro: 2-12 秒
   - 1.5 Pro: 4-12 秒（最短时长更高）
3. **音频支持:** 仅 1.5 Pro 支持音频生成
4. **并发限制:** 视频模型最大并发 10，需要使用队列控制
5. **Fast 版本优势:** 价格比标准版便宜 72%，批量价格再打 5 折

---

**更新日志:**
- 2026-03-19: 升级图片模型为 Doubao Seedream 5.0 Lite（按张计费）
- 2026-03-19: 添加 Doubao Seedance 1.0 Pro Fast（极致性价比）
- 2026-03-18: 添加 Doubao Seedance 1.0 Pro 视频模型
- 2026-03-18: 添加 Doubao Seedance 1.5 Pro 视频模型
- 2026-03-18: 初始配置，包含 2 文本 + 1 图片模型
