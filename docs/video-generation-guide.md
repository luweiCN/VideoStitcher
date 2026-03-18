# 视频生成模型使用指南

## 🎬 Doubao Seedance 1.5 Pro

### 模型特点

- ✅ **多模态输入**：支持文本 + 图片组合输入
- ✅ **音频生成**：可生成带音频的视频
- ✅ **多种模式**：
  - 文生音画（文本 → 视频+音频）
  - 图生音画（图片 → 视频+音频）
  - 图生视频（图片 → 视频）
  - 文生视频（文本 → 视频）

### 技术规格

| 参数 | 规格 |
|------|------|
| **分辨率** | 480P, 720P, 1080P |
| **时长** | 4-12 秒 |
| **帧率** | 24 fps |
| **并发数** | 10 |
| **RPM** | 600 请求/分钟 |

### 定价（元/百万tokens）

| 类型 | 单次 | 批量 | 节省 |
|------|------|------|------|
| **有声视频** | ¥16 | ¥8 | 50% |
| **无声视频** | ¥8 | ¥4 | 50% |

> **注意：** 实际计费可能按视频秒数或生成次数，而非 tokens

---

## 💰 成本计算

### 单次生成成本估算

假设生成 **10 秒 720P 有声视频**：

```
成本 = ¥16 / 1,000,000 tokens × 实际 token 消耗

粗略估算：
- 1 秒视频 ≈ 10,000 tokens（含音频）
- 10 秒视频 ≈ 100,000 tokens
- 单次成本 ≈ ¥1.6
```

### 批量生成节省

生成 **100 个视频**：

```
单次模式：100 × ¥1.6 = ¥160
批量模式：100 × ¥0.8 = ¥80

节省：¥80（50%）
```

---

## 🚀 使用示例

### 基础调用

```typescript
import { AdapterRegistry } from '../ai/registry/AdapterRegistry';
import type { UnifiedMessage, MessageContent } from '../ai/types';

const registry = AdapterRegistry.getInstance();
const model = registry.getModel('volcengine', 'video', 'doubao-seedance-1-5-pro-251215');

// 文生视频
const messages: UnifiedMessage[] = [
  {
    role: 'user',
    content: '一只可爱的小猫在草地上奔跑，阳光明媚，背景是蓝天白云',
  },
];

const response = await model.invoke(messages, {
  resolution: '720P',
  duration: '8s',
  withAudio: true,
});

// 处理视频响应
if (Array.isArray(response.content)) {
  const video = response.content.find((c) => c.type === 'video');
  if (video?.url) {
    console.log('生成的视频：', video.url);
  }
}
```

### 图生视频

```typescript
const messages: UnifiedMessage[] = [
  {
    role: 'user',
    content: [
      {
        type: 'text',
        text: '让这张图片动起来，添加自然的风吹效果',
      },
      {
        type: 'image',
        url: 'https://example.com/image.jpg',
      },
    ],
  },
];

const response = await model.invoke(messages, {
  resolution: '1080P',
  duration: '10s',
  withAudio: false, // 无声视频
});
```

### 批量生成

```typescript
// 批量生成多个视频
const scripts = [
  '剧本 1：...',
  '剧本 2：...',
  '剧本 3：...',
];

const batchPromises = scripts.map((script) =>
  model.invoke([{ role: 'user', content: script }], {
    resolution: '720P',
    duration: '6s',
    withAudio: true,
    batch: true, // 启用批量模式（价格减半）
  })
);

const videos = await Promise.all(batchPromises);

// 总成本计算
const totalCost = videos.length * ¥0.8; // 批量价格
console.log(`生成了 ${videos.length} 个视频，总成本：¥${totalCost}`);
```

---

## 🎯 Aside 项目应用场景

### 场景 1：剧本 → 视频预览

将生成的剧本快速转化为视频预览：

```typescript
async function generateVideoFromScreenplay(screenplay: Screenplay) {
  const model = registry.getModel('volcengine', 'video', 'doubao-seedance-1-5-pro-251215');

  // 提取剧本的关键画面描述
  const visualPrompt = `
    场景：${screenplay.scene}
    动作：${screenplay.action}
    氛围：${screenplay.mood}
  `;

  const response = await model.invoke(
    [{ role: 'user', content: visualPrompt }],
    {
      resolution: '720P',
      duration: '8s',
      withAudio: true,
    }
  );

  return response.content;
}
```

### 场景 2：分镜脚本可视化

根据分镜脚本生成每个镜头的视频片段：

```typescript
async function visualizeStoryboard(storyboard: Storyboard) {
  const model = registry.getModel('volcengine', 'video', 'doubao-seedance-1-5-pro-251215');

  const videos = await Promise.all(
    storyboard.shots.map((shot) =>
      model.invoke([{ role: 'user', content: shot.description }], {
        resolution: '1080P',
        duration: '4s', // 每个镜头 4 秒
        withAudio: false,
      })
    )
  );

  return videos;
}
```

### 场景 3：快速原型制作

为创作者快速生成视频原型：

```typescript
async function createQuickPrototype(
  creativeDirection: CreativeDirection,
  options: { quality: 'draft' | 'final' }
) {
  const model = registry.getModel('volcengine', 'video', 'doubao-seedance-1-5-pro-251215');

  const resolution = options.quality === 'draft' ? '480P' : '1080P';

  const response = await model.invoke(
    [{ role: 'user', content: creativeDirection.description }],
    {
      resolution,
      duration: '12s',
      withAudio: options.quality === 'final',
    }
  );

  // 成本追踪
  const cost = calculateCost(
    { inputTokens: 1000, outputTokens: 100000 },
    {
      videoWithAudio: 16,
      videoWithoutAudio: 8,
    }
  );

  console.log(`原型制作成本：¥${cost.total}`);

  return response;
}
```

---

## 📊 性能优化

### 1. 选择合适的分辨率

| 分辨率 | 适用场景 | 成本 | 质量 |
|--------|---------|------|------|
| **480P** | 快速预览、原型 | 低 | 标清 |
| **720P** | 平衡选择 | 中 | 高清 |
| **1080P** | 最终成品 | 高 | 全高清 |

**建议：**
- 原型阶段用 **480P**（快速、低成本）
- 确认满意后用 **1080P** 生成最终版本

### 2. 控制视频时长

```typescript
// 根据内容复杂度选择时长
function selectDuration(complexity: 'simple' | 'medium' | 'complex'): string {
  switch (complexity) {
    case 'simple':
      return '4s'; // 简单场景，4 秒足够
    case 'medium':
      return '8s'; // 中等复杂度
    case 'complex':
      return '12s'; // 复杂场景，需要更多时间展示
  }
}
```

### 3. 音频决策

```typescript
// 根据场景决定是否需要音频
function shouldGenerateAudio(scene: Scene): boolean {
  // 需要音频的场景
  const audioScenes = ['对话', '动作', '环境音'];
  return audioScenes.some((type) => scene.type.includes(type));
}
```

---

## 🚦 限制与注意事项

### 1. 并发限制

- **最大并发数：** 10
- **RPM：** 600 请求/分钟

```typescript
// 使用队列控制并发
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 10 });

const videos = await Promise.all(
  scripts.map((script) =>
    queue.add(() => model.invoke([{ role: 'user', content: script }]))
  )
);
```

### 2. 时长限制

- **最短：** 4 秒
- **最长：** 12 秒

```typescript
// 验证时长参数
function validateDuration(duration: number): string {
  if (duration < 4) return '4s';
  if (duration > 12) return '12s';
  return `${duration}s`;
}
```

### 3. 生成时间

视频生成通常需要 **30-120 秒**，建议：
- 使用异步处理
- 提供进度反馈
- 支持后台生成

---

## 💡 最佳实践

### 1. 成本控制

```typescript
class VideoBudgetManager {
  private budget: number;
  private spent: number = 0;

  constructor(budget: number) {
    this.budget = budget;
  }

  canGenerate(duration: number, resolution: string, withAudio: boolean): boolean {
    const cost = this.estimateCost(duration, resolution, withAudio);
    return this.spent + cost <= this.budget;
  }

  estimateCost(duration: number, resolution: string, withAudio: boolean): number {
    const baseCost = withAudio ? 1.6 : 0.8; // ¥/秒
    const resolutionMultiplier = resolution === '1080P' ? 1.5 : 1;

    return (duration * baseCost * resolutionMultiplier) / 10;
  }

  recordCost(cost: number): void {
    this.spent += cost;
    console.log(`已花费：¥${this.spent.toFixed(2)} / ¥${this.budget}`);
  }
}
```

### 2. 质量与速度平衡

```typescript
async function generateWithRetry(
  prompt: string,
  options: VideoGenerationOptions
): Promise<UnifiedResponse> {
  // 先用低分辨率快速验证
  const draft = await model.invoke([{ role: 'user', content: prompt }], {
    ...options,
    resolution: '480P',
  });

  // 如果满意，再用高分辨率生成最终版本
  if (await userApproves(draft)) {
    return await model.invoke([{ role: 'user', content: prompt }], {
      ...options,
      resolution: '1080P',
    });
  }

  return draft;
}
```

---

## 🔗 相关文档

- [火山引擎视频生成 API 文档](https://www.volcengine.com/docs/82379/1302735)
- [AI 模型管理使用指南](./ai-system-usage-guide.md)
- [成本计算工具](./ai-tools-guide.md#2-成本计算器)

---

**更新时间：** 2025-03-18
**模型版本：** Doubao Seedance 1.5 Pro (251215)
