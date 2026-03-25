---
phase: 03-agent
plan: 01
type: execute
subsystem: ai-agents
tags: [storyboard-artist, prompt-templates, three-layer-architecture]
dependency_graph:
  requires: []
  provides: [STORYBOARD_ARTIST_AGENT_BUILTIN_TEMPLATE]
  affects: [prompt-studio, storyboard-artist-agent]
tech_stack:
  added: []
  patterns: [three-layer-prompt-architecture]
key_files:
  created:
    - src/shared/constants/storyboardArtistTemplates.ts
  modified: []
decisions: []
metrics:
  duration: "30 minutes"
  completed_date: "2026-03-25"
---

# Phase 3 Plan 1: 分镜设计 Agent 提示词重构 - 执行总结

## 一句话总结

创建了分镜设计 Agent 的三层提示词常量文件，包含完整的 EDITABLE（镜头语言词汇、分镜方法论）、LOCKED（5×5 网格约束、4K 分辨率、JSON 格式）、DYNAMIC（运行时变量）三层架构。

## 执行结果

### 完成的任务

| 任务 | 名称 | 提交 | 文件 |
|------|------|------|------|
| 1 | 创建 storyboardArtistTemplates.ts 三层提示词常量文件 | a267b3b | src/shared/constants/storyboardArtistTemplates.ts |

### 交付物

**文件**: `src/shared/constants/storyboardArtistTemplates.ts`

包含以下导出常量：

1. **STORYBOARD_ARTIST_AGENT_EDITABLE_PART** - 可编辑层
   - Agent 人设：动态视觉分镜规划总监
   - 镜头语言词汇表（景别、角度、运动）
   - 分镜创作方法论（剧本→镜头转换逻辑）
   - 场景连贯性规则（180度规则、视线匹配、动作连贯）
   - 剧情节奏标记（场景切换点、高潮点、过渡点）

2. **STORYBOARD_ARTIST_AGENT_LOCKED_PART** - 锁定层
   - 5×5 网格布局约束（强制不可修改）
   - 禁止白边/间隙约束（zero gaps, no borders）
   - 4K 分辨率规格（横版 3840×2160 / 竖版 2160×3840）
   - 图像生成提示词模板（含 layout_hint 动态插入）
   - JSON 输出格式定义（storyboard_grid_image + frame_images + frames）
   - 字段约束和自检清单

3. **STORYBOARD_ARTIST_AGENT_USER_PROMPT_TEMPLATE** - 动态层
   - 变量占位符：{{scriptContent}}, {{characterReferenceSheet}}, {{sceneBreakdowns}}, {{videoSpec}}, {{artDirectorOutput}}
   - 任务要求说明
   - 输出格式要求

4. **STORYBOARD_ARTIST_AGENT_BUILTIN_TEMPLATE** - 元数据导出
   - agentId: 'storyboard-artist-agent'
   - agentName: '分镜设计 Agent'
   - agentDescription: '根据剧本和角色参考图，生成 5×5 分镜网格图和 25 张单帧图'
   - templateId: 'builtin-storyboard-artist-v1'
   - systemPrompt getter 合并 editablePart 和 lockedPart

## 与计划的偏差

无偏差 - 计划执行完全符合预期。

## 自检结果

### 验证通过

- [x] 文件结构检查：包含文件头注释、三层提示词定义、元数据导出
- [x] 导出检查：四个常量都已正确导出
- [x] 模式一致性：代码风格与 artDirectorTemplates.ts 一致
- [x] LOCKED 层检查：包含 5×5 网格约束、无白边约束、4K 分辨率、JSON 格式定义
- [x] BUILTIN_TEMPLATE 检查：包含正确的 agentId 和 systemPrompt getter

## 技术细节

### 三层架构设计

```
EDITABLE（可编辑层）
├── 镜头语言词汇表（景别、角度、运动术语）
├── 分镜创作方法论
├── 场景连贯性规则
└── 剧情节奏标记

LOCKED（锁定层）
├── 5×5 网格布局约束
├── 禁止白边/间隙约束
├── 4K 分辨率规格
├── 图像生成提示词模板
└── JSON 输出格式定义

DYNAMIC（动态层）
├── {{scriptContent}}
├── {{characterReferenceSheet}}
├── {{sceneBreakdowns}}
├── {{videoSpec}}
└── {{artDirectorOutput}}
```

### 下游使用

该模板将被用于：
1. **PromptStudio** - 展示和编辑可编辑层
2. **StoryboardArtistAgent** - 构建系统提示词
3. **摄像师 Agent** - 使用 narrative_beats 进行视频分组

## 后续工作

根据计划，下一步是：
- 创建/重构分镜设计 Agent 实现目录 (`src/main/ai/agents/storyboard-artist/`)
- 在 `BUILTIN_PROMPT_TEMPLATES` 中注册分镜设计 Agent
- 确保 PromptStudio 能正确展示三层结构

---

*Summary created: 2026-03-25*
*Commit: a267b3b*
