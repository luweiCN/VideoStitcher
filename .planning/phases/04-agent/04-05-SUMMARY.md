---
phase: 04-agent
plan: 05
subsystem: ai
tags: [cinematographer, agent, prompt-templates, workflow, dual-model]

# Dependency graph
requires:
  - phase: 04-agent
    provides: 摄像师 Agent 基础架构（Planner + Executor 多阶段模式）
provides:
  - 单个「摄像师 Agent」配置（替代 Planner + Executor 双 Agent）
  - 内置不可编辑的提示词系统
  - 双模型选择支持（textModel + videoModel）
  - 自动工作流模式检测（基于视频模型能力）
affects:
  - PromptStudio UI（只显示一个摄像师 Agent）
  - 工作流执行（自动选择单阶段/多阶段模式）

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "内置提示词模式：提示词作为实现细节内置在 Agent 代码中，不对用户暴露"
    - "双模型配置模式：Agent 支持分别指定 Planner 文字模型和 Executor 视频模型"
    - "能力驱动工作流：根据模型能力（supportsReferenceImage）自动选择执行模式"

key-files:
  created: []
  modified:
    - src/renderer/pages/AICreative/agentStudio/agents.ts - 简化为单个摄像师 Agent
    - src/shared/constants/promptTemplates.ts - 更新 BUILTIN_PROMPT_TEMPLATES
    - src/main/ai/workflows/state.ts - 添加 cinematographerOptions 类型
    - src/main/ai/workflows/nodes/cinematographer.ts - 支持双模型选择和自动检测
    - src/main/ai/agents/cinematographer/index.ts - 使用内置提示词，支持双模型配置

key-decisions:
  - "提示词内置：摄像师是专业角色，提示词不应被修改，内置在代码中不对用户暴露"
  - "双模型选择：用户选择文字模型（Planner）和视频模型（Executor），Agent 内部协调"
  - "自动模式检测：根据 videoModel.supportsReferenceImage 自动选择单阶段/多阶段模式"
  - "向后兼容：保留 modelCapabilities 和 agentModelAssignments 支持旧配置"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-04-01
---

# Phase 4 Plan 5: 摄像师 Agent 重新设计 Summary

**摄像师 Agent 重新设计为单一 Agent，提示词内置不可编辑，支持双模型选择（文字模型 + 视频模型），内部自动根据视频模型能力选择工作流模式**

## Performance

- **Duration:** 35 min
- **Started:** 2026-04-01T12:00:00Z
- **Completed:** 2026-04-01T12:35:00Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

- PromptStudio 只显示一个「摄像师 Agent」（替代原来的 Planner + Executor 双 Agent）
- 提示词完全内置在代码中，用户不可见、不可编辑、不可添加模板
- 支持双模型选择：文字模型（Planner 使用）和视频模型（视频生成使用）
- 内部自动检测：根据视频模型是否支持参考图，自动选择单阶段或多阶段工作流
- 向后兼容：保留旧配置支持，确保现有工作流不受影响

## Task Commits

Each task was committed atomically:

1. **Task 1: 简化 agents.ts 为一个摄像师 Agent** - `69ee13b` (feat)
2. **Task 2: 更新 BUILTIN_PROMPT_TEMPLATES** - `7a62c29` (feat)
3. **Task 3: 更新 Node 支持双模型选择和自动工作流检测** - `cd45b60` (feat)
4. **Task 4: 更新 Agent 使用内置提示词，支持双模型配置** - `1ff2ccb` (feat)

## Files Created/Modified

- `src/renderer/pages/AICreative/agentStudio/agents.ts` - 删除两个摄像师 Agent，添加统一的 cinematographer-agent，modelTypes 包含 text 和 video
- `src/shared/constants/promptTemplates.ts` - 删除两个模板配置，添加统一的 cinematographer-agent 配置（editablePart/lockedPart 为空）
- `src/main/ai/workflows/state.ts` - 添加 cinematographerOptions 类型（textModel + videoModel + videoModelConfig）
- `src/main/ai/workflows/nodes/cinematographer.ts` - 读取双模型配置，根据 videoModelConfig.supportsReferenceImage 自动决定工作流模式
- `src/main/ai/agents/cinematographer/index.ts` - 添加内置 PLANNER_SYSTEM_PROMPT 和 EXECUTOR_SYSTEM_PROMPT，支持 textModel/videoModel 分别指定

## Decisions Made

1. **提示词内置不可编辑**：摄像师是专业角色，其提示词涉及复杂的视频生成逻辑，不应被非技术人员修改。提示词作为实现细节完全内置在 Agent 代码中。

2. **双模型选择架构**：用户需要选择两个模型：
   - 文字模型：用于 Planner 阶段生成渲染计划
   - 视频模型：用于 Executor 阶段生成视频片段
   这种设计允许灵活组合（如 Doubao 规划 + Seedance 生成，或 GPT-4 规划 + Kling 生成）。

3. **自动工作流模式检测**：工作流模式不由用户配置，而是由视频模型能力决定：
   - 支持参考图（如 Seedance）：单阶段模式，直接使用分镜图生成
   - 只支持首尾帧（如 Kling）：多阶段模式，自动分段、切图、生成、拼接

4. **向后兼容策略**：保留旧的 modelCapabilities 和 agentModelAssignments 字段，确保现有工作流配置在新代码中仍然可用。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 摄像师 Agent 重新设计完成，可以进入 Phase 5 开发
- PromptStudio 将只显示一个摄像师 Agent，用户体验更简洁
- 双模型选择架构为后续多供应商模型接入奠定基础

---

*Phase: 04-agent*
*Completed: 2026-04-01*
