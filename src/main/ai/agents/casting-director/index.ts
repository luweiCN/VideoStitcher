/**
 * 选角导演 Agent
 *
 * 职责：根据艺术总监的角色设定，生成一张包含所有角色的角色参考图（Character Reference Sheet）提示词
 *
 * 设计说明：
 * - 支持两种模式：单阶段（向后兼容）和多阶段（Planner + Visualizer）
 * - **单阶段模式**：直接生成图像提示词并生成图像
 * - **多阶段模式**：Planner 生成视觉规格 JSON → Visualizer 生成图像
 * - 提示词分两层：EDITABLE（游戏行业专家可在 PromptStudio 调整）+ LOCKED（JSON 格式，代码依赖）
 * - **单图原则**：无论有多少角色，只生成一张包含所有角色的角色参考图（Nx3 网格布局）
 */

import {
  CASTING_DIRECTOR_AGENT_EDITABLE_PART,
  CASTING_DIRECTOR_AGENT_LOCKED_PART,
  CASTING_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/castingDirectorTemplates';
import {
  CASTING_PLANNER_AGENT_EDITABLE_PART,
  CASTING_PLANNER_AGENT_LOCKED_PART,
  CASTING_PLANNER_AGENT_USER_PROMPT_TEMPLATE,
  CASTING_VISUALIZER_AGENT_EDITABLE_PART,
  CASTING_VISUALIZER_AGENT_LOCKED_PART,
  CASTING_VISUALIZER_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/castingDirectorMultiTemplates';
import { getGlobalProvider } from '../../provider-manager';

// ─── 类型定义 ─────────────────────────────────────────────

/**
 * 角色视角描述
 */
interface CharacterView {
  description: string;
  key_features: string[];
}

/**
 * 角色的三视图描述
 */
interface CharacterViews {
  front_view: CharacterView;
  side_view: CharacterView;
  action_pose: CharacterView;
}

/**
 * 角色分解信息（用于详细说明每个角色在参考图中的位置和表现）
 */
interface CharacterBreakdown {
  character_id: string;
  character_name: string;
  role_type: 'protagonist' | 'antagonist' | 'supporting';
  row_position: number;
  views: CharacterViews;
  reference_notes: string;
}

/**
 * 图像生成提示词（单图）
 */
interface ImagePrompt {
  full_prompt: string;
  negative_prompt: string;
}

/**
 * 风格指南
 */
interface StyleGuide {
  art_style: string;
  lighting_style: string;
  quality_tags: string[];
  color_tone: string;
  style_consistency_tags: string[];
}

/**
 * 角色参考图（单图输出）
 */
interface CharacterReferenceSheet {
  total_characters: number;
  grid_layout: string;
  image_prompt: ImagePrompt;
  character_breakdown: CharacterBreakdown[];
  style_guide: StyleGuide;
}

/**
 * 生成结果：选角导演输出
 */
export interface CastingDirectorResult {
  /** 角色参考图（单图，包含生成的图片 URL） */
  character_reference_sheet: CharacterReferenceSheet & {
    /** 生成的角色参考图 URL */
    image_url: string;
    /** 图像生成元数据 */
    image_generation_metadata: {
      /** 图片尺寸 */
      size: string;
      /** 质量设置 */
      quality: string;
      /** 生成时间戳 */
      generationTime: number;
    };
  };
}

/**
 * 艺术总监输出的角色设定（输入）
 */
export interface CharacterProfile {
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
 * 艺术总监输出的场景描述（输入）
 */
export interface SceneBreakdown {
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
 * 艺术总监输出的剧本简报（输入）
 */
export interface ScriptBrief {
  title: string;
  core_conflict: string;
  climax_point: string;
  visual_style_tags: string[];
  overall_tone: string;
}

/**
 * 选角导演上下文
 */
export interface CastingDirectorContext {
  /** 角色设定数组 */
  characterProfiles: CharacterProfile[];
  /** 场景描述数组 */
  sceneBreakdowns: SceneBreakdown[];
  /** 剧本简报 */
  scriptBrief?: ScriptBrief;
  /** 视觉风格标签 */
  visualStyleTags?: string[];
  /** 整体基调 */
  overallTone?: string;
}

/**
 * Agent 调用选项
 */
export interface CastingDirectorAgentOptions {
  /** 指定模型 ID（默认使用系统全局配置的模型） */
  modelId?: string;
  /** 自定义系统提示词可编辑部分（来自 PromptStudio，覆盖内置默认值） */
  customEditablePart?: string;
  /** 当前索引（用于批量生成时显示进度） */
  currentIndex?: number;
  /** 总数（用于批量生成时显示进度） */
  totalCount?: number;
  /** 是否使用多阶段模式（Planner + Visualizer），默认 false 保持向后兼容 */
  useMultiStage?: boolean;
  /** Planner 阶段选项（多阶段模式下使用） */
  planner?: CastingPlannerOptions;
  /** Visualizer 阶段选项（多阶段模式下使用） */
  visualizer?: CastingVisualizerOptions;
}

// ═══════════════════════════════════════════════════════════
// 多阶段架构类型定义
// ═══════════════════════════════════════════════════════════

/**
 * 角色视觉规格（Planner 阶段输出）
 */
export interface CharacterVisualSpec {
  /** 角色名称 */
  name: string;
  /** 角色身份 */
  role: string;
  /** 外貌描述 */
  appearance: {
    age: string;
    gender: string;
    facialFeatures: string;
    bodyType: string;
  };
  /** 服装规范 */
  clothing: {
    type: string;
    color: string;
    material: string;
    accessories: string[];
  };
  /** 姿势设计 */
  poses: {
    front: string;
    side: string;
    action: string;
  };
}

/**
 * 风格指南（Planner 阶段输出）
 */
export interface StyleGuide {
  /** 艺术风格 */
  artStyle: string;
  /** 光照风格 */
  lighting: string;
  /** 质量标签 */
  qualityTags: string;
}

/**
 * Planner 阶段输入
 */
export interface CastingPlannerInput {
  /** 艺术总监输出（角色设定） */
  artDirectorOutput: ArtDirectorResult;
  /** 剧本内容 */
  scriptContent: string;
}

/**
 * Planner 阶段输出
 */
export interface CastingPlannerOutput {
  /** 角色视觉规格数组 */
  characterVisualSpecs: CharacterVisualSpec[];
  /** 风格指南 */
  styleGuide: StyleGuide;
}

/**
 * Visualizer 阶段输入
 */
export interface CastingVisualizerInput {
  /** 角色视觉规格 */
  characterVisualSpecs: CharacterVisualSpec[];
  /** 风格指南 */
  styleGuide: StyleGuide;
}

/**
 * Visualizer 阶段输出
 */
export interface CastingVisualizerOutput {
  /** 图像生成提示词 */
  imagePrompt: string;
  /** 角色参考图 URL */
  characterReferenceSheet: string;
  /** 风格说明 */
  styleNotes: string;
}

/**
 * Planner 阶段选项
 */
export interface CastingPlannerOptions {
  /** 指定模型 ID */
  modelId?: string;
  /** 自定义系统提示词可编辑部分（来自 PromptStudio） */
  customEditablePart?: string;
  /** 当前索引 */
  currentIndex?: number;
  /** 总数 */
  totalCount?: number;
}

/**
 * Visualizer 阶段选项
 */
export interface CastingVisualizerOptions {
  /** 指定图像生成模型 ID */
  imageModelId?: string;
  /** 自定义系统提示词可编辑部分（来自 PromptStudio） */
  customEditablePart?: string;
}

// ═══════════════════════════════════════════════════════════
// 单阶段模式：提示词构建
// ═══════════════════════════════════════════════════════════

/**
 * 构建完整系统提示词
 */
function buildSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? CASTING_DIRECTOR_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${CASTING_DIRECTOR_AGENT_LOCKED_PART}`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(
  context: CastingDirectorContext,
  currentIndex: number,
  totalCount: number,
  logger?: { info: (msg: string, meta?: any) => void }
): string {
  const {
    characterProfiles,
    sceneBreakdowns,
    scriptBrief,
    visualStyleTags,
    overallTone,
  } = context;

  // 准备变量值
  const characterProfilesJson = JSON.stringify(characterProfiles, null, 2);
  const sceneBreakdownsJson = JSON.stringify(sceneBreakdowns, null, 2);
  const visualStyleTagsStr = visualStyleTags?.join(', ') ||
    scriptBrief?.visual_style_tags?.join(', ') ||
    '未指定';
  const overallToneStr = overallTone || scriptBrief?.overall_tone || '未指定';

  // 填充模板
  const userPrompt = CASTING_DIRECTOR_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{characterProfiles\}\}/g, characterProfilesJson)
    .replace(/\{\{sceneBreakdowns\}\}/g, sceneBreakdownsJson)
    .replace(/\{\{visualStyleTags\}\}/g, visualStyleTagsStr)
    .replace(/\{\{overallTone\}\}/g, overallToneStr);

  // 添加生成进度信息
  const promptWithProgress = totalCount > 1
    ? `【生成进度】第 ${currentIndex}/${totalCount} 个\n\n${userPrompt}`
    : userPrompt;

  // 输出日志
  if (logger) {
    const systemPrompt = buildSystemPrompt();
    logger.info('[选角导演提示词信息]', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: promptWithProgress.length,
      totalLength: systemPrompt.length + promptWithProgress.length,
      characterCount: characterProfiles.length,
      currentIndex,
      totalCount,
    });
    // 输出完整提示词便于调试
    logger.info('[选角导演-系统提示词]', { content: systemPrompt });
    logger.info('[选角导演-用户提示词]', { content: promptWithProgress });
  }

  return promptWithProgress;
}

// ─── 输出解析 ──────────────────────────────────────────────

/**
 * 验证角色视角
 */
function validateViews(views: any, characterName: string): CharacterViews {
  if (!views || typeof views !== 'object') {
    throw new Error(`角色 ${characterName} 缺少 views 字段`);
  }

  const requiredViews = ['front_view', 'side_view', 'action_pose'];
  for (const view of requiredViews) {
    if (!views[view] || typeof views[view] !== 'object') {
      throw new Error(`角色 ${characterName} 缺少 ${view} 视角描述`);
    }
    if (!views[view].description) {
      throw new Error(`角色 ${characterName} 的 ${view} 缺少 description`);
    }
  }

  return {
    front_view: {
      description: String(views.front_view.description || '').trim(),
      key_features: Array.isArray(views.front_view.key_features)
        ? views.front_view.key_features.map((f: unknown) => String(f).trim()).filter(Boolean)
        : [],
    },
    side_view: {
      description: String(views.side_view.description || '').trim(),
      key_features: Array.isArray(views.side_view.key_features)
        ? views.side_view.key_features.map((f: unknown) => String(f).trim()).filter(Boolean)
        : [],
    },
    action_pose: {
      description: String(views.action_pose.description || '').trim(),
      key_features: Array.isArray(views.action_pose.key_features)
        ? views.action_pose.key_features.map((f: unknown) => String(f).trim()).filter(Boolean)
        : [],
    },
  };
}

/**
 * 解析 LLM 输出，提取选角导演结果
 *
 * 新格式：character_reference_sheet（单图输出）
 */
function parseOutput(llmOutput: string): CastingDirectorResult {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  const parsed = JSON.parse(jsonStr);

  // 验证新格式的必要字段
  if (!parsed.character_reference_sheet || typeof parsed.character_reference_sheet !== 'object') {
    throw new Error('AI 输出缺少必要字段（character_reference_sheet）');
  }

  const sheet = parsed.character_reference_sheet;

  // 验证核心字段
  if (!sheet.image_prompt || typeof sheet.image_prompt !== 'object') {
    throw new Error('AI 输出缺少必要字段（character_reference_sheet.image_prompt）');
  }

  if (!sheet.image_prompt.full_prompt) {
    throw new Error('AI 输出的 image_prompt.full_prompt 为空');
  }

  if (!sheet.character_breakdown || !Array.isArray(sheet.character_breakdown)) {
    throw new Error('AI 输出缺少必要字段（character_reference_sheet.character_breakdown）');
  }

  // 验证每个角色的分解信息
  for (const char of sheet.character_breakdown) {
    if (!char.character_id) {
      throw new Error(`角色 ${char.character_name || '未知'} 缺少 character_id`);
    }
    if (!char.character_name) {
      throw new Error(`角色 ID ${char.character_id} 缺少 character_name`);
    }
    // 验证三视图
    validateViews(char.views, char.character_name);
  }

  // 验证 total_characters 与数组长度一致
  const totalCharacters = Number(sheet.total_characters) || sheet.character_breakdown.length;
  if (totalCharacters !== sheet.character_breakdown.length) {
    throw new Error(
      `total_characters (${totalCharacters}) 与 character_breakdown 数组长度 (${sheet.character_breakdown.length}) 不一致`
    );
  }

  return {
    character_reference_sheet: {
      total_characters: totalCharacters,
      grid_layout: String(sheet.grid_layout || 'Nx3 grid layout, row per character, three views each').trim(),
      image_prompt: {
        full_prompt: String(sheet.image_prompt.full_prompt || '').trim(),
        negative_prompt: String(sheet.image_prompt.negative_prompt || '').trim(),
      },
      character_breakdown: sheet.character_breakdown.map((char: any) => ({
        character_id: String(char.character_id || '').trim(),
        character_name: String(char.character_name || '').trim(),
        role_type: char.role_type as 'protagonist' | 'antagonist' | 'supporting',
        row_position: Number(char.row_position) || 1,
        views: validateViews(char.views, char.character_name),
        reference_notes: String(char.reference_notes || '').trim(),
      })),
      style_guide: {
        art_style: String(sheet.style_guide?.art_style || 'photorealistic').trim(),
        lighting_style: String(sheet.style_guide?.lighting_style || 'studio lighting').trim(),
        quality_tags: Array.isArray(sheet.style_guide?.quality_tags)
          ? sheet.style_guide.quality_tags.map((t: unknown) => String(t).trim()).filter(Boolean)
          : ['high quality', 'detailed', '8k'],
        color_tone: String(sheet.style_guide?.color_tone || 'natural').trim(),
        style_consistency_tags: Array.isArray(sheet.style_guide?.style_consistency_tags)
          ? sheet.style_guide.style_consistency_tags.map((t: unknown) => String(t).trim()).filter(Boolean)
          : [],
      },
    },
  };
}

// ─── Agent 主函数 ──────────────────────────────────────────

/**
 * 运行选角导演 Agent
 *
 * 调用流程（单阶段模式，默认）：
 * 1. 构建系统提示词（EDITABLE + LOCKED 合并）
 * 2. 构建用户提示词（注入角色设定、场景描述、视觉风格）
 * 3. 调用 LLM 生成图像提示词
 * 4. 调用图像生成 API 生成角色参考图
 * 5. 解析输出，返回结构化的角色参考图结果（包含图片 URL）
 *
 * 调用流程（多阶段模式，useMultiStage=true）：
 * 1. Planner 阶段：调用 LLM 生成角色视觉规格 JSON
 * 2. Visualizer 阶段：调用图像生成 API 生成角色参考图
 * 3. 返回完整结果
 *
 * @param context - 选角导演上下文
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的角色参考图结果（包含图片 URL）
 */
export async function runCastingDirectorAgent(
  context: CastingDirectorContext,
  options: CastingDirectorAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CastingDirectorResult> {
  const startTime = Date.now();

  // 检查是否使用多阶段模式
  if (options.useMultiStage) {
    logger?.info('[选角导演 Agent] 使用多阶段模式（Planner + Visualizer）');

    // 准备 Planner 输入
    const plannerInput: CastingPlannerInput = {
      artDirectorOutput: {
        visual_design_brief: {
          character_profiles: context.characterProfiles,
          scene_breakdowns: context.sceneBreakdowns,
          script_brief: context.scriptBrief,
        },
        visual_style_tags: context.visualStyleTags || [],
        overall_tone: context.overallTone || '',
      },
      scriptContent: context.scriptBrief?.core_conflict || '未提供剧本内容',
    };

    // Stage 1: Planner 阶段
    logger?.info('[选角导演 Agent] ========== Stage 1: Planner ==========');
    const plannerOptions: CastingPlannerOptions = {
      modelId: options.planner?.modelId ?? options.modelId,
      customEditablePart: options.planner?.customEditablePart ?? options.customEditablePart,
      currentIndex: options.planner?.currentIndex ?? options.currentIndex ?? 1,
      totalCount: options.planner?.totalCount ?? options.totalCount ?? 1,
    };
    const plannerResult = await runCastingPlannerAgent(plannerInput, plannerOptions, logger);

    // Stage 2: Visualizer 阶段
    logger?.info('[选角导演 Agent] ========== Stage 2: Visualizer ==========');
    const visualizerInput: CastingVisualizerInput = {
      characterVisualSpecs: plannerResult.characterVisualSpecs,
      styleGuide: plannerResult.styleGuide,
    };
    const visualizerOptions: CastingVisualizerOptions = {
      imageModelId: options.visualizer?.imageModelId,
      customEditablePart: options.visualizer?.customEditablePart,
    };
    const visualizerResult = await runCastingVisualizerAgent(visualizerInput, visualizerOptions, logger);

    const endTime = Date.now();
    logger?.info('[选角导演 Agent] 多阶段执行完成', {
      totalDuration: endTime - startTime,
      characterCount: plannerResult.characterVisualSpecs.length,
    });

    // 转换 Visualizer 输出为标准 CastingDirectorResult 格式
    const characterCount = plannerResult.characterVisualSpecs.length;
    const baseWidth = 1536;
    const baseHeightPerRow = 512;
    const totalHeight = Math.max(baseHeightPerRow * characterCount, 512);
    const maxDimension = 2048;
    let finalWidth = baseWidth;
    let finalHeight = totalHeight;
    if (finalHeight > maxDimension) {
      const scale = maxDimension / finalHeight;
      finalWidth = Math.floor(finalWidth * scale);
      finalHeight = maxDimension;
    }
    finalWidth = Math.floor(finalWidth / 64) * 64;
    finalHeight = Math.floor(finalHeight / 64) * 64;

    return {
      character_reference_sheet: {
        total_characters: characterCount,
        grid_layout: `${characterCount}x3 grid layout, row per character, three views each`,
        image_prompt: {
          full_prompt: visualizerResult.imagePrompt,
          negative_prompt: '',
        },
        character_breakdown: plannerResult.characterVisualSpecs.map((spec, index) => ({
          character_id: `char_${index + 1}`,
          character_name: spec.name,
          role_type: 'protagonist' as const, // 默认主角，可根据 role 字段映射
          row_position: index + 1,
          views: {
            front_view: {
              description: spec.poses.front,
              key_features: [spec.appearance.facialFeatures],
            },
            side_view: {
              description: spec.poses.side,
              key_features: [spec.appearance.bodyType],
            },
            action_pose: {
              description: spec.poses.action,
              key_features: spec.clothing.accessories,
            },
          },
          reference_notes: `${spec.role}, ${spec.clothing.type}, ${spec.clothing.color}`,
        })),
        style_guide: {
          art_style: plannerResult.styleGuide.artStyle,
          lighting_style: plannerResult.styleGuide.lighting,
          quality_tags: plannerResult.styleGuide.qualityTags.split(', ').filter(Boolean),
          color_tone: 'natural',
          style_consistency_tags: [plannerResult.styleGuide.artStyle, plannerResult.styleGuide.lighting],
        },
        image_url: visualizerResult.characterReferenceSheet,
        image_generation_metadata: {
          size: `${finalWidth}x${finalHeight}`,
          quality: 'hd',
          generationTime: Date.now(),
        },
      },
    };
  }

  // 单阶段模式（向后兼容）
  const { customEditablePart, currentIndex = 1, totalCount = 1 } = options;

  // 步骤 1：获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 步骤 2：构建提示词
  const systemPrompt = buildSystemPrompt(customEditablePart);
  const userPrompt = buildUserPrompt(context, currentIndex, totalCount, logger);

  // 步骤 3：调用 LLM 生成图像提示词
  const result = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 4096,
  });

  // 步骤 4：解析 LLM 输出
  const parsedResult = parseOutput(result.content);

  // 步骤 5：调用图像生成 API 生成角色参考图
  logger?.info('[选角导演] 开始生成角色参考图...', {
    characterCount: parsedResult.character_reference_sheet.total_characters,
    gridLayout: parsedResult.character_reference_sheet.grid_layout,
  });

  const imagePrompt = parsedResult.character_reference_sheet.image_prompt.full_prompt;

  // 根据角色数量计算合适的图片尺寸（Nx3 网格）
  // 每行高度约 512px，宽度约 1536px（3列）
  const characterCount = parsedResult.character_reference_sheet.total_characters;
  const baseWidth = 1536;  // 3列，每列约 512px
  const baseHeightPerRow = 512;
  const totalHeight = Math.max(baseHeightPerRow * characterCount, 512);

  // 限制最大尺寸（大多数 API 有尺寸限制）
  const maxDimension = 2048;
  let finalWidth = baseWidth;
  let finalHeight = totalHeight;

  if (finalHeight > maxDimension) {
    // 如果高度超过限制，按比例缩放
    const scale = maxDimension / finalHeight;
    finalWidth = Math.floor(finalWidth * scale);
    finalHeight = maxDimension;
  }

  // 确保尺寸是 64 的倍数（符合大多数图像生成 API 要求）
  finalWidth = Math.floor(finalWidth / 64) * 64;
  finalHeight = Math.floor(finalHeight / 64) * 64;

  const imageSize = `${finalWidth}x${finalHeight}` as const;

  logger?.info('[选角导演] 图像生成参数', {
    imageSize,
    characterCount,
    promptLength: imagePrompt.length,
  });

  const imageResult = await provider.generateImage(imagePrompt, {
    size: imageSize,
    quality: 'hd',
    numberOfImages: 1,
  });

  if (!imageResult.images || imageResult.images.length === 0) {
    throw new Error('角色参考图生成失败：未返回图片');
  }

  const imageUrl = imageResult.images[0].url;

  logger?.info('[选角导演] 角色参考图生成成功', {
    imageUrl: imageUrl.substring(0, 100) + '...',
    width: finalWidth,
    height: finalHeight,
  });

  // 返回完整结果（包含图片 URL）
  return {
    character_reference_sheet: {
      ...parsedResult.character_reference_sheet,
      image_url: imageUrl,
      image_generation_metadata: {
        size: imageSize,
        quality: 'hd',
        generationTime: Date.now(),
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════
// 多阶段架构：Planner + Visualizer
// ═══════════════════════════════════════════════════════════

/**
 * 构建 Planner 系统提示词
 */
function buildPlannerSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? CASTING_PLANNER_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${CASTING_PLANNER_AGENT_LOCKED_PART}`;
}

/**
 * 构建 Planner 用户提示词
 */
function buildPlannerUserPrompt(
  input: CastingPlannerInput,
  currentIndex: number,
  totalCount: number
): string {
  const { artDirectorOutput, scriptContent } = input;

  // 准备变量值
  const artDirectorJson = JSON.stringify(artDirectorOutput, null, 2);

  // 填充模板
  const userPrompt = CASTING_PLANNER_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{artDirectorOutput\}\}/g, artDirectorJson)
    .replace(/\{\{scriptContent\}\}/g, scriptContent || '未提供剧本内容');

  // 添加生成进度信息
  return totalCount > 1
    ? `【生成进度】第 ${currentIndex}/${totalCount} 个\n\n${userPrompt}`
    : userPrompt;
}

/**
 * 验证角色视觉规格
 */
function validateCharacterVisualSpec(spec: any, index: number): CharacterVisualSpec {
  if (!spec || typeof spec !== 'object') {
    throw new Error(`角色视觉规格[${index}] 格式错误`);
  }

  return {
    name: String(spec.name || `角色${index + 1}`).trim(),
    role: String(spec.role || '').trim(),
    appearance: {
      age: String(spec.appearance?.age || '').trim(),
      gender: String(spec.appearance?.gender || '').trim(),
      facialFeatures: String(spec.appearance?.facialFeatures || '').trim(),
      bodyType: String(spec.appearance?.bodyType || '').trim(),
    },
    clothing: {
      type: String(spec.clothing?.type || '').trim(),
      color: String(spec.clothing?.color || '').trim(),
      material: String(spec.clothing?.material || '').trim(),
      accessories: Array.isArray(spec.clothing?.accessories)
        ? spec.clothing.accessories.map((a: unknown) => String(a).trim()).filter(Boolean)
        : [],
    },
    poses: {
      front: String(spec.poses?.front || '').trim(),
      side: String(spec.poses?.side || '').trim(),
      action: String(spec.poses?.action || '').trim(),
    },
  };
}

/**
 * 解析 Planner LLM 输出
 */
function parsePlannerOutput(llmOutput: string): CastingPlannerOutput {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error('选角导演 Planner 阶段输出格式错误：无法解析 JSON');
  }

  // 验证必要字段
  if (!parsed.characterVisualSpecs || !Array.isArray(parsed.characterVisualSpecs)) {
    throw new Error('AI 输出缺少必要字段（characterVisualSpecs）');
  }

  // 验证每个角色的视觉规格
  const characterVisualSpecs = parsed.characterVisualSpecs.map((spec: any, index: number) =>
    validateCharacterVisualSpec(spec, index)
  );

  // 验证风格指南
  const styleGuide: StyleGuide = {
    artStyle: String(parsed.styleGuide?.artStyle || 'photorealistic').trim(),
    lighting: String(parsed.styleGuide?.lighting || 'studio lighting').trim(),
    qualityTags: String(parsed.styleGuide?.qualityTags || 'high quality, detailed, 8k').trim(),
  };

  return {
    characterVisualSpecs,
    styleGuide,
  };
}

/**
 * 运行选角导演 Planner 阶段
 *
 * 职责：根据艺术总监输出和剧本，生成角色视觉规格 JSON
 *
 * @param input - Planner 阶段输入
 * @param options - Planner 阶段选项
 * @param logger - 可选的日志输出函数
 * @returns Planner 阶段输出（角色视觉规格和风格指南）
 */
export async function runCastingPlannerAgent(
  input: CastingPlannerInput,
  options: CastingPlannerOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CastingPlannerOutput> {
  const { customEditablePart, currentIndex = 1, totalCount = 1 } = options;
  const startTime = Date.now();

  // 获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  logger?.info('[选角导演-Planner] 开始执行', {
    currentIndex,
    totalCount,
  });

  // 构建提示词
  const systemPrompt = buildPlannerSystemPrompt(customEditablePart);
  const userPrompt = buildPlannerUserPrompt(input, currentIndex, totalCount);

  logger?.info('[选角导演-Planner] 提示词信息', {
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
  });

  // 调用 LLM 生成角色视觉规格
  logger?.info('[选角导演-Planner] 调用 LLM 生成角色视觉规格...');
  const textResult = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 4096,
  });

  logger?.info('[选角导演-Planner] LLM 响应接收完成', {
    contentLength: textResult.content.length,
  });

  // 解析 LLM 输出
  logger?.info('[选角导演-Planner] 解析角色视觉规格...');
  const parsedResult = parsePlannerOutput(textResult.content);

  const endTime = Date.now();
  logger?.info('[选角导演-Planner] 执行完成', {
    duration: endTime - startTime,
    characterCount: parsedResult.characterVisualSpecs.length,
  });

  return parsedResult;
}

/**
 * 构建 Visualizer 系统提示词
 */
function buildVisualizerSystemPrompt(customEditablePart?: string): string {
  const editablePart = customEditablePart ?? CASTING_VISUALIZER_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${CASTING_VISUALIZER_AGENT_LOCKED_PART}`;
}

/**
 * 构建 Visualizer 用户提示词
 */
function buildVisualizerUserPrompt(
  input: CastingVisualizerInput
): string {
  const { characterVisualSpecs, styleGuide } = input;

  // 准备变量值
  const specsJson = JSON.stringify(characterVisualSpecs, null, 2);
  const styleGuideJson = JSON.stringify(styleGuide, null, 2);

  // 填充模板
  return CASTING_VISUALIZER_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{characterVisualSpecs\}\}/g, specsJson)
    .replace(/\{\{styleGuide\}\}/g, styleGuideJson);
}

/**
 * 解析 Visualizer LLM 输出
 */
function parseVisualizerOutput(llmOutput: string): { imagePrompt: string; styleNotes: string } {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error('选角导演 Visualizer 阶段输出格式错误：无法解析 JSON');
  }

  // 验证必要字段
  if (!parsed.imagePrompt) {
    throw new Error('AI 输出缺少必要字段（imagePrompt）');
  }

  return {
    imagePrompt: String(parsed.imagePrompt).trim(),
    styleNotes: String(parsed.styleNotes || '').trim(),
  };
}

/**
 * 构建图像生成提示词（从视觉规格）
 */
function buildImagePromptFromSpecs(
  characterVisualSpecs: CharacterVisualSpec[],
  styleGuide: StyleGuide
): string {
  const characterCount = characterVisualSpecs.length;

  // 构建网格布局描述
  const rows = characterVisualSpecs.map((spec, index) => {
    const { name, appearance, clothing, poses } = spec;
    return `Row ${index + 1} - ${name}: ${appearance.age} ${appearance.gender}, ${appearance.facialFeatures}, ${appearance.bodyType} body type, wearing ${clothing.color} ${clothing.type} made of ${clothing.material}, front view: ${poses.front}, side view: ${poses.side}, action pose: ${poses.action}`;
  }).join('; ');

  // 构建完整提示词
  return `Character reference sheet, ${characterCount} characters in ${characterCount}x3 grid layout, row per character with three views each, ${rows}, ${styleGuide.artStyle} style, ${styleGuide.lighting}, ${styleGuide.qualityTags}, zero gaps between panels, no borders no padding, neutral gray background, consistent character design, professional game art`;
}

/**
 * 运行选角导演 Visualizer 阶段
 *
 * 职责：根据角色视觉规格，生成角色参考图
 *
 * @param input - Visualizer 阶段输入
 * @param options - Visualizer 阶段选项
 * @param logger - 可选的日志输出函数
 * @returns Visualizer 阶段输出（图像 URL 和提示词）
 */
export async function runCastingVisualizerAgent(
  input: CastingVisualizerInput,
  options: CastingVisualizerOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CastingVisualizerOutput> {
  const { imageModelId, customEditablePart } = options;
  const startTime = Date.now();

  // 获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  const { characterVisualSpecs, styleGuide } = input;

  logger?.info('[选角导演-Visualizer] 开始执行', {
    characterCount: characterVisualSpecs.length,
  });

  // 构建图像生成提示词
  const imagePrompt = buildImagePromptFromSpecs(characterVisualSpecs, styleGuide);

  logger?.info('[选角导演-Visualizer] 图像生成提示词构建完成', {
    promptLength: imagePrompt.length,
  });

  // 根据角色数量计算合适的图片尺寸（Nx3 网格）
  const characterCount = characterVisualSpecs.length;
  const baseWidth = 1536;  // 3列，每列约 512px
  const baseHeightPerRow = 512;
  const totalHeight = Math.max(baseHeightPerRow * characterCount, 512);

  // 限制最大尺寸
  const maxDimension = 2048;
  let finalWidth = baseWidth;
  let finalHeight = totalHeight;

  if (finalHeight > maxDimension) {
    const scale = maxDimension / finalHeight;
    finalWidth = Math.floor(finalWidth * scale);
    finalHeight = maxDimension;
  }

  // 确保尺寸是 64 的倍数
  finalWidth = Math.floor(finalWidth / 64) * 64;
  finalHeight = Math.floor(finalHeight / 64) * 64;

  const imageSize = `${finalWidth}x${finalHeight}` as const;

  logger?.info('[选角导演-Visualizer] 开始生成角色参考图...', {
    imageSize,
    characterCount,
  });

  // 图像生成选项
  const imageOptions = {
    size: imageSize,
    quality: 'hd' as const,
    numberOfImages: 1 as const,
    ...(imageModelId && imageModelId !== 'default' ? { model: imageModelId } : {}),
  };

  // 调用图像生成 API
  const imageResult = await provider.generateImage(imagePrompt, imageOptions);

  if (!imageResult.images || imageResult.images.length === 0) {
    throw new Error('角色参考图生成失败：未返回图片');
  }

  const imageUrl = imageResult.images[0].url;

  const endTime = Date.now();
  logger?.info('[选角导演-Visualizer] 角色参考图生成成功', {
    duration: endTime - startTime,
    imageUrl: imageUrl.substring(0, 100) + '...',
  });

  return {
    imagePrompt,
    characterReferenceSheet: imageUrl,
    styleNotes: `${styleGuide.artStyle}, ${styleGuide.lighting}, ${styleGuide.qualityTags}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 默认导出
export default runCastingDirectorAgent;
