---
phase: 01-agent
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/constants/artDirectorTemplates.ts
  - src/main/ai/agents/art-director/index.ts
  - src/shared/constants/promptTemplates.ts
  - src/main/ai/workflows/nodes/art-director.ts
autonomous: true
requirements:
  - ARTDIR-01
  - ARTDIR-02
  - ARTDIR-03
  - ARTDIR-04
  - ARTDIR-05
must_haves:
  truths:
    - "艺术总监 Agent 提示词已拆分为 EDITABLE + LOCKED + DYNAMIC 三层"
    - "artDirectorTemplates.ts 文件已创建并导出三层提示词常量"
    - "art-director/ Agent 目录已创建，包含完整的 Agent 调用逻辑"
    - "BUILTIN_PROMPT_TEMPLATES 数组已包含艺术总监 Agent 元数据"
    - "PromptStudio 能正确展示艺术总监 Agent 的编辑界面"
    - "LangGraph Node 能正常调用新的 Agent 函数"
  artifacts:
    - path: "src/shared/constants/artDirectorTemplates.ts"
      provides: "三层提示词模板常量（EDITABLE/LOCKED/DYNAMIC）和元数据对象"
      exports: ["ART_DIRECTOR_AGENT_EDITABLE_PART", "ART_DIRECTOR_AGENT_LOCKED_PART", "ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE", "ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE"]
    - path: "src/main/ai/agents/art-director/index.ts"
      provides: "Agent 主函数、类型定义、提示词构建、输出解析"
      exports: ["runArtDirectorAgent", "ArtDirectorResult", "ArtDirectorContext", "ArtDirectorAgentOptions"]
    - path: "src/shared/constants/promptTemplates.ts"
      provides: "BUILTIN_PROMPT_TEMPLATES 数组已注册艺术总监 Agent"
      contains: "agentId: 'art-director-agent'"
    - path: "src/main/ai/workflows/nodes/art-director.ts"
      provides: "LangGraph Node 入口，内部调用 runArtDirectorAgent"
      imports: "from '../../agents/art-director'"
  key_links:
    - from: "artDirectorTemplates.ts"
      to: "promptTemplates.ts"
      via: "import { ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE }"
    - from: "art-director/index.ts"
      to: "artDirectorTemplates.ts"
      via: "import { ART_DIRECTOR_AGENT_EDITABLE_PART, ART_DIRECTOR_AGENT_LOCKED_PART, ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE }"
    - from: "art-director/index.ts"
      to: "nodes/art-director.ts"
      via: "export { runArtDirectorAgent }"
    - from: "nodes/art-director.ts"
      to: "art-director/index.ts"
      via: "import { runArtDirectorAgent, ArtDirectorResult, ArtDirectorContext } from '../../agents/art-director'"
---

<objective>
将艺术总监 Agent 的提示词系统改造为三层架构（EDITABLE + LOCKED + DYNAMIC），创建共享常量文件和独立 Agent 实现目录，确保 PromptStudio 能正确展示和编辑。

Purpose: 使艺术总监 Agent 的提示词可以在 PromptStudio 中自定义编辑，同时保持代码解析依赖的 JSON 格式稳定不变
Output: artDirectorTemplates.ts 常量文件、art-director/ Agent 目录、BUILTIN_PROMPT_TEMPLATES 注册、适配后的 LangGraph Node
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-agent/01-CONTEXT.md

<!-- 三层架构标杆参考 -->
@src/shared/constants/screenplayAgentTemplates.ts

<!-- Agent 标准实现结构参考 -->
@src/main/ai/agents/screenplay/index.ts

<!-- BUILTIN_PROMPT_TEMPLATES 注册方式参考 -->
@src/shared/constants/promptTemplates.ts

<!-- 现有艺术总监实现（待重构） -->
@src/main/ai/prompts/art-director-agent.ts
@src/main/ai/workflows/nodes/art-director.ts

<interfaces>
<!-- 从 screenplayAgentTemplates.ts 提取的三层架构模式 -->

三层架构常量命名规范:
- EDITABLE: {AGENT_NAME}_AGENT_EDITABLE_PART
- LOCKED: {AGENT_NAME}_AGENT_LOCKED_PART
- DYNAMIC: {AGENT_NAME}_AGENT_USER_PROMPT_TEMPLATE
- 元数据: {AGENT_NAME}_AGENT_BUILTIN_TEMPLATE

元数据对象结构:
```typescript
{
  agentId: string,           // 唯一标识，如 'art-director-agent'
  agentName: string,         // 显示名称，如 '艺术总监 Agent'
  agentDescription: string,  // 功能描述
  templateId: string,        // 模板版本，如 'builtin-art-director-v1'
  name: string,              // 模板名称，如 '内置默认模板 v1'
  editablePart: string,      // 可编辑层内容
  lockedPart: string,        // 锁定层内容
  userPromptTemplate: string, // 动态层模板（含 {{variable}} 占位符）
  get systemPrompt(): string  // 合并 editable + locked 的计算属性
}
```

变量占位符格式（DYNAMIC 层使用）:
- {{gameName}} - 游戏名称
- {{gameType}} - 游戏类型
- {{sellingPoint}} - 游戏卖点
- {{creativeDirectionName}} - 创意方向名称
- {{creativeDirectionDescription}} - 创意方向描述
- {{personaName}} - 编剧人设名称
- {{personaPrompt}} - 编剧人设提示词
- {{cultureProfile}} - 地区文化档案（JSON字符串）
- {{scriptContent}} - 剧本内容
- {{duration}} - 时长要求
- {{aspectRatio}} - 画幅比例

<!-- 从 screenplay/index.ts 提取的 Agent 函数签名模式 -->

类型定义模式:
```typescript
export interface {Agent}Result {
  // LLM 输出字段，与 JSON 格式定义对应
}

export interface {Agent}Context {
  project: Project;
  creativeDirection: CreativeDirection;
  persona: Persona;
  cultureProfile: string;
  regionName?: string;
  // 其他上下文字段...
}

export interface {Agent}AgentOptions {
  modelId?: string;
  customEditablePart?: string;  // 来自 PromptStudio 的自定义提示词
  currentIndex?: number;
  totalCount?: number;
}
```

主函数签名:
```typescript
export async function run{Agent}Agent(
  context: {Agent}Context,
  options: {Agent}AgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<{Agent}Result>
```

提示词构建函数:
```typescript
function buildSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? {AGENT_NAME}_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${{AGENT_NAME}_AGENT_LOCKED_PART}`;
}

function buildUserPrompt(
  context: {Agent}Context,
  currentIndex: number,
  totalCount: number,
  logger?: { info: (msg: string, meta?: any) => void }
): string {
  // 使用 .replace(/\{\{variable\}\}/g, value) 替换变量
}
```

输出解析函数:
```typescript
function parseOutput(llmOutput: string): {Agent}Result {
  // 提取 ```json ... ``` 代码块或直接解析
  // 验证必要字段
  // 返回结构化结果
}
```

<!-- 从 art-director-agent.ts 提取的现有 JSON 输出格式 -->

艺术总监 Agent 输出 JSON 结构:
```typescript
{
  script_brief: {
    title: string;
    core_conflict: string;
    climax_point: string;
    visual_style_tags: string[];  // 3-5 个英文核心风格 Tags
    overall_tone: string;
  };
  character_profiles: Array<{
    name: string;
    role_type: 'protagonist' | 'antagonist' | 'supporting';
    appearance: string;  // 详细外貌描述
    costume: string;     // 服装描述
    personality_traits: string[];
    key_actions: string[];
    image_generation_prompt: string;  // 英文图像生成提示词
  }>;
  scene_breakdowns: Array<{
    scene_number: number;
    scene_name: string;
    location_type: 'indoor' | 'outdoor';
    time_of_day: 'day' | 'night' | 'dusk' | 'dawn';
    environment: string;
    props: string[];
    atmosphere: string;
    key_visual_elements: string[];
  }>;
  duration_seconds: number;
  aspect_ratio: string;
  reference_images: Array<{
    scene_number: number;
    description: string;
    style_notes: string;
  }>;
  video_generation_prompt: string;  // 英文视频生成提示词
  transition_note: string;  // 转场建议
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: 创建 artDirectorTemplates.ts 三层提示词常量文件</name>
  <read_first>
    src/shared/constants/screenplayAgentTemplates.ts
    src/main/ai/prompts/art-director-agent.ts
  </read_first>
  <files>src/shared/constants/artDirectorTemplates.ts</files>
  <action>
创建文件 src/shared/constants/artDirectorTemplates.ts，包含三层架构提示词常量：

1. ART_DIRECTOR_AGENT_EDITABLE_PART（可编辑层）：
   - Agent 人设定义：视觉与剧本解构总监的定位
   - 剧本提炼方法论：如何提取时间、地点、人物、核心冲突和高潮点
   - 角色创作方法论：根据剧本需求识别角色数量，设定外貌、服装、性格
   - 场景创作方法论：创作主要场景（仅1个），设定环境、光线、氛围、道具
   - 视觉风格定义：转化为 3-5 个英文核心风格 Tags 的方法
   - 地区适配方法论：如何根据文化档案调整视觉风格，但不生搬硬套固定场景
   - 参考 screenplayAgentTemplates.ts 中 SCREENPLAY_AGENT_EDITABLE_PART 的格式和风格

2. ART_DIRECTOR_AGENT_LOCKED_PART（锁定层）：
   - JSON 输出格式定义（必须与现有 art-director-agent.ts 中的输出格式完全一致）
   - 字段约束规则（字符数、必填项等）
   - 输出前自检清单
   - 所有代码解析依赖的结构定义
   - 参考 screenplayAgentTemplates.ts 中 SCREENPLAY_AGENT_LOCKED_PART 的格式

3. ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE（动态层）：
   - 使用变量占位符：{{gameName}}, {{gameType}}, {{sellingPoint}}, {{creativeDirectionName}}, {{creativeDirectionDescription}}, {{personaName}}, {{personaPrompt}}, {{cultureProfile}}, {{scriptContent}}, {{duration}}, {{aspectRatio}}
   - 包含项目信息、创意方向、编剧人设、地区文化档案、剧本内容、视频参数等章节
   - 参考 screenplayAgentTemplates.ts 中 SCREENPLAY_AGENT_USER_PROMPT_TEMPLATE 的格式

4. ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE（元数据对象）：
   - agentId: 'art-director-agent'
   - agentName: '艺术总监 Agent'
   - agentDescription: '根据剧本提炼精华、创作角色和场景，为后续分镜设计提供视觉简报'
   - templateId: 'builtin-art-director-v1'
   - name: '内置默认模板 v1'
   - editablePart: ART_DIRECTOR_AGENT_EDITABLE_PART
   - lockedPart: ART_DIRECTOR_AGENT_LOCKED_PART
   - userPromptTemplate: ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE
   - systemPrompt getter: 合并 editablePart + lockedPart

文件头部必须包含与 screenplayAgentTemplates.ts 相同的注释结构，说明分层设计意图。
  </action>
  <verify>
    <automated>grep -n "ART_DIRECTOR_AGENT_EDITABLE_PART" src/shared/constants/artDirectorTemplates.ts && grep -n "ART_DIRECTOR_AGENT_LOCKED_PART" src/shared/constants/artDirectorTemplates.ts && grep -n "ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE" src/shared/constants/artDirectorTemplates.ts && grep -n "ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE" src/shared/constants/artDirectorTemplates.ts</automated>
  </verify>
  <acceptance_criteria>
    - 文件 src/shared/constants/artDirectorTemplates.ts 存在
    - 文件包含 export const ART_DIRECTOR_AGENT_EDITABLE_PART
    - 文件包含 export const ART_DIRECTOR_AGENT_LOCKED_PART
    - 文件包含 export const ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE
    - 文件包含 export const ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE
    - ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE 包含变量：{{gameName}}, {{gameType}}, {{sellingPoint}}, {{creativeDirectionName}}, {{creativeDirectionDescription}}, {{personaName}}, {{personaPrompt}}, {{cultureProfile}}, {{scriptContent}}, {{duration}}, {{aspectRatio}}
    - ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE.agentId 等于 'art-director-agent'
    - ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE.agentName 等于 '艺术总监 Agent'
  </acceptance_criteria>
  <done>artDirectorTemplates.ts 文件创建完成，包含完整的三层提示词常量和元数据对象</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: 创建 art-director/ Agent 实现目录</name>
  <read_first>
    src/main/ai/agents/screenplay/index.ts
    src/main/ai/prompts/art-director-agent.ts
  </read_first>
  <files>src/main/ai/agents/art-director/index.ts</files>
  <action>
创建文件 src/main/ai/agents/art-director/index.ts，实现完整的 Agent 调用逻辑：

1. 类型定义（参考 screenplay/index.ts 模式）：
   - ArtDirectorResult 接口：包含 script_brief, character_profiles, scene_breakdowns, duration_seconds, aspect_ratio, reference_images, video_generation_prompt, transition_note 字段，与现有 art-director-agent.ts 中的 JSON 输出格式一致
   - ArtDirectorContext 接口：包含 project (Project), creativeDirection (CreativeDirection), persona (Persona), cultureProfile (string), regionName (string, optional), scriptContent (string), duration (string), aspectRatio (string)
   - ArtDirectorAgentOptions 接口：包含 modelId (string, optional), customEditablePart (string, optional), currentIndex (number, optional), totalCount (number, optional)

2. 提示词构建函数：
   - buildSystemPrompt(customEditablePart?: string): string - 合并 EDITABLE + LOCKED，支持 customEditablePart 覆盖
   - buildUserPrompt(context, currentIndex, totalCount, logger?): string - 使用 ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE 替换所有变量占位符

3. 输出解析函数：
   - parseOutput(llmOutput: string): ArtDirectorResult - 提取 ```json 代码块或直接解析，验证必要字段（script_brief, character_profiles, scene_breakdowns），返回结构化结果
   - 为每个 character_profile 生成稳定 ID（如果 LLM 没有生成），使用 MD5 哈希算法

4. Agent 主函数：
   - runArtDirectorAgent(context: ArtDirectorContext, options?: ArtDirectorAgentOptions, logger?): Promise<ArtDirectorResult>
   - 实现步骤：获取 AI 提供商（getGlobalProvider）→ 构建系统提示词 → 构建用户提示词 → 调用 LLM（temperature: 0.7, maxTokens: 4096）→ 解析输出 → 返回结果
   - 支持 logger 参数用于调试输出提示词信息

5. 默认导出：export default runArtDirectorAgent

导入语句：
- import type { Project, CreativeDirection, Persona } from '@shared/types/aside'
- import { ART_DIRECTOR_AGENT_EDITABLE_PART, ART_DIRECTOR_AGENT_LOCKED_PART, ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE } from '@shared/constants/artDirectorTemplates'
- import { getGlobalProvider } from '../../provider-manager'
- import { createHash } from 'crypto'
  </action>
  <verify>
    <automated>grep -n "export interface ArtDirectorResult" src/main/ai/agents/art-director/index.ts && grep -n "export interface ArtDirectorContext" src/main/ai/agents/art-director/index.ts && grep -n "export interface ArtDirectorAgentOptions" src/main/ai/agents/art-director/index.ts && grep -n "export async function runArtDirectorAgent" src/main/ai/agents/art-director/index.ts</automated>
  </verify>
  <acceptance_criteria>
    - 文件 src/main/ai/agents/art-director/index.ts 存在
    - 文件包含 export interface ArtDirectorResult
    - 文件包含 export interface ArtDirectorContext
    - 文件包含 export interface ArtDirectorAgentOptions
    - 文件包含 export async function runArtDirectorAgent
    - runArtDirectorAgent 函数导入并使用 ART_DIRECTOR_AGENT_EDITABLE_PART, ART_DIRECTOR_AGENT_LOCKED_PART, ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE
    - runArtDirectorAgent 函数调用 getGlobalProvider()
    - 文件包含函数 buildSystemPrompt, buildUserPrompt, parseOutput
    - 文件包含 export default runArtDirectorAgent
  </acceptance_criteria>
  <done>art-director/ Agent 目录创建完成，包含完整的类型定义、提示词构建、输出解析和主函数</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: 在 BUILTIN_PROMPT_TEMPLATES 中注册艺术总监 Agent</name>
  <read_first>
    src/shared/constants/promptTemplates.ts
    src/shared/constants/screenplayAgentTemplates.ts
  </read_first>
  <files>src/shared/constants/promptTemplates.ts</files>
  <action>
修改 src/shared/constants/promptTemplates.ts，在 BUILTIN_PROMPT_TEMPLATES 数组中添加艺术总监 Agent：

1. 在文件顶部添加导入语句（参考 screenplayAgentTemplates.ts 的导入方式）：
   ```typescript
   import {
     ART_DIRECTOR_AGENT_EDITABLE_PART,
     ART_DIRECTOR_AGENT_LOCKED_PART,
     ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE,
     ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE,
   } from './artDirectorTemplates';
   ```

2. 在 BUILTIN_PROMPT_TEMPLATES 数组中添加新的 Agent 元数据对象（参考 creative-direction-agent 和 writer-generator-agent 的格式）：
   ```typescript
   {
     agentId: 'art-director-agent',
     agentName: '艺术总监 Agent',
     agentDescription: '根据剧本提炼精华、创作角色和场景，为后续分镜设计提供视觉简报',
     templateId: 'builtin-art-director-v1',
     name: '内置默认模板 v1',
     editablePart: ART_DIRECTOR_AGENT_EDITABLE_PART,
     lockedPart: ART_DIRECTOR_AGENT_LOCKED_PART,
     userPromptTemplate: ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE,
     get systemPrompt() {
       return `${this.editablePart}\n\n${this.lockedPart}`;
     },
   },
   ```

3. 确保新添加的对象位于数组中合适的位置（建议按 Agent 类型排序，放在 writer-generator-agent 之后）
  </action>
  <verify>
    <automated>grep -n "art-director-agent" src/shared/constants/promptTemplates.ts && grep -n "ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE" src/shared/constants/promptTemplates.ts</automated>
  </verify>
  <acceptance_criteria>
    - src/shared/constants/promptTemplates.ts 包含 import { ART_DIRECTOR_AGENT_EDITABLE_PART, ART_DIRECTOR_AGENT_LOCKED_PART, ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE, ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE } from './artDirectorTemplates'
    - BUILTIN_PROMPT_TEMPLATES 数组包含 agentId 为 'art-director-agent' 的对象
    - 该对象包含 agentName: '艺术总监 Agent'
    - 该对象包含 editablePart: ART_DIRECTOR_AGENT_EDITABLE_PART
    - 该对象包含 lockedPart: ART_DIRECTOR_AGENT_LOCKED_PART
    - 该对象包含 userPromptTemplate: ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE
    - 该对象包含 systemPrompt getter 返回 editablePart + lockedPart 的合并结果
  </acceptance_criteria>
  <done>BUILTIN_PROMPT_TEMPLATES 已注册艺术总监 Agent，PromptStudio 可以自动发现并展示</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: 重构 LangGraph Node 以调用新的 Agent 函数</name>
  <read_first>
    src/main/ai/workflows/nodes/art-director.ts
    src/main/ai/agents/screenplay/index.ts
    src/main/ai/agents/art-director/index.ts
  </read_first>
  <files>src/main/ai/workflows/nodes/art-director.ts</files>
  <action>
修改 src/main/ai/workflows/nodes/art-director.ts，使其调用新的 runArtDirectorAgent 函数：

1. 添加导入语句：
   ```typescript
   import {
     runArtDirectorAgent,
     ArtDirectorResult,
     ArtDirectorContext,
     ArtDirectorAgentOptions,
   } from '../../agents/art-director';
   ```

2. 移除或注释掉旧的导入（如果不再需要）：
   - import { ArtDirectorAgentPrompts } from '../../prompts/art-director-agent';

3. 重构 artDirectorNode 函数：
   - 保留现有的前置检查逻辑（检查 step2_characters 是否已存在）
   - 保留获取 AI 提供商的代码（getProvider / getGlobalProvider）
   - 保留获取上下文信息的代码（project, creativeDirection, persona, region, step1_script, videoSpec）
   - 将原有的 "使用 ArtDirectorAgentPrompts 构建提示词" 和 "调用 LLM" 逻辑替换为调用 runArtDirectorAgent：
     ```typescript
     const context: ArtDirectorContext = {
       project,
       creativeDirection,
       persona,
       cultureProfile: /* 从 region 获取文化档案 */,
       regionName: region || 'universal',
       scriptContent: step1_script.content,
       duration: videoSpec.duration === 'short' ? '15秒以内' : '15-30秒',
       aspectRatio: videoSpec.aspectRatio === '16:9' ? '横屏 (16:9)' : '竖屏 (9:16)',
     };

     const options: ArtDirectorAgentOptions = {
       // 可以添加 customEditablePart 支持从 PromptStudio 获取自定义提示词
     };

     const parsed = await runArtDirectorAgent(context, options);
     ```
   - 保留为每个角色生成稳定 ID 的逻辑（如果 runArtDirectorAgent 内部已实现，可以移除重复代码）
   - 保留构建 StepOutput 和返回状态更新的逻辑
   - 保留错误处理逻辑

4. 保留 parseArtDirectorOutput 函数作为兼容层（或者如果 runArtDirectorAgent 内部已实现解析，可以移除）

5. 确保所有类型导入正确，没有类型错误
  </action>
  <verify>
    <automated>grep -n "from '../../agents/art-director'" src/main/ai/workflows/nodes/art-director.ts && grep -n "runArtDirectorAgent" src/main/ai/workflows/nodes/art-director.ts</automated>
  </verify>
  <acceptance_criteria>
    - src/main/ai/workflows/nodes/art-director.ts 包含 import { runArtDirectorAgent } from '../../agents/art-director'
    - artDirectorNode 函数内部调用 runArtDirectorAgent
    - 构建 ArtDirectorContext 对象传递给 runArtDirectorAgent，包含 project, creativeDirection, persona, cultureProfile, regionName, scriptContent, duration, aspectRatio
    - 不再直接调用 ArtDirectorAgentPrompts.buildSystemPrompt 和 buildUserPrompt（除非保留兼容层）
    - 保留原有的状态更新逻辑（返回 step2_characters, currentStep 等）
    - 保留原有的错误处理逻辑
  </acceptance_criteria>
  <done>LangGraph Node 已适配新的 Agent 函数，工作流可以正常调用艺术总监 Agent</done>
</task>

</tasks>

<verification>
整体验证检查清单：

1. 文件结构验证：
   - src/shared/constants/artDirectorTemplates.ts 存在且导出所有必需常量
   - src/main/ai/agents/art-director/index.ts 存在且导出所有必需类型和函数

2. BUILTIN_PROMPT_TEMPLATES 验证：
   - 数组中包含 agentId 为 'art-director-agent' 的元数据对象
   - 该对象包含正确的 agentName, agentDescription, editablePart, lockedPart, userPromptTemplate

3. LangGraph Node 验证：
   - src/main/ai/workflows/nodes/art-director.ts 导入并调用 runArtDirectorAgent
   - Node 函数正确构建 ArtDirectorContext 并传递

4. 三层架构验证：
   - EDITABLE 层包含 Agent 人设、创作方法论（剧本提炼、角色创作、场景创作、视觉风格、地区适配）
   - LOCKED 层包含 JSON 输出格式定义、字段约束、自检清单
   - DYNAMIC 层包含所有必需的变量占位符

5. 类型安全验证：
   - ArtDirectorResult 接口与 JSON 输出格式一致
   - ArtDirectorContext 接口包含所有必需的上下文字段
   - ArtDirectorAgentOptions 接口包含 modelId, customEditablePart 等选项
</verification>

<success_criteria>
- artDirectorTemplates.ts 文件创建，包含 EDITABLE、LOCKED、DYNAMIC 三层提示词和元数据对象
- art-director/ Agent 目录创建，包含完整的类型定义、提示词构建、输出解析和 runArtDirectorAgent 主函数
- BUILTIN_PROMPT_TEMPLATES 数组已注册艺术总监 Agent，PromptStudio 可以正确展示
- LangGraph Node 已重构，内部调用新的 runArtDirectorAgent 函数，工作流正常运行
- 所有代码使用中文注释，遵循项目代码风格规范
- 输出 JSON 结构保持向后兼容，scene_breakdowns 字段正确生成
</success_criteria>

<output>
After completion, create `.planning/phases/01-agent/01-01-SUMMARY.md`
</output>
