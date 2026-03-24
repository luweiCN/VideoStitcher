/**
 * 艺术总监 Agent
 *
 * 职责：根据剧本提炼精华、创作角色和场景，为后续分镜设计提供视觉简报
 *
 * 设计说明：
 * - 这是一个「单次调用型 Agent」，不需要 LangGraph StateGraph
 * - 提示词分两层：EDITABLE（游戏行业专家可在 PromptStudio 调整）+ LOCKED（JSON 格式，代码依赖）
 * - 动态提示词包含：游戏信息、创意方向、编剧人设、文化档案、剧本内容、视频参数
 */

import type { Project, CreativeDirection, Persona } from '@shared/types/aside';
import {
  ART_DIRECTOR_AGENT_EDITABLE_PART,
  ART_DIRECTOR_AGENT_LOCKED_PART,
  ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/artDirectorTemplates';
import { getGlobalProvider } from '../../provider-manager';
import { createHash } from 'crypto';

// ─── 类型定义 ─────────────────────────────────────────────

/**
 * 剧本简报
 */
interface ScriptBrief {
  title: string;
  core_conflict: string;
  climax_point: string;
  visual_style_tags: string[];
  overall_tone: string;
}

/**
 * 角色设定
 */
interface CharacterProfile {
  id?: string;
  name: string;
  role_type: 'protagonist' | 'antagonist' | 'supporting';
  appearance: string;
  costume: string;
  personality_traits: string[];
  key_actions: string[];
  image_generation_prompt: string;
}

/**
 * 场景拆分
 */
interface SceneBreakdown {
  scene_number: number;
  scene_name: string;
  location_type: 'indoor' | 'outdoor';
  time_of_day: 'day' | 'night' | 'dusk' | 'dawn';
  environment: string;
  props: string[];
  atmosphere: string;
  key_visual_elements: string[];
}

/**
 * 参考图像
 */
interface ReferenceImage {
  scene_number: number;
  description: string;
  style_notes: string;
}

/**
 * 生成结果：艺术总监输出
 */
export interface ArtDirectorResult {
  script_brief: ScriptBrief;
  character_profiles: CharacterProfile[];
  scene_breakdowns: SceneBreakdown[];
  duration_seconds: number;
  aspect_ratio: string;
  reference_images: ReferenceImage[];
  video_generation_prompt: string;
  transition_note: string;
}

/**
 * 艺术总监上下文
 */
export interface ArtDirectorContext {
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
  /** 剧本内容 */
  scriptContent: string;
  /** 时长要求 */
  duration: string;
  /** 画幅比例 */
  aspectRatio: string;
}

/**
 * Agent 调用选项
 */
export interface ArtDirectorAgentOptions {
  /** 指定模型 ID（默认使用系统全局配置的模型） */
  modelId?: string;
  /** 自定义系统提示词可编辑部分（来自 PromptStudio，覆盖内置默认值） */
  customEditablePart?: string;
  /** 当前索引（用于批量生成时显示进度） */
  currentIndex?: number;
  /** 总数（用于批量生成时显示进度） */
  totalCount?: number;
}

// ─── 提示词构建 ────────────────────────────────────────────

/**
 * 构建完整系统提示词
 */
function buildSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? ART_DIRECTOR_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${ART_DIRECTOR_AGENT_LOCKED_PART}`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(
  context: ArtDirectorContext,
  currentIndex: number,
  totalCount: number,
  logger?: { info: (msg: string, meta?: any) => void }
): string {
  const { project, cultureProfile, regionName, scriptContent } = context;

  // 填充所有变量
  const userPrompt = ART_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{gameName\}\}/g, project.name)
    .replace(/\{\{gameType\}\}/g, project.gameType)
    .replace(/\{\{cultureProfile\}\}/g, cultureProfile)
    .replace(/\{\{scriptContent\}\}/g, scriptContent);

  // 添加生成进度信息
  const promptWithProgress = totalCount > 1
    ? `【生成进度】第 ${currentIndex}/${totalCount} 个\n\n${userPrompt}`
    : userPrompt;

  // 输出日志
  if (logger) {
    const systemPrompt = buildSystemPrompt();
    logger.info('[艺术总监提示词信息]', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: promptWithProgress.length,
      totalLength: systemPrompt.length + promptWithProgress.length,
      projectName: project.name,
      gameType: project.gameType,
      region: regionName || '通用',
      currentIndex,
      totalCount,
    });
    // 输出完整提示词便于调试
    logger.info('[艺术总监-系统提示词]', { content: systemPrompt });
    logger.info('[艺术总监-用户提示词]', { content: promptWithProgress });
  }

  return promptWithProgress;
}

// ─── 输出解析 ──────────────────────────────────────────────

/**
 * 解析 LLM 输出，提取艺术总监结果
 */
function parseOutput(llmOutput: string, scriptContent?: string): ArtDirectorResult {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  const parsed = JSON.parse(jsonStr);

  // 验证必要字段
  if (!parsed.script_brief || !parsed.character_profiles || !parsed.scene_breakdowns) {
    throw new Error('AI 输出缺少必要字段（script_brief、character_profiles、scene_breakdowns）');
  }

  // 为每个角色生成稳定 ID（如果 LLM 没有生成）
  const characterProfiles = parsed.character_profiles.map((profile: any, index: number) => {
    if (!profile.id && scriptContent) {
      // 使用剧本内容哈希 + 索引生成稳定 ID
      const stableId = `char-${createHash('md5')
        .update(scriptContent)
        .digest('hex')
        .substring(0, 8)}-${index}`;
      profile.id = stableId;
    }
    return profile;
  });

  return {
    script_brief: {
      title: String(parsed.script_brief.title || '').trim(),
      core_conflict: String(parsed.script_brief.core_conflict || '').trim(),
      climax_point: String(parsed.script_brief.climax_point || '').trim(),
      visual_style_tags: Array.isArray(parsed.script_brief.visual_style_tags)
        ? parsed.script_brief.visual_style_tags.map((t: unknown) => String(t).trim()).filter(Boolean)
        : [],
      overall_tone: String(parsed.script_brief.overall_tone || '').trim(),
    },
    character_profiles: characterProfiles.map((profile: any) => ({
      id: profile.id,
      name: String(profile.name || '').trim(),
      role_type: profile.role_type as 'protagonist' | 'antagonist' | 'supporting',
      appearance: String(profile.appearance || '').trim(),
      costume: String(profile.costume || '').trim(),
      personality_traits: Array.isArray(profile.personality_traits)
        ? profile.personality_traits.map((t: unknown) => String(t).trim()).filter(Boolean)
        : [],
      key_actions: Array.isArray(profile.key_actions)
        ? profile.key_actions.map((a: unknown) => String(a).trim()).filter(Boolean)
        : [],
      image_generation_prompt: String(profile.image_generation_prompt || '').trim(),
    })),
    scene_breakdowns: parsed.scene_breakdowns.map((scene: any) => ({
      scene_number: Number(scene.scene_number || 1),
      scene_name: String(scene.scene_name || '').trim(),
      location_type: scene.location_type as 'indoor' | 'outdoor',
      time_of_day: scene.time_of_day as 'day' | 'night' | 'dusk' | 'dawn',
      environment: String(scene.environment || '').trim(),
      props: Array.isArray(scene.props)
        ? scene.props.map((p: unknown) => String(p).trim()).filter(Boolean)
        : [],
      atmosphere: String(scene.atmosphere || '').trim(),
      key_visual_elements: Array.isArray(scene.key_visual_elements)
        ? scene.key_visual_elements.map((e: unknown) => String(e).trim()).filter(Boolean)
        : [],
    })),
    duration_seconds: Number(parsed.duration_seconds || 15),
    aspect_ratio: String(parsed.aspect_ratio || '9:16').trim(),
    reference_images: Array.isArray(parsed.reference_images)
      ? parsed.reference_images.map((img: any) => ({
          scene_number: Number(img.scene_number || 1),
          description: String(img.description || '').trim(),
          style_notes: String(img.style_notes || '').trim(),
        }))
      : [],
    video_generation_prompt: String(parsed.video_generation_prompt || '').trim(),
    transition_note: String(parsed.transition_note || '').trim(),
  };
}

// ─── Agent 主函数 ──────────────────────────────────────────

/**
 * 运行艺术总监 Agent
 *
 * 调用流程：
 * 1. 构建系统提示词（EDITABLE + LOCKED 合并）
 * 2. 构建用户提示词（注入游戏信息、创意方向、编剧人设、文化档案、剧本内容、视频参数）
 * 3. 调用 LLM
 * 4. 解析输出，返回结构化的角色、场景和剧本简报
 *
 * @param context - 艺术总监上下文
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的角色、场景和剧本简报
 */
export async function runArtDirectorAgent(
  context: ArtDirectorContext,
  options: ArtDirectorAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<ArtDirectorResult> {
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
    temperature: 0.7,
    maxTokens: 4096,
  });

  // 步骤 4：解析并返回结果
  return parseOutput(result.content, context.scriptContent);
}

// 默认导出
export default runArtDirectorAgent;
