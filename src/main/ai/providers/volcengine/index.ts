/**
 * 火山引擎 AI 提供商 - 主入口
 *
 * 整合火山引擎所有 AI 能力：
 * - 文本生成（豆包大语言模型）
 * - 图片生成（Seedream 3.0）
 * - 语音合成（可选）
 * - 视频生成（可选）
 */

import type {
  AIProvider,
  ProviderConfig,
  TextGenerationOptions,
  TextGenerationResult,
  ImageGenerationOptions,
  ImageGenerationResult,
  SpeechSynthesisOptions,
  SpeechSynthesisResult,
  VideoGenerationOptions,
  VideoGenerationResult,
} from '../interface';
import { VolcEngineLLM } from './llm';
import { VolcEngineImage } from './image';
import { VolcEngineVideo } from './video';

/**
 * 火山引擎 AI 提供商
 *
 * 实现所有 AI 能力的统一接口
 */
export class VolcEngineProvider implements AIProvider {
  /** 提供商名称 */
  readonly name = 'volcengine';

  /** LLM 客户端 */
  private llm: VolcEngineLLM | null = null;

  /** 图片生成客户端 */
  private image: VolcEngineImage | null = null;

  /** 视频生成客户端 */
  private video: VolcEngineVideo | null = null;

  /** 提供商配置 */
  private config: ProviderConfig;

  /**
   * 构造函数
   * @param config 提供商配置
   */
  constructor(config: ProviderConfig) {
    // 验证配置
    this.validateConfig(config);

    this.config = config;

    // 初始化 LLM
    if (config.features.textGeneration) {
      this.llm = new VolcEngineLLM({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });
      console.log('[VolcEngineProvider] LLM 初始化成功');
    } else {
      console.log('[VolcEngineProvider] LLM 功能未启用');
    }

    // 初始化图片生成
    if (config.features.imageGeneration) {
      this.image = new VolcEngineImage({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });
      console.log('[VolcEngineProvider] 图片生成初始化成功');
    } else {
      console.log('[VolcEngineProvider] 图片生成功能未启用');
    }

    // 初始化视频生成
    if (config.features.videoGeneration) {
      this.video = new VolcEngineVideo({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });
      console.log('[VolcEngineProvider] 视频生成初始化成功');
    } else {
      console.log('[VolcEngineProvider] 视频生成功能未启用');
    }

    console.log('[VolcEngineProvider] 提供商初始化完成', {
      textGeneration: config.features.textGeneration,
      imageGeneration: config.features.imageGeneration,
      speechSynthesis: config.features.speechSynthesis,
      videoGeneration: config.features.videoGeneration,
    });
  }

  /**
   * 验证配置
   * @param config 提供商配置
   */
  private validateConfig(config: ProviderConfig): void {
    // 验证 API Key
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new Error('[VolcEngineProvider] API 密钥不能为空');
    }

    // 验证至少启用一个功能
    const hasAnyFeature =
      config.features.textGeneration ||
      config.features.imageGeneration ||
      config.features.speechSynthesis ||
      config.features.videoGeneration;

    if (!hasAnyFeature) {
      throw new Error('[VolcEngineProvider] 至少需要启用一个 AI 功能');
    }

    console.log('[VolcEngineProvider] 配置验证通过');
  }

  /**
   * 生成文本
   *
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成结果
   */
  async generateText(
    prompt: string,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    // 检查功能是否启用
    if (!this.config.features.textGeneration) {
      throw new Error('[VolcEngineProvider] 文本生成功能未启用');
    }

    // 检查模块是否初始化
    if (!this.llm) {
      throw new Error('[VolcEngineProvider] LLM 模块未初始化,请检查配置');
    }

    console.log('[VolcEngineProvider] 调用文本生成', {
      prompt: prompt.substring(0, 50),
      options,
    });

    // 委托给 LLM 实现
    return await this.llm.generateText(prompt, options);
  }

  /**
   * 流式生成文本
   *
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 文本流
   */
  async *generateTextStream(
    prompt: string,
    options?: TextGenerationOptions
  ): AsyncIterable<string> {
    // 检查功能是否启用
    if (!this.config.features.textGeneration) {
      throw new Error('[VolcEngineProvider] 文本生成功能未启用');
    }

    // 检查模块是否初始化
    if (!this.llm) {
      throw new Error('[VolcEngineProvider] LLM 模块未初始化,请检查配置');
    }

    console.log('[VolcEngineProvider] 调用流式文本生成', {
      prompt: prompt.substring(0, 50),
      options,
    });

    // 委托给 LLM 实现
    yield* this.llm.generateTextStream(prompt, options);
  }

  /**
   * 生成图片
   *
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成结果
   */
  async generateImage(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<ImageGenerationResult> {
    // 检查功能是否启用
    if (!this.config.features.imageGeneration) {
      throw new Error('[VolcEngineProvider] 图片生成功能未启用');
    }

    // 检查模块是否初始化
    if (!this.image) {
      throw new Error('[VolcEngineProvider] 图片生成模块未初始化,请检查配置');
    }

    console.log('[VolcEngineProvider] 调用图片生成', {
      prompt: prompt.substring(0, 50),
      options,
    });

    // 委托给图片生成实现
    return await this.image.generateImage(prompt, options);
  }

  /**
   * 合成语音（可选）
   *
   * @param text 文本内容
   * @param options 合成选项
   * @returns 合成结果
   */
  async synthesizeSpeech?(
    text: string,
    options?: SpeechSynthesisOptions
  ): Promise<SpeechSynthesisResult> {
    // 检查功能是否启用
    if (!this.config.features.speechSynthesis) {
      throw new Error('[VolcEngineProvider] 语音合成功能未启用');
    }

    console.log('[VolcEngineProvider] 语音合成功能暂未实现');

    // TODO: Task #42 - 实现火山引擎语音合成
    throw new Error('[VolcEngineProvider] 语音合成功能暂未实现，请等待后续版本');
  }

  /**
   * 生成视频（可选）
   *
   * @param prompt 提示词或图片 URL
   * @param options 生成选项
   * @returns 生成结果
   */
  async generateVideo?(
    prompt: string,
    options?: VideoGenerationOptions
  ): Promise<VideoGenerationResult> {
    // 检查功能是否启用
    if (!this.config.features.videoGeneration) {
      throw new Error('[VolcEngineProvider] 视频生成功能未启用');
    }

    if (!this.video) {
      throw new Error('[VolcEngineProvider] 视频生成模块未初始化,请检查配置');
    }

    console.log('[VolcEngineProvider] 开始生成视频');

    // 检查是否是图片 URL（以 http 开头）
    const isImageUrl = prompt.startsWith('http://') || prompt.startsWith('https://');

    if (isImageUrl) {
      // 图生视频
      return await this.video.generateVideoFromImage(prompt, undefined, options);
    } else {
      // 文生视频（暂不支持）
      throw new Error('[VolcEngineProvider] 暂不支持文生视频，请使用图生视频');
    }
  }

  /**
   * 健康检查
   *
   * 检查所有已启用功能是否正常
   * @returns 服务是否正常
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('[VolcEngineProvider] 开始健康检查');

      const checks: boolean[] = [];

      // 检查 LLM（如果启用）
      if (this.config.features.textGeneration && this.llm) {
        try {
          // 使用一个简单的提示词测试 LLM
          await this.llm.generateText('ping', {
            maxTokens: 10,
          });
          checks.push(true);
          console.log('[VolcEngineProvider] LLM 健康检查通过');
        } catch (error) {
          console.error('[VolcEngineProvider] LLM 健康检查失败:', error);
          checks.push(false);
        }
      }

      // 检查图片生成（如果启用）
      if (this.config.features.imageGeneration && this.image) {
        try {
          const imageHealthy = await this.image.healthCheck();
          checks.push(imageHealthy);
          console.log('[VolcEngineProvider] 图片生成健康检查:', imageHealthy ? '通过' : '失败');
        } catch (error) {
          console.error('[VolcEngineProvider] 图片生成健康检查失败:', error);
          checks.push(false);
        }
      }

      // 如果没有启用任何功能，返回 false
      if (checks.length === 0) {
        console.warn('[VolcEngineProvider] 未启用任何功能，健康检查失败');
        return false;
      }

      // 所有检查都通过才返回 true
      const allHealthy = checks.every((check) => check);

      console.log('[VolcEngineProvider] 健康检查完成', {
        allHealthy,
        checkResults: checks,
      });

      return allHealthy;
    } catch (error) {
      console.error('[VolcEngineProvider] 健康检查异常:', error);
      return false;
    }
  }
}

/**
 * 创建火山引擎提供商实例
 *
 * @param config 提供商配置
 * @returns 火山引擎提供商实例
 */
export function createVolcEngineProvider(config: ProviderConfig): AIProvider {
  return new VolcEngineProvider(config);
}
