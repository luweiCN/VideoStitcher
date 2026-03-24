# VideoStitcher Agent 提示词重构项目

## What This Is

VideoStitcher 是一款基于 Electron 的 AI 视频生成工具，采用 LangGraph 多 Agent 协作工作流。本项目的目标是将所有 Agent 的提示词系统改造成**三层架构模式**，使游戏行业专家可以在 PromptStudio 中自定义可编辑部分，同时保持代码解析所需的锁定部分不变。

## Core Value

让非技术人员（游戏行业专家）能够调整 AI Agent 的"人设"和"创作风格"，而不需要修改代码或担心破坏系统功能。

## Context

### 技术栈
- Electron + React + TypeScript
- LangChain/LangGraph 用于 AI 工作流编排
- SQLite 用于数据持久化
- Tailwind CSS + Radix UI 用于界面

### 已有三层架构重构完成的 Agent
1. **创意方向生成 Agent** (`creative-direction-agent`) - 生成差异化创意风格方向
2. **编剧生成 Agent** (`writer-generator-agent`) - 生成专属编剧人设
3. **剧本写作 Agent** (`screenplay-agent`) - 生成 15 秒短视频剧本

### 待重构的 Agent（按优先级排序）
1. **艺术总监 Agent** (`art-director-agent`) - 提炼剧本精华、创作角色
2. **选角导演 Agent** (`casting-director-agent`) - 生成人物图像提示词
3. **分镜设计 Agent** (`storyboard-artist-agent`) - 生成分镜图
4. **摄像师 Agent** (`cinematographer-agent`) - 生成视频合成计划

### 三层架构设计模式

```typescript
// 可编辑层（EDITABLE）- 面向游戏行业专家
export const XXX_AGENT_EDITABLE_PART = `...`;

// 锁定层（LOCKED）- 代码解析依赖，不可修改
export const XXX_AGENT_LOCKED_PART = `...`;

// 动态层（DYNAMIC）- 运行时注入的变量
export const XXX_AGENT_USER_PROMPT_TEMPLATE = `...`;

// Agent 元数据，用于 PromptStudio 展示
export const XXX_AGENT_BUILTIN_TEMPLATE = {
  agentId: 'xxx-agent',
  agentName: 'XXX Agent',
  editablePart: XXX_AGENT_EDITABLE_PART,
  lockedPart: XXX_AGENT_LOCKED_PART,
  userPromptTemplate: XXX_AGENT_USER_PROMPT_TEMPLATE,
  get systemPrompt() {
    return `${this.editablePart}\n\n${this.lockedPart}`;
  },
} as const;
```

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 提示词分三层 | 分离"可编辑内容"与"代码依赖"，让非技术人员安全地自定义 | — Pending |
| 共享常量文件 | `src/shared/constants/` 中的文件同时被 main 和 renderer 引用，确保 PromptStudio 展示与 AI 执行使用相同模板 | — Pending |
| Agent 实现独立目录 | `src/main/ai/agents/{agent-name}/` 包含该 Agent 的调用逻辑和类型定义 | — Pending |

## Requirements

### Validated

- ✓ 创意方向生成 Agent 三层架构重构完成
- ✓ 编剧生成 Agent 三层架构重构完成
- ✓ 剧本写作 Agent 三层架构重构完成
- ✓ PromptStudio UI 已支持展示和编辑可编辑层

### Active

- [ ] **ARTDIR-01**: 艺术总监 Agent 提示词拆分为三层架构
- [ ] **ARTDIR-02**: 创建 `artDirectorTemplates.ts` 共享常量文件
- [ ] **ARTDIR-03**: 创建/重构艺术总监 Agent 实现目录
- [ ] **ARTDIR-04**: 在 `BUILTIN_PROMPT_TEMPLATES` 中注册艺术总监 Agent
- [ ] **ARTDIR-05**: 确保 PromptStudio 能正确展示艺术总监 Agent 的三层结构

### Out of Scope

- 选角导演、分镜设计、摄像师 Agent 的重构 —— 将在后续阶段处理
- PromptStudio 的功能扩展 —— 只调整提示词结构，不改 UI 功能
- AI 模型切换逻辑 —— 保持现有的 provider-manager 机制

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-24 after initialization*
