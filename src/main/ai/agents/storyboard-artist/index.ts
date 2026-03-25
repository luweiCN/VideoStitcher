/**
 * 分镜设计 Agent
 *
 * 职责：根据艺术总监的视觉简报、选角导演的角色参考图和剧本内容，设计完整的 25 帧分镜计划，
 *       并生成 5x5 网格分镜图，使用 sharp 切割为 25 张单帧图
 *
 * 设计说明：
 * - 这是一个「单次调用型 Agent」，不需要 LangGraph StateGraph
 * - 提示词分两层：EDITABLE（游戏行业专家可在 PromptStudio 调整）+ LOCKED（JSON 格式，代码依赖）
 * - 动态提示词包含：艺术总监输出、选角导演输出、剧本内容、视频规格
 * - **图像生成在 Agent 内完成**：LLM 生成分镜描述 → generateImage 生成 5x5 网格图 → sharp 切割为 25 帧
 */

import {
  STORYBOARD_ARTIST_AGENT_EDITABLE_PART,
  STORYBOARD_ARTIST_AGENT_LOCKED_PART,
  STORYBOARD_ARTIST_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/storyboardArtistTemplates';
import { getGlobalProvider } from '../../provider-manager';
import { downloadToCache } from '@main/utils/cache';
import type { ArtDirectorResult } from '@shared/types/aside';
import type { CastingDirectorResult } from '../casting-director';

// ─── 类型定义 ─────────────────────────────────────────────

/**
 * 叙事节拍标记
 */
interface NarrativeBeats {
  is_scene_change: boolean;
  is_climax: boolean;
  is_transition: boolean;
}

/**
 * 单帧元数据
 */
interface StoryboardFrame {
  frame_number: number;
  description: string;
  duration: number;
  shot_type: 'EXTREME_CLOSE_UP' | 'CLOSE_UP' | 'MEDIUM_SHOT' | 'FULL_SHOT' | 'WIDE_SHOT';
  character_refs: string[];
  camera_movement: 'STATIC' | 'PAN_LEFT' | 'PAN_RIGHT' | 'TILT_UP' | 'TILT_DOWN' | 'ZOOM_IN' | 'ZOOM_OUT' | 'TRACK_IN' | 'TRACK_OUT' | 'HANDHELD';
  is_key_frame: boolean;
  narrative_beats: NarrativeBeats;
}

/**
 * 视频规格
 */
interface VideoSpec {
  aspectRatio: '9:16' | '16:9';
  duration: number;
}

/**
 * 分镜设计 Agent 输出结果
 */
export interface StoryboardArtistResult {
  /** 完整 5x5 分镜网格图 URL（支持参考图的模型使用） */
  storyboard_grid_image: string;

  /** 25 张切割后的单帧图 base64（只支持首尾帧的模型使用） */
  frame_images: string[];

  /** 每帧详细元数据 */
  frames: StoryboardFrame[];

  /** 整体风格描述（供摄像师传递给视频模型） */
  style_notes: string;

  /** 本地缓存路径（供后续处理使用） */
  local_grid_path?: string;
}

/**
 * 分镜设计 Agent 上下文输入
 */
export interface StoryboardArtistContext {
  /** 艺术总监输出（角色设定、场景描述、剧本简报） */
  artDirectorOutput: ArtDirectorResult;

  /** 选角导演输出（含角色参考图 URL 和风格指南） */
  castingDirectorOutput: CastingDirectorResult;

  /** 剧本内容 */
  scriptContent: string;

  /** 视频规格（画幅比例、时长） */
  videoSpec: VideoSpec;
}

/**
 * Agent 调用选项
 */
export interface StoryboardArtistAgentOptions {
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
  const editablePart = customEditablePart ?? STORYBOARD_ARTIST_AGENT_EDITABLE_PART;
  return `${editablePart}\n\n${STORYBOARD_ARTIST_AGENT_LOCKED_PART}`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(
  context: StoryboardArtistContext,
  currentIndex: number,
  totalCount: number,
  logger?: { info: (msg: string, meta?: any) => void }
): string {
  const { artDirectorOutput, castingDirectorOutput, scriptContent, videoSpec } = context;

  // 准备变量值
  const artDirectorJson = JSON.stringify(artDirectorOutput, null, 2);
  const castingDirectorJson = JSON.stringify(castingDirectorOutput, null, 2);
  const videoSpecJson = JSON.stringify(videoSpec, null, 2);

  // 填充模板
  const userPrompt = STORYBOARD_ARTIST_AGENT_USER_PROMPT_TEMPLATE
    .replace(/\{\{artDirectorOutput\}\}/g, artDirectorJson)
    .replace(/\{\{characterReferenceSheet\}\}/g, castingDirectorJson)
    .replace(/\{\{scriptContent\}\}/g, scriptContent)
    .replace(/\{\{videoSpec\}\}/g, videoSpecJson);

  // 添加生成进度信息
  const promptWithProgress = totalCount > 1
    ? `【生成进度】第 ${currentIndex}/${totalCount} 个\n\n${userPrompt}`
    : userPrompt;

  // 输出日志
  if (logger) {
    const systemPrompt = buildSystemPrompt();
    logger.info('[分镜设计提示词信息]', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: promptWithProgress.length,
      totalLength: systemPrompt.length + promptWithProgress.length,
      frameCount: 25,
      aspectRatio: videoSpec.aspectRatio,
      currentIndex,
      totalCount,
    });
    // 输出完整提示词便于调试
    logger.info('[分镜设计-系统提示词]', { content: systemPrompt });
    logger.info('[分镜设计-用户提示词]', { content: promptWithProgress });
  }

  return promptWithProgress;
}

// ─── 输出解析 ──────────────────────────────────────────────

/**
 * 验证叙事节拍
 */
function validateNarrativeBeats(beats: any): NarrativeBeats {
  if (!beats || typeof beats !== 'object') {
    return { is_scene_change: false, is_climax: false, is_transition: false };
  }

  return {
    is_scene_change: Boolean(beats.is_scene_change),
    is_climax: Boolean(beats.is_climax),
    is_transition: Boolean(beats.is_transition),
  };
}

/**
 * 验证单帧数据
 */
function validateFrame(frame: any, index: number): StoryboardFrame {
  const validShotTypes = ['EXTREME_CLOSE_UP', 'CLOSE_UP', 'MEDIUM_SHOT', 'FULL_SHOT', 'WIDE_SHOT'];
  const validCameraMovements = ['STATIC', 'PAN_LEFT', 'PAN_RIGHT', 'TILT_UP', 'TILT_DOWN', 'ZOOM_IN', 'ZOOM_OUT', 'TRACK_IN', 'TRACK_OUT', 'HANDHELD'];

  return {
    frame_number: Number(frame.frame_number) || (index + 1),
    description: String(frame.description || '').trim(),
    duration: Number(frame.duration) || 0.6,
    shot_type: validShotTypes.includes(frame.shot_type) ? frame.shot_type : 'MEDIUM_SHOT',
    character_refs: Array.isArray(frame.character_refs)
      ? frame.character_refs.map((ref: unknown) => String(ref).trim()).filter(Boolean)
      : [],
    camera_movement: validCameraMovements.includes(frame.camera_movement) ? frame.camera_movement : 'STATIC',
    is_key_frame: Boolean(frame.is_key_frame),
    narrative_beats: validateNarrativeBeats(frame.narrative_beats),
  };
}

/**
 * 解析 LLM 输出，提取分镜设计结果
 */
function parseOutput(llmOutput: string): { frames: StoryboardFrame[]; style_notes: string } {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error('分镜设计 Agent 输出格式错误：无法解析 JSON');
  }

  // 验证必要字段
  if (!parsed.frames || !Array.isArray(parsed.frames)) {
    throw new Error('AI 输出缺少必要字段（frames）');
  }

  // 验证帧数量（应为 25 帧）
  if (parsed.frames.length !== 25) {
    console.warn(`[分镜设计] 警告：帧数量不为 25，实际为 ${parsed.frames.length}`);
  }

  // 验证每帧数据
  const frames = parsed.frames.map((frame: any, index: number) => validateFrame(frame, index));

  // 确保帧按序号排序
  frames.sort((a, b) => a.frame_number - b.frame_number);

  return {
    frames,
    style_notes: String(parsed.style_notes || '').trim(),
  };
}

// ─── 图像生成和切割 ────────────────────────────────────────

/**
 * 构建分镜网格图像生成提示词
 */
function buildStoryboardImagePrompt(
  frames: StoryboardFrame[],
  castingDirectorOutput: CastingDirectorResult,
  videoSpec: VideoSpec
): { prompt: string; styleTags: string } {
  const isPortrait = videoSpec.aspectRatio === '9:16';
  const layoutHint = isPortrait
    ? 'portrait orientation 9:16 vertical layout, each cell is taller than wide'
    : 'landscape orientation 16:9 horizontal layout, each cell is wider than tall';

  // 从选角导演输出中提取风格标签
  const styleTags = castingDirectorOutput.character_reference_sheet?.style_guide?.style_consistency_tags?.join(', ')
    || 'photorealistic, cinematic composition';

  // 构建帧描述
  const frameDescriptions = frames
    .slice(0, 25)
    .map((f, i) => `Frame ${i + 1}: ${f.description}`)
    .join('. ');

  // 构建完整提示词
  const prompt = `Professional storyboard grid, exactly 5 rows and 5 columns of 25 panels, ${layoutHint}, zero gaps between panels, no borders no padding no margins no gutters no grid lines no black bars no white space, all panels flush edge-to-edge filling the entire image, ${styleTags}, each panel shows: ${frameDescriptions}, consistent character design, sequential narrative flow, no text, no numbers`;

  return { prompt, styleTags };
}

/**
 * 生成分镜网格图
 */
async function generateStoryboardImage(
  frames: StoryboardFrame[],
  castingDirectorOutput: CastingDirectorResult,
  videoSpec: VideoSpec,
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<{ imageUrl: string; localPath: string }> {
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 构建图像生成提示词
  const { prompt, styleTags } = buildStoryboardImagePrompt(frames, castingDirectorOutput, videoSpec);

  logger?.info('[分镜设计] 开始生成分镜网格图...', {
    frameCount: frames.length,
    aspectRatio: videoSpec.aspectRatio,
    styleTags,
    promptLength: prompt.length,
  });

  // 获取角色参考图 URL
  const characterImageUrl = castingDirectorOutput.character_reference_sheet?.image_url;

  // 图像生成选项
  const imageOptions = {
    // 分镜图用最高分辨率，保证帧切割质量
    // 16:9 → 3840x2160（每帧 768x432）
    // 9:16 → 2160x3840（每帧 432x768）
    size: (videoSpec.aspectRatio === '9:16' ? '2160x3840' : '3840x2160') as const,
    quality: 'hd' as const,
    numberOfImages: 1 as const,
    ...(characterImageUrl ? { referenceImageUrl: characterImageUrl } : {}),
  };

  // 调用图像生成 API
  const imageResult = await provider.generateImage(prompt, imageOptions);

  if (!imageResult.images || imageResult.images.length === 0) {
    throw new Error('分镜网格图生成失败：未返回图片');
  }

  const imageUrl = imageResult.images[0].url;

  logger?.info('[分镜设计] 分镜网格图生成成功', {
    imageUrl: imageUrl.substring(0, 100) + '...',
    size: imageOptions.size,
  });

  // 下载到本地缓存
  logger?.info('[分镜设计] 下载分镜网格图到本地缓存...');
  const localPath = await downloadToCache(imageUrl, '.jpg');
  logger?.info('[分镜设计] 下载完成', { localPath });

  return { imageUrl, localPath };
}

/**
 * 使用 sharp 切割分镜网格图为 25 张单帧
 */
async function sliceStoryboardGrid(
  localPath: string,
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<string[]> {
  // 动态导入 sharp（ESM 兼容）
  let sharpModule: any;
  try {
    sharpModule = await import('sharp');
  } catch (error) {
    throw new Error('sharp 模块加载失败，请确保已安装 sharp 依赖');
  }
  const sharp = sharpModule.default || sharpModule;

  logger?.info('[分镜设计] 开始切割分镜网格图...');

  // 获取图片实际尺寸
  const gridMeta = await sharp(localPath).metadata();
  const rawWidth: number = gridMeta.width || 2560;
  const rawHeight: number = gridMeta.height || 1440;

  // 自动裁剪边框：图像生成模型常在网格周围添加白色/黑色边距
  // 策略：对每条边最多裁剪 3%，然后取整到能被 5 整除的值
  const maxCropRatio = 0.03;
  const cropPx = (dim: number) => Math.floor(dim * maxCropRatio);
  const cropLeft = cropPx(rawWidth);
  const cropTop = cropPx(rawHeight);
  // 保证裁剪后的宽高能被 5 整除，便于等分 5 列/行
  const croppedWidth = Math.floor((rawWidth - cropLeft * 2) / 5) * 5;
  const croppedHeight = Math.floor((rawHeight - cropTop * 2) / 5) * 5;

  const frameWidth = croppedWidth / 5;
  const frameHeight = croppedHeight / 5;

  logger?.info('[分镜设计] 切割参数计算完成', {
    rawWidth,
    rawHeight,
    croppedWidth,
    croppedHeight,
    frameWidth,
    frameHeight,
    cropLeft,
    cropTop,
  });

  // 切割 25 帧并转 base64（按行优先：第1行5帧，第2行5帧...）
  const frameBase64List: string[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const frameBuffer = await sharp(localPath)
        .extract({
          left: cropLeft + col * frameWidth,
          top: cropTop + row * frameHeight,
          width: frameWidth,
          height: frameHeight,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      frameBase64List.push(`data:image/jpeg;base64,${frameBuffer.toString('base64')}`);
    }
  }

  logger?.info('[分镜设计] 切割完成', { frameCount: frameBase64List.length });

  return frameBase64List;
}

// ─── Agent 主函数 ──────────────────────────────────────────

/**
 * 运行分镜设计 Agent
 *
 * 调用流程：
 * 1. 构建系统提示词（EDITABLE + LOCKED 合并）
 * 2. 构建用户提示词（注入艺术总监输出、选角导演输出、剧本内容、视频规格）
 * 3. 调用 LLM 生成分镜描述（JSON 格式）
 * 4. 解析输出，获取 frames 和 style_notes
 * 5. 调用 generateImage 生成 5x5 分镜网格图
 * 6. 使用 sharp 切割为 25 张单帧图
 * 7. 返回完整结果（包含大图 URL、小图 base64 数组、帧元数据）
 *
 * @param context - 分镜设计上下文
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的分镜结果（包含网格图、单帧图、元数据）
 */
export async function runStoryboardArtistAgent(
  context: StoryboardArtistContext,
  options: StoryboardArtistAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<StoryboardArtistResult> {
  const { customEditablePart, currentIndex = 1, totalCount = 1 } = options;
  const startTime = Date.now();

  // 步骤 1：获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  logger?.info('[分镜设计 Agent] 开始执行', {
    aspectRatio: context.videoSpec.aspectRatio,
    duration: context.videoSpec.duration,
    currentIndex,
    totalCount,
  });

  // 步骤 2：构建提示词
  const systemPrompt = buildSystemPrompt(customEditablePart);
  const userPrompt = buildUserPrompt(context, currentIndex, totalCount, logger);

  // 步骤 3：调用 LLM 生成分镜描述
  logger?.info('[分镜设计 Agent] 调用 LLM 生成分镜描述...');
  const textResult = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 8192,
  });

  logger?.info('[分镜设计 Agent] LLM 响应接收完成', {
    contentLength: textResult.content.length,
    tokens: textResult.usage?.totalTokens,
  });

  // 步骤 4：解析 LLM 输出
  logger?.info('[分镜设计 Agent] 解析分镜描述...');
  const parsedResult = parseOutput(textResult.content);

  logger?.info('[分镜设计 Agent] 分镜描述解析完成', {
    frameCount: parsedResult.frames.length,
    keyFrameCount: parsedResult.frames.filter(f => f.is_key_frame).length,
  });

  // 步骤 5：生成分镜网格图
  logger?.info('[分镜设计 Agent] 开始生成分镜网格图...');
  const { imageUrl, localPath } = await generateStoryboardImage(
    parsedResult.frames,
    context.castingDirectorOutput,
    context.videoSpec,
    logger
  );

  // 步骤 6：使用 sharp 切割为 25 张单帧图
  logger?.info('[分镜设计 Agent] 开始切割分镜网格图...');
  const frameImages = await sliceStoryboardGrid(localPath, logger);

  const endTime = Date.now();
  logger?.info('[分镜设计 Agent] 执行完成', {
    duration: endTime - startTime,
    frameCount: parsedResult.frames.length,
  });

  // 步骤 7：返回完整结果
  return {
    storyboard_grid_image: imageUrl,
    frame_images: frameImages,
    frames: parsedResult.frames,
    style_notes: parsedResult.style_notes,
    local_grid_path: localPath,
  };
}

// 默认导出
export default runStoryboardArtistAgent;
