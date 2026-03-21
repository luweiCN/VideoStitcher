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
 * 构建用户提示词
 *
 * 将游戏信息和已有方向注入模板占位符。
 * 已有方向格式化为简洁的列表，让 AI 能快速理解现有风格覆盖范围。
 */
function buildUserPrompt(
  project: Project,
  existingDirections: Array<{ name: string; description: string }>
): string {
  // 将已有方向格式化为简洁的文本列表
  const existingDirectionsText =
    existingDirections.length === 0
      ? '（暂无，这是第一个创意方向）'
      : existingDirections
          .map((d, i) => `${i + 1}. 【${d.name}】${d.description.slice(0, 40)}...`)
          .join('\n');

  return CREATIVE_DIRECTION_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{gameName\}\}/g, project.name)
    .replace(/\{\{gameType\}\}/g, project.gameType)
    .replace(/\{\{sellingPoint\}\}/g, project.sellingPoint || '暂无')
    .replace(/\{\{existingDirections\}\}/g, existingDirectionsText);
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
 * 2. 构建用户提示词（注入游戏信息 + 已有方向）
 * 3. 调用 LLM（通过全局 provider，支持未来多模型切换）
 * 4. 解析输出，返回结构化的单个创意方向
 *
 * @param project - 游戏项目信息（name、gameType、sellingPoint）
 * @param options - Agent 调用选项
 * @returns 生成的创意方向（name、iconName、description）
 */
export async function runCreativeDirectionAgent(
  project: Project,
  options: CreativeDirectionAgentOptions = {}
): Promise<CreativeDirectionResult> {
  const { existingDirections = [], customEditablePart } = options;

  // 步骤 1：获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 步骤 2：构建提示词
  const systemPrompt = buildSystemPrompt(customEditablePart);
  const userPrompt = buildUserPrompt(project, existingDirections);

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
