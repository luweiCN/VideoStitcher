/**
 * AI 配置迁移工具
 * 将旧配置格式迁移到新的模型配置格式
 */

import type { AIConfig, VolcEngineConfig, ModelConfig, ProviderModelsConfig } from '../config/schema';

/**
 * 迁移火山引擎配置
 */
export function migrateVolcEngineConfig(config: VolcEngineConfig): VolcEngineConfig {
  // 如果已经有 models 字段，直接返回
  if (config.models) {
    console.log('[配置迁移] 火山引擎配置已经是新格式，跳过迁移');
    return config;
  }

  console.log('[配置迁移] 开始迁移火山引擎配置到新格式...');

  const models: ProviderModelsConfig = {};

  // 迁移文本模型
  if (config.model) {
    models.text = [
      {
        id: config.model,
        name: `Doubao (${config.model})`,
        inputTypes: ['text'],
        outputTypes: ['text'],
        features: ['function_calling', 'streaming'],
        contextWindow: 32768,
        maxOutputTokens: 32768,
        enabled: true,
      },
    ];
    console.log(`[配置迁移] 迁移文本模型: ${config.model}`);
  }

  // 迁移图片模型
  if (config.imageModel) {
    models.image = [
      {
        id: config.imageModel,
        name: `Doubao SeeDream (${config.imageModel})`,
        inputTypes: ['text'],
        outputTypes: ['image'],
        features: [],
        maxOutputTokens: 1,
        enabled: true,
      },
    ];
    console.log(`[配置迁移] 迁移图片模型: ${config.imageModel}`);
  }

  // 迁移语音模型
  if (config.speechModel) {
    models.speech = [
      {
        id: config.speechModel,
        name: `Doubao TTS (${config.speechModel})`,
        inputTypes: ['text'],
        outputTypes: ['audio'],
        features: [],
        maxOutputTokens: 1,
        enabled: true,
      },
    ];
    console.log(`[配置迁移] 迁移语音模型: ${config.speechModel}`);
  }

  // 迁移视频模型
  if (config.videoModel) {
    models.video = [
      {
        id: config.videoModel,
        name: `Doubao Video (${config.videoModel})`,
        inputTypes: ['text', 'image'],
        outputTypes: ['video'],
        features: [],
        maxOutputTokens: 1,
        enabled: true,
      },
    ];
    console.log(`[配置迁移] 迁移视频模型: ${config.videoModel}`);
  }

  // 如果没有任何模型，添加默认配置
  if (Object.keys(models).length === 0) {
    console.log('[配置迁移] 未发现任何模型配置，使用默认配置');
    models.text = [
      {
        id: 'doubao-1-5-pro-32k-250115',
        name: 'Doubao 1.5 Pro 32K',
        inputTypes: ['text'],
        outputTypes: ['text'],
        features: ['function_calling', 'streaming'],
        contextWindow: 32768,
        maxOutputTokens: 32768,
        enabled: true,
      },
    ];
    models.image = [
      {
        id: 'doubao-seedream-3-0-t2i-250428',
        name: 'Doubao SeeDream 3.0',
        inputTypes: ['text'],
        outputTypes: ['image'],
        features: [],
        maxOutputTokens: 1,
        enabled: true,
      },
    ];
  }

  return {
    ...config,
    models,
  };
}

/**
 * 迁移完整配置
 */
export function migrateConfig(config: AIConfig): AIConfig {
  console.log('[配置迁移] 开始迁移 AI 配置...');

  const migratedConfig: AIConfig = {
    ...config,
    providers: { ...config.providers },
  };

  // 迁移火山引擎配置
  if (migratedConfig.providers.volcengine) {
    migratedConfig.providers.volcengine = migrateVolcEngineConfig(
      migratedConfig.providers.volcengine
    );
  }

  // 迁移 OpenAI 配置（如果存在）
  if (migratedConfig.providers.openai) {
    // TODO: 实现 OpenAI 迁移
    console.log('[配置迁移] OpenAI 配置迁移尚未实现');
  }

  console.log('[配置迁移] 配置迁移完成');
  return migratedConfig;
}
