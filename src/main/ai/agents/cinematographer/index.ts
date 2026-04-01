/**
 * 摄像师 Agent（多阶段架构）
 *
 * 职责：根据分镜输出生成最终视频，包含视频合成计划和运镜调度
 *
 * 设计说明：
 * - 采用多阶段架构：Planner（规划器）+ Executor（执行器）
 * - **Stage 1 - Planner**：调用 LLM 生成视频渲染计划（RenderPlan）
 * - **Stage 2 - Executor**：调用视频生成 API 生成视频片段，并使用 ffmpeg 拼接
 * - 支持每个阶段自定义提示词和模型选择
 * - 支持向后兼容的单阶段模式
 */

import { getGlobalProvider } from '../../provider-manager';
import { downloadToCache } from '@main/utils/cache';
import type { AIProvider, VideoGenerationOptions } from '../../providers/interface';
import { CinematographerAgentPrompts } from '../../prompts/cinematographer-agent';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';

// ═══════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════

/**
 * 渲染块
 */
export interface RenderChunk {
  /** 块 ID */
  chunkId: number;
  /** 时长（秒） */
  durationSeconds: number;
  /** 起始帧号（1-based） */
  startFrameIndex: number;
  /** 结束帧号（1-based） */
  endFrameIndex: number;
  /** 首帧下标（0-based，对应分镜帧数组） */
  firstFrameIndex: number;
  /** 尾帧下标（0-based，对应分镜帧数组） */
  lastFrameIndex: number;
  /** 运镜描述 */
  cameraMovement: string;
  /** 转场说明 */
  transitionNote: string;
  /** 视频生成提示词上下文 */
  promptContext: string;
}

/**
 * 渲染计划
 */
export interface RenderPlan {
  /** 工作流模式 */
  workflowMode: 'mode_a' | 'mode_b';
  /** 总块数 */
  totalChunks: number;
  /** 渲染块数组 */
  chunks: RenderChunk[];
  /** 模型特定说明 */
  modelSpecificNotes: string;
}

/**
 * 模型能力配置
 */
export interface ModelCapabilities {
  /** 是否支持首帧图 */
  supportsFirstFrame: boolean;
  /** 是否支持尾帧图 */
  supportsLastFrame: boolean;
  /** 最大视频时长（秒） */
  maxDuration: number;
  /** 支持的画幅比例 */
  supportedAspectRatios: string[];
  /** 提供商名称 */
  provider: 'seedance' | 'kling' | 'other';
}

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 提供商名称 */
  provider: 'seedance' | 'kling' | 'other';
  /** 模型 ID */
  modelId?: string;
  /** 是否生成音频 */
  generateAudio?: boolean;
}

/**
 * 帧图像
 */
export interface FrameImage {
  /** 帧号 */
  frameNumber: number;
  /** 图像 URL 或 base64 */
  imageUrl: string;
  /** 帧描述 */
  description: string;
}

/**
 * 分镜帧
 */
export interface StoryboardFrame {
  /** 帧号 */
  frameNumber: number;
  /** 帧描述 */
  description: string;
  /** 时长 */
  duration: number;
  /** 镜头类型 */
  shotType: string;
  /** 运镜 */
  cameraMovement: string;
  /** 是否关键帧 */
  isKeyFrame: boolean;
  /** base64 图像数据 */
  base64?: string;
}

/**
 * 分镜输出
 */
export interface StoryboardOutput {
  /** 帧数组 */
  frames: StoryboardFrame[];
  /** 分镜网格图 URL */
  imageUrl?: string;
  /** 风格说明 */
  styleNotes?: string;
}

/**
 * 视频规格
 */
export interface VideoSpec {
  /** 画幅比例 */
  aspectRatio: '16:9' | '9:16';
  /** 时长（秒） */
  duration: number;
  /** 分辨率 */
  resolution?: '720p' | '1080p' | '4k';
}

/**
 * Planner 阶段输入
 */
export interface CinematographerPlannerInput {
  /** 分镜输出 */
  storyboardOutput: StoryboardOutput;
  /** 视频规格 */
  videoSpec: VideoSpec;
  /** 模型能力配置 */
  modelCapabilities: ModelCapabilities;
}

/**
 * Planner 阶段输出
 */
export interface CinematographerPlannerOutput {
  /** 渲染计划 */
  renderPlan: RenderPlan;
  /** 原始 LLM 输出 */
  rawOutput: string;
}

/**
 * Executor 阶段输入
 */
export interface CinematographerExecutorInput {
  /** 渲染计划 */
  renderPlan: RenderPlan;
  /** 分镜帧图 */
  frameImages: FrameImage[];
  /** 模型配置 */
  modelConfig: ModelConfig;
}

/**
 * Executor 阶段输出
 */
export interface CinematographerExecutorOutput {
  /** 视频片段 URL 数组 */
  videoSegments: string[];
  /** 本地视频片段路径数组 */
  localVideoSegments: string[];
  /** 总时长（秒） */
  totalDuration: number;
  /** 最终视频 URL */
  finalVideoUrl: string;
  /** 本地最终视频路径 */
  localFinalVideoPath?: string;
}

/**
 * 摄像师 Agent 完整结果
 */
export interface CinematographerResult {
  /** 最终视频 URL */
  videoUrl: string;
  /** 本地视频路径 */
  localVideoPath?: string;
  /** 视频片段数组 */
  videoSegments: string[];
  /** 本地片段路径数组 */
  localVideoSegments: string[];
  /** 总时长 */
  totalDuration: number;
  /** 片段数量 */
  videoChunks: number;
  /** 渲染计划 */
  renderPlan: RenderPlan;
  /** 各阶段详细结果 */
  stageResults?: {
    planner: CinematographerPlannerOutput;
    executor: CinematographerExecutorOutput;
  };
}

/**
 * Planner 阶段选项
 */
export interface CinematographerPlannerOptions {
  /** 指定模型 ID */
  modelId?: string;
  /** 自定义系统提示词 */
  customSystemPrompt?: string;
  /** 当前索引 */
  currentIndex?: number;
  /** 总数 */
  totalCount?: number;
}

/**
 * Executor 阶段选项
 */
export interface CinematographerExecutorOptions {
  /** 指定视频生成模型 ID */
  videoModelId?: string;
  /** 临时目录 */
  tempDir?: string;
}

/**
 * 摄像师 Agent 选项
 */
export interface CinematographerAgentOptions {
  /** Planner 阶段选项 */
  planner?: CinematographerPlannerOptions;
  /** Executor 阶段选项 */
  executor?: CinematographerExecutorOptions;
  /** 是否使用多阶段模式 */
  useMultiStage?: boolean;
  /** 指定模型 ID（向后兼容） */
  modelId?: string;
  /** 自定义系统提示词（向后兼容） */
  customSystemPrompt?: string;
  /** 导演模式（不暂停） */
  directorMode?: boolean;
}

/**
 * 最终输出设置
 */
interface FinalOutputSettings {
  resolution: string;
  fps: number;
  codec: string;
}

/**
 * 渲染队列项（与 LLM 输出格式保持一致）
 */
interface RenderQueueItem {
  chunk_id: number;
  duration_seconds: number;
  start_frame?: number;
  end_frame?: number;
  first_frame_index?: number;
  last_frame_index?: number;
  video_generation_prompt: string;
  camera_movement?: string;
  transition_note?: string;
}

/**
 * 摄像师输出（旧格式兼容）
 */
interface LegacyCinematographerOutput {
  render_queue: RenderQueueItem[];
  total_duration_seconds: number;
  final_output_settings: FinalOutputSettings;
}

// ═══════════════════════════════════════════════════════════
// Planner 阶段（规划器）- 生成渲染计划
// ═══════════════════════════════════════════════════════════

/**
 * 构建 Planner 系统提示词
 */
function buildPlannerSystemPrompt(customSystemPrompt?: string): string {
  if (customSystemPrompt) {
    return customSystemPrompt;
  }
  return `你是视频合成与运镜调度员 Agent，专注于视频块的生成和运镜调度。

# 核心目标
1. 接收所有分镜组，克服视频大模型单次生成时长限制，进行合理的时间轴切片。
2. 为每一段切片编写包含摄像机运动（Camera Movements）的动态 Prompt。

# 处理规则
1. 智能切片逻辑：根据分镜输出提供的总组数 N 和预估时长，按剧情段落平滑切分视频块（Video Chunks）。如 20s = 10s + 10s，避免生硬的 15s + 5s 断崖切分。
2. 运镜赋予：为每一组视频块添加专业的镜头语言词汇（如：Slow motion, Whip pan, Zoom in, Tracking shot）。
3. 承接帧设定：强制规定每个 Chunk 的 first_frame_index 是该段视频的首帧（0-based，对应分镜帧数组下标），last_frame_index 是尾帧，Chunk 2 的首帧必须紧接 Chunk 1 的尾帧，以实现关键帧插值连贯。

# 视频生成规则
1. 确保每个视频块的时长合理（通常 5-15 秒）。
2. 为每个视频块提供清晰的运镜指令和动作描述。
3. 考虑视频块之间的转场效果（cut, crossfade, wipe, dissolve 等）。
4. 确保整体视频的叙事连贯性和视觉流畅性。

# 运镜词汇表
- 摇镜头：Pan left/right, Tilt up/down
- 推拉镜头：Zoom in/out, Dolly in/out
- 跟镜头：Tracking shot, Follow shot
- 移动镜头：Crane shot, Drone shot
- 特殊运动：Slow motion, Fast motion, Whip pan, Static shot

# 输出格式
请严格按以下 JSON 格式输出（不要使用 markdown 代码块包裹，直接输出 JSON 文本）：

{
  "workflowMode": "mode_a",
  "totalChunks": 2,
  "chunks": [
    {
      "chunkId": 1,
      "durationSeconds": 10,
      "startFrameIndex": 1,
      "endFrameIndex": 15,
      "firstFrameIndex": 0,
      "lastFrameIndex": 14,
      "cameraMovement": "Tracking shot from behind",
      "transitionNote": "crossfade",
      "promptContext": "Slow motion tracking shot of character walking through corridor, dramatic lighting, cinematic composition"
    }
  ],
  "modelSpecificNotes": "使用 Seedance 1.5 pro 模型，支持首帧图和音频生成"
}`;
}

/**
 * 构建 Planner 用户提示词
 */
function buildPlannerUserPrompt(
  input: CinematographerPlannerInput,
  currentIndex: number,
  totalCount: number
): string {
  const { storyboardOutput, videoSpec, modelCapabilities } = input;

  // 剥离 frames 中的 base64 字段，避免撑爆 LLM 上下文
  const storyboardOutputForLLM = {
    ...storyboardOutput,
    frames: (storyboardOutput.frames || []).map(({ base64: _b64, ...rest }) => rest),
  };

  const prompt = `请根据以下分镜输出和视频参数生成视频渲染计划：

# 分镜输出
${JSON.stringify(storyboardOutputForLLM, null, 2)}

# 视频规格
${JSON.stringify(videoSpec, null, 2)}

# 模型能力
${JSON.stringify(modelCapabilities, null, 2)}

请生成渲染计划（RenderPlan），包含：
1. 工作流模式（mode_a 或 mode_b）
2. 总块数（totalChunks）
3. 每个渲染块包含：chunkId, durationSeconds, startFrameIndex, endFrameIndex, firstFrameIndex（0-based）, lastFrameIndex（0-based）, cameraMovement, transitionNote, promptContext
4. 模型特定说明（modelSpecificNotes）`;

  // 添加生成进度信息
  return totalCount > 1
    ? `【生成进度】第 ${currentIndex}/${totalCount} 个\n\n${prompt}`
    : prompt;
}

/**
 * 验证渲染块数据
 */
function validateRenderChunk(chunk: any, index: number): RenderChunk {
  return {
    chunkId: Number(chunk.chunkId) || (index + 1),
    durationSeconds: Number(chunk.durationSeconds) || 5,
    startFrameIndex: Number(chunk.startFrameIndex) || 1,
    endFrameIndex: Number(chunk.endFrameIndex) || 1,
    firstFrameIndex: Number(chunk.firstFrameIndex) || 0,
    lastFrameIndex: Number(chunk.lastFrameIndex) || 0,
    cameraMovement: String(chunk.cameraMovement || '').trim() || 'Static shot',
    transitionNote: String(chunk.transitionNote || '').trim() || 'cut',
    promptContext: String(chunk.promptContext || '').trim(),
  };
}

/**
 * 解析 Planner LLM 输出
 */
function parsePlannerOutput(llmOutput: string): CinematographerPlannerOutput {
  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = llmOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : llmOutput.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    throw new Error('摄像师 Planner 阶段输出格式错误：无法解析 JSON');
  }

  // 验证必要字段
  if (!parsed.chunks || !Array.isArray(parsed.chunks)) {
    throw new Error('AI 输出缺少必要字段（chunks）');
  }

  // 验证每个渲染块
  const chunks = parsed.chunks.map((chunk: any, index: number) =>
    validateRenderChunk(chunk, index)
  );

  const renderPlan: RenderPlan = {
    workflowMode: parsed.workflowMode === 'mode_b' ? 'mode_b' : 'mode_a',
    totalChunks: Number(parsed.totalChunks) || chunks.length,
    chunks,
    modelSpecificNotes: String(parsed.modelSpecificNotes || '').trim(),
  };

  return {
    renderPlan,
    rawOutput: llmOutput,
  };
}

/**
 * 运行摄像师 Planner 阶段
 *
 * 职责：根据分镜输出和模型能力，生成视频渲染计划
 *
 * @param input - Planner 阶段输入
 * @param options - Planner 阶段选项
 * @param logger - 可选的日志输出函数
 * @returns Planner 阶段输出（渲染计划）
 */
export async function runCinematographerPlannerAgent(
  input: CinematographerPlannerInput,
  options: CinematographerPlannerOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CinematographerPlannerOutput> {
  const { customSystemPrompt, currentIndex = 1, totalCount = 1 } = options;
  const startTime = Date.now();

  // 获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  logger?.info('[摄像师-Planner] 开始执行', {
    aspectRatio: input.videoSpec.aspectRatio,
    duration: input.videoSpec.duration,
    provider: input.modelCapabilities.provider,
    currentIndex,
    totalCount,
  });

  // 构建提示词
  const systemPrompt = buildPlannerSystemPrompt(customSystemPrompt);
  const userPrompt = buildPlannerUserPrompt(input, currentIndex, totalCount);

  logger?.info('[摄像师-Planner] 提示词信息', {
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
  });

  // 调用 LLM 生成渲染计划
  logger?.info('[摄像师-Planner] 调用 LLM 生成渲染计划...');
  const textResult = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 4096,
  });

  logger?.info('[摄像师-Planner] LLM 响应接收完成', {
    contentLength: textResult.content.length,
    tokens: textResult.usage?.totalTokens,
  });

  // 解析 LLM 输出
  logger?.info('[摄像师-Planner] 解析渲染计划...');
  const parsedResult = parsePlannerOutput(textResult.content);

  const endTime = Date.now();
  logger?.info('[摄像师-Planner] 执行完成', {
    duration: endTime - startTime,
    chunkCount: parsedResult.renderPlan.chunks.length,
    workflowMode: parsedResult.renderPlan.workflowMode,
  });

  return parsedResult;
}

// ═══════════════════════════════════════════════════════════
// Executor 阶段（执行器）- 生成视频
// ═══════════════════════════════════════════════════════════

/**
 * 构建视频生成提示词
 */
function buildVideoPrompt(
  chunk: RenderChunk,
  provider: 'seedance' | 'kling' | 'other'
): string {
  const basePrompt = chunk.promptContext;

  // 根据提供商添加特定风格标签
  switch (provider) {
    case 'seedance':
      return `${basePrompt}, cinematic lighting, professional cinematography, high quality, smooth motion, no timecode, no subtitles`;
    case 'kling':
      return `${basePrompt}, dynamic action, smooth camera movement, professional video, high quality, no timecode, no subtitles`;
    default:
      return `${basePrompt}, high quality, no timecode, no subtitles`;
  }
}

/**
 * 使用 ffmpeg 拼接多个视频片段
 * 支持本地路径（直接使用）和远程 URL（自动下载）
 */
async function concatenateVideos(
  videoPaths: string[],
  tempDir: string,
  settings: FinalOutputSettings
): Promise<string> {
  console.log('[FFmpeg] 开始拼接视频片段:', videoPaths);

  // 1. 确保所有片段都是本地文件（远程 URL 需要先下载）
  const localVideoPaths: string[] = [];
  for (let i = 0; i < videoPaths.length; i++) {
    const input = videoPaths[i];
    if (input.startsWith('/') || input.startsWith('file://')) {
      // 已是本地路径，直接使用
      localVideoPaths.push(input);
      console.log(`[FFmpeg] 第 ${i + 1} 个片段已是本地文件: ${input}`);
    } else {
      // 远程 URL，下载到临时目录
      const localPath = path.join(tempDir, `segment_${i}.mp4`);
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        https.get(input, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
      });
      await fs.promises.writeFile(localPath, buffer);
      localVideoPaths.push(localPath);
      console.log(`[FFmpeg] 已下载第 ${i + 1} 个视频片段到: ${localPath}`);
    }
  }

  // 2. 创建 ffmpeg concat 文件列表
  const listFile = path.join(tempDir, 'files.txt');
  const fileListContent = localVideoPaths.map((p) => `file '${p}'`).join('\n');
  await fs.promises.writeFile(listFile, fileListContent);

  // 3. 生成最终视频文件名
  const finalVideoPath = path.join(tempDir, `final_${uuidv4()}.mp4`);

  // 4. 执行 ffmpeg concat 命令
  const ffmpegPath = '/opt/homebrew/bin/ffmpeg'; // macOS Homebrew ffmpeg 路径
  const ffmpegArgs = [
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    '-y', finalVideoPath,
  ];

  console.log('[FFmpeg] 执行拼接命令:', ffmpegArgs.join(' '));

  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let stderr = '';
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[FFmpeg] 视频拼接完成: ${finalVideoPath}`);
        resolve(finalVideoPath);
      } else {
        console.error(`[FFmpeg] 拼接失败，退出码: ${code}`);
        console.error(`[FFmpeg] stderr: ${stderr}`);
        reject(new Error(`ffmpeg 拼接失败，退出码: ${code}`));
      }
    });
  });
}

/**
 * 运行摄像师 Executor 阶段
 *
 * 职责：根据渲染计划生成视频片段，并拼接为最终视频
 *
 * @param input - Executor 阶段输入
 * @param options - Executor 阶段选项
 * @param logger - 可选的日志输出函数
 * @returns Executor 阶段输出（视频片段和最终视频）
 */
export async function runCinematographerExecutorAgent(
  input: CinematographerExecutorInput,
  options: CinematographerExecutorOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CinematographerExecutorOutput> {
  const { renderPlan, frameImages, modelConfig } = input;
  const { videoModelId, tempDir: customTempDir } = options;
  const startTime = Date.now();

  // 获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 检查视频生成能力
  if (!provider.generateVideo) {
    throw new Error('[摄像师-Executor] 提供商不支持视频生成');
  }

  logger?.info('[摄像师-Executor] 开始执行', {
    chunkCount: renderPlan.chunks.length,
    provider: modelConfig.provider,
    hasVideoModelId: !!videoModelId,
  });

  // 准备视频临时目录
  const tempDir = customTempDir || path.join(os.tmpdir(), `video_temp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  logger?.info('[摄像师-Executor] 临时目录:', { tempDir });

  // 生成视频片段
  const videoSegments: string[] = [];
  const localVideoSegments: string[] = [];
  let totalDuration = 0;

  for (const chunk of renderPlan.chunks) {
    const chunkStartTime = Date.now();

    // 获取首帧图（如果可用）
    const firstFrame = frameImages.find(
      (f) => f.frameNumber === chunk.firstFrameIndex + 1
    );
    const firstFrameImageUrl = firstFrame?.imageUrl;

    // 获取尾帧图（如果可用且模型支持）
    const lastFrame = frameImages.find(
      (f) => f.frameNumber === chunk.lastFrameIndex + 1
    );
    const lastFrameImageUrl = modelConfig.provider === 'seedance' ? lastFrame?.imageUrl : undefined;

    // 构建视频生成提示词
    const videoPrompt = buildVideoPrompt(chunk, modelConfig.provider);

    logger?.info(`[摄像师-Executor] 开始生成第 ${chunk.chunkId} 段视频`, {
      duration: chunk.durationSeconds,
      frames: `${chunk.startFrameIndex}-${chunk.endFrameIndex}`,
      firstFrameIndex: chunk.firstFrameIndex,
      hasFirstFrame: !!firstFrameImageUrl,
      hasLastFrame: !!lastFrameImageUrl,
      promptPreview: videoPrompt.substring(0, 150),
    });

    // 构建视频生成选项
    const videoOptions: VideoGenerationOptions = {
      duration: chunk.durationSeconds,
      aspectRatio: '16:9', // 默认值，实际应从输入获取
      generateAudio: modelConfig.generateAudio ?? true,
      // i2v 模式：首帧图
      ...(firstFrameImageUrl ? { firstFrameImageUrl } : {}),
      // 尾帧图（仅 Seedance 支持）
      ...(lastFrameImageUrl && modelConfig.provider === 'seedance'
        ? { referenceImageUrls: [lastFrameImageUrl] }
        : {}),
    };

    // 调用视频生成 API
    const videoResult = await provider.generateVideo(videoPrompt, videoOptions);

    if (!videoResult.videoUrl) {
      throw new Error(`第 ${chunk.chunkId} 段视频生成失败：未返回视频 URL`);
    }

    videoSegments.push(videoResult.videoUrl);
    totalDuration += chunk.durationSeconds;

    logger?.info(`[摄像师-Executor] 第 ${chunk.chunkId} 段视频生成完成`, {
      videoUrl: videoResult.videoUrl.substring(0, 100) + '...',
      duration: Date.now() - chunkStartTime,
    });

    // 下载视频到本地缓存
    try {
      const localVideoPath = await downloadToCache(videoResult.videoUrl, '.mp4');
      localVideoSegments.push(localVideoPath);
      logger?.info(`[摄像师-Executor] 第 ${chunk.chunkId} 段视频已下载到本地`, {
        localPath: localVideoPath,
      });
    } catch (downloadErr) {
      logger?.info(`[摄像师-Executor] 第 ${chunk.chunkId} 段视频下载失败，使用远程 URL`, {
        error: String(downloadErr),
      });
      localVideoSegments.push(videoResult.videoUrl);
    }
  }

  // 拼接视频片段
  let finalVideoUrl: string;
  let localFinalVideoPath: string | undefined;

  if (videoSegments.length === 1) {
    finalVideoUrl = videoSegments[0];
    localFinalVideoPath = localVideoSegments[0];
    logger?.info('[摄像师-Executor] 单段视频，无需拼接');
  } else if (videoSegments.length > 1) {
    logger?.info(`[摄像师-Executor] 开始拼接 ${videoSegments.length} 个视频片段`);

    // 优先使用本地缓存路径进行拼接
    const localPaths = localVideoSegments.filter((p) => p.startsWith('/'));
    const pathsToConcat =
      localPaths.length === localVideoSegments.length
        ? localPaths
        : videoSegments;

    const finalSettings: FinalOutputSettings = {
      resolution: '720p',
      fps: 24,
      codec: 'H.264',
    };

    localFinalVideoPath = await concatenateVideos(
      pathsToConcat,
      tempDir,
      finalSettings
    );
    finalVideoUrl = localFinalVideoPath;

    logger?.info(`[摄像师-Executor] 视频拼接完成`, {
      finalVideoPath: localFinalVideoPath,
    });
  } else {
    throw new Error('[摄像师-Executor] 没有生成任何视频片段');
  }

  const endTime = Date.now();
  logger?.info('[摄像师-Executor] 执行完成', {
    totalDuration: endTime - startTime,
    videoSegments: videoSegments.length,
    finalVideoDuration: totalDuration,
  });

  return {
    videoSegments,
    localVideoSegments,
    totalDuration,
    finalVideoUrl,
    localFinalVideoPath,
  };
}

// ═══════════════════════════════════════════════════════════
// 主函数（组合两个阶段 + 单阶段兼容模式）
// ═══════════════════════════════════════════════════════════

/**
 * 解析旧格式摄像师输出
 */
function parseLegacyCinematographerOutput(llmOutput: string): LegacyCinematographerOutput {
  let parsed: unknown;

  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // 尝试直接解析整个输出
      parsed = JSON.parse(llmOutput);
    }
  } catch (error) {
    console.warn('[摄像师] JSON 解析失败，返回原始输出');
    throw new Error('摄像师输出格式错误：无法解析 JSON');
  }

  return parsed as LegacyCinematographerOutput;
}

/**
 * 将旧格式渲染队列转换为 RenderPlan
 */
function convertLegacyToRenderPlan(legacy: LegacyCinematographerOutput): RenderPlan {
  const chunks: RenderChunk[] = (legacy.render_queue || []).map((item) => ({
    chunkId: item.chunk_id,
    durationSeconds: item.duration_seconds,
    startFrameIndex: item.start_frame || 1,
    endFrameIndex: item.end_frame || 1,
    firstFrameIndex: item.first_frame_index ?? 0,
    lastFrameIndex: item.last_frame_index ?? 0,
    cameraMovement: item.camera_movement || 'Static shot',
    transitionNote: item.transition_note || 'cut',
    promptContext: item.video_generation_prompt || '',
  }));

  return {
    workflowMode: 'mode_a',
    totalChunks: chunks.length,
    chunks,
    modelSpecificNotes: '从旧格式转换',
  };
}

/**
 * 运行完整的摄像师 Agent
 *
 * 调用流程（多阶段模式，useMultiStage=true）：
 * 1. Planner 阶段：调用 LLM 生成渲染计划（RenderPlan）
 * 2. Executor 阶段：调用视频生成 API 生成视频片段并拼接
 * 3. 返回完整结果
 *
 * 调用流程（单阶段模式，默认）：
 * 1. 使用旧版 CinematographerAgentPrompts 生成视频合成计划
 * 2. 直接生成视频片段
 * 3. 返回结果（向后兼容）
 *
 * @param storyboardOutput - 分镜输出
 * @param videoSpec - 视频规格
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的视频结果
 */
export async function runCinematographerAgent(
  storyboardOutput: StoryboardOutput,
  videoSpec: VideoSpec,
  options: CinematographerAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CinematographerResult> {
  const startTime = Date.now();
  const { useMultiStage = false, planner, executor, directorMode = true } = options;

  // 多阶段模式
  if (useMultiStage) {
    logger?.info('[摄像师 Agent] 使用多阶段模式（Planner + Executor）');

    // 准备模型能力配置（默认值）
    const modelCapabilities: ModelCapabilities = {
      supportsFirstFrame: true,
      supportsLastFrame: false,
      maxDuration: 15,
      supportedAspectRatios: ['16:9', '9:16'],
      provider: 'seedance',
    };

    // Stage 1: Planner 阶段
    logger?.info('[摄像师 Agent] ========== Stage 1: Planner ==========');
    const plannerInput: CinematographerPlannerInput = {
      storyboardOutput,
      videoSpec,
      modelCapabilities,
    };
    const plannerOptions: CinematographerPlannerOptions = {
      modelId: planner?.modelId ?? options.modelId,
      customSystemPrompt: planner?.customSystemPrompt ?? options.customSystemPrompt,
      currentIndex: planner?.currentIndex ?? 1,
      totalCount: planner?.totalCount ?? 1,
    };
    const plannerResult = await runCinematographerPlannerAgent(
      plannerInput,
      plannerOptions,
      logger
    );

    // Stage 2: Executor 阶段
    logger?.info('[摄像师 Agent] ========== Stage 2: Executor ==========');

    // 构建帧图像数组
    const frameImages: FrameImage[] = (storyboardOutput.frames || []).map((frame) => ({
      frameNumber: frame.frameNumber,
      imageUrl: frame.base64 || storyboardOutput.imageUrl || '',
      description: frame.description,
    }));

    const modelConfig: ModelConfig = {
      provider: 'seedance',
      generateAudio: true,
    };

    const executorInput: CinematographerExecutorInput = {
      renderPlan: plannerResult.renderPlan,
      frameImages,
      modelConfig,
    };
    const executorOptions: CinematographerExecutorOptions = {
      videoModelId: executor?.videoModelId,
      tempDir: executor?.tempDir,
    };
    const executorResult = await runCinematographerExecutorAgent(
      executorInput,
      executorOptions,
      logger
    );

    const endTime = Date.now();
    logger?.info('[摄像师 Agent] 多阶段执行完成', {
      totalDuration: endTime - startTime,
      videoChunks: executorResult.videoSegments.length,
      finalVideoDuration: executorResult.totalDuration,
    });

    return {
      videoUrl: executorResult.finalVideoUrl,
      localVideoPath: executorResult.localFinalVideoPath,
      videoSegments: executorResult.videoSegments,
      localVideoSegments: executorResult.localVideoSegments,
      totalDuration: executorResult.totalDuration,
      videoChunks: executorResult.videoSegments.length,
      renderPlan: plannerResult.renderPlan,
      stageResults: {
        planner: plannerResult,
        executor: executorResult,
      },
    };
  }

  // 单阶段模式（向后兼容）
  logger?.info('[摄像师 Agent] 使用单阶段模式（向后兼容）');

  // 获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 检查视频生成能力
  if (!provider.generateVideo) {
    throw new Error('[摄像师 Agent] 提供商不支持视频生成');
  }

  // 使用旧版提示词生成视频合成计划
  const systemPrompt = CinematographerAgentPrompts.buildSystemPrompt();

  // 剥离 frames 中的 base64 字段
  const storyboardOutputForLLM = {
    ...storyboardOutput,
    frames: (storyboardOutput.frames || []).map(({ base64: _b64, ...rest }) => rest),
  };

  const userPrompt = CinematographerAgentPrompts.buildUserPrompt(
    storyboardOutputForLLM,
    {
      duration: videoSpec.duration,
      aspectRatio: videoSpec.aspectRatio,
    },
    []
  );

  logger?.info('[摄像师 Agent] 调用 LLM 生成视频合成计划...');
  const textResult = await provider.generateText(userPrompt, {
    systemPrompt,
    temperature: 0.7,
    maxTokens: 4096,
  });

  // 解析输出
  logger?.info('[摄像师 Agent] 解析 LLM 输出...');
  const legacyOutput = parseLegacyCinematographerOutput(textResult.content);
  const renderPlan = convertLegacyToRenderPlan(legacyOutput);

  logger?.info(`[摄像师 Agent] 成功生成视频合成计划，共 ${renderPlan.chunks.length} 个渲染任务`);

  // 准备视频临时目录
  const tempDir = path.join(os.tmpdir(), `video_temp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // 生成视频片段
  const videoSegments: string[] = [];
  const localVideoSegments: string[] = [];
  const storyboardFrames = storyboardOutput.frames || [];

  for (const renderTask of renderPlan.chunks) {
    // 提取该视频块对应的分镜帧描述
    const startFrame = renderTask.startFrameIndex;
    const endFrame = renderTask.endFrameIndex;
    const relevantFrameDescriptions = storyboardFrames
      .filter((f) => f.frameNumber >= startFrame && f.frameNumber <= endFrame)
      .map((f) => `Frame ${f.frameNumber}: ${f.description}`)
      .join('; ');

    // 从 firstFrameIndex 取对应帧的 base64 作为 i2v 首帧参考图
    const firstFrameIdx = renderTask.firstFrameIndex;
    const firstFrameBase64: string | undefined = storyboardFrames[firstFrameIdx]?.base64;
    const storyboardImageUrl: string | undefined = storyboardOutput.imageUrl;

    // 构建最终提示词
    const sceneContext = relevantFrameDescriptions
      ? ` | Scene context: ${relevantFrameDescriptions}`
      : '';
    const fullPrompt = `${renderTask.promptContext}${sceneContext}`;

    logger?.info(`[摄像师 Agent] 开始生成第 ${renderTask.chunkId} 段视频`, {
      duration: renderTask.durationSeconds,
      frames: `${startFrame}-${endFrame}`,
      firstFrameIndex: firstFrameIdx,
      promptPreview: fullPrompt.substring(0, 150),
    });

    // 构建视频生成选项
    const videoOptions: VideoGenerationOptions = {
      duration: renderTask.durationSeconds,
      aspectRatio: videoSpec.aspectRatio || '16:9',
      generateAudio: true,
      // i2v 模式：分镜首帧作为视频首帧
      ...(firstFrameBase64
        ? { firstFrameImageUrl: firstFrameBase64 }
        : storyboardImageUrl
          ? { firstFrameImageUrl: storyboardImageUrl }
          : {}),
    };

    const videoResult = await provider.generateVideo(fullPrompt, videoOptions);

    if (!videoResult.videoUrl) {
      throw new Error(`第 ${renderTask.chunkId} 段视频生成失败：未返回视频 URL`);
    }

    videoSegments.push(videoResult.videoUrl);
    logger?.info(`[摄像师 Agent] 第 ${renderTask.chunkId} 段视频生成完成: ${videoResult.videoUrl}`);

    // 下载视频到本地缓存
    try {
      const localVideoPath = await downloadToCache(videoResult.videoUrl, '.mp4');
      localVideoSegments.push(localVideoPath);
      logger?.info(`[摄像师 Agent] 第 ${renderTask.chunkId} 段视频已下载到本地: ${localVideoPath}`);
    } catch (downloadErr) {
      logger?.info(`[摄像师 Agent] 第 ${renderTask.chunkId} 段视频下载失败，使用远程 URL`, {
        error: String(downloadErr),
      });
      localVideoSegments.push(videoResult.videoUrl);
    }
  }

  // 拼接视频片段
  let finalVideoUrl: string;
  let localVideoPath: string | undefined;

  if (videoSegments.length === 1) {
    finalVideoUrl = videoSegments[0];
    localVideoPath = localVideoSegments[0];
    logger?.info('[摄像师 Agent] 单段视频，无需拼接');
  } else if (videoSegments.length > 1) {
    logger?.info(`[摄像师 Agent] 开始拼接 ${videoSegments.length} 个视频片段`);

    const localPaths = localVideoSegments.filter((p) => p.startsWith('/'));
    const pathsToConcat =
      localPaths.length === localVideoSegments.length ? localPaths : videoSegments;

    const finalSettings: FinalOutputSettings = {
      resolution: '720p',
      fps: 24,
      codec: 'H.264',
    };

    localVideoPath = await concatenateVideos(pathsToConcat, tempDir, finalSettings);
    finalVideoUrl = localVideoPath;

    logger?.info(`[摄像师 Agent] 视频拼接完成: ${localVideoPath}`);
  } else {
    throw new Error('[摄像师 Agent] 没有生成任何视频片段');
  }

  const endTime = Date.now();
  logger?.info(`[摄像师 Agent] 完成，耗时 ${endTime - startTime}ms`);

  return {
    videoUrl: finalVideoUrl,
    localVideoPath,
    videoSegments,
    localVideoSegments,
    totalDuration: legacyOutput.total_duration_seconds,
    videoChunks: videoSegments.length,
    renderPlan,
  };
}

// 默认导出
export default runCinematographerAgent;
