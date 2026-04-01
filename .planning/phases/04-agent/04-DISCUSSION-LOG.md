# Phase 4: 摄像师 Agent 重构 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 04-agent
**Areas discussed:** 导演模式、提示词架构、多阶段设计、模型配置、工作流模式、提示词优化、生成调用位置

---

## 导演模式

| Option | Description | Selected |
|--------|-------------|----------|
| 人工确认 | 在关键节点设置 humanApproval | |
| 自动执行 | 不设置人工确认，直接执行 | ✓ |

**User's choice:** 自动执行
**Notes:** 剧情、人物、场景和分镜图都已在前置阶段确认，摄像师阶段不需要再人工确认

---

## 提示词架构

| Option | Description | Selected |
|--------|-------------|----------|
| 完整三层架构 | 复杂的 EDITABLE + LOCKED + DYNAMIC 拆分 | |
| 简化架构 | 重点放在模型能力适配 | ✓ |

**User's choice:** 简化架构
**Notes:** 输入已经完整确认（分镜输出包含所有需要的信息），不需要复杂的提示词补充

---

## 多阶段架构

| Option | Description | Selected |
|--------|-------------|----------|
| 单阶段 | 一个提示词处理所有逻辑 | |
| 双阶段（Planner + Executor）| Planner 决定分段策略，Executor 生成视频 | ✓ |

**User's choice:** 双阶段（Planner + Executor）
**Notes:** 如果模型能力不支持参考图，需要根据分镜剧情对视频进行分段，这时候需要一个 AI 来做分段决策

---

## 模型能力配置

| Option | Description | Selected |
|--------|-------------|----------|
| 硬编码 | 在代码中定义常量 | |
| 配置文件 | JSON/YAML 文件，用户不可更改 | ✓ |
| 设置中可配置 | UI 界面可配置 | |

**User's choice:** 配置文件
**Notes:** 已有基础配置，需要完善以支持不同能力的工作流适配，用户不需要更改

---

## 工作流模式

**模式 A：支持参考图（如 Seedance）**
- 直接使用整张分镜图作为参考
- 单段视频生成

**模式 B：只支持首尾帧（如 Kling、Luma）**
- 根据剧情节奏标记智能分段
- 多段视频生成后拼接

**User's input:** 两种模式都需要支持，根据模型配置自动选择

---

## 提示词优化

| Option | Description | Selected |
|--------|-------------|----------|
| 通用提示词 | 一套描述适用所有模型 | |
| 模型特定适配 | 根据模型转换提示词风格 | ✓ |

**User's choice:** 模型特定适配
**Notes:** 每个模型对提示词的理解不同（如 Seedance 偏好 cinematic，Kling 偏好动作描述）

---

## 视频生成调用位置

| Option | Description | Selected |
|--------|-------------|----------|
| Agent 内部 | Agent 负责完整的视频生成任务 | ✓ |
| Node 中 | Node 调用 Agent 获取计划，然后直接调用视频生成 | |
| 混合模式 | Planner 在 Agent 内，视频生成在 Node 中 | |

**User's choice:** Agent 内部
**Notes:** 与选角导演、分镜设计保持一致，Agent 负责完整的生成任务

---

## Claude's Discretion

（无 — 用户明确了所有关键决策）

---

## Deferred Ideas

1. **实时视频预览** — 生成过程中提供预览
2. **智能重试机制** — 某段生成失败自动重试或调整参数
3. **多模型对比生成** — 同一分镜用不同模型生成对比
4. **视频后期处理** — 自动调色、配音、字幕

---

*Phase: 04-agent*
*Discussion completed: 2026-04-01*
