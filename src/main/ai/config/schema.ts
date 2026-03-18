/**
 * AI 配置 Schema
 * 定义配置的数据结构和类型
 */

import type { ProviderType } from '../providers/interface';
import type { ModelFeature } from '../types/model';

/**
 * 提供商基础配置
 */
export interface ProviderConfig {
  /** API 密钥 */
  apiKey: string;
  /** API 基础 URL（可选） */
  baseUrl?: string;
  /** 模型名称（可选） */
  model?: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 模型配置（在新配置格式中使用）
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
}

/**
 * 供应商模型配置（在新配置格式中使用）
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

/**
 * 癏山引擎配置
 */
export interface VolcEngineConfig extends ProviderConfig {
  /** 推理接入点 ID（文本生成） */
  endpoint?: string;
  /** 图片生成模型（Seedream） */
  imageModel?: string;
  /** 语音合成模型（可选） */
  speechModel?: string;
  /** 视频生成模型（可选） */
  videoModel?: string;

  /**
   * 模型配置（新格式，可选）
   * 如果提供，将覆盖旧的单个 model 字段
   */
  models?: ProviderModelsConfig;
}

/**
 * OpenAI 配置（未来）
 */
export interface OpenAIConfig extends ProviderConfig {
  /** 组织 ID（可选） */
  organization?: string;

  /**
   * 模型配置（新格式，可选）
   * 如果提供，将覆盖旧的单个 model 字段
   */
  models?: ProviderModelsConfig;
}

/**
 * 自定义提供商配置（未来）
 */
export interface CustomConfig extends ProviderConfig {
  /** 自定义提供商名称 */
  providerName: string;
  /** 自定义参数 */
  customParams?: Record<string, any>;

  /**
   * 模型配置（新格式，可选）
   */
  models?: ProviderModelsConfig;
}

/**
 * AI 功能标志
 */
export interface AIFeatures {
  /** 文本生成 */
  textGeneration: boolean;
  /** 图片生成 */
  imageGeneration: boolean;
  /** 语音合成 */
  speechSynthesis: boolean;
  /** 视频生成 */
  videoGeneration: boolean;
}

/**
 * AI 完整配置
 */
export interface AIConfig {
  /** 默认提供商 */
  defaultProvider: ProviderType;
  /** 提供商配置 */
  providers: {
    volcengine?: VolcEngineConfig;
    openai?: OpenAIConfig;
    custom?: CustomConfig;
  };
  /** 全局功能标志 */
  features: AIFeatures;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
}
