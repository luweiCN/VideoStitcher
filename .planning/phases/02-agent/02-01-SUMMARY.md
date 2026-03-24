---
phase: 02-agent
plan: 01
completed: 2025-03-25T05:40:00+08:00
artifacts_created:
  - src/shared/constants/castingDirectorTemplates.ts
verification_status: passed
---

# 02-01 总结：选角导演 Agent 三层提示词常量

## 完成内容

创建了 `src/shared/constants/castingDirectorTemplates.ts` 文件，包含选角导演 Agent 的三层提示词架构：

### 1. EDITABLE 层（CASTING_DIRECTOR_AGENT_EDITABLE_PART）
- Agent 人设定义：选角导演是专注于将角色描述转化为图像生成提示词的专业 Agent
- 三视图创作方法论：正面视图、侧面视图、动作姿势的详细规范
- 图像提示词构建技巧：主体描述 → 服装细节 → 姿势视角 → 场景背景 → 质量标签
- 风格一致性规则：禁止混合风格，所有角色必须使用相同艺术风格
- 提示词质量检查清单

### 2. LOCKED 层（CASTING_DIRECTOR_AGENT_LOCKED_PART）
- JSON 输出格式定义（严格遵守）
- 字段约束：character_images、image_prompts、global_style_guide
- 图像提示词字段验证规则
- 自检清单（结构检查、内容检查、一致性检查）

### 3. DYNAMIC 层（CASTING_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE）
- 变量占位符：{{characterProfiles}}、{{sceneBreakdowns}}、{{visualStyleTags}}、{{overallTone}}
- 运行时注入角色设定、场景描述、视觉风格标签

### 4. 元数据导出（CASTING_DIRECTOR_AGENT_BUILTIN_TEMPLATE）
- agentId: 'casting-director-agent'
- agentName: '选角导演 Agent'
- 用于 PromptStudio 展示和模板选择

## 关键决策

- 遵循与艺术总监 Agent 相同的代码风格和架构模式
- 提示词内容专门针对图像生成模型（如 Stable Diffusion、Midjourney）优化
- 三视图采用单图布局（非三张独立图片），通过 grid 排列展示

## 验证结果

- 文件结构符合规范 ✅
- 四个常量正确导出 ✅
- 代码风格与现有模板文件一致 ✅
