---
phase: 02-agent
plan: 03
completed: 2025-03-25T05:40:00+08:00
artifacts_modified:
  - src/shared/constants/promptTemplates.ts
  - src/main/ai/workflows/nodes/casting-director.ts
  - src/renderer/pages/AICreative/agentStudio/agents.ts
verification_status: passed
---

# 02-03 总结：选角导演 Agent 集成

## 完成内容

### 1. 在 BUILTIN_PROMPT_TEMPLATES 中注册选角导演 Agent

修改 `src/shared/constants/promptTemplates.ts`：
- 添加选角导演 Agent 导入（CASTING_DIRECTOR_AGENT_* 常量）
- 在 BUILTIN_PROMPT_TEMPLATES 数组中添加新条目：
  - agentId: 'casting-director-agent'
  - agentName: '选角导演 Agent'
  - agentDescription: '根据艺术总监的角色描述，生成三视图图像提示词'
  - 引用 EDITABLE/LOCKED/USER_PROMPT 三层定义

### 2. 重构 LangGraph Node

修改 `src/main/ai/workflows/nodes/casting-director.ts`：
- 导入 `runCastingDirectorAgent` 和类型
- 构建 `CastingDirectorContext` 上下文
- 调用 `runCastingDirectorAgent()` 替代原有的透传逻辑
- 返回包含 character_images 和 global_style_guide 的输出
- 添加导演模式 humanApproval 逻辑（executionMode === 'director' 时设置 humanApproval = false）

### 3. 在 PromptStudio 中注册选角导演 Agent

修改 `src/renderer/pages/AICreative/agentStudio/agents.ts`：
- 导入 Users 图标（lucide-react）
- 在 AGENTS 数组中添加选角导演 Agent 配置：
  - id: 'casting-director-agent'
  - name: '选角导演 Agent'
  - role: '角色设计'
  - description: '根据艺术总监的角色描述，为每个角色生成三个视角（正面、侧面、动作姿态）的图像生成提示词'
  - icon: Users
  - iconColor: 'text-emerald-400'
  - bgColor: 'bg-emerald-500/10 group-hover:bg-emerald-500'
  - modelTypes: ['text']

### 4. 文件头注释更新
- 更新为说明「工作流只生成提示词，不直接调用图像生成 API」

## 关键决策

- 保持与艺术总监 Node 相同的 humanApproval 处理模式
- PromptStudio 可以正确展示选角导演 Agent 的编辑界面
- 向后兼容：输出 JSON 结构保持不变

## 验证结果

- BUILTIN_PROMPT_TEMPLATES 包含 casting-director-agent 条目 ✅
- Node 正确导入并调用 runCastingDirectorAgent ✅
- 导演模式 humanApproval = false 逻辑已添加 ✅
- PromptStudio 的 agents.ts 包含 casting-director-agent 配置 ✅
