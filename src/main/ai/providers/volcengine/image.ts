/**
 * 火山引擎 - 图片生成实现
 *
 * 使用 Doubao Seedream 5.0 模型生成图片
 */

import type { AIProvider, ImageGenerationOptions, ImageGenerationResult } from '../interface';

/**
 * 火山引擎图片生成配置
 */
export interface VolcEngineImageConfig {
  /** API 密钥 */
  apiKey: string;
  /** 基础 URL */
  baseUrl?: string;
  /** 模型名称（默认：doubao-seedream-5-0-260128） */
  model?: string;
}

/**
 * 火山引擎图片生成 API 响应
 */
interface VolcEngineImageResponse {
  /** 创建时间戳 */
  created: number;
  /** 图片数据列表 */
  data: Array<{
    /** 图片 URL 或 base64 */
    url?: string;
    /** Base64 图片数据 */
    b64_json?: string;
    /** 优化后的提示词 */
    revised_prompt?: string;
  }>;
}

/**
 * 火山引擎图片生成 API 错误
 */
interface VolcEngineImageError {
  /** 错误信息 */
  error: {
    /** 错误消息 */
    message: string;
    /** 错误类型 */
    type: string;
    /** 错误代码 */
    code: string;
  };
}

/**
 * 常量定义
 */
const MAX_PROMPT_LENGTH = 4000;
const MIN_IMAGE_COUNT = 1;
const MAX_IMAGE_COUNT = 4;
const REQUEST_TIMEOUT = 300000; // 300 秒（4K 图片生成需要较长时间）
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000; // 1 秒

/**
 * 支持的图片尺寸（火山引擎 Seedream 5.0）
 */
const SUPPORTED_SIZES = [
  '1K',
  '2K',
  '4K',
  '512x512',
  '768x768',
  '1024x1024',
  '1024x1792',
  '1792x1024',
] as const;

/**
 * 火山引擎 - 图片生成
 *
 * 实现 AI 图片生成功能
 */
export class VolcEngineImage implements Pick<AIProvider, 'generateImage' | 'healthCheck'> {
  /** 提供商名称 */
  readonly name = 'volcengine-image';

  /** 配置信息 */
  private config: Required<VolcEngineImageConfig>;

  /**
   * 构造函数
   * @param config 配置参数
   */
  constructor(config: VolcEngineImageConfig) {
    // 验证必填参数
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new Error('[VolcEngineImage] API 密钥不能为空');
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
      model: config.model || 'doubao-seedream-5-0-260128',
    };
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
    try {
      console.log('[VolcEngineImage] 开始图片生成', {
        prompt: prompt.substring(0, 50),
        options,
      });

      // 参数验证
      this.validateParameters(prompt, options);

      // 构建请求体
      const requestBody = this.buildRequestBody(prompt, options);

      // 调用 API
      const response = await this.callAPI(requestBody);

      // 解析响应
      const result = this.parseResponse(response);

      console.log('[VolcEngineImage] 图片生成完成', {
        imageCount: result.images.length,
        created: result.created,
      });

      return result;
    } catch (error) {
      console.error('[VolcEngineImage] 图片生成失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   * @returns 服务是否正常
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('[VolcEngineImage] 开始健康检查');

      // 使用最小的请求测试连通性
      await this.callAPI({
        model: this.config.model,
        prompt: 'test',
        size: '2K',
        sequential_image_generation: 'disabled',
        response_format: 'url',
        stream: false,
        watermark: true,
      });

      console.log('[VolcEngineImage] 健康检查成功');
      return true;
    } catch (error) {
      console.error('[VolcEngineImage] 健康检查失败:', error);
      return false;
    }
  }

  /**
   * 验证参数
   * @param prompt 提示词
   * @param options 生成选项
   */
  private validateParameters(prompt: string, options?: ImageGenerationOptions): void {
    // 验证 prompt
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('提示词不能为空');
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new Error(`提示词长度超出限制（当前 ${prompt.length}，最大 ${MAX_PROMPT_LENGTH} 字符）`);
    }

    // 验证 size
    if (options?.size && !SUPPORTED_SIZES.includes(options.size as typeof SUPPORTED_SIZES[number])) {
      throw new Error(
        `不支持的图片尺寸 "${options.size}"，支持的尺寸: ${SUPPORTED_SIZES.join(', ')}`
      );
    }

    // 验证 numberOfImages
    if (options?.numberOfImages !== undefined) {
      if (options.numberOfImages < MIN_IMAGE_COUNT || options.numberOfImages > MAX_IMAGE_COUNT) {
        throw new Error(`图片数量必须在 ${MIN_IMAGE_COUNT}-${MAX_IMAGE_COUNT} 之间（当前 ${options.numberOfImages}）`);
      }
    }

    // 验证 quality
    if (options?.quality && !['standard', 'hd'].includes(options.quality)) {
      throw new Error(`不支持的质量选项 "${options.quality}"，仅支持 "standard" 和 "hd"`);
    }
  }

  /**
   * 构建请求体
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 请求体对象
   */
  private buildRequestBody(prompt: string, options?: ImageGenerationOptions): object {
    const body: Record<string, unknown> = {
      model: this.config.model,
      prompt: prompt,
      // 火山引擎特定参数
      sequential_image_generation: 'disabled',
      response_format: 'url', // 返回格式：url 或 b64_json
      stream: false,
      watermark: true, // 是否添加水印
      output_format: 'png', // 输出格式：png 或 jpeg（Seedream 5.0 lite 支持）
    };

    // 处理尺寸参数
    if (options?.size) {
      // 如果是 1024x1024 格式，转换为 2K
      if (options.size === '1024x1024') {
        body.size = '2K';
      } else {
        body.size = options.size;
      }
    } else {
      body.size = '2K'; // 默认尺寸
    }

    // 添加可选参数（风格和质量暂时不支持，火山引擎有自己的参数）
    if (options?.style) {
      body.style = options.style;
    }

    // 参考图（用于角色/风格一致性控制）
    if (options?.referenceImageUrl) {
      body.reference_image_url = options.referenceImageUrl;
      console.log('[VolcEngineImage] 使用参考图:', options.referenceImageUrl.substring(0, 60));
    }

    return body;
  }

  /**
   * 调用 API（带超时和重试机制）
   * @param requestBody 请求体
   * @param retryCount 当前重试次数
   * @returns API 响应
   */
  private async callAPI(requestBody: object, retryCount = 0): Promise<VolcEngineImageResponse> {
    const url = `${this.config.baseUrl}/images/generations`;

    console.log('[VolcEngineImage] 调用 API', { url, requestBody, retryCount });

    try {
      // 创建超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 检查 HTTP 状态
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API 请求失败 (${response.status}): ${errorText}`;

        // 尝试解析错误响应
        try {
          const errorJson: VolcEngineImageError = JSON.parse(errorText);
          errorMessage = `API 错误: ${errorJson.error.message} (类型: ${errorJson.error.type}, 代码: ${errorJson.error.code})`;
        } catch {
          // 无法解析为 JSON，使用原始错误消息
        }

        // 针对不同错误类型抛出特定异常
        if (response.status === 401 || response.status === 403) {
          throw new Error(`认证失败: ${errorMessage}`);
        } else if (response.status === 429) {
          throw new Error(`API 配额不足: ${errorMessage}`);
        } else if (response.status >= 500) {
          throw new Error(`服务器错误: ${errorMessage}`);
        }

        throw new Error(errorMessage);
      }

      // 解析响应
      const data: VolcEngineImageResponse = await response.json();
      return data;
    } catch (error) {
      // 判断是否需要重试
      if (retryCount < MAX_RETRIES) {
        const isRetryable =
          error instanceof Error &&
          (error.message.includes('网络') ||
            error.message.includes('timeout') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('服务器错误'));

        if (isRetryable) {
          console.warn(
            `[VolcEngineImage] 请求失败，准备第 ${retryCount + 1} 次重试`,
            error.message
          );

          // 指数退避：等待 2^retryCount 秒
          const delay = Math.pow(2, retryCount) * RETRY_BASE_DELAY;
          await new Promise((resolve) => setTimeout(resolve, delay));

          return this.callAPI(requestBody, retryCount + 1);
        }
      }

      // 重试次数用完或不可重试的错误，抛出异常
      throw error;
    }
  }

  /**
   * 解析响应
   * @param response API 响应
   * @returns 统一格式的结果
   */
  private parseResponse(response: VolcEngineImageResponse): ImageGenerationResult {
    // 检查响应数据
    if (!response.data || response.data.length === 0) {
      throw new Error('API 返回的图片数据为空');
    }

    // 转换图片数据
    const images = response.data.map((item) => {
      // 优先使用 URL，如果没有则使用 base64 数据
      let imageUrl: string;

      if (item.url) {
        imageUrl = item.url;
      } else if (item.b64_json) {
        // 构建 base64 data URL
        imageUrl = `data:image/png;base64,${item.b64_json}`;
      } else {
        throw new Error('图片数据既没有 URL 也没有 base64 数据');
      }

      return {
        url: imageUrl,
        revisedPrompt: item.revised_prompt,
      };
    });

    return {
      images,
      created: response.created,
    };
  }
}
