# Phase 2: 选角导演 Agent 重构 - Research

**Researched:** 2026-03-25
**Domain:** AI Agent 提示词工程 / 图像生成提示词设计
**Confidence:** HIGH

## Summary

Phase 2 将选角导演 Agent 从当前的「透传模式」改造为「AI 生成模式」，核心变化是：

1. **当前缺陷**：`casting-director.ts` 第 36-49 行直接透传艺术总监输出，不调用 AI
2. **目标行为**：调用 LLM 为每个角色生成三视图图像提示词（正面、侧面、动作姿态）
3. **架构升级**：采用三层架构（EDITABLE + LOCKED + DYNAMIC），与艺术总监、剧本写作 Agent 保持一致
4. **导演模式**：支持 `humanApproval` 人工确认机制

**Primary recommendation:** 复用 Phase 1 艺术总监 Agent 的目录结构和代码模式，创建 `castingDirectorTemplates.ts` 常量文件 + `casting-director/index.ts` Agent 实现 + 重构 LangGraph Node。

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** EDITABLE 层包含 Agent 人设、三视图创作方法论、图像提示词编写技巧、角色一致性保证方法
- **D-02:** LOCKED 层包含 JSON 输出格式、图像提示词字段约束、三视图结构定义、自检清单
- **D-03:** DYNAMIC 层包含角色描述、视频参数、视觉风格标签
- **D-04:** 选角导演核心职责：接收艺术总监角色描述，生成三视图图像提示词，确保角色形象一致
- **D-05:** 导演模式 `executionMode === 'director'` 时设置 `humanApproval = false`，快速模式不设此字段
- **D-06:** 采用标准目录结构 `src/main/ai/agents/casting-director/index.ts`
- **D-07:** LangGraph Node 保持向后兼容，内部调用新的 `runCastingDirectorAgent()` 函数
- **D-08:** 输出 JSON 保持向后兼容，但 AI 生成图像提示词
- **D-09:** 工作流只生成提示词，不直接调用图像生成 API（仍由前端处理）

### Claude's Discretion
- 提示词具体内容设计（EDITABLE 层文案）
- 类型定义的具体字段命名（在约束范围内）
- 日志输出格式细节

### Deferred Ideas (OUT OF SCOPE)
- 分镜设计 Agent 重构 — Phase 3
- 摄像师 Agent 重构 — Phase 4
- 图像生成直接集成 — 保持当前设计，前端处理图像生成

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAST-01 | 选角导演 Agent 提示词拆分为三层架构 | 参考 artDirectorTemplates.ts 模式，EDITABLE/LOCKED/DYNAMIC 分离 |
| CAST-02 | 创建 `castingDirectorTemplates.ts` 共享常量文件 | 路径：src/shared/constants/castingDirectorTemplates.ts，遵循 screenplayAgentTemplates.ts 风格 |
| CAST-03 | 创建/重构选角导演 Agent 实现目录 | 路径：src/main/ai/agents/casting-director/index.ts，包含 runCastingDirectorAgent 主函数 |
| CAST-04 | 在 `BUILTIN_PROMPT_TEMPLATES` 中注册选角导演 Agent | 修改 src/shared/constants/promptTemplates.ts，添加 casting-director-agent 条目 |
| CAST-05 | 确保 PromptStudio 能正确展示选角导演 Agent | 验证 agentId、agentName、editablePart/lockedPart 分离展示 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | 类型安全 | 项目标准 |
| LangGraph | (内置) | 工作流编排 | 现有工作流基础设施 |
| provider-manager | (内置) | AI 提供商管理 | 统一 LLM 调用接口 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node.js) | built-in | 生成稳定 ID | 角色 ID 哈希生成 |

### Project-Specific Patterns
| Pattern | Source | Usage |
|---------|--------|-------|
| 三层提示词架构 | artDirectorTemplates.ts | EDITABLE + LOCKED + DYNAMIC 分离 |
| Agent 目录结构 | art-director/index.ts | 类型定义 + 提示词构建 + 输出解析 + 主函数 |
| LangGraph Node | art-director.ts | 调用 Agent 函数 + humanApproval 逻辑 |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── shared/constants/
│   └── castingDirectorTemplates.ts    # 三层提示词定义
├── main/ai/agents/casting-director/
│   └── index.ts                       # Agent 实现
├── main/ai/workflows/nodes/
│   └── casting-director.ts            # LangGraph Node（重构）
└── shared/constants/
    └── promptTemplates.ts             # 注册 BUILTIN_PROMPT_TEMPLATES
```

### Pattern 1: 三层提示词架构
**What:** 将提示词分离为 EDITABLE（可编辑）、LOCKED（锁定）、DYNAMIC（动态）三层
**When to use:** 所有 AI Agent 提示词系统
**Example:**
```typescript
// Source: src/shared/constants/artDirectorTemplates.ts
export const ART_DIRECTOR_AGENT_EDITABLE_PART = `你是"视觉与剧本解构总监"...`;
export const ART_DIRECTOR_AGENT_LOCKED_PART = `# 输出格式（严格遵守）...`;
export const ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE = `## 游戏信息...`;

export const ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE = {
  agentId: 'art-director-agent',
  agentName: '艺术总监 Agent',
  editablePart: ART_DIRECTOR_AGENT_EDITABLE_PART,
  lockedPart: ART_DIRECTOR_AGENT_LOCKED_PART,
  userPromptTemplate: ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE,
  get systemPrompt() {
    return `${this.editablePart}\n\n${this.lockedPart}`;
  },
} as const;
```

### Pattern 2: Agent 实现结构
**What:** 统一的 Agent 实现文件组织方式
**When to use:** 所有单次调用型 Agent
**Example:**
```typescript
// Source: src/main/ai/agents/art-director/index.ts

// ─── 类型定义 ─────────────────────────────────────────────
export interface CastingDirectorResult { ... }
export interface CastingDirectorContext { ... }
export interface CastingDirectorAgentOptions { ... }

// ─── 提示词构建 ────────────────────────────────────────────
function buildSystemPrompt(customEditablePart?: string): string { ... }
function buildUserPrompt(context: CastingDirectorContext, ...): string { ... }

// ─── 输出解析 ──────────────────────────────────────────────
function parseOutput(llmOutput: string): CastingDirectorResult { ... }

// ─── Agent 主函数 ──────────────────────────────────────────
export async function runCastingDirectorAgent(
  context: CastingDirectorContext,
  options: CastingDirectorAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CastingDirectorResult> { ... }
```

### Pattern 3: LangGraph Node 导演模式
**What:** 在导演模式下设置 `humanApproval = false` 暂停工作流等待人工确认
**When to use:** 需要人工干预的 Agent 节点
**Example:**
```typescript
// Source: src/main/ai/workflows/nodes/art-director.ts 第 75-77 行
if (state.executionMode === 'director') {
  updates.humanApproval = false;
}
```

### Pattern 4: 图像提示词生成
**What:** 为角色生成三视图图像提示词（正面、侧面、动作姿态）
**When to use:** 选角导演 Agent 核心职责
**Output Structure:**
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

### Anti-Patterns to Avoid
- **直接透传输出：** 当前 casting-director.ts 第 36-49 行的做法是错误的，必须调用 AI 生成图像提示词
- **混合风格：** 图像提示词必须确保所有角色使用相同艺术风格（真人写实/卡通/油画）
- **中文提示词：** 图像生成模型更理解英文，提示词必须使用英文关键词

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 图像生成 API 调用 | 直接调用 SD/Midjourney API | 前端通过 `aside:generate-character-image` 处理 | 工作流只生成提示词，图像生成时机由前端控制 |
| JSON 解析 | 手写正则提取 | 复用 `parseOutput()` 模式（代码块提取 + JSON.parse） | 统一错误处理，支持 markdown 代码块包裹 |
| 角色 ID 生成 | 随机 UUID | 使用剧本内容哈希生成稳定 ID | 确保相同输入产生相同 ID，便于缓存和调试 |
| 提示词变量注入 | 字符串拼接 | 使用 `.replace(/\{\{var\}\}/g, value)` 模式 | 统一变量命名规范，便于 PromptStudio 识别 |

**Key insight:** 选角导演的职责边界是「生成图像提示词」，不是「生成图像」。图像生成是耗时操作，应由前端按需触发。

## Common Pitfalls

### Pitfall 1: 忘记设置导演模式 humanApproval
**What goes wrong:** 导演模式下工作流不暂停，用户无法确认角色设计
**Why it happens:** 重构时遗漏 Node 中的 `humanApproval` 逻辑
**How to avoid:** 在 `runCastingDirectorAgent` 调用后，检查 `state.executionMode === 'director'` 并设置 `updates.humanApproval = false`
**Warning signs:** 导演模式下角色生成步骤一闪而过，没有弹出确认对话框

### Pitfall 2: 图像提示词风格不一致
**What goes wrong:** 不同角色的图像生成风格差异大，看起来像来自不同作品
**Why it happens:** EDITABLE 层没有强调「所有角色必须使用相同艺术风格」
**How to avoid:** 在 EDITABLE 层添加「风格一致性规则」章节，强制要求统一风格标签
**Warning signs:** 同一剧本的角色有的像真人照片，有的像卡通画

### Pitfall 3: 中文图像提示词
**What goes wrong:** 图像生成效果差，模型不理解中文描述
**Why it happens:** LLM 输出中文提示词，但图像模型训练数据以英文为主
**How to avoid:** 在 LOCKED 层明确要求「所有 image_generation_prompts 必须使用英文」
**Warning signs:** 生成的图像与描述不符，或质量明显偏低

### Pitfall 4: 破坏向后兼容性
**What goes wrong:** 下游分镜设计 Agent 无法读取选角导演输出
**Why it happens:** 修改了 JSON 结构但没有保持必要字段
**How to avoid:** 确保 `character_profiles` 和 `scene_breakdowns` 字段与现有结构兼容，只新增 `image_generation_prompts` 字段
**Warning signs:** 工作流执行到分镜设计步骤时报错「缺少必要字段」

### Pitfall 5: 遗漏 BUILTIN_PROMPT_TEMPLATES 注册
**What goes wrong:** PromptStudio 中看不到选角导演 Agent
**Why it happens:** 忘记在 `promptTemplates.ts` 中添加新 Agent 条目
**How to avoid:** 在 CAST-04 任务中明确要求修改 `BUILTIN_PROMPT_TEMPLATES` 数组
**Warning signs:** PromptStudio 下拉列表中没有「选角导演 Agent」选项

## Code Examples

### 三视图图像提示词结构
```typescript
// Source: 02-CONTEXT.md D-08
interface CharacterProfile {
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
```

### 图像提示词生成示例（EDITABLE 层指导）
```typescript
// 正面视图提示词示例
"High quality photorealistic full body portrait of [角色描述], front view,
detailed facial features, [服装描述], [表情描述], studio lighting,
sharp focus, 8k resolution, professional photography"

// 侧面视图提示词示例
"Side profile full body shot of [角色描述], [服装描述], professional
photography, detailed, realistic, studio lighting, neutral expression"

// 动作姿态提示词示例
"Full body shot of [角色描述] in [动作描述], [服装描述], dynamic pose,
[场景元素], cinematic lighting, professional photography, 8k resolution"
```

### DYNAMIC 变量模板
```typescript
export const CASTING_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE = `## 角色描述

{{characterProfiles}}

## 视觉风格

- 视觉风格标签：{{visualStyleTags}}
- 画幅比例：{{aspectRatio}}

请为以上每个角色生成三视图图像提示词（正面、侧面、动作姿态）。`;
```

### 导演模式 humanApproval 设置
```typescript
// Source: src/main/ai/workflows/nodes/art-director.ts
const updates: Partial<WorkflowState> = {
  step3_storyboard: output,
  currentStep: 4,
};

if (state.executionMode === 'director') {
  updates.humanApproval = false;
}

return updates;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 直接透传艺术总监输出 | AI 生成图像提示词 | Phase 2 | 角色图像质量提升，支持三视图 |
| 单层提示词 | 三层架构（EDITABLE/LOCKED/DYNAMIC） | Phase 1-2 | PromptStudio 可编辑，代码安全 |
| 无导演模式 | 支持 humanApproval 暂停 | Phase 1-2 | 人工可干预关键步骤 |

**Deprecated/outdated:**
- `CastingDirectorAgentPrompts` 类（src/main/ai/prompts/casting-director-agent.ts）：将被新的三层架构替代
- 直接透传模式（casting-director.ts 第 36-49 行）：必须改为调用 AI

## Open Questions

1. **图像提示词长度限制**
   - What we know: 图像生成模型通常有提示词长度限制（如 77 tokens for CLIP）
   - What's unclear: 是否需要截断或压缩提示词
   - Recommendation: 在 LOCKED 层添加「提示词控制在 200 字以内」的约束

2. **负面提示词（negative prompt）**
   - What we know: 现有代码包含 negative_prompt 字段
   - What's unclear: 是否需要为每个视图生成负面提示词
   - Recommendation: 在 D-08 输出结构中保留 negative_prompt 字段，但可设为可选

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified)

本阶段为纯代码重构，依赖现有项目基础设施：
- provider-manager（已存在）
- LangGraph（已存在）
- TypeScript 编译器（已存在）

无新增外部依赖。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 项目未配置自动化测试框架 |
| Config file | none |
| Quick run command | `npm run dev` 手动测试 |
| Full suite command | 人工端到端测试 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAST-01 | 提示词三层分离 | 手动 | PromptStudio 查看 | N/A |
| CAST-02 | 常量文件创建 | 静态 | TypeScript 编译 | N/A |
| CAST-03 | Agent 函数导出 | 静态 | TypeScript 编译 | N/A |
| CAST-04 | BUILTIN_PROMPT_TEMPLATES 注册 | 手动 | PromptStudio 查看 | N/A |
| CAST-05 | PromptStudio 展示正确 | 手动 | 启动应用验证 | N/A |

### Wave 0 Gaps
- [ ] 无现有测试框架，依赖人工验证
- [ ] 建议添加：TypeScript 类型检查 `npm run typecheck`
- [ ] 建议添加：ESLint 检查 `npm run lint`

## Sources

### Primary (HIGH confidence)
- `src/shared/constants/artDirectorTemplates.ts` - Phase 1 完成的三层架构模板
- `src/main/ai/agents/art-director/index.ts` - Agent 实现标准结构
- `src/main/ai/agents/screenplay/index.ts` - 单次调用型 Agent 参考
- `src/main/ai/workflows/nodes/art-director.ts` - 导演模式 humanApproval 实现
- `.planning/phases/02-agent/02-CONTEXT.md` - 用户确认的实现决策

### Secondary (MEDIUM confidence)
- `src/main/ai/prompts/casting-director-agent.ts` - 现有提示词（待重构）
- `src/main/ai/workflows/nodes/casting-director.ts` - 现有 Node 实现（待重构）
- `src/shared/constants/promptTemplates.ts` - BUILTIN_PROMPT_TEMPLATES 注册方式

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 完全基于项目现有代码
- Architecture: HIGH - Phase 1 已验证模式
- Pitfalls: MEDIUM - 基于代码审查经验，需实际测试验证

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days for stable patterns)
