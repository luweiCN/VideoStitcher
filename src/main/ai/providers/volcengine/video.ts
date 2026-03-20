/**
 * 火山引擎视频生成客户端
 *
 * 使用 Seedance 模型实现图生视频能力
 */

import type {
  VideoGenerationOptions,
  VideoGenerationResult,
} from '../interface';

/**
 * 火山引擎视频生成配置
 */
export interface VolcEngineVideoConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * 火山引擎视频生成任务状态
 */
interface VideoTaskStatus {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

/**
 * 火山引擎视频生成客户端
 */
export class VolcEngineVideo {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: VolcEngineVideoConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    this.model = config.model || 'doubao-seedance-1-0-lite-i2v-250428';

    console.log('[VolcEngineVideo] 初始化视频生成客户端', {
      baseUrl: this.baseUrl,
      model: this.model,
    });
  }

  /**
   * 文生视频
   *
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 视频生成结果
   */
  async generateVideoFromText(
    prompt: string,
    options?: VideoGenerationOptions
  ): Promise<VideoGenerationResult> {
    console.log('[VolcEngineVideo] 开始文生视频', {
      prompt: prompt.substring(0, 80),
      duration: options?.duration || 5,
    });

    try {
      const task = await this.createVideoTask(undefined, prompt, options);
      console.log('[VolcEngineVideo] 视频任务已创建:', task.taskId);

      const result = await this.pollTaskStatus(task.taskId);

      if (result.status === 'failed') {
        throw new Error(result.error || '视频生成失败');
      }

      if (!result.videoUrl) {
        throw new Error('视频生成成功，但未返回视频 URL');
      }

      console.log('[VolcEngineVideo] 视频生成完成:', result.videoUrl);

      return {
        videoUrl: result.videoUrl,
        duration: options?.duration || 5,
        resolution: options?.resolution || '720p',
        fileSize: 0,
      };
    } catch (error) {
      console.error('[VolcEngineVideo] 文生视频失败:', error);
      throw error;
    }
  }

  /**
   * 图生视频（首帧）
   *
   * @param imageUrl 首帧图片 URL
   * @param prompt 提示词（可选）
   * @param options 生成选项
   * @returns 视频生成结果
   */
  async generateVideoFromImage(
    imageUrl: string,
    prompt?: string,
    options?: VideoGenerationOptions
  ): Promise<VideoGenerationResult> {
    console.log('[VolcEngineVideo] 开始图生视频', {
      imageUrl: imageUrl.substring(0, 50) + '...',
      prompt,
      duration: options?.duration || 5,
    });

    try {
      // 1. 创建视频生成任务
      const task = await this.createVideoTask(imageUrl, prompt, options);
      console.log('[VolcEngineVideo] 视频任务已创建:', task.taskId);

      // 2. 轮询任务状态
      const result = await this.pollTaskStatus(task.taskId);

      if (result.status === 'failed') {
        throw new Error(result.error || '视频生成失败');
      }

      if (!result.videoUrl) {
        throw new Error('视频生成成功，但未返回视频 URL');
      }

      console.log('[VolcEngineVideo] 视频生成完成:', result.videoUrl);

      return {
        videoUrl: result.videoUrl,
        duration: options?.duration || 5,
        resolution: options?.resolution || '1080p',
        fileSize: 0, // 未知文件大小
      };
    } catch (error) {
      console.error('[VolcEngineVideo] 视频生成失败:', error);
      throw error;
    }
  }

  /**
   * 创建视频生成任务（文生视频 or 图生视频）
   */
  private async createVideoTask(
    imageUrl?: string,
    prompt?: string,
    options?: VideoGenerationOptions
  ): Promise<{ taskId: string }> {
    // 构建 content 数组（与 OpenAI Chat API 格式一致）
    const contentItems: Array<Record<string, unknown>> = [];

    // 提示词（文本）
    if (prompt) {
      contentItems.push({ type: 'text', text: prompt });
    }

    // 首帧图片（图生视频，可选）
    if (imageUrl) {
      contentItems.push({
        type: 'image_url',
        image_url: { url: imageUrl },
        role: 'first_frame',
      });
    }

    // 参考图片列表（role: reference_image → r2v 任务类型）
    // 当前模型 doubao-seedance-1-0-lite-i2v-250428 支持 r2v（参考图生视频）
    if (options?.referenceImageUrls && options.referenceImageUrls.length > 0) {
      const refs = options.referenceImageUrls.slice(0, 4); // API 限制最多 4 张
      for (const refUrl of refs) {
        contentItems.push({
          type: 'image_url',
          image_url: { url: refUrl },
          role: 'reference_image',
        });
      }
      console.log(`[VolcEngineVideo] 添加 ${refs.length} 张参考图（r2v 模式）`);
    }

    const response = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        content: contentItems,
        duration: options?.duration || 5,
        ratio: options?.aspectRatio || '16:9',
        fps: options?.fps || 24,
        resolution: options?.resolution || '720p',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`创建视频任务失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
      taskId: data.id || data.task_id,
    };
  }

  /**
   * 轮询任务状态
   */
  private async pollTaskStatus(
    taskId: string,
    maxAttempts: number = 60,
    interval: number = 5000
  ): Promise<VideoTaskStatus> {
    console.log(`[VolcEngineVideo] 开始轮询任务状态: ${taskId}`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(
          `${this.baseUrl}/contents/generations/tasks/${taskId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`查询任务状态失败: ${response.status}`);
        }

        const data = await response.json();
        const status = this.mapTaskStatus(data.status);

        console.log(
          `[VolcEngineVideo] 任务状态 (${attempt + 1}/${maxAttempts}): ${status}`
        );

        if (status === 'completed') {
          return {
            taskId,
            status: 'completed',
            // 官方文档：视频URL在 content.video_url 字段
            videoUrl: data.content?.video_url,
          };
        }

        if (status === 'failed') {
          return {
            taskId,
            status: 'failed',
            error: data.error?.message || data.error || data.message || '视频生成失败',
          };
        }

        // 等待后继续轮询
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error(`[VolcEngineVideo] 轮询失败 (尝试 ${attempt + 1}):`, error);
        // 继续重试
      }
    }

    throw new Error(`视频生成超时（超过 ${maxAttempts * interval / 1000} 秒）`);
  }

  /**
   * 映射任务状态
   */
  private mapTaskStatus(status: string): VideoTaskStatus['status'] {
    const statusMap: Record<string, VideoTaskStatus['status']> = {
      pending: 'pending',
      queued: 'pending',       // 官方状态：排队中
      processing: 'processing',
      running: 'processing',   // 官方状态：任务运行中
      completed: 'completed',
      succeeded: 'completed',  // 官方状态：任务成功
      success: 'completed',
      failed: 'failed',
      error: 'failed',
      cancelled: 'failed',     // 官方状态：取消任务
      expired: 'failed',       // 官方状态：任务超时
    };

    return statusMap[status.toLowerCase()] || 'pending';
  }
}
