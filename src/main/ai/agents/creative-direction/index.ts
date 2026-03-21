/**
 * 创意方向生成 Agent
 *
 * 职责：根据游戏项目信息，生成一个专属的「创意方向」
 * 创意方向是 15 秒短视频广告剧本的「风格宪法」，规定了剧本的开场方式、节奏情绪、台词风格和禁忌。
 *
 * 设计说明（可作为学习示例）：
 * - 这是一个「单次调用型 Agent」，不需要 LangGraph StateGraph
 * - 只做一件事：接收项目信息 → 构建提示词 → 调用 LLM → 解析输出 → 返回结构化结果
 * - 与 workflows/ 目录下的多步骤 LangGraph 流程不同，这里没有循环、没有状态机
 * - 提示词分两层：EDITABLE（游戏行业专家可在 PromptStudio 调整）+ LOCKED（JSON 格式/图标列表，代码依赖）
 */

import type { Project } from '@shared/types/aside';
import {
  CREATIVE_DIRECTION_AGENT_EDITABLE_PART,
  CREATIVE_DIRECTION_AGENT_LOCKED_PART,
  CREATIVE_DIRECTION_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/promptTemplates';
import { getGlobalProvider } from '../../provider-manager';

// ─── 类型定义 ─────────────────────────────────────────────

/**
 * 生成结果：单个创意方向
 */
export interface CreativeDirectionResult {
  name: string;
  iconName: string;
  description: string;
}

/**
 * Agent 调用选项
 */
export interface CreativeDirectionAgentOptions {
  /** 已有的创意方向列表（让 AI 避免生成雷同方向） */
  existingDirections?: Array<{ name: string; description: string }>;
  /** 指定模型 ID（默认使用系统全局配置的模型） */
  modelId?: string;
  /** 自定义系统提示词可编辑部分（来自 PromptStudio，覆盖内置默认值） */
  customEditablePart?: string;
}

/**
 * 创意方向上下文（用于提示词动态长度控制）
 */
export interface CreativeDirectionContext {
  /** 最近20个方向的名称列表（固定传入，用于去重） */
  recentNames: string[];
  /** 完整方向列表（按时间倒序，动态截取） */
  fullDirections: Array<{ name: string; description: string }>;
}

// ─── 提示词构建 ────────────────────────────────────────────

/**
 * 构建完整系统提示词
 *
 * 将 EDITABLE 层（可能已被用户自定义）和 LOCKED 层（代码固定）合并。
 * EDITABLE 在前，LOCKED 在后 —— 让模型先理解创意标准，再看输出格式约束。
 */
function buildSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? CREATIVE_DIRECTION_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${CREATIVE_DIRECTION_AGENT_LOCKED_PART}`;
}

/**
 * 构建用户提示词（支持动态长度控制）
 *
 * 策略：
 * 1. 始终传入最近 20 个方向的名称列表（用于去重，固定长度）
 * 2. 动态截取最近 N 个完整方向（N 由剩余容量决定）
 * 3. 在日志中输出详细的长度信息用于调试
 *
 * @param project - 游戏项目信息
 * @param context - 创意方向上下文（包含完整列表和名称列表）
 * @param logger - 可选的日志输出函数
 * @returns 构建好的用户提示词
 */
function buildUserPrompt(
  project: Project,
  context: CreativeDirectionContext,
  logger?: { info: (msg: string, meta?: any) => void }
): string {
  const { recentNames, fullDirections } = context;

  // 1. 计算各部分长度（精确字符数）
  const systemPrompt = buildSystemPrompt();
  const systemLength = systemPrompt.length;

  // 基础模板长度（不包含已有方向部分）
  const baseTemplate = CREATIVE_DIRECTION_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{gameName\}\}/g, project.name)
    .replace(/\{\{gameType\}\}/g, project.gameType)
    .replace(/\{\{sellingPoint\}\}/g, project.sellingPoint || '暂无');
  const baseLength = baseTemplate.replace(/\{\{existingDirections\}\}/g, '').length;

  // 20 个标题列表的长度（固定传入）
  const titlesSection = recentNames.length === 0
    ? '（暂无）'
    : recentNames.slice(0, 20).map((name, i) => `${i + 1}. ${name}`).join('\n');
  const titlesLength = titlesSection.length;

  // 安全上限：8000 字符（给输出留余量）
  const SAFE_LIMIT = 8000;

  // 2. 计算剩余可用容量
  const usedLength = systemLength + baseLength + titlesLength;
  const remainingCapacity = SAFE_LIMIT - usedLength;

  // 每个完整方向平均约 250 字符（名称 20 + 描述 200 + 格式 30）
  const AVG_DIRECTION_LENGTH = 250;
  const maxFullDirections = Math.max(0, Math.floor(remainingCapacity / AVG_DIRECTION_LENGTH));

  // 最多取 5 个完整方向（上限），但至少要有空间放一个
  const fullDirectionsCount = Math.min(5, maxFullDirections, fullDirections.length);

  // 3. 构建完整方向部分（最近 N 个）
  const selectedFullDirections = fullDirections.slice(0, fullDirectionsCount);
  const fullDirectionsText = selectedFullDirections.length === 0
    ? '（暂无完整参考）'
    : selectedFullDirections
        .map((d, i) => `${i + 1}. 【${d.name}】${d.description}`)
        .join('\n\n');

  // 4. 组装最终提示词
  const existingDirectionsText = `【最近 ${recentNames.length} 个创意方向名称】（避免重复）：
${titlesSection}

【最近 ${selectedFullDirections.length} 个创意方向详情】（参考风格）：
${fullDirectionsText}`;

  const finalPrompt = baseTemplate
    .replace(/\{\{existingDirections\}\}/g, existingDirectionsText);

  // 5. 输出日志
  if (logger) {
    logger.info('[创意方向提示词长度统计]', {
      systemPromptLength: systemLength,
      userBaseLength: baseLength,
      titlesSectionLength: titlesLength,
      fullDirectionsLength: fullDirectionsText.length,
      usedLength,
      finalTotalLength: systemLength + finalPrompt.length,
      remainingCapacity,
      maxFullDirections,
      selectedFullDirections: fullDirectionsCount,
      totalExisting: fullDirections.length,
      titlesCount: Math.min(recentNames.length, 20),
    });
  }

  return finalPrompt;
}

// ─── 输出解析 ──────────────────────────────────────────────

/**
 * 解析 LLM 输出，提取单个创意方向
 *
 * 处理两种情况：
 * 1. 纯 JSON（理想情况，提示词要求直接输出 JSON）
 * 2. Markdown 代码块包裹的 JSON（部分模型会忽略格式要求）
 */
function parseOutput(llmOutput: string): CreativeDirectionResult {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  const parsed = JSON.parse(jsonStr);

  // 兼容两种格式：{ direction: {...} } 或直接 {...}
  const raw = parsed.direction ?? parsed;

  if (!raw.name || !raw.description) {
    throw new Error('AI 输出缺少必要字段（name 或 description）');
  }

  return {
    name: String(raw.name).trim(),
    iconName: String(raw.iconName || 'Sparkles').trim(),
    description: String(raw.description).trim(),
  };
}

// ─── Agent 主函数 ──────────────────────────────────────────

/**
 * 运行创意方向生成 Agent
 *
 * 调用流程：
 * 1. 构建系统提示词（EDITABLE + LOCKED 合并）
 * 2. 构建用户提示词（注入游戏信息 + 已有方向，动态长度控制）
 * 3. 调用 LLM（通过全局 provider，支持未来多模型切换）
 * 4. 解析输出，返回结构化的单个创意方向
 *
 * @param project - 游戏项目信息（name、gameType、sellingPoint）
 * @param context - 创意方向上下文（包含完整列表和名称列表）
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的创意方向（name、iconName、description）
 */
export async function runCreativeDirectionAgent(
  project: Project,
  context: CreativeDirectionContext,
  options: CreativeDirectionAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CreativeDirectionResult> {
  const { customEditablePart } = options;

  // 步骤 1：获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 步骤 2：构建提示词（支持动态长度控制）
  const systemPrompt = buildSystemPrompt(customEditablePart);
  const userPrompt = buildUserPrompt(project, context, logger);

  // 步骤 3：调用 LLM
  // temperature 略高（0.85）以增加创意多样性，maxTokens 控制输出长度
  const result = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.85,
    maxTokens: 512,
  });

  // 步骤 4：解析并返回结果
  return parseOutput(result.content);
}
