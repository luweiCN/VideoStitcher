# Phase 1: 艺术总监 Agent 重构 - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

将艺术总监 Agent 的提示词系统改造为三层架构（EDITABLE + LOCKED + DYNAMIC），创建共享常量文件和独立 Agent 实现目录，确保 PromptStudio 能正确展示和编辑。

**关键约束：**
- 不修改 LangGraph 工作流图，保持节点调用关系不变
- 不扩展 PromptStudio UI 功能，使用现有展示机制
- 输出 JSON 结构保持向后兼容，但补充场景字段

</domain>

<decisions>
## Implementation Decisions

### 三层架构拆分策略

- **D-01:** EDITABLE（可编辑层）包含：
  - Agent 人设定义（视觉与剧本解构总监的定位）
  - 剧本提炼方法论（如何提取核心剧情节点）
  - 角色创作方法论（外貌、服装、性格的创作规则）
  - 场景创作方法论（环境、氛围、视觉元素的创作规则）
  - 地区适配方法论（如何根据地区特征调整视觉风格，但不固定场景）

- **D-02:** LOCKED（锁定层）包含：
  - JSON 输出格式定义
  - 字段约束规则（字符数、必填项等）
  - 输出前自检清单
  - 所有代码解析依赖的结构定义

- **D-03:** DYNAMIC（动态层）包含：
  - 项目信息（游戏名称、类型、卖点）
  - 创意方向（名称、描述）
  - 编剧人设（名称、prompt）
  - 地区信息（地区名称 + 文化档案）
  - 剧本内容（原始剧本）
  - 视频参数（时长、画幅比例）

### Agent 目录组织策略

- **D-04:** 采用与 screenplay agent 相同的目录结构：
  - `src/main/ai/agents/art-director/index.ts`
  - 包含 `runArtDirectorAgent()` 主函数
  - 包含类型定义：`ArtDirectorResult`, `ArtDirectorContext`, `ArtDirectorAgentOptions`
  - 包含提示词构建函数：`buildSystemPrompt()`, `buildUserPrompt()`
  - 包含输出解析函数：`parseOutput()`

- **D-05:** 保持 LangGraph Node 向后兼容：
  - 保留 `src/main/ai/workflows/nodes/art-director.ts` 作为工作流入口
  - Node 内部调用新的 `runArtDirectorAgent()` 函数
  - 不破坏现有的工作流状态流转逻辑

### 输出 JSON 结构

- **D-06:** 保持现有字段兼容，补充场景字段：
  - `script_brief` - 剧本简报
  - `character_profiles` - 角色设定数组（含 image_generation_prompt）
  - `scene_breakdowns` - 场景拆分数组（**必须补充，用于传递给分镜师**）
  - `duration_seconds` - 时长
  - `aspect_ratio` - 画幅比例
  - `reference_images` - 参考图像
  - `video_generation_prompt` - 视频生成提示词
  - `transition_note` - 转场建议

### 地区与文化适配

- **D-07:** 地区信息动态注入：
  - 通过 `{{cultureProfile}}` 变量注入完整文化档案
  - Agent 根据文化档案自动适配视觉风格和角色形象
  - **场景创作不得绑定固定地点**（如避免每次都出现"村口大树"）
  - 方法论中应指导 Agent 如何灵活运用地区元素，而非硬编码

### 最佳实践优先

- **D-08:** 不强制保持向后兼容：
  - 如果现有实现不符合最佳实践，直接重构
  - LangGraph Node 可以修改内部实现，只保持接口契约
  - 采用 screenplay agent 的成功模式作为标杆

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 参考实现（三层架构标杆）
- `src/shared/constants/screenplayAgentTemplates.ts` — 三层架构模板定义的标准模式
- `src/main/ai/agents/screenplay/index.ts` — 单次调用型 Agent 的标准实现结构
- `src/shared/constants/promptTemplates.ts` — BUILTIN_PROMPT_TEMPLATES 注册方式

### 现有艺术总监实现（待重构）
- `src/main/ai/prompts/art-director-agent.ts` — 现有提示词构建器（需要拆分）
- `src/main/ai/workflows/nodes/art-director.ts` — LangGraph Node 实现（需要适配新 Agent）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **三层架构模式**：screenplayAgentTemplates.ts 提供了完整的 EDITABLE/LOCKED/DYNAMIC 分离范例
- **BUILTIN_PROMPT_TEMPLATES**：promptTemplates.ts 中展示了如何注册内置模板
- **Agent 函数签名**：screenplay/index.ts 中的 `runScreenplayAgent(context, options, logger)` 模式可直接复用

### Established Patterns
- **单次调用型 Agent**：screenplay 和 creative-direction 都是单次 LLM 调用，无需 LangGraph StateGraph
- **工作流集成 Agent**：art-director、casting-director 等是 LangGraph 工作流的节点组件
- **提示词构建**：使用简单的字符串拼接（`buildSystemPrompt()` 合并 EDITABLE + LOCKED）
- **变量注入**：使用 `{{variable}}` 占位符模板，通过 `.replace()` 批量替换

### Integration Points
- **LangGraph Node 入口**：`src/main/ai/workflows/nodes/art-director.ts` 调用新 Agent
- **PromptStudio 展示**：通过 `BUILTIN_PROMPT_TEMPLATES` 数组自动发现
- **类型共享**：`@shared/types/aside` 中的 Project、CreativeDirection、Persona 类型

### Known Issues to Fix
- **场景字段缺失**：当前输出中 scene_breakdowns 可能为空或未正确生成，需要确保场景创作逻辑完整
- **地区绑定问题**：需要避免场景固定绑定（如"村口大树"），改为灵活应用地区元素

</code_context>

<specifics>
## Specific Ideas

### EDITABLE 层内容要点（可编辑的核心）
1. **剧本提炼方法论**：如何提取时间、地点、人物、核心冲突和高潮点
2. **角色创作方法论**：根据剧本需求识别角色数量，设定外貌、服装、性格
3. **场景创作方法论**：创作主要场景（仅1个），设定环境、光线、氛围、道具
4. **视觉风格定义**：转化为 3-5 个英文核心风格 Tags 的方法
5. **地区适配方法论**：如何根据文化档案调整视觉风格，但不生搬硬套固定场景

### DYNAMIC 变量清单
```
{{gameName}} - 游戏名称
{{gameType}} - 游戏类型
{{sellingPoint}} - 游戏卖点
{{creativeDirectionName}} - 创意方向名称
{{creativeDirectionDescription}} - 创意方向描述
{{personaName}} - 编剧人设名称
{{personaPrompt}} - 编剧人设提示词
{{cultureProfile}} - 地区文化档案（JSON字符串）
{{scriptContent}} - 剧本内容
{{duration}} - 时长要求
{{aspectRatio}} - 画幅比例
```

### Agent 目录结构
```
src/main/ai/agents/art-director/
├── index.ts          # 主入口：runArtDirectorAgent, 类型定义, 提示词构建
```

</specifics>

<deferred>
## Deferred Ideas

### 已识别但不在本阶段范围
1. **选角导演 Agent 重构** — Phase 2
2. **分镜设计 Agent 重构** — Phase 3
3. **摄像师 Agent 重构** — Phase 4
4. **PromptStudio 功能扩展** — 保持 UI 不变，只做提示词结构调整

</deferred>

---

*Phase: 01-agent*
*Context gathered: 2026-03-25*
