/**
 * 模型信息类型定义
 */

/**
 * 模型类型
 */
export type ModelType = 'text' | 'image' | 'speech' | 'video';

/**
 * 模型能力特征
 */
export type ModelFeature =
  | 'function_calling' // 函数调用
  | 'streaming' // 流式响应
  | 'vision' // 视觉理解
  | 'audio_input' // 音频输入
  | 'audio_output' // 音频输出
  | 'deep_reasoning' // 深度思考
  | 'web_search' // 网络搜索
  | 'hd_quality' // 高清质量（图片）
  | 'revised_prompt'; // 重写提示词（图片）

/**
 * 模型定价信息
 */
export interface ModelPricing {
  /** 推理输入价格（元/百万tokens） */
  inputTokens?: number;

  /** 推理输出价格（元/百万tokens） */
  outputTokens?: number;

  /** 缓存命中价格（元/百万tokens） */
  cachedTokens?: number;

  /** 缓存存储价格（元/百万tokens/小时） */
  cachedStorage?: number;

  /** 计费单位 */
  unit?: string;

  /** 货币单位 */
  currency?: string;

  // ===== 图片生成特定价格 =====

  /** 文生图价格（元/张） */
  textToImage?: number;

  /** 图生图价格（元/张） */
  imageToImage?: number;

  /** 批量文生图价格（元/张） */
  batchTextToImage?: number;

  /** 批量图生图价格（元/张） */
  batchImageToImage?: number;

  // ===== 视频生成特定价格 =====

  /** 有声视频价格（元/百万tokens） */
  videoWithAudio?: number;

  /** 无声视频价格（元/百万tokens） */
  videoWithoutAudio?: number;

  /** 批量推理有声视频价格 */
  batchVideoWithAudio?: number;

  /** 批量推理无声视频价格 */
  batchVideoWithoutAudio?: number;

  /** 图生视频价格（元/百万tokens） */
  imageToVideo?: number;

  /** 文生视频价格（元/百万tokens） */
  textToVideo?: number;

  /** 批量图生视频价格 */
  batchImageToVideo?: number;

  /** 批量文生视频价格 */
  batchTextToVideo?: number;

  /** 精调图生视频价格 */
  finetunedImageToVideo?: number;

  /** 备注 */
  note?: string;
}

/**
 * 模型限制
 */
export interface ModelLimits {
  /** 每分钟最大 tokens (Tokens Per Minute) */
  TPM?: number;

  /** 每分钟最大请求数 (Requests Per Minute) */
  RPM?: number;

  /** 每分钟最大图片数 (Images Per Minute) */
  IPM?: number;

  /** 并发数限制 */
  concurrency?: number;

  // ===== 视频生成特定限制 =====

  /** 支持的分辨率列表 */
  resolution?: string[];

  /** 视频时长范围（如 "4-12s"） */
  duration?: string;

  /** 帧率 */
  fps?: number;
}

/**
 * 模型信息
 *
 * @example
 * ```typescript
 * const modelInfo: ModelInfo = {
 *   id: 'doubao-1-5-pro-32k-250115',
 *   name: 'Doubao 1.5 Pro 32K',
 *   provider: 'volcengine',
 *   type: 'text',
 *   inputTypes: ['text', 'image'],
 *   outputTypes: ['text'],
 *   features: ['function_calling', 'streaming'],
 *   contextWindow: 32768,
 *   maxOutputTokens: 32768,
 *   enabled: true,
 *   pricing: {
 *     inputTokens: 0.3,
 *     outputTokens: 0.6,
 *     cachedTokens: 0.06,
 *     unit: 'CNY/million_tokens'
 *   },
 *   limits: {
 *     TPM: 5000000,
 *     RPM: 30000
 *   }
 * };
 * ```
 */
export interface ModelInfo {
  /** 模型 ID（供应商内部的模型标识） */
  id: string;

  /** 显示名称 */
  name: string;

  /** 供应商名称 */
  provider: string;

  /** 模型类型 */
  type: ModelType;

  /** 输入类型（支持的输入格式） */
  inputTypes: string[];

  /** 输出类型（支持的输出格式） */
  outputTypes: string[];

  /** 能力特征 */
  features: ModelFeature[];

  /** 上下文窗口大小（tokens） */
  contextWindow?: number;

  /** 最大输出 tokens */
  maxOutputTokens?: number;

  /** 是否启用 */
  enabled?: boolean;

  /** 定价信息 */
  pricing?: ModelPricing;

  /** 限制信息 */
  limits?: ModelLimits;

  /** 描述信息 */
  description?: string;

  /** 模型版本 */
  version?: string;

  /** 额外能力配置（用于特定模型类型的特殊能力） */
  capabilities?: Record<string, any>;

  /** 额外配置 */
  extra?: Record<string, any>;
}

/**
 * 模型配置（在配置文件中）
 */
export interface ModelConfig {
  /** 模型 ID */
  id: string;

  /** 显示名称 */
  name: string;

  /** 输入类型 */
  inputTypes: string[];

  /** 输出类型 */
  outputTypes: string[];

  /** 能力特征 */
  features: ModelFeature[];

  /** 上下文窗口 */
  contextWindow?: number;

  /** 最大输出 tokens */
  maxOutputTokens?: number;

  /** 是否启用（默认 true） */
  enabled?: boolean;

  /** 定价信息 */
  pricing?: ModelPricing;

  /** 限制信息 */
  limits?: ModelLimits;

  /** 描述信息 */
  description?: string;

  /** 模型版本 */
  version?: string;
}

/**
 * 供应商模型配置
 */
export interface ProviderModelsConfig {
  /** 文本模型列表 */
  text?: ModelConfig[];

  /** 图片模型列表 */
  image?: ModelConfig[];

  /** 语音模型列表 */
  speech?: ModelConfig[];

  /** 视频模型列表 */
  video?: ModelConfig[];
}
