/**
 * AI 配置管理器
 * 负责加载、保存、验证和管理 AI 提供商配置
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type {
  AIConfig,
  ProviderType,
  ConfigValidationResult,
  VolcEngineConfig,
} from './schema';
import type { ProviderConfig } from '../providers/interface';

/**
 * 默认配置文件名
 */
const CONFIG_FILENAME = 'ai-config.json';

/**
 * 默认火山引擎测试 API Key（仅供开发测试）
 */
const DEFAULT_VOLCENGINE_API_KEY = '635a4f87-91d7-44f3-b09c-a580aa6ba835';

/**
 * AI 配置管理器类
 */
export class AIConfigManager {
  private config: AIConfig | null = null;
  private readonly configPath: string;

  /**
   * 构造函数
   * @param configPath 配置文件路径（可选，默认使用用户数据目录）
   */
  constructor(configPath?: string) {
    // 确定配置文件路径
    if (configPath) {
      this.configPath = configPath;
    } else {
      // 使用用户数据目录
      const userDataPath = app.getPath('userData');
      const configDir = path.join(userDataPath, 'ai');

      // 确保配置目录存在
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      this.configPath = path.join(configDir, CONFIG_FILENAME);
    }

    console.log(`[AIConfigManager] 配置文件路径: ${this.configPath}`);
  }

  /**
   * 加载配置
   * 如果配置文件不存在，则创建默认配置
   */
  loadConfig(): AIConfig {
    try {
      // 如果已经加载过，直接返回
      if (this.config) {
        return this.config;
      }

      // 检查配置文件是否存在
      if (!fs.existsSync(this.configPath)) {
        console.log('[AIConfigManager] 配置文件不存在，创建默认配置');
        this.config = this.createDefaultConfig();
        this.saveConfig(this.config);
        return this.config;
      }

      // 读取配置文件
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData) as AIConfig;

      // 验证配置
      const validation = this.validateConfig(parsedConfig);
      if (!validation.valid) {
        console.error('[AIConfigManager] 配置验证失败:', validation.errors);
        throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
      }

      // 显示警告
      if (validation.warnings.length > 0) {
        console.warn('[AIConfigManager] 配置警告:', validation.warnings);
      }

      this.config = parsedConfig;
      console.log('[AIConfigManager] 配置加载成功');

      return this.config;
    } catch (error) {
      console.error('[AIConfigManager] 加载配置失败:', error);

      // 如果加载失败，使用默认配置
      console.log('[AIConfigManager] 使用默认配置');
      this.config = this.createDefaultConfig();
      return this.config;
    }
  }

  /**
   * 保存配置
   * @param config 要保存的配置
   */
  saveConfig(config: AIConfig): void {
    try {
      // 验证配置
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
      }

      // 序列化并保存
      const configData = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf-8');

      // 更新内存中的配置
      this.config = config;

      console.log('[AIConfigManager] 配置保存成功');
    } catch (error) {
      console.error('[AIConfigManager] 保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   * @param config 要验证的配置
   * @returns 验证结果
   */
  validateConfig(config: AIConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证默认提供商
    if (!config.defaultProvider) {
      errors.push('未指定默认提供商');
    }

    // 验证提供商配置
    if (!config.providers || Object.keys(config.providers).length === 0) {
      errors.push('至少需要配置一个提供商');
    }

    // 验证默认提供商是否已配置
    const defaultProviderConfig = config.providers[config.defaultProvider];
    if (!defaultProviderConfig) {
      errors.push(`默认提供商 "${config.defaultProvider}" 未配置`);
    }

    // 验证火山引擎配置
    if (config.providers.volcengine) {
      const volcengine = config.providers.volcengine;
      if (!volcengine.apiKey || volcengine.apiKey.trim() === '') {
        errors.push('火山引擎 API Key 不能为空');
      }
    }

    // 验证 OpenAI 配置（如果启用）
    if (config.providers.openai) {
      const openai = config.providers.openai;
      if (!openai.apiKey || openai.apiKey.trim() === '') {
        errors.push('OpenAI API Key 不能为空');
      }
    }

    // 验证功能标志
    if (!config.features) {
      warnings.push('未指定功能标志，将使用默认值');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 获取指定提供商的配置
   * @param type 提供商类型
   * @returns 提供商配置，如果未配置则返回 null
   */
  getProviderConfig(type: ProviderType): ProviderConfig | null {
    const config = this.loadConfig();
    return config.providers[type] || null;
  }

  /**
   * 设置默认提供商
   * @param type 提供商类型
   */
  setDefaultProvider(type: ProviderType): void {
    const config = this.loadConfig();

    // 验证提供商是否已配置
    if (!config.providers[type]) {
      throw new Error(`提供商 "${type}" 未配置`);
    }

    config.defaultProvider = type;
    this.saveConfig(config);

    console.log(`[AIConfigManager] 默认提供商已设置为: ${type}`);
  }

  /**
   * 更新提供商配置
   * @param type 提供商类型
   * @param providerConfig 新的提供商配置
   */
  updateProviderConfig(type: ProviderType, providerConfig: ProviderConfig): void {
    const config = this.loadConfig();
    config.providers[type] = providerConfig as any;
    this.saveConfig(config);

    console.log(`[AIConfigManager] 提供商 "${type}" 配置已更新`);
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getCurrentConfig(): AIConfig {
    return this.loadConfig();
  }

  /**
   * 创建默认配置
   * @returns 默认配置
   */
  private createDefaultConfig(): AIConfig {
    console.log('[AIConfigManager] 创建默认配置（火山引擎）');

    return {
      defaultProvider: 'volcengine',
      providers: {
        volcengine: {
          apiKey: process.env.VOLCENGINE_API_KEY || DEFAULT_VOLCENGINE_API_KEY,
          enabled: true,
          features: {
            textGeneration: true,
            imageGeneration: true,
            speechSynthesis: false,
            videoGeneration: true,
          },
        } as VolcEngineConfig,
      },
      features: {
        textGeneration: true,
        imageGeneration: true,
        speechSynthesis: false,
        videoGeneration: false,
      },
    };
  }

  /**
   * 重新加载配置（从文件重新读取）
   */
  reloadConfig(): AIConfig {
    this.config = null;
    return this.loadConfig();
  }

  /**
   * 获取配置文件路径
   * @returns 配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 检查配置文件是否存在
   * @returns 是否存在
   */
  configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * 删除配置文件（用于重置）
   */
  deleteConfig(): void {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
      this.config = null;
      console.log('[AIConfigManager] 配置文件已删除');
    }
  }
}
