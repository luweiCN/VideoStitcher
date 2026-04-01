---
phase: 04-agent
plan: 01
type: execute
subsystem: ai-agents
tags: [cinematographer, templates, multi-stage, planner, executor]
dependency_graph:
  requires: []
  provides: [CINE-01, CINE-02]
  affects: [04-02, 04-03]
tech-stack:
  added: []
  patterns: [三层架构, 多阶段Agent]
key-files:
  created:
    - src/shared/constants/cinematographerTemplates.ts
  modified: []
decisions: []
metrics:
  duration: 15min
  completed_date: "2026-04-01"
---

# Phase 4 Plan 01: 摄像师 Agent 提示词常量文件 - 执行总结

## 一句话总结

创建了摄像师 Agent 多阶段架构的三层提示词常量文件，包含 Planner（规划器）和 Executor（执行器）两个阶段的 EDITABLE、LOCKED、DYNAMIC 层定义，支持根据视频生成模型能力智能适配工作流。

## 执行结果

### 已交付工件

| 文件 | 路径 | 说明 |
|------|------|------|
| cinematographerTemplates.ts | src/shared/constants/cinematographerTemplates.ts | 摄像师 Agent 多阶段提示词常量 |

### 导出常量清单

#### Planner 阶段（摄像规划器）

| 常量名 | 类型 | 说明 |
|--------|------|------|
| CINEMATOGRAPHER_PLANNER_AGENT_EDITABLE_PART | string | 可编辑层：Agent 人设、分段策略、运镜词汇表 |
| CINEMATOGRAPHER_PLANNER_AGENT_LOCKED_PART | string | 锁定层：RenderPlan JSON 格式定义 |
| CINEMATOGRAPHER_PLANNER_AGENT_USER_PROMPT_TEMPLATE | string | 动态层：storyboardOutput、videoSpec、modelCapabilities 变量 |
| CINEMATOGRAPHER_PLANNER_AGENT_BUILTIN_TEMPLATE | object | 元数据：agentId = 'cinematographer-planner' |

#### Executor 阶段（视频执行器）

| 常量名 | 类型 | 说明 |
|--------|------|------|
| CINEMATOGRAPHER_EXECUTOR_AGENT_EDITABLE_PART | string | 可编辑层：提示词构建方法论、模型适配规则 |
| CINEMATOGRAPHER_EXECUTOR_AGENT_LOCKED_PART | string | 锁定层：视频生成调用规范、输出格式 |
| CINEMATOGRAPHER_EXECUTOR_AGENT_USER_PROMPT_TEMPLATE | string | 动态层：renderPlan、frameImages、modelConfig 变量 |
| CINEMATOGRAPHER_EXECUTOR_AGENT_BUILTIN_TEMPLATE | object | 元数据：agentId = 'cinematographer-executor' |

### 核心功能

#### Planner 阶段功能

1. **工作流模式选择**：
   - 模式 A（mode_a）：支持参考图（如 Seedance）
   - 模式 B（mode_b）：只支持首尾帧（如 Kling）

2. **智能分段策略**：
   - 根据模型 maxDuration 决定分段数
   - 分析 narrative_beats 避免在场景切换点/高潮点切断
   - 优先在过渡点（is_transition）处分段

3. **RenderPlan 输出**：
   - workflowMode、totalChunks、chunks 数组
   - 每段包含：chunkId、durationSeconds、startFrameIndex、endFrameIndex
   - cameraMovement、transitionNote、promptContext

#### Executor 阶段功能

1. **提示词构建**：
   - Subject + Action + Camera Movement + Environment + Style + Quality 结构
   - 模型特定适配：Seedance（cinematic）vs Kling（action）

2. **参考图策略**：
   - 模式 A：完整分镜图作为风格参考
   - 模式 B：首尾帧作为关键帧插值

3. **视频生成调用**：
   - 调用 provider.generateVideo
   - 返回 videoUrl 和元数据

### 与参考实现的对比

| 特性 | storyboardArtistTemplates | cinematographerTemplates（本实现） |
|------|---------------------------|----------------------------------|
| 阶段划分 | Planner + Visualizer | Planner + Executor |
| Planner 输出 | 25 帧分镜描述 | RenderPlan JSON |
| Executor 输出 | 图像 URL | 视频 URL |
| 模型适配 | 图像生成模型 | 视频生成模型 |
| 工作流模式 | 单模式 | 双模式（A/B） |

## 偏差记录

### 自动修复问题

无偏差 - 计划按预期执行。

### 设计决策

1. **RenderPlan 字段命名**：采用 camelCase（chunkId、durationSeconds）与现有代码风格保持一致
2. **参考模式枚举**：使用 "full_storyboard" 和 "first_last_frames" 作为 referenceMode 值，语义清晰
3. **提示词风格字段**：沿用 promptStyle（'cinematic' | 'action' | 'neutral'）与 04-CONTEXT.md 决策一致

## 验证结果

- [x] 文件结构检查：包含 Planner 和 Executor 的 EDITABLE、LOCKED、DYNAMIC 层
- [x] 导出检查：确认所有八个常量都已导出
- [x] JSON 格式验证：确认 RenderPlan 输出格式定义正确
- [x] Agent ID 检查：确认使用 cinematographer-planner 和 cinematographer-executor
- [x] TypeScript 编译：文件通过类型检查

## 提交记录

| Commit | Message |
|--------|---------|
| 181f098 | feat(04-01): 创建摄像师 Agent 多阶段提示词常量文件 |

## 下一步

Plan 04-02（已实现）和 04-03：
- 04-02：实现 cinematographer 多阶段 Agent（CINE-03）
- 04-03：注册 BUILTIN_PROMPT_TEMPLATES 并更新 LangGraph Node（CINE-04, CINE-05）

## 自检结果

```
## Self-Check: PASSED

- [x] src/shared/constants/cinematographerTemplates.ts 存在
- [x] 导出八个常量已验证
- [x] TypeScript 编译通过
- [x] Commit 181f098 已创建
```
