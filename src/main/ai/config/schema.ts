/**
 * AI 配置 Schema
 * 定义配置的数据结构和类型
 */

import type { ProviderType } from '../providers/interface';

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
 * 癏山引擎配置
 */
export interface VolcEngineConfig extends ProviderConfig {
  /** 图片生成模型（Seedream） */
  imageModel?: string;
  /** 语音合成模型（可选） */
  speechModel?: string;
  /** 视频生成模型（可选） */
  videoModel?: string;
}

/**
 * OpenAI 配置（未来）
 */
export interface OpenAIConfig extends ProviderConfig {
  /** 组织 ID（可选） */
  organization?: string;
}

/**
 * 自定义提供商配置（未来）
 */
export interface CustomConfig extends ProviderConfig {
  /** 自定义提供商名称 */
  providerName: string;
  /** 自定义参数 */
  customParams?: Record<string, any>;
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
