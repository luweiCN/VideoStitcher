/**
 * AI 配置模块导出
 */

export { AIConfigManager } from './manager';
export type {
  AIConfig,
  ProviderConfig,
  VolcEngineConfig,
  OpenAIConfig,
  CustomConfig,
  AIFeatures,
  ConfigValidationResult,
} from './schema';

/**
 * 创建 AI 配置管理器实例（工厂函数）
 * @param configPath 配置文件路径（可选）
 * @returns AI 配置管理器实例
 */
export function createAIConfigManager(configPath?: string): AIConfigManager {
  return new AIConfigManager(configPath);
}
