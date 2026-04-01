---
phase: 01
plan: 01
completed: 2025-03-25T01:30:00+08:00
artifacts_created:
  - src/shared/constants/artDirectorTemplates.ts
  - src/main/ai/agents/art-director/index.ts
artifacts_modified:
  - src/shared/constants/promptTemplates.ts
  - src/main/ai/workflows/nodes/art-director.ts
verification_status: passed
---

# 01-01 总结：艺术总监 Agent 三层架构重构

## 完成内容

### 1. 创建 artDirectorTemplates.ts 三层提示词常量文件

文件 `src/shared/constants/artDirectorTemplates.ts` 包含：

- **EDITABLE 层** (`ART_DIRECTOR_AGENT_EDITABLE_PART`)：
  - Agent 人设定义：视觉与剧本解构总监的定位
  - 剧本提炼方法论：提取时间、地点、人物、核心冲突和高潮点
  - 角色创作方法论：识别角色数量，设定外貌、服装、性格
  - 场景创作方法论：创作主要场景，设定环境、光线、氛围、道具
  - 视觉风格定义：转化为 3-5 个英文核心风格 Tags
  - 地区适配方法论：根据文化档案调整视觉风格

- **LOCKED 层** (`ART_DIRECTOR_AGENT_LOCKED_PART`)：
  - JSON 输出格式定义（与原有格式一致）
  - 字段约束规则
  - 输出前自检清单

- **DYNAMIC 层** (`ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE`)：
  - 变量占位符：{{gameName}}, {{gameType}}, {{creativeDirectionName}}, {{personaName}}, {{cultureProfile}}, {{scriptContent}}, {{duration}}, {{aspectRatio}} 等

- **元数据对象** (`ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE`)：
  - agentId: 'art-director-agent'
  - agentName: '艺术总监 Agent'
  - agentDescription: '根据剧本提炼精华、创作角色和场景，为后续分镜设计提供视觉简报'

### 2. 创建 art-director/ Agent 实现目录

文件 `src/main/ai/agents/art-director/index.ts` 包含：

- **类型定义**：
  - `ArtDirectorResult`：包含 script_brief, character_profiles, scene_breakdowns, duration_seconds, aspect_ratio, reference_images, video_generation_prompt, transition_note
  - `ArtDirectorContext`：包含 project, creativeDirection, persona, cultureProfile, regionName, scriptContent, duration, aspectRatio
  - `ArtDirectorAgentOptions`：包含 modelId, customEditablePart, currentIndex, totalCount

- **提示词构建函数**：
  - `buildSystemPrompt()`：合并 EDITABLE + LOCKED，支持 customEditablePart 覆盖
  - `buildUserPrompt()`：使用模板替换所有变量占位符

- **输出解析函数**：
  - `parseOutput()`：提取 JSON 代码块，验证必要字段，生成稳定角色 ID

- **Agent 主函数**：
  - `runArtDirectorAgent()`：主入口函数，获取 provider → 构建提示词 → 调用 LLM → 解析输出

### 3. 注册 BUILTIN_PROMPT_TEMPLATES

修改 `src/shared/constants/promptTemplates.ts`：
- 导入 artDirectorTemplates 中的四个常量
- 在 BUILTIN_PROMPT_TEMPLATES 数组中添加艺术总监 Agent 元数据对象

### 4. 重构 LangGraph Node

修改 `src/main/ai/workflows/nodes/art-director.ts`：
- 导入 `runArtDirectorAgent` 和相关类型
- 构建 `ArtDirectorContext` 上下文对象
- 调用 `runArtDirectorAgent()` 替代原有的直接 LLM 调用
- 保留原有的状态更新和错误处理逻辑

## 关键决策

- 采用与编剧 Agent 相同的代码风格和架构模式
- 保持输出 JSON 结构向后兼容
- PromptStudio 可以正确展示艺术总监 Agent 的编辑界面
- 支持 customEditablePart 参数，允许从 PromptStudio 获取自定义提示词

## 验证结果

- artDirectorTemplates.ts 文件存在且导出所有必需常量 ✅
- art-director/index.ts 文件存在且导出所有必需类型和函数 ✅
- BUILTIN_PROMPT_TEMPLATES 包含 art-director-agent 条目 ✅
- Node 正确导入并调用 runArtDirectorAgent ✅
