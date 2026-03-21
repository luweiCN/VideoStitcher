/**
 * 编剧生成 Agent
 *
 * 职责：根据游戏项目信息，生成一个专属的编剧人设
 * 编剧人设决定了剧本的语言风格和叙事方式
 *
 * 设计说明：
 * - 这是一个「单次调用型 Agent」，不需要 LangGraph StateGraph
 * - 支持两种模式：通用生成 + 按名称生成
 * - 提示词分两层：EDITABLE（游戏行业专家可在 PromptStudio 调整）+ LOCKED（JSON 格式，代码依赖）
 * - 历史编剧用于去重和参考，与创意方向相同的动态长度控制策略
 */

import type { Project } from '@shared/types/aside';
import {
  WRITER_GENERATOR_AGENT_EDITABLE_PART,
  WRITER_GENERATOR_AGENT_LOCKED_PART,
  WRITER_GENERATOR_AGENT_USER_PROMPT_TEMPLATE_GENERATE,
  WRITER_GENERATOR_AGENT_USER_PROMPT_TEMPLATE_BY_NAME,
} from './prompts';
import { getGlobalProvider } from '../../provider-manager';

// ─── 类型定义 ─────────────────────────────────────────────

/**
 * 生成结果：单个编剧人设
 */
export interface WriterGeneratorResult {
  name: string;
  prompt: string;
  characteristics: string[];
}

/**
 * Agent 调用选项
 */
export interface WriterGeneratorAgentOptions {
  /** 已有的编剧列表（让 AI 避免生成雷同编剧） */
  existingWriters?: Array<{ name: string; prompt: string }>;
  /** 指定模型 ID（默认使用系统全局配置的模型） */
  modelId?: string;
  /** 自定义系统提示词可编辑部分（来自 PromptStudio，覆盖内置默认值） */
  customEditablePart?: string;
  /** 用户指定的编剧名称（为空则通用生成，有值则按名称生成） */
  userWriterName?: string;
}

/**
 * 编剧生成上下文（用于提示词动态长度控制）
 */
export interface WriterGeneratorContext {
  /** 最近20个编剧的名称列表（固定传入，用于去重） */
  recentNames: string[];
  /** 完整编剧列表（按时间倒序，动态截取） */
  fullWriters: Array<{ name: string; prompt: string }>;
}

// ─── 提示词构建 ────────────────────────────────────────────

/**
 * 构建完整系统提示词
 */
function buildSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? WRITER_GENERATOR_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${WRITER_GENERATOR_AGENT_LOCKED_PART}`;
}

/**
 * 构建用户提示词（支持动态长度控制）
 *
 * 策略：
 * 1. 始终传入最近 20 个编剧的名称列表（用于去重，固定长度）
 * 2. 动态截取最近 N 个完整编剧（N 由剩余容量决定）
 * 3. 根据是否有 userWriterName 选择不同模板
 */
function buildUserPrompt(
  project: Project,
  context: WriterGeneratorContext,
  userWriterName?: string,
  logger?: { info: (msg: string, meta?: any) => void }
): string {
  const { recentNames, fullWriters } = context;

  const systemPrompt = buildSystemPrompt();
  const systemLength = systemPrompt.length;

  // 选择模板：按名称生成 vs 通用生成
  const baseTemplate = userWriterName?.trim()
    ? WRITER_GENERATOR_AGENT_USER_PROMPT_TEMPLATE_BY_NAME
        .replace(/\{\{userWriterName\}\}/g, userWriterName.trim())
    : WRITER_GENERATOR_AGENT_USER_PROMPT_TEMPLATE_GENERATE;

  // 填充项目信息
  const baseWithProject = baseTemplate
    .replace(/\{\{gameName\}\}/g, project.name)
    .replace(/\{\{gameType\}\}/g, project.gameType)
    .replace(/\{\{sellingPoint\}\}/g, project.sellingPoint || '暂无');

  // 计算不含已有编剧的基础长度
  const baseLength = baseWithProject.replace(/\{\{existingWriters\}\}/g, '').length;

  // 20 个标题列表（固定传入）
  const titlesSection = recentNames.length === 0
    ? '（暂无）'
    : recentNames.slice(0, 20).map((name, i) => `${i + 1}. ${name}`).join('\n');
  const titlesLength = titlesSection.length;

  // 安全上限：8000 字符
  const SAFE_LIMIT = 8000;

  // 计算剩余容量
  const usedLength = systemLength + baseLength + titlesLength;
  const remainingCapacity = SAFE_LIMIT - usedLength;

  // 每个完整编剧平均约 400 字符
  const AVG_WRITER_LENGTH = 400;
  const maxFullWriters = Math.max(0, Math.floor(remainingCapacity / AVG_WRITER_LENGTH));

  // 最多取 5 个完整编剧（上限）
  const fullWritersCount = Math.min(5, maxFullWriters, fullWriters.length);

  // 构建完整编剧部分（最近 N 个）
  const selectedFullWriters = fullWriters.slice(0, fullWritersCount);
  const fullWritersText = selectedFullWriters.length === 0
    ? '（暂无完整参考）'
    : selectedFullWriters
        .map((w, i) => `${i + 1}. 【${w.name}】${w.prompt}`)
        .join('\n\n');

  const existingWritersText = `【最近 ${recentNames.length} 个编剧名称】（避免重复）：
${titlesSection}

【最近 ${selectedFullWriters.length} 个编剧详情】（参考风格）：
${fullWritersText}`;

  const finalPrompt = baseWithProject.replace(/\{\{existingWriters\}\}/g, existingWritersText);

  if (logger) {
    logger.info('[编剧生成提示词长度统计]', {
      systemPromptLength: systemLength,
      userBaseLength: baseLength,
      titlesSectionLength: titlesLength,
      fullWritersLength: fullWritersText.length,
      usedLength,
      finalTotalLength: systemLength + finalPrompt.length,
      remainingCapacity,
      maxFullWriters,
      selectedFullWriters: fullWritersCount,
      totalExisting: fullWriters.length,
      titlesCount: Math.min(recentNames.length, 20),
      userWriterName: userWriterName || null,
    });
  }

  return finalPrompt;
}

// ─── 输出解析 ──────────────────────────────────────────────

/**
 * 解析 LLM 输出，提取编剧人设
 *
 * 处理两种情况：
 * 1. 纯 JSON（理想情况，提示词要求直接输出 JSON）
 * 2. Markdown 代码块包裹的 JSON（部分模型会忽略格式要求）
 */
function parseOutput(llmOutput: string): WriterGeneratorResult {
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  const parsed = JSON.parse(jsonStr);

  if (!parsed.name || !parsed.prompt) {
    throw new Error('AI 输出缺少必要字段（name 或 prompt）');
  }

  return {
    name: String(parsed.name).trim(),
    prompt: String(parsed.prompt).trim(),
    characteristics: Array.isArray(parsed.characteristics)
      ? parsed.characteristics.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [],
  };
}

// ─── Agent 主函数 ──────────────────────────────────────────

/**
 * 运行编剧生成 Agent
 *
 * @param project - 游戏项目信息（name、gameType、sellingPoint）
 * @param context - 编剧上下文（包含完整列表和名称列表）
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的编剧人设（name、prompt、characteristics）
 */
export async function runWriterGeneratorAgent(
  project: Project,
  context: WriterGeneratorContext,
  options: WriterGeneratorAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<WriterGeneratorResult> {
  const { customEditablePart, userWriterName } = options;

  // 步骤 1：获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 步骤 2：构建提示词
  const systemPrompt = buildSystemPrompt(customEditablePart);
  const userPrompt = buildUserPrompt(project, context, userWriterName, logger);

  // 步骤 3：调用 LLM
  const result = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.8,
    maxTokens: 1024,
  });

  // 步骤 4：解析并返回结果
  const parsed = parseOutput(result.content);

  // 如果用户提供了名称，沿用用户输入的名称
  if (userWriterName?.trim()) {
    parsed.name = userWriterName.trim();
  }

  return parsed;
}
