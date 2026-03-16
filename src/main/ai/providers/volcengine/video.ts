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
    this.model = config.model || 'seedance-2-0';

    console.log('[VolcEngineVideo] 初始化视频生成客户端', {
      baseUrl: this.baseUrl,
      model: this.model,
    });
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
   * 创建视频生成任务
   */
  private async createVideoTask(
    imageUrl: string,
    prompt?: string,
    options?: VideoGenerationOptions
  ): Promise<{ taskId: string }> {
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: {
          type: 'image',
          url: imageUrl,
        },
        prompt: prompt || '',
        duration: options?.duration || 5,
        aspect_ratio: options?.aspectRatio || '16:9',
        fps: options?.fps || 24,
        resolution: options?.resolution || '1080p',
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
            videoUrl: data.output?.video_url || data.video_url,
          };
        }

        if (status === 'failed') {
          return {
            taskId,
            status: 'failed',
            error: data.error || data.message || '视频生成失败',
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
      processing: 'processing',
      running: 'processing',
      completed: 'completed',
      success: 'completed',
      failed: 'failed',
      error: 'failed',
    };

    return statusMap[status.toLowerCase()] || 'pending';
  }
}
