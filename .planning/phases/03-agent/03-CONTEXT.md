# Phase 3: 分镜设计 Agent 重构 - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

将分镜设计 Agent 的提示词系统改造为三层架构（EDITABLE + LOCKED + DYNAMIC），使其可在 PromptStudio 中自定义。

**关键约束**：分镜图必须同时支持两种视频生成模式：
1. **支持参考图**的模型：使用完整 5×5 分镜图
2. **只支持首尾帧**的模型：使用切割后的 25 张单帧图

</domain>

<decisions>
## Implementation Decisions

### 三层架构拆分策略

- **D-01:** EDITABLE（可编辑层）包含：
  - 镜头语言词汇（景别、角度、运动术语）
  - 分镜创作方法论（如何提炼剧本为画面）
  - 场景连贯性规则
  - 角色引用策略

- **D-02:** LOCKED（锁定层）包含：
  - 5×5 网格布局（强制不可修改）
  - 禁止白边/间隙的约束（zero gaps, no borders, no padding）
  - 4K 分辨率规格
  - JSON 输出格式定义
  - ~~时长分组逻辑~~（移除：分组逻辑移至摄像师 Agent）

- **D-03:** DYNAMIC（动态层）包含：
  - 角色参考图 URL（来自选角导演）
  - 视觉风格标签（来自艺术总监）
  - 剧本内容
  - 视频规格（时长、横竖版）
  - 场景描述

### 图像生成职责

- **D-04:** Agent 内部完成图像生成：
  - 调用 LLM 生成分镜描述（JSON 格式）
  - 调用 `generateImage` 生成 5×5 分镜网格图
  - 使用 sharp 切割为 25 张单帧图
  - 返回完整结果（包含大图 + 小图数组）

### 分辨率与横竖版

- **D-05:** 修复当前横竖版 bug：
  - 横版视频（16:9）→ 横版分镜图（3840×2160）
  - 竖版视频（9:16）→ 竖版分镜图（2160×3840）
  - 每组 5×5 网格，每帧尺寸根据总尺寸自动计算

### Agent 职责边界（重要）

- **D-06:** 分镜师只负责生成分镜，**不负责视频分组**：
  - 分镜师输出：分镜图 + 每帧元数据 + 剧情节奏标记
  - 摄像师负责：根据目标视频模型能力决定分组策略
  - 这样设计避免重复工作（用户可能在设置中切换模型）

### 分镜师输出格式

```typescript
interface StoryboardArtistResult {
  // 完整 5×5 分镜网格图（支持参考图的模型使用）
  storyboard_grid_image: string;

  // 25 张切割后的单帧图（只支持首尾帧的模型使用）
  frame_images: string[];

  // 每帧详细元数据
  frames: {
    frame_number: number;
    description: string;
    duration: number;
    shot_type: string;
    character_refs: string[];
    camera_movement: string;
    is_key_frame: boolean;

    // 剧情节奏标记（供摄像师参考切分位置）
    narrative_beats?: {
      is_scene_change: boolean;  // 场景切换点
      is_climax: boolean;        // 高潮点
      is_transition: boolean;    // 过渡点
    }
  }[];

  // 整体风格描述（供摄像师传递给视频模型）
  style_notes: string;
}
```

### 下游使用方式（Phase 4 摄像师 Agent）

**模式 A：支持参考图的模型**
- 使用 `storyboard_grid_image` 作为参考图
- 根据 `narrative_beats` 决定切分位置
- 为每组生成对应 `description`

**模式 B：只支持首尾帧的模型**
- 从 `frame_images` 中提取首尾帧
- 根据 `duration` 和模型最大时长计算组数
- `middle_frames` 仅作生成参考，不直接传入

### 导演模式检查点

- **D-07:** 两次 humanApproval：
  1. LLM 生成分镜描述 JSON 后（可编辑/重试）
  2. 图像生成完成后（可确认/重试）

### Agent 目录结构

- **D-08:** 标准结构：
  ```
  src/main/ai/agents/storyboard-artist/
  ├── index.ts          # runStoryboardArtistAgent, 类型定义
  ```

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 参考实现（三层架构标杆）
- `src/shared/constants/artDirectorTemplates.ts` — 三层架构模板
- `src/main/ai/agents/art-director/index.ts` — Agent 实现结构
- `src/main/ai/agents/casting-director/index.ts` — 含图像生成的 Agent 实现

### 现有分镜师实现（待重构）
- `src/main/ai/prompts/storyboard-artist-agent.ts` — 当前提示词
- `src/main/ai/workflows/nodes/storyboard-artist.ts` — Node 实现（含 sharp 切割逻辑）

### 视频生成相关
- `src/main/ai/providers/interface.ts` — ImageGenerationOptions, VideoGenerationOptions
- `src/main/utils/cache.ts` — downloadToCache 用于下载图片

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Sharp 切割逻辑**：storyboard-artist.ts 第 167-208 行已实现 5×5 切割
- **动态导入 sharp**：`const sharp = await import('sharp')` 模式已验证
- **图像生成调用**：casting-director 已实现双调用模式（LLM + generateImage）

### Established Patterns
- **Agent 返回格式**：包含 `image_url` + `metadata` + 结构化数据
- **导演模式**：`executionMode === 'director'` 时设置 `humanApproval = false`
- **横竖版处理**：state.videoSpec?.aspectRatio === '9:16' 判断

### Integration Points
- **输入**：选角导演的 `character_reference_sheet.image_url` 作为风格参考
- **输出**：`step4_video.content` 包含 frames + imageUrl + localGridPath
- **下游**：摄像师 Agent 使用分镜结果规划视频生成

### Known Issues to Fix
- **横竖版 bug**：当前代码似乎未正确区分横竖版尺寸
- **切割逻辑**：当前在 Node 中，应移到 Agent 内

</code_context>

<specifics>
## Specific Ideas

### EDITABLE 层内容要点

1. **镜头语言词汇表**
   - 景别：close-up, medium shot, wide shot, extreme close-up
   - 角度：high angle, low angle, bird's eye view, eye level, dutch angle
   - 运动：static, pan, tilt, zoom, tracking, dolly, handheld

2. **分镜创作方法论**
   - 剧本段落 → 镜头序列的转换逻辑
   - 角色出场、冲突、高潮的视觉呈现
   - 转场效果选择（cut, fade, dissolve）

3. **场景连贯性规则**
   - 180度规则
   - 视线匹配
   - 动作连贯

4. **剧情节奏标记（供摄像师参考）**
   - 场景切换点识别（is_scene_change）
   - 高潮点标记（is_climax）
   - 过渡点识别（is_transition）
   - 这些标记帮助摄像师在分组时避免切在尴尬位置

### LOCKED 层强制约束

```typescript
// 图像生成提示词模板（强制不可编辑）
const STORYBOARD_IMAGE_PROMPT = `Professional storyboard grid, exactly 5 rows and 5 columns of 25 panels,
{{layout_hint}}, zero gaps between panels, no borders no padding no margins no gutters no grid lines no black bars no white space, all panels flush edge-to-edge filling the entire image,
{{style_tags}}, each panel shows: {{frame_descriptions}},
consistent character design, sequential narrative flow, no text, no numbers`;

// layout_hint 动态插入
const isPortrait = aspectRatio === '9:16';
const layoutHint = isPortrait
  ? 'portrait orientation 9:16 vertical layout, each cell is taller than wide'
  : 'landscape orientation 16:9 horizontal layout, each cell is wider than tall';
```

### 视频模型能力配置（参考信息，供摄像师使用）

```typescript
// 不同视频生成模型的能力配置（Phase 4 摄像师 Agent 使用）
interface VideoGenConfig {
  maxDuration: number;      // 模型支持的最大时长（秒）
  supportsReference: boolean; // 是否支持参考图
}

// 示例配置（供参考）
const MODEL_CONFIGS: Record<string, VideoGenConfig> = {
  'seedance-1.5-pro': { maxDuration: 15, supportsReference: true },
  'seedance-1.5-lite': { maxDuration: 5, supportsReference: true },
  'kling-1.6': { maxDuration: 10, supportsReference: false },
  'luma-1.0': { maxDuration: 5, supportsReference: false },
};
```

注：分镜师 **不处理** 这些配置，只负责输出分镜。摄像师根据用户选择的模型和这些配置决定分组策略。

### DYNAMIC 变量清单

```
{{scriptContent}} - 剧本内容
{{characterReferenceSheet}} - 选角导演输出（含 image_url, style_guide）
{{sceneBreakdowns}} - 场景描述
{{videoSpec}} - 视频规格（aspectRatio, duration）
{{artDirectorOutput}} - 艺术总监输出
```

</specifics>

<deferred>
## Deferred Ideas

1. **智能分镜优化** — 根据 AI 生成的分镜质量自动调整提示词
2. **多风格分镜** — 支持手绘风格、3D 渲染风格等不同视觉风格
3. **动态分镜** — 支持生成简单的动画预览（超出当前范围）

### 已识别但不在本阶段范围
- 摄像师 Agent 重构 — Phase 4
- 视频生成模型适配的具体实现 — 属于摄像师 Agent 职责

</deferred>

---

*Phase: 03-agent*
*Context gathered: 2026-03-25*
