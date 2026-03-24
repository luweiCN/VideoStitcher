/**
 * 剧本写作 Agent
 *
 * 职责：根据游戏信息、创意方向、编剧人设和文化档案，生成 15 秒短视频广告剧本
 *
 * 设计说明：
 * - 这是一个「单次调用型 Agent」，不需要 LangGraph StateGraph
 * - 提示词分两层：EDITABLE（游戏行业专家可在 PromptStudio 调整）+ LOCKED（JSON 格式，代码依赖）
 * - 动态提示词包含：游戏信息、创意方向、编剧人设、文化档案
 */

import type { Project, CreativeDirection, Persona } from '@shared/types/aside';
import {
  SCREENPLAY_AGENT_EDITABLE_PART,
  SCREENPLAY_AGENT_LOCKED_PART,
  SCREENPLAY_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/screenplayAgentTemplates';
import { getGlobalProvider } from '../../provider-manager';

// ─── 类型定义 ─────────────────────────────────────────────

/**
 * 生成结果：单个剧本
 */
export interface ScreenplayResult {
  script_title: string;
  creative_direction_alignment: string;
  persona_alignment: string;
  region_style: string;
  hook_3s: {
    visual: string;
    dialogue: string;
  };
  absurd_twist: {
    visual: string;
    dialogue: string;
  };
  bside_transition: {
    visual: string;
    dialogue: string;
  };
  full_script_for_art_director: string;
  regional_elements: string[];
  total_duration_estimate: string;
  word_count: string;
}

/**
 * Agent 调用选项
 */
export interface ScreenplayAgentOptions {
  /** 指定模型 ID（默认使用系统全局配置的模型） */
  modelId?: string;
  /** 自定义系统提示词可编辑部分（来自 PromptStudio，覆盖内置默认值） */
  customEditablePart?: string;
  /** 当前索引（用于批量生成时显示进度） */
  currentIndex?: number;
  /** 总数（用于批量生成时显示进度） */
  totalCount?: number;
}

/**
 * 剧本写作上下文
 */
export interface ScreenplayContext {
  /** 游戏项目信息 */
  project: Project;
  /** 创意方向 */
  creativeDirection: CreativeDirection;
  /** 编剧人设 */
  persona: Persona;
  /** 地区文化档案 */
  cultureProfile: string;
  /** 地区名称 */
  regionName?: string;
}

// ─── 提示词构建 ────────────────────────────────────────────

/**
 * 构建完整系统提示词
 */
function buildSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? SCREENPLAY_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${SCREENPLAY_AGENT_LOCKED_PART}`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(
  context: ScreenplayContext,
  currentIndex: number,
  totalCount: number,
  logger?: { info: (msg: string, meta?: any) => void }
): string {
  const { project, creativeDirection, persona, cultureProfile, regionName } = context;

  // 填充所有变量
  const userPrompt = SCREENPLAY_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{gameName\}\}/g, project.name)
    .replace(/\{\{gameType\}\}/g, project.gameType)
    .replace(/\{\{sellingPoint\}\}/g, project.sellingPoint || '玩法丰富，乐趣无穷')
    .replace(/\{\{creativeDirectionName\}\}/g, creativeDirection.name)
    .replace(/\{\{creativeDirectionDescription\}\}/g, creativeDirection.description || '无特定要求，自由发挥')
    .replace(/\{\{personaName\}\}/g, persona.name)
    .replace(/\{\{personaPrompt\}\}/g, persona.prompt)
    .replace(/\{\{cultureProfile\}\}/g, cultureProfile);

  // 添加生成进度信息
  const promptWithProgress = totalCount > 1
    ? `【生成进度】第 ${currentIndex}/${totalCount} 个剧本\n\n${userPrompt}`
    : userPrompt;

  // 输出日志
  if (logger) {
    const systemPrompt = buildSystemPrompt();
    logger.info('[剧本写作提示词信息]', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: promptWithProgress.length,
      totalLength: systemPrompt.length + promptWithProgress.length,
      projectName: project.name,
      gameType: project.gameType,
      creativeDirection: creativeDirection.name,
      persona: persona.name,
      region: regionName || '通用',
      currentIndex,
      totalCount,
    });
    // 输出完整提示词便于调试
    logger.info('[剧本写作-系统提示词]', { content: systemPrompt });
    logger.info('[剧本写作-用户提示词]', { content: promptWithProgress });
  }

  return promptWithProgress;
}

// ─── 输出解析 ──────────────────────────────────────────────

/**
 * 解析 LLM 输出，提取剧本
 */
function parseOutput(llmOutput: string): ScreenplayResult {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  const parsed = JSON.parse(jsonStr);

  // 验证必要字段
  if (!parsed.script_title || !parsed.hook_3s || !parsed.absurd_twist) {
    throw new Error('AI 输出缺少必要字段（script_title、hook_3s、absurd_twist）');
  }

  return {
    script_title: String(parsed.script_title).trim(),
    creative_direction_alignment: String(parsed.creative_direction_alignment || '').trim(),
    persona_alignment: String(parsed.persona_alignment || '').trim(),
    region_style: String(parsed.region_style || '').trim(),
    hook_3s: {
      visual: String(parsed.hook_3s.visual || '').trim(),
      dialogue: String(parsed.hook_3s.dialogue || '').trim(),
    },
    absurd_twist: {
      visual: String(parsed.absurd_twist.visual || '').trim(),
      dialogue: String(parsed.absurd_twist.dialogue || '').trim(),
    },
    bside_transition: {
      visual: String(parsed.bside_transition?.visual || '').trim(),
      dialogue: String(parsed.bside_transition?.dialogue || '').trim(),
    },
    full_script_for_art_director: String(parsed.full_script_for_art_director || '').trim(),
    regional_elements: Array.isArray(parsed.regional_elements)
      ? parsed.regional_elements.map((e: unknown) => String(e).trim()).filter(Boolean)
      : [],
    total_duration_estimate: String(parsed.total_duration_estimate || '').trim(),
    word_count: String(parsed.word_count || '').trim(),
  };
}

// ─── Agent 主函数 ──────────────────────────────────────────

/**
 * 运行剧本写作 Agent
 *
 * 调用流程：
 * 1. 构建系统提示词（EDITABLE + LOCKED 合并）
 * 2. 构建用户提示词（注入游戏信息、创意方向、编剧人设、文化档案）
 * 3. 调用 LLM
 * 4. 解析输出，返回结构化的剧本
 *
 * @param context - 剧本写作上下文
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的剧本
 */
export async function runScreenplayAgent(
  context: ScreenplayContext,
  options: ScreenplayAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<ScreenplayResult> {
  const { customEditablePart, currentIndex = 1, totalCount = 1 } = options;

  // 步骤 1：获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 步骤 2：构建提示词
  const systemPrompt = buildSystemPrompt(customEditablePart);
  const userPrompt = buildUserPrompt(context, currentIndex, totalCount, logger);

  // 步骤 3：调用 LLM
  const result = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.8,
    maxTokens: 2048,
  });

  // 步骤 4：解析并返回结果
  return parseOutput(result.content);
}

// 默认导出
export default runScreenplayAgent;
