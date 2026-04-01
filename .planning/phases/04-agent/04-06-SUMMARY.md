---
phase: 04-agent
plan: 06
type: ui-fix
subsystem: prompt-studio
wave: 1
gap_closure: true
tags: [ui, cinematographer, builtin-prompts]
dependency_graph:
  requires: [04-05]
  provides: []
  affects: [prompt-templates, agent-studio]
tech-stack:
  added: []
  patterns: [conditional-rendering, builtin-flag]
key-files:
  created: []
  modified:
    - src/shared/constants/promptTemplates.ts
    - src/renderer/pages/AICreative/agentStudio/TemplatesView.tsx
decisions:
  - 使用 builtinPrompts 标记识别使用内置提示词的 Agent
  - 条件渲染：builtinPrompts=true 时隐藏模板编辑 UI
  - 保持模型选择区域始终显示（包括双模型选择）
metrics:
  duration: 15min
  completed_date: "2026-04-01"
  tasks: 2
  files_modified: 2
  commits: 2
---

# Phase 4 Plan 6: PromptStudio UI 修复（摄像师 Agent）

## 一句话总结

为摄像师 Agent 添加 `builtinPrompts` 标记，使 PromptStudio 自动隐藏模板编辑 UI，仅保留双模型选择（文字模型 + 视频模型）。

## 执行结果

### 已完成的任务

| 任务 | 名称 | 提交 | 说明 |
|------|------|------|------|
| 1 | 更新 BUILTIN_PROMPT_TEMPLATES 标记内置提示词 | `121cbfc` | 为 cinematographer-agent 添加 `builtinPrompts: true` |
| 2 | 更新 PromptStudio UI 简化内置提示词 Agent | `f9485de` | 条件渲染：隐藏模板列表、新建按钮，显示简化提示 |

### 关键变更

#### 1. promptTemplates.ts

```typescript
// 摄像师 Agent 配置
{
  agentId: 'cinematographer-agent',
  // ...
  builtinPrompts: true,  // 新增：标识使用内置提示词
  // ...
}
```

#### 2. TemplatesView.tsx

```typescript
// 检测 builtinPrompts 标记
const isBuiltinPrompts = (builtinTemplate as { builtinPrompts?: boolean } | undefined)?.builtinPrompts === true;

// 条件渲染
{!isBuiltinPrompts && (
  // 内置默认模板区域
  // 自定义模板列表
  // 新建模板按钮
)}

{isBuiltinPrompts && (
  // 简化提示：此 Agent 使用内置提示词，不可编辑
)}

// 模型选择始终显示（包括双模型选择）
<AgentModelSelector ... />
```

## 验证结果

- [x] 摄像师 Agent 不显示"内置默认模板"区域
- [x] 摄像师 Agent 不显示"新建模板"按钮
- [x] 显示提示"此 Agent 使用内置提示词，不可编辑"
- [x] 显示文字模型和视频模型选择（双模型）
- [x] 其他 Agent 正常显示模板 UI
- [x] TypeScript 编译无新增错误

## 设计决策

### 标记方式

使用 `builtinPrompts: boolean` 字段标记使用内置提示词的 Agent：
- **优点**：显式声明，易于理解和维护
- **缺点**：需要在 BUILTIN_PROMPT_TEMPLATES 中逐个配置

### UI 简化策略

对于 `builtinPrompts === true` 的 Agent：
1. 隐藏 `BuiltinTemplateCard`（内置默认模板详情）
2. 隐藏自定义模板列表
3. 隐藏"新建模板"按钮
4. 显示简化提示信息（橙色圆点标识）
5. **保留**模型选择区域（这是配置的核心功能）

## 影响范围

- **仅影响**：PromptStudio 的 TemplatesView 组件
- **不影响**：Agent 实际执行逻辑（提示词仍在代码中）
- **不影响**：其他 Agent 的显示和行为

## 后续建议

如需支持更多使用内置提示词的 Agent，只需在 `BUILTIN_PROMPT_TEMPLATES` 中添加 `builtinPrompts: true` 即可自动获得简化 UI。

---

*执行时间：约 15 分钟*
*执行日期：2026-04-01*
