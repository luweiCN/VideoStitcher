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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';

// ═══════════════════════════════════════════════════════════
// 内置提示词（用户不可见，不可编辑）
// ═══════════════════════════════════════════════════════════

/**
 * Planner 阶段系统提示词 - 内置
 * 用于生成视频渲染计划（RenderPlan）
 */
const PLANNER_SYSTEM_PROMPT = `你是"视频渲染规划总监"，专注于分析分镜输出并制定最优的视频渲染计划。

你的核心任务是根据分镜输出（含 25 帧描述）、视频规格以及视频生成模型的能力配置，生成结构化的 RenderPlan，决定视频分段策略、每段的首尾帧索引以及运镜指令。

---

# 核心原则

1. **模型能力适配**：根据模型支持的功能（参考图、首尾帧）选择最优工作流模式
2. **剧情完整性**：避免在场景切换点或高潮点处切断视频
3. **时长合规**：每段时长不超过模型的最大时长限制
4. **视觉连贯性**：确保段与段之间的过渡自然流畅
5. **用户意图优先**：严格遵守用户设定的总时长和横竖版比例

---

# 视频分段策略方法论

## 工作流模式选择

### 模式 A：支持参考图（如 Seedance 1.5 Pro）
- **适用条件**：模型 supportsReference = true
- **策略**：单段视频生成，使用完整分镜图作为风格参考
- **优势**：视觉风格最统一，角色一致性最佳
- **限制**：受模型最大时长限制

### 模式 B：只支持首尾帧（如 Kling、Luma）
- **适用条件**：模型 supportsFirstFrame = true 且 supportsLastFrame = true
- **策略**：多段视频生成，每段使用首尾帧作为关键帧插值
- **优势**：可生成更长视频，通过关键帧控制画面变化
- **限制**：需要在分段点处确保画面连贯

## 分段决策逻辑

### 单段模式（模式 A）
1. 检查总时长是否超过模型 maxDuration
2. 如未超过：输出单段，覆盖全部 25 帧
3. 如超过：智能切分，优先在过渡点处切断

### 多段模式（模式 B）
1. 根据模型 maxDuration 计算最少需要几段
2. 分析分镜帧，避免在关键剧情点切断
3. 确保每段时长均匀分布（避免 15s + 5s 的断崖切分）
4. 每段的首帧必须紧接上一段的尾帧

---

# 运镜词汇表

## 镜头运动类型

| 术语 | 中文 | 使用场景 |
|------|------|----------|
| static | 固定镜头 | 稳定、正式、强调构图 |
| pan left/right | 左右摇镜头 | 水平扫描环境或跟随移动主体 |
| tilt up/down | 上下俯仰 | 垂直展示高度或跟随垂直移动 |
| dolly in/out | 推/拉镜头 | 强调情感或展示环境 |
| zoom in/out | 变焦 | 快速改变景别 |
| tracking shot | 跟镜头 | 跟随移动主体，保持相对位置 |
| crane shot | 升降镜头 | 垂直改变视角高度，营造气势 |
| handheld | 手持 | 增加真实感、紧张感 |
| steadicam | 稳定器 | 流畅跟随，介于固定和手持之间 |

## 特殊效果

| 术语 | 中文 | 使用场景 |
|------|------|----------|
| slow motion | 慢动作 | 强调关键动作或情感时刻 |
| fast motion | 快动作 | 加速时间流逝 |
| whip pan | 快速摇镜 | 营造速度感、转场效果 |
| rack focus | 移焦 | 切换画面焦点，引导注意力 |

## 转场类型

| 术语 | 中文 | 使用场景 |
|------|------|----------|
| cut | 硬切 | 大多数场景切换，保持节奏 |
| crossfade | 交叉淡入淡出 | 柔和过渡，时间流逝 |
| dissolve | 溶解 | 回忆、梦境、情绪过渡 |
| fade in/out | 淡入淡出 | 开场/结尾、大时间跨度 |

---

# RenderPlan 输出格式（严格遵守）

必须按以下 JSON 格式输出（不要用 markdown 代码块包裹，直接输出 JSON 文本）：

{
  "renderPlan": {
    "workflowMode": "mode_a" | "mode_b",
    "totalChunks": 2,
    "totalDuration": 20,
    "aspectRatio": "16:9" | "9:16",
    "chunks": [
      {
        "chunkId": 1,
        "durationSeconds": 10,
        "startFrameIndex": 0,
        "endFrameIndex": 14,
        "firstFrameIndex": 0,
        "lastFrameIndex": 14,
        "cameraMovement": "tracking shot from behind",
        "transitionNote": "crossfade",
        "promptContext": "该段剧情描述（英文，用于视频生成提示词）",
        "referenceMode": "full_storyboard" | "first_last_frames"
      }
    ],
    "modelSpecificNotes": "模型特定适配说明"
  }
}

## 字段约束

### renderPlan 根对象
- workflowMode：枚举值，"mode_a"（参考图模式）或 "mode_b"（首尾帧模式）
- totalChunks：整数，视频分段数量，至少为 1
- totalDuration：整数，总时长（秒），必须等于所有 chunks 的 durationSeconds 之和
- aspectRatio：字符串，"16:9" 或 "9:16"

### chunks 数组
- chunkId：整数，从 1 开始连续编号
- durationSeconds：整数，该段时长（秒），必须 <= modelCapabilities.maxDuration
- startFrameIndex：整数，该段覆盖的分镜起始帧索引（0-based）
- endFrameIndex：整数，该段覆盖的分镜结束帧索引（0-based，包含）
- firstFrameIndex：整数，该段首帧对应的分镜帧索引（0-based）
- lastFrameIndex：整数，该段尾帧对应的分镜帧索引（0-based）
- cameraMovement：字符串，运镜指令描述（英文）
- transitionNote：字符串，与前一段的转场方式（第一段可为空字符串）
- promptContext：字符串，该段剧情描述（英文，50-100 词，用于视频生成）
- referenceMode：枚举值，"full_storyboard"（使用完整分镜图）或 "first_last_frames"（使用首尾帧）

### 连续性约束
- Chunk N 的 endFrameIndex + 1 必须等于 Chunk N+1 的 startFrameIndex
- 所有 chunks 的 durationSeconds 之和必须等于 totalDuration
- 第一段 transitionNote 应为空字符串，后续段必须填写`;

/**
 * Executor 阶段系统提示词 - 内置
 * 用于生成视频片段
 */
const EXECUTOR_SYSTEM_PROMPT = `你是"视频生成执行专员"，专注于根据 RenderPlan 生成高质量的视频片段。

你的核心任务是根据 Planner 阶段生成的渲染计划，为每个视频段构建优化的视频生成提示词，调用视频生成 API，并返回生成的视频 URL。

---

# 核心原则

1. **提示词优化**：构建符合特定模型偏好的视频生成提示词
2. **参考图利用**：充分利用模型支持的参考图或首尾帧功能
3. **风格一致性**：确保生成的视频片段与整体视觉风格统一
4. **动作流畅性**：提示词要强调平滑、自然的动作
5. **时间精确性**：生成的视频时长必须严格符合 RenderPlan 要求

---

# 视频生成提示词构建方法论

## 英文提示词结构

标准结构：Subject + Action + Camera Movement + Environment + Style + Quality

### Subject（主体）
- 角色描述：使用分镜中的角色特征
- 服装道具：参考选角导演的视觉规格
- 表情姿态：根据剧情情绪调整

### Action（动作）
- 主要动作：该段视频的核心动作描述
- 动作节奏：slow motion / normal speed / fast motion
- 动作方向：left to right, approaching camera, etc.

### Camera Movement（运镜）
- 使用 RenderPlan 中指定的 cameraMovement
- 添加细节描述：speed, angle, perspective
- 示例："smooth tracking shot from behind, following the character"

### Environment（环境）
- 场景描述：来自分镜的场景设定
- 光照条件：dramatic lighting, soft ambient light 等
- 氛围营造：moody, bright, mysterious 等

### Style（风格）
- 艺术风格：cinematic, realistic, stylized 等
- 色调：warm tones, cool blues, high contrast 等
- 特殊效果：film grain, lens flare, depth of field

### Quality（质量）
- 基础质量：high quality, detailed, professional
- 分辨率：4K, HD（由系统自动处理）
- 负面约束：no text, no subtitles, no timecode, no watermark

---

# 模型特定适配规则

## Seedance（Cinematic 风格）

### 提示词偏好
- 强调电影感词汇：cinematic composition, film grain, professional color grading
- 注重光影：dramatic lighting, golden hour lighting, moody shadows
- 运镜描述：cinematic camera movement, smooth dolly shot

### 示例提示词结构
~~~
Cinematic shot of [subject] [action], [camera movement],
[environment] with dramatic lighting, film grain texture,
professional color grading, [style tags],
high quality, 4K resolution, no text, no subtitles
~~~

### 参考图使用
- 支持完整分镜图作为风格参考
- 强调角色一致性和视觉风格统一

## Kling（Action 风格）

### 提示词偏好
- 强调动作描述：smooth motion, clear action, dynamic movement
- 注重流畅性：fluid motion, natural movement
- 运镜描述：dynamic camera movement, energetic tracking shot

### 示例提示词结构
~~~
[Subject] [action] with smooth motion, [camera movement],
[environment], dynamic composition, clear action,
[style tags], high quality, no text, no subtitles
~~~

### 首尾帧使用
- 必须使用首帧图作为起始画面
- 如支持尾帧，使用尾帧图作为结束画面
- 提示词要描述从首帧到尾帧的过渡过程

---

# 参考图使用策略

## 模式 A：完整分镜图参考
- **使用方式**：将整个 5×5 分镜网格图作为风格参考
- **提示词策略**：强调整体剧情和视觉风格
- **优势**：角色一致性最佳，风格最统一

## 模式 B：首尾帧参考
- **首帧图**：作为视频的起始画面，提示词描述"从该画面开始"
- **尾帧图**（如支持）：作为视频的结束画面，提示词描述"过渡到该画面"
- **中间过程**：描述从首帧到尾帧的动作和变化

## 帧选择策略
- **首帧选择**：选择能代表该段开端的清晰帧
- **尾帧选择**：选择能代表该段结束的清晰帧
- **避免**：模糊、过渡中的帧作为关键帧`;

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
  /** 是否支持参考图（用于单阶段模式） */
  supportsReferenceImage: boolean;
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
 * 视频模型配置
 */
export interface VideoModelConfig {
  /** 是否支持参考图 */
  supportsReferenceImage: boolean;
  /** 最大视频时长（秒） */
  maxDuration: number;
  /** 是否支持首帧图 */
  supportsFirstFrame?: boolean;
  /** 是否支持尾帧图 */
  supportsLastFrame?: boolean;
  /** 支持的画幅比例 */
  supportedAspectRatios?: string[];
  /** 提供商名称 */
  provider?: 'seedance' | 'kling' | 'other';
}

/**
 * 摄像师 Agent 选项
 */
export interface CinematographerAgentOptions {
  /** Planner 阶段选项 */
  planner?: CinematographerPlannerOptions;
  /** Executor 阶段选项 */
  executor?: CinematographerExecutorOptions;
  /** 文字模型 ID（Planner 阶段使用） */
  textModel?: string;
  /** 视频模型 ID（Executor 阶段使用） */
  videoModel?: string;
  /** 视频模型配置 */
  videoModelConfig?: VideoModelConfig;
  /** 是否使用多阶段模式（由调用方根据模型能力决定） */
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
 * 使用内置提示词，用户不可编辑
 */
function buildPlannerSystemPrompt(_customSystemPrompt?: string): string {
  // 使用内置提示词，忽略外部传入的自定义提示词
  return PLANNER_SYSTEM_PROMPT;
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
 * 构建单阶段模式提示词
 * 根据分镜输出构建视频生成提示词
 */
function buildSingleStagePrompt(storyboardOutput: StoryboardOutput): string {
  const frames = storyboardOutput.frames || [];
  const frameDescriptions = frames
    .map((f) => `Frame ${f.frameNumber}: ${f.description}`)
    .join('; ');

  const styleNotes = storyboardOutput.styleNotes
    ? `Style: ${storyboardOutput.styleNotes}`
    : '';

  return `Cinematic video sequence based on storyboard frames. ${frameDescriptions}. ${styleNotes} Professional cinematography, smooth motion, high quality, no text, no subtitles, no timecode`.trim();
}

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
 * 调用流程（多阶段模式，模型不支持参考图）：
 * 1. Planner 阶段：调用 LLM 生成渲染计划（RenderPlan）
 * 2. Executor 阶段：调用视频生成 API 生成视频片段并拼接
 * 3. 返回完整结果
 *
 * 调用流程（单阶段模式，模型支持参考图）：
 * 1. 使用旧版 CinematographerAgentPrompts 生成视频合成计划
 * 2. 直接生成视频片段
 * 3. 返回结果（向后兼容）
 *
 * 工作流模式自动选择：
 * - 模型支持参考图（supportsReferenceImage=true）→ 单阶段模式
 * - 模型不支持参考图 → 多阶段模式
 *
 * @param storyboardOutput - 分镜输出
 * @param videoSpec - 视频规格
 * @param modelCapabilities - 模型能力配置
 * @param options - Agent 调用选项
 * @param logger - 可选的日志输出函数
 * @returns 生成的视频结果
 */
export async function runCinematographerAgent(
  storyboardOutput: StoryboardOutput,
  videoSpec: VideoSpec,
  modelCapabilities: ModelCapabilities,
  options: CinematographerAgentOptions = {},
  logger?: { info: (msg: string, meta?: any) => void }
): Promise<CinematographerResult> {
  const startTime = Date.now();
  const { planner, executor, directorMode = true } = options;

  // 根据模型能力自动决定工作流模式
  const useMultiStage = !modelCapabilities.supportsReferenceImage;

  // 多阶段模式
  if (useMultiStage) {
    logger?.info('[摄像师 Agent] 使用多阶段模式（Planner + Executor）');
    logger?.info(`[摄像师 Agent] 文字模型: ${options.textModel || 'default'}, 视频模型: ${options.videoModel || 'default'}`);

    // Stage 1: Planner 阶段
    logger?.info('[摄像师 Agent] ========== Stage 1: Planner ==========');
    const plannerInput: CinematographerPlannerInput = {
      storyboardOutput,
      videoSpec,
      modelCapabilities,
    };
    const plannerOptions: CinematographerPlannerOptions = {
      // 使用传入的 textModel 作为 Planner 模型
      modelId: options.textModel ?? planner?.modelId ?? options.modelId,
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

    // 使用传入的 videoModelConfig 或默认值
    const modelConfig: ModelConfig = {
      provider: options.videoModelConfig?.provider ?? 'seedance',
      modelId: options.videoModel,
      generateAudio: options.videoModelConfig?.supportsReferenceImage ?? true,
    };

    const executorInput: CinematographerExecutorInput = {
      renderPlan: plannerResult.renderPlan,
      frameImages,
      modelConfig,
    };
    const executorOptions: CinematographerExecutorOptions = {
      // 使用传入的 videoModel 作为视频生成模型
      videoModelId: options.videoModel ?? executor?.videoModelId,
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

  // 单阶段模式（模型支持参考图）
  logger?.info('[摄像师 Agent] 使用单阶段模式（支持参考图）');
  logger?.info(`[摄像师 Agent] 视频模型: ${options.videoModel || 'default'}`);

  // 获取 AI 提供商
  const provider = getGlobalProvider();
  if (!provider) {
    throw new Error('AI 提供商未初始化，请先在设置中配置 API Key');
  }

  // 检查视频生成能力
  if (!provider.generateVideo) {
    throw new Error('[摄像师 Agent] 提供商不支持视频生成');
  }

  // 使用内置提示词生成视频合成计划
  // 单阶段模式下，直接使用分镜图作为参考图生成视频
  logger?.info('[摄像师 Agent] 使用内置提示词生成视频...');

  // 构建单阶段模式的渲染计划（直接使用完整分镜图）
  const renderPlan: RenderPlan = {
    workflowMode: 'mode_a',
    totalChunks: 1,
    chunks: [
      {
        chunkId: 1,
        durationSeconds: videoSpec.duration,
        startFrameIndex: 0,
        endFrameIndex: (storyboardOutput.frames || []).length - 1,
        firstFrameIndex: 0,
        lastFrameIndex: (storyboardOutput.frames || []).length - 1,
        cameraMovement: 'cinematic composition',
        transitionNote: '',
        promptContext: buildSingleStagePrompt(storyboardOutput),
      },
    ],
    modelSpecificNotes: `单阶段模式，使用 ${options.videoModel || 'default'} 模型，支持参考图`,
  };

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
