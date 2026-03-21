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

  /** 项目卖点（可选，最多200字符） */
  sellingPoint?: string;

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

  /** 特点标签列表（如 ["反转", "悬念", "节奏快"]） */
  characteristics?: string[];

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

  /** 区域（可选，从项目表移过来） */
  region?: string;

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

/**
 * 角色
 * 导演模式中的角色定义
 */
export interface Character {
  /** 角色唯一标识符 */
  id: string;

  /** 角色名称 */
  name: string;

  /** 角色描述 */
  description: string;

  /** 角色图片 URL（AI 生成或用户上传） */
  imageUrl?: string;

  // 结构化字段（从艺术总监 Agent 生成）
  /** 角色类型：主角、反派、配角 */
  role_type?: 'protagonist' | 'antagonist' | 'supporting';

  /** 外貌描述 */
  appearance?: string;

  /** 服装描述 */
  costume?: string;

  /** 性格特征列表 */
  personality_traits?: string[];

  /** 关键动作列表 */
  key_actions?: string[];

  /** 图片生成提示词 */
  image_generation_prompt?: string;
}

/**
 * 分镜场景
 * 单个分镜镜头
 */
export interface Scene {
  /** 场景唯一标识符 */
  id: string;

  /** 场景序号（1-9） */
  index: number;

  /** 场景描述 */
  description: string;

  /** 场景图片 URL（AI 生成） */
  imageUrl?: string;
}

/**
 * 分镜图
 * 包含多个分镜场景的完整分镜图
 */
export interface Storyboard {
  /** 分镜图唯一标识符 */
  id: string;

  /** 行数 */
  rows: number;

  /** 列数 */
  cols: number;

  /** 所有场景 */
  scenes: Scene[];

  /** 完整分镜图 URL（包含所有场景的大图） */
  imageUrl?: string;
}

// ==================== 地区管理类型 ====================

/**
 * 地区
 * 全局共用，不绑定项目
 * 支持 1-3 级层级结构（国家 → 省级 → 市级）
 */
export interface Region {
  /** 地区唯一标识符 */
  id: string;

  /** 地区名称 */
  name: string;

  /** 父地区 ID（一级地区为 undefined） */
  parentId?: string;

  /** 层级（1=国家，2=省级，3=市级） */
  level: number;

  /** 文化档案（Markdown 格式，最多 800 字符） */
  culturalProfile: string;

  /** 地区 emoji */
  emoji: string;

  /** 图标类型（local=本地文件，url=远程图片） */
  iconType?: 'local' | 'url';

  /** 图标值（本地路径或远程 URL） */
  iconValue?: string;

  /** 是否为预置地区（预置地区不可删除） */
  isPreset: boolean;

  /** 是否启用 */
  isActive: boolean;

  /** 排序权重 */
  sortOrder: number;

  /** 创建时间（ISO 8601 格式） */
  createdAt: string;

  /** 更新时间（ISO 8601 格式） */
  updatedAt: string;
}

/**
 * 地区树节点
 * 用于前端树形展示
 */
export interface RegionTreeNode extends Region {
  /** 子地区列表 */
  children: RegionTreeNode[];
}
