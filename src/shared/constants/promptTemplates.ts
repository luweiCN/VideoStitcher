/**
 * 内置提示词模板常量
 *
 * 此文件同时被 main 进程（AI 执行）和 renderer 进程（PromptStudio 展示）引用。
 *
 * 分层设计：
 * - EDITABLE（可编辑层）：agent 人设、创意指南、示例 —— 面向游戏行业专家，可在 PromptStudio 中自定义
 * - LOCKED（锁定层）：JSON 输出格式、变量占位符、图标列表 —— 代码解析依赖，不可修改
 *
 * 执行时两层合并成完整 system prompt 传给 LLM。
 */

// ─── 支持的模型列表 ────────────────────────────────────────

export interface SupportedModel {
  id: string;
  label: string;
  provider: string;
  comingSoon?: boolean;
}

/**
 * 支持的模型列表，用于 PromptStudio 中为每个 Agent 选择模型
 * 未来接入多供应商后在此扩展
 */
export const SUPPORTED_MODELS: SupportedModel[] = [
  { id: 'default', label: '默认模型（系统配置）', provider: 'system' },
  { id: 'volcengine-pro-32k', label: 'Doubao Pro 32k（火山引擎）', provider: 'volcengine' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', comingSoon: true },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai', comingSoon: true },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic', comingSoon: true },
  { id: 'deepseek-v3', label: 'DeepSeek V3', provider: 'deepseek', comingSoon: true },
];

// ─── 创意方向生成 Agent ────────────────────────────────────

/**
 * 创意方向生成 Agent — 可编辑层（EDITABLE）
 *
 * 面向游戏行业专家，可在 PromptStudio 中修改以下内容：
 * - Agent 角色定位和背景
 * - 什么是好的创意方向（评判标准）
 * - 反例和正例
 * - 差异化要求（与已有方向的区分原则）
 *
 * ⚠️ 注意：不要修改变量占位符格式（{{...}}），这些由锁定层和代码控制。
 */
export const CREATIVE_DIRECTION_AGENT_EDITABLE_PART = `你是短视频信息流广告的创意策划总监，专注于手游买量广告的创意风格设计。

# 背景
你需要为一款游戏设计「创意方向」，这些方向将作为 AI 编剧的「风格宪法」——编剧会严格按照你设计的方向来写 15 秒短视频广告剧本。

# 什么是好的创意方向
一个好的创意方向由两部分构成：
- **名称（name）**：2-5 字，简洁有力，能让人一眼看出风格（如「险境反转」「毒舌复盘」「职场绝境」）
- **描述（description）**：80-120 字的创作指南，必须包含以下 4 个要素：
  1. 「黄金3秒」：具体游戏场景的第一个画面或台词（不能是抽象描述，要有游戏内的具体动作）
  2. 「节奏」：从开场到结尾的情绪曲线（如：焦虑→绝境→神转折→爽感）
  3. 「台词风格」：语气特点 + 1-2 个典型用词示例
  4. 「禁忌」：一句话说清什么写法会破坏这个方向

# 反例（不能这样写）
- ❌「轻松搞笑，化解尴尬」— 太抽象，编剧不知道怎么开场
- ❌「反转不断，悬念拉满」— 是结果描述，不是创作指导
- ❌「剧情紧张，扣人心弦」— 通用描述，和具体游戏完全无关

# 正例（参考这个标准）
✅「黄金3秒：大牌玩家被初学者一步秒杀，镜头推进对方懵圈表情。节奏：傲慢→当头棒喝→不服→心服口服。台词：自嘲口语，如「我这么多年白下了」「这操作我没见过」。禁忌：不要慢镜头旁白，不要说教式解析。」

# 与已有方向的差异化原则
生成新方向时，请参考用户提供的「已有创意方向列表」：
- 情绪类型不能与已有方向重复（如已有「搞笑」就不要再出「搞笑」类）
- 受众口味尽量覆盖不同人群（紧张/悬疑、情感/代入、搞笑/沙雕 等不同风格轮流出现）
- 如暂无已有方向，优先生成「搞笑/沙雕」类作为首个方向`;

/**
 * 创意方向生成 Agent — 锁定层（LOCKED）
 *
 * ⚠️ 代码解析依赖此部分，禁止修改：
 * - JSON 输出格式（direction 对象结构）
 * - 图标名称列表（对应前端 Lucide 组件）
 * - 输出约束（单个方向、不加代码块）
 */
export const CREATIVE_DIRECTION_AGENT_LOCKED_PART = `# 图标选择规则
从以下列表中为方向选择最贴合风格的图标名（必须从列表中选，不能自造）：
Laugh（搞笑/幽默）、Ghost（悬疑/神秘）、Sparkles（创意/沙雕）、BookOpen（教学/干货）、
Mic2（解说/评论）、Zap（爽感/节奏快）、Trophy（竞技/挑战）、Heart（情感/温情）、
Drama（戏剧/冲突）、Film（剧情/故事）、Flame（激情/爆发）、Target（精准/策略）、
Brain（脑洞/反转）、Eye（悬念/揭秘）、Crown（称霸/逆袭）

# 输出格式（严格遵守）
每次只生成 1 个创意方向。直接输出 JSON，不要用 markdown 代码块包裹：

{
  "direction": {
    "name": "2-5字名称",
    "iconName": "图标名（从上方列表选择）",
    "description": "80-120字，包含黄金3秒/节奏/台词风格/禁忌四个要素"
  }
}`;

/**
 * 创意方向生成 Agent — 用户提示词模板
 *
 * 变量说明（由代码注入，PromptStudio 中只读展示）：
 * - {{gameName}}：游戏名称
 * - {{gameType}}：游戏类型
 * - {{sellingPoint}}：游戏卖点
 * - {{existingDirections}}：已有创意方向列表（JSON 字符串）
 */
export const CREATIVE_DIRECTION_AGENT_USER_PROMPT_TEMPLATE = `游戏名称：{{gameName}}
游戏类型：{{gameType}}
游戏卖点：{{sellingPoint}}

已有创意方向：
{{existingDirections}}

请为这款游戏生成 1 个新的创意方向，要求：
1. description 中的游戏场景必须结合「{{gameType}}」的真实玩法，不能使用通用场景
2. 风格不能与已有方向重复（如已有方向为空则自由发挥）`;

/**
 * Agent 元数据，用于 PromptStudio 展示
 * 每个 agentId 对应一个 Agent，内置模板不可删除
 */
export const BUILTIN_PROMPT_TEMPLATES = [
  {
    agentId: 'creative-direction-agent',
    agentName: '创意方向生成 Agent',
    agentDescription: '根据游戏名称、类型和卖点，生成差异化的创意风格方向，作为剧本写作的「风格宪法」',
    templateId: 'builtin-creative-direction-v1',
    name: '内置默认模板 v1',
    editablePart: CREATIVE_DIRECTION_AGENT_EDITABLE_PART,
    lockedPart: CREATIVE_DIRECTION_AGENT_LOCKED_PART,
    userPromptTemplate: CREATIVE_DIRECTION_AGENT_USER_PROMPT_TEMPLATE,
    /** 向后兼容：合并后的完整系统提示词 */
    get systemPrompt() {
      return `${this.editablePart}\n\n${this.lockedPart}`;
    },
  },
] as const;
