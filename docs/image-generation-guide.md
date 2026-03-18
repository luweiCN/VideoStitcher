# Doubao Seedream 5.0 Lite 图片生成指南

> **更新时间:** 2026-03-19
> **模型:** Doubao Seedream 5.0 Lite
> **Model ID:** `doubao-seedream-5-0-260128`

---

## 🎯 模型特点

**核心优势 - 按张计费，价格清晰**

| 特点 | 说明 |
|------|------|
| **计费方式** | 按张计费（¥0.22/张）✨ |
| **输入支持** | 文本、单图、多图 |
| **输出能力** | 单图、组图 |
| **性价比** | 超高（¥0.22/张） |
| **限制** | IPM 500（500 张/分钟） |

---

## 📊 定价详情

### 单次生成成本

```typescript
// 文生图
const cost1 = 0.22; // 元/张

// 图生图
const cost2 = 0.22; // 元/张

// 多图输入生成
const cost3 = 0.22; // 元/张（仍按输出张数计费）
```

### 批量生成成本

```typescript
// 生成 10 张图片
const cost10 = 10 * 0.22; // ¥2.2

// 生成 100 张图片
const cost100 = 100 * 0.22; // ¥22

// 生成 500 张图片（1 分钟内）
const cost500 = 500 * 0.22; // ¥110
```

### 与其他模型对比

| 模型 | 计费方式 | 价格 | 优势 |
|------|---------|------|------|
| **Seedream 5.0 Lite** | **按张** | **¥0.22/张** | **价格清晰，性价比高** |
| DALL-E 3 | 按张 | ~¥0.35-0.70/张 | 质量高但贵 |
| Midjourney | 订阅制 | ~¥70-140/月 | 需要订阅 |

**结论:** Seedream 5.0 Lite 是性价比最高的选择之一

---

## 🚀 使用示例

### 1. 文生图（基础）

```typescript
import { AdapterRegistry } from './src/main/ai/registry/AdapterRegistry';

const registry = AdapterRegistry.getInstance();
const model = registry.getModel('volcengine', 'image', 'doubao-seedream-5-0-260128');

// 基础文生图
const response = await model.invoke([
  { role: 'user', content: '一只可爱的小猫在草地上玩耍，阳光明媚' }
]);

// 获取图片 URL
if (Array.isArray(response.content)) {
  const image = response.content.find(c => c.type === 'image');
  console.log('生成的图片:', image?.url);
}
```

### 2. 图生图（风格转换）

```typescript
// 将图片转换为油画风格
const response = await model.invoke([
  {
    role: 'user',
    content: [
      { type: 'text', text: '将这张照片转换为印象派油画风格，保持主体不变' },
      { type: 'image', url: 'https://example.com/photo.jpg' }
    ]
  }
]);

// 获取转换后的图片
if (Array.isArray(response.content)) {
  const image = response.content.find(c => c.type === 'image');
  console.log('转换后的图片:', image?.url);
}
```

### 3. 多图输入生成（风格融合）

```typescript
// 融合多张图片的风格
const response = await model.invoke([
  {
    role: 'user',
    content: [
      { type: 'text', text: '融合这些图片的风格，生成一张新的艺术作品' },
      { type: 'image', url: 'https://example.com/style1.jpg' },
      { type: 'image', url: 'https://example.com/style2.jpg' },
      { type: 'image', url: 'https://example.com/style3.jpg' }
    ]
  }
]);
```

### 4. 批量生成

```typescript
// 为剧本的每个场景生成配图
const scenes = [
  '森林中的小屋，清晨的阳光',
  '海边的日落，沙滩上的贝壳',
  '雪山之巅，蓝天白云'
];

const images = await Promise.all(
  scenes.map(scene =>
    model.invoke([{ role: 'user', content: scene }])
  )
);

console.log(`生成了 ${images.length} 张图片`);
console.log('总成本:', images.length * 0.22, '元');

// 获取所有图片 URL
const urls = images.map(img => {
  if (Array.isArray(img.content)) {
    const image = img.content.find(c => c.type === 'image');
    return image?.url;
  }
}).filter(Boolean);

console.log('所有图片 URL:', urls);
```

### 5. Aside 项目集成

```typescript
// Aside 项目：为剧本生成配图
async function generateImagesForScreenplay(screenplay: string, sceneCount: number) {
  const model = registry.getModel('volcengine', 'image', 'doubao-seedream-5-0-260128');

  // 提取剧本中的关键场景描述
  const scenes = extractScenes(screenplay, sceneCount);

  // 批量生成配图
  const images = await Promise.all(
    scenes.map((scene, index) =>
      model.invoke([
        { role: 'user', content: `剧本场景 ${index + 1}: ${scene}` }
      ])
    )
  );

  // 成本统计
  const cost = images.length * 0.22;
  console.log(`生成了 ${images.length} 张配图`);
  console.log('总成本:', cost.toFixed(2), '元');

  return images;
}

// 使用示例
const screenplay = '一部关于小猫冒险的短片...';
const images = await generateImagesForScreenplay(screenplay, 5);
// 输出: 生成了 5 张配图，总成本: 1.10 元
```

---

## 💡 最佳实践

### 1. 提示词优化

```typescript
// ❌ 不好的提示词
const bad = '一只猫';

// ✅ 好的提示词
const good = `
一只毛茸茸的橘色小猫坐在阳光下的草地上，
背景是蓝天白云和远处的山峦，
风格：温馨、治愈、日系摄影
`;

// ✅ 专业级提示词
const professional = `
主题：一只 3 个月大的橘色虎斑猫
场景：春日的午后，嫩绿的草地
光线：柔和的侧光，营造温暖氛围
构图：三分法，猫咪位于画面右侧三分之一处
背景：浅景深，远处有模糊的樱花树
风格：日系清新，略带胶片质感
色调：暖色调，偏橙黄色
`;
```

### 2. 风格转换技巧

```typescript
// 艺术风格转换
const artStyles = [
  '将这张照片转换为梵高星空风格',
  '将这张照片转换为毕加索立体主义风格',
  '将这张照片转换为莫奈印象派风格',
  '将这张照片转换为浮世绘风格',
  '将这张照片转换为赛博朋克风格'
];

// 生成同一张图片的多个艺术版本
const artVersions = await Promise.all(
  artStyles.map(style =>
    model.invoke([
      {
        role: 'user',
        content: [
          { type: 'text', text: style },
          { type: 'image', url: originalImage }
        ]
      }
    ])
  )
);

console.log(`生成了 ${artVersions.length} 个艺术版本`);
console.log('总成本:', artVersions.length * 0.22, '元');
```

### 3. 批量生成优化

```typescript
import PQueue from 'p-queue';

// 控制并发，避免超过 IPM 限制
const queue = new PQueue({
  concurrency: 10, // 每次并发 10 个请求
  interval: 6000,  // 每 6 秒（6000ms）执行一次
  intervalCap: 10  // 每个 interval 最多 10 个请求
});

// 批量生成 100 张图片
const prompts = Array(100).fill(0).map((_, i) => `场景 ${i + 1}`);

const images = await Promise.all(
  prompts.map(prompt =>
    queue.add(() =>
      model.invoke([{ role: 'user', content: prompt }])
    )
  )
);

console.log(`成功生成 ${images.length} 张图片`);
console.log('总耗时:', '~10 分钟'); // 100 / 10 * 6s
console.log('总成本:', 100 * 0.22, '元'); // ¥22
```

### 4. 错误处理

```typescript
async function generateImageWithErrorHandling(prompt: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await model.invoke([
        { role: 'user', content: prompt }
      ]);

      if (Array.isArray(response.content)) {
        const image = response.content.find(c => c.type === 'image');
        if (image?.url) {
          return image.url;
        }
      }

      throw new Error('响应中没有找到图片');
    } catch (error) {
      console.error(`尝试 ${i + 1}/${retries} 失败:`, error.message);

      if (i === retries - 1) {
        throw error; // 最后一次重试失败，抛出错误
      }

      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## 🎯 应用场景

### 1. Aside 项目 - 剧本配图

```typescript
async function illustrateScreenplay(screenplayText: string) {
  // 解析剧本，提取场景描述
  const scenes = parseScreenplayScenes(screenplayText);

  // 为每个场景生成配图
  const illustrations = await Promise.all(
    scenes.map((scene, index) =>
      model.invoke([
        {
          role: 'user',
          content: `剧本场景 ${index + 1}: ${scene.description}\n风格: ${scene.mood}`
        }
      ])
    )
  );

  // 成本计算
  const cost = illustrations.length * 0.22;

  return {
    illustrations,
    cost,
    costPerImage: 0.22
  };
}
```

### 2. 内容创作 - 博客配图

```typescript
async function generateBlogImages(title: string, sections: string[]) {
  // 生成封面图
  const coverImage = await model.invoke([
    { role: 'user', content: `博客封面: ${title}` }
  ]);

  // 为每个章节生成配图
  const sectionImages = await Promise.all(
    sections.map(section =>
      model.invoke([
        { role: 'user', content: `博客配图: ${section}` }
      ])
    )
  );

  const totalCost = (1 + sections.length) * 0.22;
  console.log('生成配图总成本:', totalCost, '元');

  return { coverImage, sectionImages };
}
```

### 3. 产品展示 - 电商图片

```typescript
async function generateProductImages(
  productDescription: string,
  styles: string[]
) {
  // 为同一产品生成不同风格的展示图
  const images = await Promise.all(
    styles.map(style =>
      model.invoke([
        {
          role: 'user',
          content: `${productDescription}\n展示风格: ${style}`
        }
      ])
    )
  );

  return images;
}

// 使用示例
const productImages = await generateProductImages(
  '一款简约的陶瓷咖啡杯，白色，容量 300ml',
  ['极简风格', '生活化场景', '艺术氛围', '商业摄影']
);
// 成本: 4 * 0.22 = ¥0.88
```

---

## ⚠️ 限制与注意事项

### 1. IPM 限制

- **IPM:** 500（每分钟最多生成 500 张图片）
- **建议:** 使用队列控制并发，避免超过限制

```typescript
// 使用 PQueue 控制 IPM
const queue = new PQueue({
  interval: 60000,  // 1 分钟
  intervalCap: 450  // 留 10% 余量，设置为 450
});
```

### 2. 成本控制

```typescript
class ImageBudgetManager {
  private budget: number;
  private generated: number = 0;
  private costPerImage = 0.22;

  constructor(budget: number) {
    this.budget = budget;
  }

  canGenerate(count: number): boolean {
    const cost = count * this.costPerImage;
    const currentSpent = this.generated * this.costPerImage;
    return currentSpent + cost <= this.budget;
  }

  recordGeneration(count: number): void {
    this.generated += count;
    const spent = this.generated * this.costPerImage;
    console.log(`已生成 ${this.generated} 张图片，花费 ¥${spent.toFixed(2)} / ¥${this.budget}`);
  }

  getRemainingBudget(): number {
    return this.budget - (this.generated * this.costPerImage);
  }
}

// 使用示例
const budgetManager = new ImageBudgetManager(10); // 预算 10 元

if (budgetManager.canGenerate(5)) {
  // 生成 5 张图片
  const images = await generateImages(5);
  budgetManager.recordGeneration(5);
  console.log('剩余预算:', budgetManager.getRemainingBudget(), '元');
}
```

---

## 📊 ROI 分析

### 场景 1: 个人创作者

**需求:** 每周为博客生成 10 张配图

| 项目 | Seedream 5.0 Lite | DALL-E 3 | 节省 |
|------|------------------|----------|------|
| 单张成本 | ¥0.22 | ¥0.50 | ¥0.28 |
| 每周成本 | ¥2.2 | ¥5.0 | ¥2.8 |
| 每月成本 | ¥8.8 | ¥20.0 | ¥11.2 |
| 每年成本 | ¥105.6 | ¥240.0 | ¥134.4 |

**ROI:** 年节省 **¥134.4**（节省 56%）

### 场景 2: 内容团队

**需求:** 每月生成 500 张配图

| 项目 | Seedream 5.0 Lite | DALL-E 3 | 节省 |
|------|------------------|----------|------|
| 单张成本 | ¥0.22 | ¥0.50 | ¥0.28 |
| 月度成本 | ¥110 | ¥250 | ¥140 |
| 年度成本 | ¥1,320 | ¥3,000 | ¥1,680 |

**ROI:** 年节省 **¥1,680**（节省 56%）

---

## 🔗 相关文档

- [AI 模型配置快速参考](./quick-reference.md)
- [AI 系统使用指南](./ai-system-usage-guide.md)
- [视频生成指南](./video-generation-guide.md)

---

**更新日志:**
- 2026-03-19: 初始版本，Seedream 5.0 Lite 图片生成指南
