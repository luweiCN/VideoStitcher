/**
 * AI 提供商全局管理器
 * 负责创建和管理全局 AI 提供商实例
 */

import type { AIProvider } from './providers/interface';
import { VolcEngineProvider } from './providers/volcengine';
import { AIConfigManager } from './config/manager';
import type { AIConfig, ProviderType } from './config/schema';

/**
 * 全局提供商实例缓存
 */
let globalProvider: AIProvider | null = null;

/**
 * 全局配置管理器
 */
let globalConfigManager: AIConfigManager | null = null;

/**
 * 初始化全局 AI 提供商
 *
 * @param configPath 配置文件路径（可选）
 * @returns AI 提供商实例
 */
export function initializeGlobalProvider(configPath?: string): AIProvider {
  console.log('[AIProviderManager] 初始化全局 AI 提供商');

  // 1. 创建配置管理器
  if (!globalConfigManager) {
    globalConfigManager = new AIConfigManager(configPath);
  }

  // 2. 加载配置
  const config = globalConfigManager.loadConfig();
  console.log('[AIProviderManager] 配置加载成功', {
    defaultProvider: config.defaultProvider,
    providerCount: Object.keys(config.providers).length,
  });

  // 3. 获取默认提供商配置
  const defaultProviderType = config.defaultProvider;
  const providerConfig = config.providers[defaultProviderType];

  if (!providerConfig) {
    throw new Error(
      `[AIProviderManager] 未找到提供商配置: ${defaultProviderType}`
    );
  }

  // 4. 创建提供商实例
  globalProvider = createProvider(defaultProviderType, providerConfig);

  console.log('[AIProviderManager] 全局提供商初始化完成');
  return globalProvider;
}

/**
 * 获取全局 AI 提供商实例
 *
 * @returns AI 提供商实例
 * @throws 如果提供商未初始化
 */
export function getGlobalProvider(): AIProvider {
  if (!globalProvider) {
    throw new Error(
      '[AIProviderManager] AI 提供商未初始化，请先调用 initializeGlobalProvider()'
    );
  }
  return globalProvider;
}

/**
 * 重置全局提供商（用于测试或配置变更）
 */
export function resetGlobalProvider(): void {
  globalProvider = null;
  globalConfigManager = null;
  console.log('[AIProviderManager] 全局提供商已重置');
}

/**
 * 创建 AI 提供商实例
 *
 * @param type 提供商类型
 * @param config 提供商配置
 * @returns AI 提供商实例
 */
function createProvider(type: ProviderType, config: any): AIProvider {
  console.log(`[AIProviderManager] 创建提供商: ${type}`);

  switch (type) {
    case 'volcengine':
      return new VolcEngineProvider(config);

    case 'openai':
      throw new Error('[AIProviderManager] OpenAI 提供商尚未实现');

    case 'anthropic':
      throw new Error('[AIProviderManager] Anthropic 提供商尚未实现');

    case 'custom':
      throw new Error('[AIProviderManager] 自定义提供商尚未实现');

    default:
      throw new Error(`[AIProviderManager] 未知的提供商类型: ${type}`);
  }
}
