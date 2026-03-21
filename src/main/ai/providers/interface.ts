/**
 * AI 提供商统一接口定义
 *
 * 支持多种 AI 能力：
 * - 文本生成（大语言模型）
 * - 图片生成
 * - 语音合成
 * - 视频生成
 *
 * 所有 AI 提供商都需要实现此接口，以便支持 LangGraph 工作流
 */

// ==================== 文本生成接口 ====================

/**
 * 文本生成选项
 */
export interface TextGenerationOptions {
  /** 温度（0-1），控制随机性 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** Top-p 采样 */
  topP?: number;
  /** 停止序列 */
  stopSequences?: string[];
  /** 系统提示词 */
  systemPrompt?: string;
}

/**
 * 文本生成结果
 */
export interface TextGenerationResult {
  /** 生成的内容 */
  content: string;
  /** Token 使用情况 */
  usage: {
    /** 输入 token 数 */
    promptTokens: number;
    /** 输出 token 数 */
    completionTokens: number;
    /** 总 token 数 */
    totalTokens: number;
  };
  /** 完成原因 */
  finishReason: 'stop' | 'length' | 'content_filter' | 'other';
}

// ==================== 图片生成接口 ====================

/**
 * 图片生成选项
 */
export interface ImageGenerationOptions {
  /** 图片尺寸（如 '1024x1024'） */
  size?: `${number}x${number}` | string;
  /** 风格（如 '写实', '动漫'） */
  style?: string;
  /** 质量 */
  quality?: 'standard' | 'hd';
  /** 生成数量（1-4） */
  numberOfImages?: number;
  /** 参考图片 URL（用于风格/角色一致性控制，可选） */
  referenceImageUrl?: string;
}

/**
 * 图片生成结果
 */
export interface ImageGenerationResult {
  /** 生成的图片列表 */
  images: Array<{
    /** 图片 URL 或 base64 */
    url: string;
    /** 优化后的提示词 */
    revisedPrompt?: string;
  }>;
  /** 创建时间戳 */
  created: number;
}

// ==================== 语音合成接口 ====================

/**
 * 语音合成选项
 */
export interface SpeechSynthesisOptions {
  /** 音色 ID */
  voice?: string;
  /** 语速（0.5-2.0） */
  speed?: number;
  /** 音调（-12 到 12） */
  pitch?: number;
  /** 音频格式 */
  format?: 'mp3' | 'wav';
}

/**
 * 语音合成结果
 */
export interface SpeechSynthesisResult {
  /** 音频数据 */
  audioBuffer: Buffer;
  /** 时长（秒） */
  duration: number;
  /** 格式 */
  format: string;
}

// ==================== 视频生成接口 ====================

/**
 * 视频生成选项
 *
 * 注意：Seedance API 的图片输入模式是互斥的：
 * - i2v 模式：firstFrameImageUrl（首帧图生视频）
 * - r2v 模式：referenceImageUrls（参考图生视频）
 * 两者不能同时使用；优先级：firstFrameImageUrl > referenceImageUrls
 */
export interface VideoGenerationOptions {
  /** 时长（秒） */
  duration?: number;
  /** 画幅比例 */
  aspectRatio?: '16:9' | '9:16';
  /** 帧率 */
  fps?: number;
  /** 分辨率 */
  resolution?: '720p' | '1080p' | '4k';
  /**
   * 首帧图片（i2v 模式，role: first_frame）
   * 支持 URL 或 base64 data URI
   * 与 referenceImageUrls 互斥，设置后优先使用 i2v 模式
   */
  firstFrameImageUrl?: string;
  /**
   * 参考图片列表（r2v 模式，role: reference_image）
   * 仅在 firstFrameImageUrl 未设置时生效
   */
  referenceImageUrls?: string[];
  /**
   * 是否生成同步音频（仅 Seedance 1.5 pro 支持）
   * true：生成与画面同步的人声/音效/背景音乐
   * false：无声视频
   * 默认 true（仅在支持音频的模型中生效）
   */
  generateAudio?: boolean;
}

/**
 * 视频生成结果
 */
export interface VideoGenerationResult {
  /** 视频 URL 或本地路径 */
  videoUrl: string;
  /** 时长（秒） */
  duration: number;
  /** 分辨率 */
  resolution: string;
  /** 文件大小（字节） */
  fileSize: number;
}

// ==================== 统一 AI 提供商接口 ====================

/**
 * AI 提供商统一接口
 *
 * 所有 AI 服务提供商都需要实现此接口
 */
export interface AIProvider {
  /** 提供商名称 */
  readonly name: string;

  /**
   * 生成文本
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成结果
   */
  generateText(
    prompt: string,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult>;

  /**
   * 流式生成文本（可选）
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 文本流
   */
  generateTextStream?(
    prompt: string,
    options?: TextGenerationOptions
  ): AsyncIterable<string>;

  /**
   * 生成图片
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成结果
   */
  generateImage(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult>;

  /**
   * 合成语音（可选）
   * @param text 文本内容
   * @param options 合成选项
   * @returns 合成结果
   */
  synthesizeSpeech?(
    text: string,
    options?: SpeechSynthesisOptions
  ): Promise<SpeechSynthesisResult>;

  /**
   * 生成视频（可选）
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成结果
   */
  generateVideo?(
    prompt: string,
    options?: VideoGenerationOptions
  ): Promise<VideoGenerationResult>;

  /**
   * 健康检查
   * @returns 服务是否正常
   */
  healthCheck(): Promise<boolean>;
}

// ==================== 提供商类型和配置 ====================

/**
 * 提供商类型
 */
export type ProviderType = 'volcengine' | 'openai' | 'custom';

/**
 * 提供商配置
 */
export interface ProviderConfig {
  /** 提供商类型 */
  type: ProviderType;
  /** API 密钥 */
  apiKey: string;
  /** 基础 URL（可选） */
  baseUrl?: string;
  /** 模型名称（可选） */
  model?: string;
  /** 支持的功能 */
  features: {
    /** 文本生成 */
    textGeneration: boolean;
    /** 图片生成 */
    imageGeneration: boolean;
    /** 语音合成 */
    speechSynthesis: boolean;
    /** 视频生成 */
    videoGeneration: boolean;
  };
}
