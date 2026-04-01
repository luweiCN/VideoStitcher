# Phase 4: 摄像师 Agent 重构 - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

将摄像师 Agent 的提示词系统重构，核心目标是**根据视频生成模型能力智能适配工作流**。

**关键约束**：
1. 必须遵守用户设定的视频总时长和横竖版
2. 不同模型能力决定不同的执行策略
3. 支持参考图的模型 vs 只支持首尾帧的模型 → 不同工作流

</domain>

<decisions>
## Implementation Decisions

### 导演模式

- **D-01:** 摄像师阶段**不设置人工确认**（humanApproval = false）
  - 理由：剧情、人物、场景和分镜图都已在前置阶段（Phase 1-3）确认

### 提示词架构（简化版三层）

- **D-02:** **简化提示词结构**，重点放在模型能力适配
  - EDITABLE：运镜词汇表、分段逻辑规则、剧情节奏识别规则
  - LOCKED：RenderPlan JSON 输出格式、模型特定约束
  - DYNAMIC：分镜输出、视频规格、模型配置

### 多阶段架构（Planner + Executor）

- **D-03:** 采用与选角导演一致的多阶段架构

**Planner Agent 职责**：
- 读取模型能力配置（maxDuration, supportsReference, maxFrames）
- 分析分镜输出（25 帧 + narrative_beats）
- 决定分段策略（几段、每段时长、起始帧）
- 输出 RenderPlan

**Executor Agent 职责**：
- 根据 RenderPlan 生成模型特定的视频生成提示词
- 调用 `generateVideo` 生成视频片段
- 返回视频 URL

**Node 职责**：
- 调用 Planner 获取 RenderPlan
- 根据 RenderPlan 并行/串行调用 Executor 生成各段视频
- 使用 ffmpeg 拼接多段视频
- 管理状态更新

### 模型能力配置

- **D-04:** 使用**配置文件**（JSON）定义模型能力
  - 用户不可更改（预定义支持的模型）
  - 已有基础配置，需完善以支持工作流适配

**配置示例**：
```typescript
interface VideoModelConfig {
  id: string;                    // 模型标识
  name: string;                  // 显示名称
  maxDuration: number;           // 最大时长（秒）
  supportsReference: boolean;    // 是否支持参考图
  supportsFirstFrame: boolean;   // 是否支持首帧图
  supportsLastFrame: boolean;    // 是否支持尾帧图
  maxFrames: number;             // 最大首尾帧数量
  aspectRatios: string[];        // 支持的横竖版比例
  promptStyle: 'cinematic' | 'action' | 'neutral'; // 提示词风格偏好
}
```

### 两种工作流模式

- **D-05:** 根据模型能力自动选择执行策略

**模式 A：支持参考图（如 Seedance 1.5 Pro）**
- Planner 输出：单段视频，使用完整分镜图作为参考
- 提示词：描述整体剧情和运镜
- Executor：调用一次 generateVideo

**模式 B：只支持首尾帧（如 Kling、Luma）**
- Planner 输出：多段视频，根据 narrative_beats 智能分段
  - 避免切在场景切换、高潮点
  - 每段时长不超过模型 maxDuration
- Executor：为每段生成首尾帧 + 描述，并行/串行调用 generateVideo
- Node：使用 ffmpeg 拼接各段视频

### 提示词优化

- **D-06:** **模型特定适配**
  - Seedance：偏好 cinematic、film grain、lighting 等词汇
  - Kling：偏好动作描述、运动幅度
  - 通过配置文件中的 `promptStyle` 字段区分

### 视频生成调用位置

- **D-07:** **Agent 内部调用** `generateVideo`
  - 与选角导演、分镜设计保持一致
  - Agent 负责完整的生成任务

### Agent ID 命名

- **D-08:**
  - Planner: `cinematographer-planner`
  - Executor: `cinematographer-executor`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 参考实现（三层架构 + 多阶段）
- `src/shared/constants/castingDirectorMultiTemplates.ts` — 多阶段提示词模板
- `src/main/ai/agents/casting-director/index.ts` — Planner + Visualizer 实现
- `src/main/ai/agents/storyboard-artist/index.ts` — 图像生成 Agent 实现

### 现有摄像师实现
- `src/main/ai/prompts/cinematographer-agent.ts` — 当前提示词（Class 方式）
- `src/main/ai/workflows/nodes/cinematographer.ts` — 当前 Node 实现

### 上游依赖（Phase 3 输出）
- `src/main/ai/agents/storyboard-artist/index.ts` — StoryboardArtistResult 类型
- `03-CONTEXT.md` — 分镜师输出格式、narrative_beats 定义

### 视频生成相关
- `src/main/ai/providers/interface.ts` — VideoGenerationOptions, generateVideo
- `src/main/utils/cache.ts` — downloadToCache 用于下载视频

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **模型配置**：已有基础配置，位于配置系统中
- **ffmpeg 拼接**：cinematographer.ts 第 314-385 行已实现
- **视频下载**：downloadToCache 已用于缓存视频片段

### Established Patterns
- **多阶段 Agent**：casting-director 已实现 Planner + Visualizer 模式
- **Agent 返回格式**：包含结构化数据（RenderPlan）+ 元数据
- **分段策略**：当前代码已支持 render_queue 概念

### Integration Points
- **输入**：`step4_video.content`（StoryboardArtistResult）
- **输出**：`step5_final.content`（视频 URL + 分段信息）
- **下游**：视频生成完成后，工作流结束或进入后期处理

### Known Issues to Address
- **模型适配不足**：当前代码未根据模型能力选择不同策略
- **分段逻辑简化**：当前仅按时长分段，未考虑 narrative_beats
- **提示词单一**：未针对特定模型优化

</code_context>

<specifics>
## Specific Ideas

### Planner 输出格式（RenderPlan）

```typescript
interface RenderPlan {
  strategy: 'single_with_reference' | 'multi_segment'; // 模式 A 或 B
  totalDuration: number;
  aspectRatio: string;
  segments: {
    segmentId: number;
    duration: number;
    startFrame: number;
    endFrame: number;
    referenceImage?: string;      // 模式 A：完整分镜图
    firstFrame?: string;          // 模式 B：首帧 base64/URL
    lastFrame?: string;           // 模式 B：尾帧 base64/URL
    description: string;          // 该段剧情描述
    cameraMovement: string;       // 运镜指令
    transitionFromPrevious?: string; // 与前一段的转场
  }[];
}
```

### Executor 输入

```typescript
interface CinematographerExecutorInput {
  segment: RenderPlan['segments'][0];
  modelConfig: VideoModelConfig;
  styleNotes: string;             // 来自分镜师的整体风格
}

interface CinematographerExecutorOutput {
  videoUrl: string;
  duration: number;
  metadata: {
    model: string;
    prompt: string;
    generationTime: number;
  };
}
```

### 模型配置扩展示例

```json
{
  "videoModels": {
    "seedance-1.5-pro": {
      "maxDuration": 15,
      "supportsReference": true,
      "supportsFirstFrame": false,
      "supportsLastFrame": false,
      "maxFrames": 0,
      "aspectRatios": ["16:9", "9:16"],
      "promptStyle": "cinematic"
    },
    "kling-1.6": {
      "maxDuration": 10,
      "supportsReference": false,
      "supportsFirstFrame": true,
      "supportsLastFrame": true,
      "maxFrames": 2,
      "aspectRatios": ["16:9", "9:16", "1:1"],
      "promptStyle": "action"
    }
  }
}
```

### 提示词模板设计

**Planner System Prompt** 核心内容：
- 你是视频分段规划师
- 根据模型能力和分镜剧情决定最优分段策略
- 避免在场景切换、高潮点处切断
- 每段时长不超过模型最大限制

**Executor System Prompt** 核心内容（模型特定）：
- Seedance 风格： cinematic composition, professional lighting, film grain
- Kling 风格： smooth motion, clear action, dynamic camera movement

</specifics>

<deferred>
## Deferred Ideas

1. **实时视频预览** — 生成过程中提供预览（超出当前范围）
2. **智能重试机制** — 某段生成失败自动重试或调整参数
3. **多模型对比生成** — 同一分镜用不同模型生成对比
4. **视频后期处理** — 自动调色、配音、字幕（独立阶段）

### 已识别但不在本阶段范围
- 视频生成模型的具体 API 实现（由 provider 层处理）
- 用户自定义模型配置界面

</deferred>

---

*Phase: 04-agent*
*Context gathered: 2026-04-01*
