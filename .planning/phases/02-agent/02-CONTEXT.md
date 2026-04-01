# Phase 2: 选角导演 Agent 重构 - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

将选角导演 Agent 的提示词系统改造为三层架构（EDITABLE + LOCKED + DYNAMIC），同时**修正当前实现缺陷**：当前代码直接透传艺术总监输出，应该改为调用 AI 生成人物三视图的图像提示词。

**关键修正（与用户确认）**：
- 选角导演 **必须调用 AI** 生成图像提示词
- 导演模式下设置 `humanApproval = false` 等待人工确认
- 快速模式下自动继续执行

</domain>

<decisions>
## Implementation Decisions

### 三层架构拆分策略

- **D-01:** EDITABLE（可编辑层）包含：
  - Agent 人设定义（选角导演的专业定位）
  - 人物三视图创作方法论（正面、侧面、动作姿态）
  - 图像提示词编写技巧（英文关键词、风格标签）
  - 角色一致性保证方法

- **D-02:** LOCKED（锁定层）包含：
  - JSON 输出格式定义
  - 图像提示词字段约束（字符数、必填项）
  - 三视图结构定义（front_view, side_view, action_pose）
  - 输出前自检清单

- **D-03:** DYNAMIC（动态层）包含：
  - 角色描述（来自艺术总监的 character_profiles）
  - 视频参数（时长、画幅比例）
  - 视觉风格标签（来自艺术总监的 visual_style_tags）

### Agent 职责与模式行为

- **D-04:** 选角导演核心职责：
  - 接收艺术总监生成的角色描述
  - 为每个角色生成三视图图像提示词（正面、侧面、动作姿态）
  - 确保角色形象在不同视角下保持一致

- **D-05:** 导演模式 vs 快速模式：
  - 导演模式：`executionMode === 'director'` 时设置 `humanApproval = false`，等待用户确认/重试
  - 快速模式：不设置 `humanApproval`，工作流自动继续

### Agent 目录组织策略

- **D-06:** 采用与 screenplay agent、art-director agent 相同的目录结构：
  - `src/main/ai/agents/casting-director/index.ts`
  - 包含 `runCastingDirectorAgent()` 主函数
  - 包含类型定义：`CastingDirectorResult`, `CastingDirectorContext`, `CastingDirectorAgentOptions`
  - 包含提示词构建函数：`buildSystemPrompt()`, `buildUserPrompt()`
  - 包含输出解析函数：`parseOutput()`

- **D-07:** LangGraph Node 保持向后兼容：
  - 保留 `src/main/ai/workflows/nodes/casting-director.ts` 作为工作流入口
  - Node 内部调用新的 `runCastingDirectorAgent()` 函数
  - 添加导演模式的 `humanApproval` 逻辑

### 输出 JSON 结构

- **D-08:** 保持向后兼容，但 AI 生成图像提示词：
  ```typescript
  {
    character_profiles: [
      {
        id: string;
        name: string;
        role_type: 'protagonist' | 'antagonist' | 'supporting';
        appearance: string;
        costume: string;
        personality_traits: string[];
        key_actions: string[];
        // AI 生成的三视图图像提示词
        image_generation_prompts: {
          front_view: string;   // 正面全身照
          side_view: string;    // 侧面全身照
          action_pose: string;  // 动作姿态
        };
      }
    ],
    scene_breakdowns: SceneBreakdown[]; // 透传艺术总监的场景
  }
  ```

### 图像生成流程

- **D-09:** 工作流只生成提示词，不直接调用图像生成 API：
  - 选角导演输出图像提示词
  - 图像实际生成仍由前端通过 `aside:generate-character-image` 处理
  - 这样设计是为了让前端可以控制图像生成时机和展示方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 参考实现（三层架构标杆）
- `src/shared/constants/screenplayAgentTemplates.ts` — 三层架构模板定义的标准模式
- `src/shared/constants/artDirectorTemplates.ts` — Phase 1 刚完成的艺术总监模板
- `src/main/ai/agents/art-director/index.ts` — Agent 实现结构参考
- `src/main/ai/agents/screenplay/index.ts` — 单次调用型 Agent 的标准实现结构

### 现有选角导演实现（待重构）
- `src/main/ai/prompts/casting-director-agent.ts` — 现有提示词构建器（需要拆分）
- `src/main/ai/workflows/nodes/casting-director.ts` — LangGraph Node 实现（需要修正 AI 调用逻辑）

### 导演模式实现参考
- `src/main/ai/workflows/nodes/art-director.ts` 第 75-77 行 — `humanApproval` 设置逻辑

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **三层架构模式**：artDirectorTemplates.ts 提供了完整的 EDITABLE/LOCKED/DYNAMIC 分离范例
- **BUILTIN_PROMPT_TEMPLATES**：promptTemplates.ts 中展示了如何注册内置模板
- **Agent 函数签名**：art-director/index.ts 中的 `runArtDirectorAgent(context, options, logger)` 模式可直接复用
- **导演模式逻辑**：art-director.ts Node 中的 `humanApproval` 设置

### Established Patterns
- **单次调用型 Agent**：screenplay、art-director、creative-direction 都是单次 LLM 调用
- **工作流集成 Agent**：casting-director 是 LangGraph 工作流的节点组件
- **提示词构建**：使用简单的字符串拼接（`buildSystemPrompt()` 合并 EDITABLE + LOCKED）
- **变量注入**：使用 `{{variable}}` 占位符模板，通过 `.replace()` 批量替换

### Integration Points
- **LangGraph Node 入口**：`src/main/ai/workflows/nodes/casting-director.ts` 调用新 Agent
- **PromptStudio 展示**：通过 `BUILTIN_PROMPT_TEMPLATES` 数组自动发现
- **类型共享**：`@shared/types/aside` 中的类型定义

### Known Issues to Fix
- **当前实现缺陷**：casting-director.ts 第 36-49 行直接透传 artDirectorOutput，不调用 AI
- **缺少导演模式支持**：当前实现没有 `humanApproval` 逻辑

</code_context>

<specifics>
## Specific Ideas

### EDITABLE 层内容要点（可编辑的核心）
1. **Agent 人设**：选角导演的专业定位——专注于将角色描述转化为可用于图像生成的精确提示词
2. **三视图方法论**：
   - 正面：展示角色完整外貌、服装细节
   - 侧面：展示角色轮廓、体型比例
   - 动作：展示角色性格、典型姿态
3. **图像提示词编写技巧**：
   - 使用英文关键词（图像生成模型更理解英文）
   - 按重要性排序（主体 > 服装 > 风格 > 质量词）
   - 添加负面提示词避免常见问题
4. **角色一致性保证**：确保三视图中角色的服装、发型、配饰保持一致

### DYNAMIC 变量清单
```
{{characterProfiles}} - 角色描述数组（JSON 字符串）
{{visualStyleTags}} - 视觉风格标签
{{aspectRatio}} - 画幅比例
```

### Agent 目录结构
```
src/main/ai/agents/casting-director/
├── index.ts          # 主入口：runCastingDirectorAgent, 类型定义, 提示词构建
```

### 提示词常量文件
```
src/shared/constants/castingDirectorTemplates.ts
```

</specifics>

<deferred>
## Deferred Ideas

### 已识别但不在本阶段范围
1. **分镜设计 Agent 重构** — Phase 3
2. **摄像师 Agent 重构** — Phase 4
3. **图像生成直接集成** — 保持当前设计，工作流只生成提示词，图像生成由前端处理

</deferred>

---

*Phase: 02-agent*
*Context gathered: 2026-03-25*
