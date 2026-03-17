/**
 * A面视频生产 - 共享类型定义
 *
 * 这些类型在主进程和渲染进程之间共享
 */

// ==================== 基础联合类型 ====================

/**
 * 游戏类型
 * 支持的游戏种类
 */
export type GameType = '麻将' | '扑克' | '赛车';

/**
 * AI 模型
 * 支持的 AI 模型提供商
 */
export type AIModel = 'gemini' | 'doubao' | 'qwen' | 'chatgpt';

/**
 * 剧本状态
 * - draft: 草稿
 * - library: 已入库
 * - producing: 生产中
 * - completed: 已完成
 */
export type ScreenplayStatus = 'draft' | 'library' | 'producing' | 'completed';

// ==================== 核心实体类型 ====================

/**
 * 项目
 * 顶级的组织单元，包含相关的创意方向、人设和剧本
 */
export interface Project {
  /** 项目唯一标识符 */
  id: string;

  /** 项目名称 */
  name: string;

  /** 游戏类型（麻将、扑克、赛车） */
  gameType: GameType;

  /** 区域（可选，用于地区化内容） */
  region?: string;

  /** 创建时间（ISO 8601 格式） */
  createdAt: string;

  /** 更新时间（ISO 8601 格式） */
  updatedAt: string;
}

/**
 * 创意方向
 * 定义视频的创意风格和方向
 */
export interface CreativeDirection {
  /** 创意方向唯一标识符 */
  id: string;

  /** 所属项目 ID */
  projectId: string;

  /** 创意方向名称 */
  name: string;

  /** 创意方向描述（可选） */
  description?: string;

  /** Lucide React 图标名称（可选） */
  iconName?: string;

  /** 是否为预设（系统内置） */
  isPreset: boolean;

  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 人设
 * 定义视频中的角色或旁白风格
 */
export interface Persona {
  /** 人设唯一标识符 */
  id: string;

  /** 所属项目 ID */
  projectId: string;

  /** 人设名称 */
  name: string;

  /** 人设提示词（用于 AI 生成） */
  prompt: string;

  /** 是否为预设（系统内置） */
  isPreset: boolean;

  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 剧本
 * 存储生成的剧本内容和元数据
 */
export interface Screenplay {
  /** 剧本唯一标识符 */
  id: string;

  /** 所属项目 ID */
  projectId: string;

  /** 剧本内容 */
  content: string;

  /** 关联的创意方向 ID（可选） */
  creativeDirectionId?: string;

  /** 关联的人设 ID（可选） */
  personaId?: string;

  /** 使用的 AI 模型（可选） */
  aiModel?: AIModel;

  /** 剧本状态（草稿、已入库、生产中、已完成） */
  status: ScreenplayStatus;

  /** 预估视频时长（秒，由 AI 根据剧情内容预估） */
  estimatedDuration?: number;

  /** 生成的视频 URL（已完成状态时） */
  videoUrl?: string;

  /** 创建时间（ISO 8601 格式） */
  createdAt: string;
}

/**
 * 区域
 * 地理区域定义，用于地区化内容生成
 */
export interface Region {
  /** 区域唯一标识符 */
  id: string;

  /** 区域名称 */
  name: string;

  /** 区域表情符号（用于 UI 展示） */
  emoji: string;

  /** 区域分组（华北、东北、华东等） */
  group: string;
}
