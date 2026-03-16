/**
 * 火山引擎 API 客户端
 * 负责调用火山引擎的各类 AI API（LLM、Vision、视频生成）
 */

import log from '../utils/logger';

// 使用 logger
const logger = log;

/**
 * API 配置
 */
interface VolcanoConfig {
  /** API Key */
  apiKey: string;
  /** API 基础 URL */
  baseUrl: string;
  /** 请求超时时间（毫秒） */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
}

/**
 * LLM 消息结构
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM 响应结构
 */
interface LLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 图片生成参数
 */
interface ImageGenerateParams {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
}

/**
 * 图片生成响应
 */
interface ImageGenerateResponse {
  data: Array<{
    url: string;
  }>;
}

/**
 * 视频生成参数
 */
interface VideoGenerateParams {
  /** 分镜图片 URL 列表 */
  images: string[];
  /** 视频时长（秒） */
  duration: number;
  /** 视频比例 */
  ratio: '16:9' | '9:16' | '1:1';
  /** 分辨率 */
  resolution?: string;
  /** 音频 URL（可选） */
  audioUrl?: string;
}

/**
 * 视频生成响应
 */
interface VideoGenerateResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * 视频任务状态
 */
interface VideoTaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  video_url?: string;
  error?: string;
}

/**
 * 火山引擎 API 客户端类
 */
export class VolcanoClient {
  private config: VolcanoConfig;

  /**
   * 构造函数
   */
  constructor() {
    // 从环境变量读取配置
    const apiKey = process.env.VOLCANO_ENGINE_API_KEY;

    if (!apiKey) {
      logger.warn('[火山引擎客户端] 未配置 VOLCANO_ENGINE_API_KEY 环境变量');
    }

    this.config = {
      apiKey: apiKey || '',
      baseUrl: process.env.VOLCANO_ENGINE_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      timeout: 30000, // 30 秒超时
      maxRetries: 3, // 最多重试 3 次
    };
  }

  /**
   * 通用请求方法（带重试机制）
   */
  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      // 判断是否需要重试
      if (retryCount < this.config.maxRetries) {
        const isRetryable =
          error instanceof Error &&
          (error.message.includes('网络') ||
            error.message.includes('timeout') ||
            error.message.includes('ECONNRESET'));

        if (isRetryable) {
          logger.warn(
            `[火山引擎客户端] 请求失败，准备第 ${retryCount + 1} 次重试`,
            error.message
          );

          // 指数退避：等待 2^retryCount 秒
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));

          return this.requestWithRetry<T>(endpoint, options, retryCount + 1);
        }
      }

      // 重试次数用完或不可重试的错误，抛出异常
      throw error;
    }
  }

  /**
   * 调用豆包 LLM API
   * @param prompt 用户提示词
   * @param systemPrompt 系统提示词（可选）
   * @returns LLM 生成的文本
   */
  async callLLM(prompt: string, systemPrompt?: string): Promise<string> {
    logger.info('[火山引擎客户端] 调用 LLM API', {
      promptLength: prompt.length,
      hasSystemPrompt: !!systemPrompt,
    });

    const messages: ChatMessage[] = [];

    // 添加系统提示词
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // 添加用户提示词
    messages.push({
      role: 'user',
      content: prompt,
    });

    const response = await this.requestWithRetry<LLMResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: process.env.VOLCANO_ENGINE_MODEL || 'doubao-pro-32k',
        messages,
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('LLM API 返回的数据格式不正确');
    }

    const content = response.choices[0].message.content;

    logger.info('[火山引擎客户端] LLM API 调用成功', {
      responseLength: content.length,
      usage: response.usage,
    });

    return content;
  }

  /**
   * 调用豆包 Vision API 生成图片
   * @param params 图片生成参数
   * @returns 生成的图片 URL
   */
  async generateImage(params: ImageGenerateParams): Promise<string> {
    logger.info('[火山引擎客户端] 调用图片生成 API', {
      promptLength: params.prompt.length,
      style: params.style,
    });

    const response = await this.requestWithRetry<ImageGenerateResponse>('/images/generations', {
      method: 'POST',
      body: JSON.stringify({
        prompt: params.prompt,
        style: params.style,
        width: params.width || 1024,
        height: params.height || 1024,
        n: 1,
        response_format: 'url',
      }),
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('图片生成 API 返回的数据格式不正确');
    }

    const imageUrl = response.data[0].url;

    logger.info('[火山引擎客户端] 图片生成成功', {
      imageUrl,
    });

    return imageUrl;
  }

  /**
   * 调用火山视频生成 API
   * @param params 视频生成参数
   * @returns 任务 ID
   */
  async generateVideo(params: VideoGenerateParams): Promise<string> {
    logger.info('[火山引擎客户端] 调用视频生成 API', {
      imageCount: params.images.length,
      duration: params.duration,
      ratio: params.ratio,
    });

    const response = await this.requestWithRetry<VideoGenerateResponse>('/video/generations', {
      method: 'POST',
      body: JSON.stringify({
        images: params.images,
        duration: params.duration,
        ratio: params.ratio,
        resolution: params.resolution || '1080p',
        audio_url: params.audioUrl,
      }),
    });

    if (!response.task_id) {
      throw new Error('视频生成 API 返回的数据格式不正确');
    }

    logger.info('[火山引擎客户端] 视频生成任务已提交', {
      taskId: response.task_id,
    });

    return response.task_id;
  }

  /**
   * 查询视频任务状态
   * @param taskId 任务 ID
   * @returns 任务状态
   */
  async queryVideoTask(taskId: string): Promise<VideoTaskStatus> {
    logger.info('[火山引擎客户端] 查询视频任务状态', { taskId });

    const response = await this.requestWithRetry<VideoTaskStatus>(
      `/video/tasks/${taskId}`,
      {
        method: 'GET',
      }
    );

    logger.info('[火山引擎客户端] 视频任务状态查询成功', {
      taskId,
      status: response.status,
      progress: response.progress,
    });

    return response;
  }
}
