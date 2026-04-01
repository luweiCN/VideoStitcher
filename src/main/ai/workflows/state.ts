/**
 * LangGraph 工作流状态定义
 *
 * 定义 AI 视频生成工作流的状态结构,
 * 用于 5 个 Agent 节点之间的数据共享和流程控制
 */

import type { BaseMessage } from '@langchain/core/messages';
import type { Script, CreativeDirection, Persona, Project } from '@shared/types/aside';

// ==================== 工作流配置类型 ====================

/**
 * 工作流执行模式
 * - fast: 快速生成（全自动，无需人工干预）
 * - director: 导演模式（每步需人工确认）
 */
export type ExecutionMode = 'fast' | 'director';

/**
 * 视频规格
 */
export interface VideoSpec {
  /** 视频时长类型 */
  duration: 'short' | 'long'; // 短视频（<15s）或长视频（>15s）
  /** 视频宽高比 */
  aspectRatio: '16:9' | '9:16'; // 横版或竖版
}

// ==================== Agent 输出类型 ====================

/**
 * 人物卡片
 * 选角导演 Agent 的输出
 */
export interface CharacterCard {
  /** 角色 ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 角色图片 URL（概念图） */
  imageUrl: string;
  /** 角色特征标签（可选） */
  traits?: string[];
  /** 是否为用户上传（可选） */
  isUserUploaded?: boolean;
}

/**
 * 分镜帧
 * 分镜师 Agent 的输出
 */
export interface StoryboardFrame {
  /** 帧 ID */
  id: string;
  /** 帧序号 */
  frameNumber: number;
  /** 帧描述 */
  description: string;
  /** 帧图片 URL */
  imageUrl: string;
  /** 时长(秒) */
  duration: number;
  /** 是否为关键帧（可选） */
  isKeyFrame?: boolean;
  /** 镜头运动（可选） */
  cameraMovement?: string;
}

/**
 * 视频输出
 * 摄像导演 Agent 的输出
 */
export interface VideoOutput {
  /** 视频 URL */
  videoUrl: string;
  /** 视频时长(秒) */
  duration: number;
  /** 视频分辨率 */
  resolution: string;
  /** 缩略图 URL（可选） */
  thumbnailUrl?: string;
}

/**
 * 步骤输出包装器
 * 包装每个步骤的输出内容和元数据
 */
export interface StepOutput<T> {
  /** 步骤输出内容 */
  content: T;
  /** 步骤元数据 */
  metadata: {
    /** 执行时间戳 */
    timestamp: number;
    /** 执行时长(毫秒) */
    duration: number;
    /** 使用的模型（可选） */
    model?: string;
    /** Token 数量（可选） */
    tokens?: number;
  };
}

// ==================== 工作流状态 ====================

/**
 * 工作流状态
 * 在所有 Agent 节点之间共享
 */
export interface WorkflowState {
  // ===== 输入参数 =====
  /** 脚本内容（用户输入或从待产库加载） */
  scriptContent: string;
  /** 项目 ID */
  projectId: string;

  // ===== 执行配置 =====
  /** 执行模式：快速生成（自动）或导演模式（手动确认） */
  executionMode: ExecutionMode;
  /** 视频规格 */
  videoSpec: VideoSpec;

  // ===== Agent 输出（5 个步骤）=====

  /** Agent 1: 剧本写作输出 */
  step1_script?: StepOutput<any>;

  /** Agent 2: 艺术总监输出（角色和场景） */
  step2_characters?: StepOutput<any>;

  /** Agent 3: 选角导演输出（人物图像提示词） */
  step3_storyboard?: StepOutput<any>;

  /** Agent 4: 分镜师输出 */
  step4_video?: StepOutput<any>;

  /** Agent 5: 摄像师输出（视频合成计划） */
  step5_final?: StepOutput<any>;

  // ===== 控制状态 =====
  /** 当前步骤（1-5） */
  currentStep: number;
  /** 是否需要人工确认（导演模式） */
  humanApproval: boolean;
  /** 用户修改记录 */
  userModifications: {
    /** 步骤 1 是否被修改 */
    step1_modified?: boolean;
    /** 步骤 1 修改内容（可选） */
    step1_payload?: unknown;
    /** 步骤 2 是否被修改 */
    step2_modified?: boolean;
    /** 步骤 2 修改内容（可选） */
    step2_payload?: unknown;
    /** 步骤 3 是否被修改 */
    step3_modified?: boolean;
    /** 步骤 3 修改内容（可选） */
    step3_payload?: unknown;
    /** 步骤 4 是否被修改 */
    step4_modified?: boolean;
    /** 步骤 4 修改内容（可选） */
    step4_payload?: unknown;
    /** 步骤 5 是否被修改 */
    step5_modified?: boolean;
    /** 步骤 5 修改内容（可选） */
    step5_payload?: unknown;
  };
  /** 是否需要重新生成当前步骤 */
  needsRegeneration: boolean;

  // ===== 上下文信息 =====
  /** 项目信息 */
  project?: Project;
  /** 创意方向 */
  creativeDirection?: CreativeDirection;
  /** 人设 */
  persona?: Persona;
  /** 目标地区 */
  region?: string;

  // ===== Agent 配置选项 =====
  /** 选角导演 Agent 配置选项 */
  castingDirectorOptions?: {
    /** 是否使用多阶段模式（Planner + Visualizer），默认 false 保持向后兼容 */
    useMultiStage?: boolean;
    /** Planner 阶段模型 ID */
    plannerModelId?: string;
    /** Visualizer 阶段图像生成模型 ID */
    visualizerModelId?: string;
  };

  /** 摄像师 Agent 配置选项（双模型选择） */
  cinematographerOptions?: {
    /** Planner 使用的文字模型 ID */
    textModel?: string;
    /** 视频生成模型 ID */
    videoModel: string;
    /** 视频模型配置 */
    videoModelConfig?: {
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
    };
  };

  /** 模型能力配置（用于摄像师 Agent 自动选择工作流模式，向后兼容） */
  modelCapabilities?: {
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
  };

  /** Agent 模型分配（向后兼容） */
  agentModelAssignments?: Record<string, string>;

  // ===== 消息历史 =====
  /** LangChain 消息历史（用于 LLM 上下文） */
  messages: BaseMessage[];

  // ===== 错误处理 =====
  /** 错误信息（可选） */
  error?: {
    /** 发生错误的步骤 */
    step: number;
    /** 错误消息 */
    message: string;
    /** 重试次数 */
    retryCount: number;
  };
}

// ==================== 工作流步骤定义 ====================

/**
 * 工作流步骤配置
 */
export interface WorkflowStep {
  /** 步骤 ID */
  id: number;
  /** 步骤名称 */
  name: string;
  /** 步骤标签（中文） */
  label: string;
  /** 步骤描述 */
  description: string;
}

/**
 * 工作流步骤列表
 */
export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    id: 1,
    name: 'screenplay',
    label: '剧本写作',
    description: '根据项目、创意方向、人设和地区生成剧本',
  },
  {
    id: 2,
    name: 'art_director',
    label: '艺术总监',
    description: '提炼剧本精华、创作角色和场景',
  },
  {
    id: 3,
    name: 'casting_director',
    label: '选角导演',
    description: '为角色生成人物图像提示词',
  },
  {
    id: 4,
    name: 'storyboard_artist',
    label: '分镜设计',
    description: '根据人物图和剧本生成分镜图',
  },
  {
    id: 5,
    name: 'cinematographer',
    label: '摄像师',
    description: '生成视频合成计划',
  },
] as const;

/**
 * 工作流总步骤数
 */
export const TOTAL_STEPS = WORKFLOW_STEPS.length;

/**
 * 规范化当前步骤，防止步骤越界
 *
 * @param currentStep 当前步骤
 * @returns 规范化后的步骤编号
 */
export function normalizeCurrentStep(currentStep: number): number {
  if (!Number.isFinite(currentStep)) {
    return 1;
  }

  const normalizedStep = Math.floor(currentStep);

  if (normalizedStep < 1) {
    return 1;
  }
  if (normalizedStep > TOTAL_STEPS) {
    return TOTAL_STEPS;
  }
  return normalizedStep;
}

// ==================== 工具函数 ====================

/**
 * 创建初始工作流状态
 *
 * @param params 初始化参数
 * @returns 初始工作流状态
 */
export function createInitialWorkflowState(params: {
  /** 脚本内容 */
  scriptContent: string;
  /** 项目 ID */
  projectId: string;
  /** 执行模式（可选，默认快速生成） */
  executionMode?: ExecutionMode;
  /** 视频规格（可选） */
  videoSpec?: VideoSpec;
  /** 项目信息（可选） */
  project?: Project;
  /** 创意方向（可选） */
  creativeDirection?: CreativeDirection;
  /** 人设（可选） */
  persona?: Persona;
  /** 地区（可选） */
  region?: string;
}): WorkflowState {
  return {
    // 输入参数
    scriptContent: params.scriptContent,
    projectId: params.projectId,

    // 执行配置
    executionMode: params.executionMode ?? 'fast',
    videoSpec: params.videoSpec ?? {
      duration: 'short',
      aspectRatio: '16:9',
    },

    // Agent 输出（初始为空）
    // 导演模式下，剧本已在外部生成，需要包装成 StepOutput
    step1_script: params.executionMode === 'director' ? {
      content: params.scriptContent, // 剧本内容（字符串）
      metadata: {
        timestamp: Date.now(),
        duration: 0,
        model: 'external',
        tokens: 0,
      },
    } : undefined,
    step2_characters: undefined,
    step3_storyboard: undefined,
    step4_video: undefined,
    step5_final: undefined,

    // 控制状态
    currentStep: params.executionMode === 'director' ? 2 : 1, // 导演模式从步骤2开始
    humanApproval: params.executionMode === 'director' ? false : true, // 导演模式需要确认，快速生成自动执行
    userModifications: {},
    needsRegeneration: false,

    // 上下文信息
    project: params.project,
    creativeDirection: params.creativeDirection,
    persona: params.persona,
    region: params.region,

    // 消息历史
    messages: [],

    // 错误信息
    error: undefined,
  };
}

/**
 * 更新工作流状态
 *
 * @param currentState 当前状态
 * @param updates 状态更新
 * @returns 更新后的状态
 */
export function updateWorkflowState(
  currentState: WorkflowState,
  updates: Partial<WorkflowState>
): WorkflowState {
  return {
    ...currentState,
    ...updates,
  };
}

/**
 * 验证工作流状态完整性
 *
 * @param state 工作流状态
 * @returns 是否有效
 */
export function validateWorkflowState(state: WorkflowState): boolean {
  // 验证必填字段
  if (!state.scriptContent || typeof state.scriptContent !== 'string') {
    console.error('[validateWorkflowState] 脚本内容无效');
    return false;
  }

  if (!state.projectId || typeof state.projectId !== 'string') {
    console.error('[validateWorkflowState] 项目 ID 无效');
    return false;
  }

  // 验证执行模式
  if (!['fast', 'director'].includes(state.executionMode)) {
    console.error('[validateWorkflowState] 执行模式无效');
    return false;
  }

  // 验证视频规格
  if (!['short', 'long'].includes(state.videoSpec.duration)) {
    console.error('[validateWorkflowState] 视频时长类型无效');
    return false;
  }

  if (!['16:9', '9:16'].includes(state.videoSpec.aspectRatio)) {
    console.error('[validateWorkflowState] 视频宽高比无效');
    return false;
  }

  // 验证当前步骤
  if (
    typeof state.currentStep !== 'number' ||
    !Number.isInteger(state.currentStep) ||
    state.currentStep < 1 ||
    state.currentStep > TOTAL_STEPS
  ) {
    console.error('[validateWorkflowState] 当前步骤无效');
    return false;
  }

  // 验证消息历史
  if (!Array.isArray(state.messages)) {
    console.error('[validateWorkflowState] 消息历史无效');
    return false;
  }

  return true;
}

/**
 * 获取当前步骤信息
 *
 * @param state 工作流状态
 * @returns 当前步骤配置
 */
export function getCurrentStep(state: WorkflowState): WorkflowStep {
  const step = WORKFLOW_STEPS.find((s) => s.id === state.currentStep);
  if (!step) {
    throw new Error(`无效的步骤编号: ${state.currentStep}`);
  }
  return step;
}

/**
 * 检查步骤是否已完成
 *
 * @param state 工作流状态
 * @param stepNumber 步骤编号
 * @returns 是否已完成
 */
export function isStepCompleted(
  state: WorkflowState,
  stepNumber: number
): boolean {
  switch (stepNumber) {
    case 1:
      return state.step1_script !== undefined;
    case 2:
      return state.step2_characters !== undefined;
    case 3:
      return state.step3_storyboard !== undefined;
    case 4:
      return state.step4_video !== undefined;
    case 5:
      return state.step5_final !== undefined;
    default:
      return false;
  }
}

/**
 * 标记步骤为已修改
 *
 * @param state 工作流状态
 * @param stepNumber 步骤编号
 * @returns 更新后的状态
 */
export function markStepAsModified(
  state: WorkflowState,
  stepNumber: number
): WorkflowState {
  const modificationKey = `step${stepNumber}_modified` as keyof typeof state.userModifications;
  return updateWorkflowState(state, {
    userModifications: {
      ...state.userModifications,
      [modificationKey]: true,
    },
  });
}

/**
 * 清除错误信息
 *
 * @param state 工作流状态
 * @returns 更新后的状态
 */
export function clearError(state: WorkflowState): WorkflowState {
  return updateWorkflowState(state, {
    error: undefined,
  });
}

/**
 * 设置错误信息
 *
 * @param state 工作流状态
 * @param step 步骤编号
 * @param message 错误消息
 * @returns 更新后的状态
 */
export function setError(
  state: WorkflowState,
  step: number,
  message: string
): WorkflowState {
  const currentRetryCount = state.error?.retryCount ?? 0;
  return updateWorkflowState(state, {
    error: {
      step,
      message,
      retryCount: currentRetryCount,
    },
  });
}

/**
 * 增加重试计数
 *
 * @param state 工作流状态
 * @returns 更新后的状态
 */
export function incrementRetryCount(state: WorkflowState): WorkflowState {
  if (!state.error) {
    return state;
  }

  return updateWorkflowState(state, {
    error: {
      ...state.error,
      retryCount: state.error.retryCount + 1,
    },
  });
}
