---
phase: 02-agent
plan: 02
completed: 2025-03-25T05:40:00+08:00
artifacts_created:
  - src/main/ai/agents/casting-director/index.ts
verification_status: passed
---

# 02-02 总结：选角导演 Agent 实现

## 完成内容

创建了 `src/main/ai/agents/casting-director/index.ts` 文件，实现完整的 Agent 调用逻辑：

### 类型定义区
- `ImagePrompt`：单个视角的图像提示词（view_type, prompt, negative_prompt）
- `CharacterImageProfile`：角色图像设定（包含三视图提示词数组）
- `GlobalStyleGuide`：全局风格指南（art_style, lighting_style, quality_tags, color_tone）
- `CastingDirectorResult`：Agent 输出结果
- `CastingDirectorContext`：输入上下文（characterProfiles, sceneBreakdowns 等）
- `CastingDirectorAgentOptions`：调用选项（modelId, customEditablePart）

### 提示词构建区
- `buildSystemPrompt()`：合并 EDITABLE + LOCKED 层
- `buildUserPrompt()`：注入动态变量（characterProfiles, visualStyleTags, overallTone）
- 日志输出：记录 systemPromptLength、userPromptLength、characterCount

### 输出解析区
- `parseOutput()`：提取 JSON 代码块并解析
- 验证必要字段：character_images 数组、三个视角（front_view, side_view, action_pose）
- 字段清理和类型转换

### Agent 主函数
- `runCastingDirectorAgent()`：主入口函数
- 步骤：获取 provider → 构建提示词 → 调用 LLM → 解析输出
- 支持自定义模型和可编辑部分覆盖

## 关键决策

- 采用与艺术总监 Agent 相同的代码风格和分隔区格式
- 单次调用型 Agent，不需要 LangGraph StateGraph
- 输出包含 global_style_guide 确保所有角色风格一致

## 验证结果

- 文件结构符合四区标准（类型/提示词/解析/主函数）✅
- 正确导入 castingDirectorTemplates 常量 ✅
- 主函数和类型正确导出 ✅
