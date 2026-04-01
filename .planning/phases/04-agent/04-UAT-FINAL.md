---
status: testing
phase: 04-agent
source:
  - 04-05-SUMMARY.md
started: 2026-04-01T22:00:00Z
updated: 2026-04-01T22:00:00Z
purpose: 验证 04-05 重新设计后的最终效果
---

## Current Test

number: 1
name: PromptStudio 显示单个摄像师 Agent
expected: |
  打开 PromptStudio（AI 创意 → Prompt Studio），在 Agent 下拉列表中应能看到：
  - 只有一个「摄像师 Agent」
  - 没有「摄像师 - 规划器」或「摄像师 - 执行器」
  - 图标为 Video（橙色主题）
awaiting: user response

## Tests

### 1. PromptStudio 显示单个摄像师 Agent
expected: Agent 列表只有一个「摄像师 Agent」，没有分开的 Planner 和 Executor
result: pass
note: "单个 Agent 显示正确"

### 2. 摄像师 Agent 提示词 UI 简化
expected: 不显示内置默认模板、不显示"新建模板"按钮，因为不支持自定义提示词
result: issue
reported: "能看到 Agent，但是内置默认模板不应该显示，新建模板按钮也不该显示，因为摄像师 Agent 不支持自定义提示词"
severity: major

### 3. 摄像师 Agent 模型选择
expected: 可以选择两个模型：文字模型（Planner 用）和视频模型（生成用）
result: [pending]

### 4. 工作流自动选择模式
expected: 根据视频模型能力自动选择：支持参考图直接生成，不支持则自动分段+切图+拼接
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0

## Gaps

