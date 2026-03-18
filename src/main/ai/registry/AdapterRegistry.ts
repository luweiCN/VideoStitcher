/**
 * 适配器注册表
 * 管理所有供应商适配器的注册和获取
 */

import { AIConfigManager } from '../config/manager';
import type { AIConfig, VolcEngineConfig } from '../config/schema';
import {
  VolcEngineTextAdapter,
  VolcEngineImageAdapter,
  type VolcEngineConfig as AdapterVolcEngineConfig,
} from '../adapters/VolcEngineAdapter';
import { UnifiedModel } from '../UnifiedModel';
import type { ProviderAdapter } from '../types';
import type { ModelInfo, ModelType, ModelConfig } from '../types/model';

/**
 * 适配器注册表
 *
 * 单例模式，管理所有供应商的模型适配器
 *
 * @example
 * ```typescript
 * const registry = AdapterRegistry.getInstance();
 *
 * // 获取模型
 * const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');
 *
 * // 列出所有模型
 * const models = registry.listModels('volcengine', 'text');
 *
 * // 获取默认模型
 * const defaultModel = registry.getDefaultModel('text');
 * ```
 */
export class AdapterRegistry {
  private static instance: AdapterRegistry;

  /** 适配器映射表 (key: "provider:type:modelId") */
  private adapters: Map<string, ProviderAdapter> = new Map();

  /** 配置管理器 */
  private configManager: AIConfigManager;

  /** 配置 */
  private config: AIConfig;

  /**
   * 私有构造函数（单例模式）
   */
  private constructor() {
    this.configManager = new AIConfigManager();
    this.config = this.configManager.loadConfig();
    this.registerAllProviders();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AdapterRegistry {
    if (!this.instance) {
      this.instance = new AdapterRegistry();
    }
    return this.instance;
  }

  /**
   * 获取模型实例
   *
   * @param provider - 供应商名称
   * @param type - 模型类型
   * @param modelId - 模型 ID
   * @returns 统一模型包装器
   */
  getModel(provider: string, type: ModelType, modelId: string): UnifiedModel {
    const key = `${provider}:${type}:${modelId}`;
    const adapter = this.adapters.get(key);

    if (!adapter) {
      throw new Error(
        `模型未注册: ${key}。可用模型: ${Array.from(this.adapters.keys()).join(', ')}`
      );
    }

    return new UnifiedModel(adapter);
  }

  /**
   * 列出所有可用模型
   *
   * @param provider - 供应商名称（可选，不指定则列出所有）
   * @param type - 模型类型（可选，不指定则列出所有）
   * @returns 模型信息列表
   */
  listModels(provider?: string, type?: ModelType): ModelInfo[] {
    const models: ModelInfo[] = [];

    for (const [key, adapter] of this.adapters) {
      const [p, t] = key.split(':');

      // 过滤条件
      if (provider && p !== provider) continue;
      if (type && t !== type) continue;

      models.push(adapter.getModelInfo());
    }

    return models;
  }

  /**
   * 获取默认供应商
   */
  getDefaultProvider(): string {
    return this.config.defaultProvider;
  }

  /**
   * 获取默认模型
   *
   * @param type - 模型类型
   * @returns 默认模型（如果找不到则返回第一个可用模型）
   */
  getDefaultModel(type: ModelType): UnifiedModel | null {
    const provider = this.config.defaultProvider;
    const models = this.listModels(provider, type);

    if (models.length === 0) {
      return null;
    }

    // 返回第一个可用模型
    return this.getModel(provider, type, models[0].id);
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.config = this.configManager.reloadConfig();
    this.adapters.clear();
    this.registerAllProviders();
  }

  /**
   * 注册所有供应商
   */
  private registerAllProviders(): void {
    console.log('[AdapterRegistry] 开始注册所有供应商...');

    // 注册火山引擎
    if (this.config.providers.volcengine?.enabled) {
      this.registerVolcEngine(this.config.providers.volcengine);
    }

    // 注册 OpenAI（如果启用）
    if (this.config.providers.openai?.enabled) {
      // TODO: 实现 OpenAI 注册
      console.log('[AdapterRegistry] OpenAI 供应商尚未实现');
    }

    console.log(
      `[AdapterRegistry] 注册完成，共 ${this.adapters.size} 个模型`
    );
  }

  /**
   * 注册火山引擎供应商
   */
  private registerVolcEngine(config: VolcEngineConfig): void {
    console.log('[AdapterRegistry] 注册火山引擎供应商...');

    // 转换配置格式
    const adapterConfig: AdapterVolcEngineConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    };

    // 获取模型配置（如果存在）
    const models = (config as any).models || {};

    // 注册文本模型
    const textModels = models.text || [];

    if (textModels.length === 0) {
      // 如果没有配置模型，使用默认模型
      console.log('[AdapterRegistry] 使用默认文本模型配置');
      textModels.push({
        id: config.model || 'doubao-1-5-pro-32k-250115',
        name: 'Doubao 1.5 Pro 32K',
        inputTypes: ['text'],
        outputTypes: ['text'],
        features: ['function_calling', 'streaming'],
        contextWindow: 32768,
        maxOutputTokens: 32768,
      });
    }

    textModels.forEach((modelConfig: ModelConfig) => {
      const modelInfo: ModelInfo = {
        ...modelConfig,
        provider: 'volcengine',
        type: 'text',
      };

      const adapter = new VolcEngineTextAdapter(adapterConfig, modelInfo);
      const key = `volcengine:text:${modelConfig.id}`;

      this.adapters.set(key, adapter);
      console.log(`[AdapterRegistry] 注册文本模型: ${key}`);
    });

    // 注册图片模型
    const imageModels = models.image || [];

    if (imageModels.length === 0) {
      // 如果没有配置模型，使用默认模型
      console.log('[AdapterRegistry] 使用默认图片模型配置');
      imageModels.push({
        id: 'doubao-seedream-3-0-t2i-250428',
        name: 'Doubao SeeDream 3.0',
        inputTypes: ['text'],
        outputTypes: ['image'],
        features: [],
        maxOutputTokens: 1,
      });
    }

    imageModels.forEach((modelConfig: ModelConfig) => {
      const modelInfo: ModelInfo = {
        ...modelConfig,
        provider: 'volcengine',
        type: 'image',
      };

      const adapter = new VolcEngineImageAdapter(adapterConfig, modelInfo);
      const key = `volcengine:image:${modelConfig.id}`;

      this.adapters.set(key, adapter);
      console.log(`[AdapterRegistry] 注册图片模型: ${key}`);
    });
  }
}
