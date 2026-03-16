/**
 * LangGraph 状态定义
 * AI 视频生产流程的状态机核心状态结构
 */

import { Annotation } from '@langchain/langgraph';

/**
 * 脚本数据结构
 */
export interface Script {
  /** 脚本唯一标识 */
  id: string;
  /** 脚本文本内容 */
  text: string;
  /** 脚本风格（幽默、悬疑、搞笑、教学、解说） */
  style: string;
  /** 创建时间 */
  createdAt: number;
  /** 是否选中 */
  selected?: boolean;
}

/**
 * 视频配置
 */
export interface VideoConfig {
  /** 视频时长（秒） */
  length: number;
  /** 视频比例（16:9, 9:16, 1:1） */
  ratio: '16:9' | '9:16' | '1:1';
  /** 分辨率 */
  resolution?: string;
}

/**
 * 角色数据结构
 */
export interface Character {
  /** 角色唯一标识 */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 角色概念图 URL */
  imageUrl?: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 分镜数据结构
 */
export interface StoryboardScene {
  /** 分镜唯一标识 */
  id: string;
  /** 场景序号 */
  sceneNumber: number;
  /** 场景描述 */
  description: string;
  /** 场景图片 URL */
  imageUrl?: string;
  /** 持续时间（秒） */
  duration?: number;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 视频输出数据结构
 */
export interface VideoOutput {
  /** 视频唯一标识 */
  id: string;
  /** 视频 URL */
  url: string;
  /** 视频状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** 生成进度 (0-100) */
  progress: number;
  /** 任务 ID（火山引擎） */
  taskId?: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 知识库检索结果
 */
export interface KnowledgeBaseResult {
  /** 结果唯一标识 */
  id: string;
  /** 相似度分数 (0-1) */
  similarity: number;
  /** 内容 */
  content: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * GraphState 状态定义
 * 使用 LangGraph 的 Annotation API 定义状态
 */
export const GraphState = Annotation.Root({
  // ==================== 用户输入 ====================

  /** 用户需求描述 */
  userRequirement: Annotation<string>,

  /** 选择的脚本风格 */
  selectedStyle: Annotation<string>,

  /** 批量生成数量 */
  batchSize: Annotation<number>,

  // ==================== 脚本生成阶段 ====================

  /** 生成的脚本列表 */
  scripts: Annotation<Script[]>,

  /** 用户选中的脚本 ID */
  selectedScriptId: Annotation<string | null>,

  // ==================== 导演模式阶段 ====================

  /** 视频配置 */
  videoConfig: Annotation<VideoConfig | null>,

  /** 生成的角色列表 */
  characters: Annotation<Character[]>,

  /** 生成的分镜列表 */
  storyboard: Annotation<StoryboardScene[]>,

  // ==================== 视频输出阶段 ====================

  /** 生成的视频列表 */
  videos: Annotation<VideoOutput[]>,

  // ==================== 知识库检索 ====================

  /** 知识库检索结果 */
  knowledgeBaseResults: Annotation<KnowledgeBaseResult[]>,

  // ==================== 错误处理 ====================

  /** 错误信息 */
  error: Annotation<string | null>,

  // ==================== 当前执行节点 ====================

  /** 当前执行的节点名称 */
  currentNode: Annotation<string>,
});

/**
 * GraphStateType 类型别名
 * 便于在代码中使用
 */
export type GraphStateType = typeof GraphState.State;

/**
 * 节点名称常量
 */
export const NodeNames = {
  /** 脚本生成节点 */
  SCRIPT: 'scriptNode',
  /** 角色设定节点 */
  CHARACTER: 'characterNode',
  /** 分镜生成节点 */
  STORYBOARD: 'storyboardNode',
  /** 视频生成节点 */
  VIDEO: 'videoNode',
} as const;

/**
 * 节点名称类型
 */
export type NodeName = (typeof NodeNames)[keyof typeof NodeNames];
