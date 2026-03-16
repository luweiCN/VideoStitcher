/**
 * 视频生成节点
 * 负责调用火山视频 API 生成最终视频
 */

import { GraphStateType, NodeNames, VideoOutput } from '../state';
import log from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { VolcanoClient } from '../../api/volcano-client';

// 使用 logger
const logger = log;

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * 视频生成节点配置
 */
export interface VideoNodeConfig {
  /** 进度回调函数 */
  onProgress?: ProgressCallback;
}

/**
 * 视频生成节点函数
 * @param state 当前状态
 * @param config 配置选项
 */
export async function videoNode(
  state: GraphStateType,
  config?: VideoNodeConfig
): Promise<Partial<GraphStateType>> {
  logger.info('[视频节点] 开始执行', {
    storyboardCount: state.storyboard.length,
    videoConfig: state.videoConfig,
  });

  try {
    // 验证输入参数
    if (!state.storyboard || state.storyboard.length === 0) {
      throw new Error('分镜列表不能为空');
    }

    if (!state.videoConfig) {
      throw new Error('视频配置不能为空');
    }

    // 通知进度：准备生成视频
    config?.onProgress?.(5, '正在准备视频生成任务...');

    // 创建火山引擎客户端
    const client = new VolcanoClient();

    // 收集分镜图片 URL
    const imageUrls = state.storyboard
      .filter((scene) => scene.imageUrl)
      .map((scene) => scene.imageUrl!);

    if (imageUrls.length === 0) {
      throw new Error('没有有效的分镜图片');
    }

    // 通知进度：提交任务到火山引擎
    config?.onProgress?.(10, '正在提交任务到火山引擎...');

    // 调用火山视频 API 生成视频
    const taskId = await client.generateVideo({
      images: imageUrls,
      duration: state.videoConfig.length,
      ratio: state.videoConfig.ratio,
      resolution: state.videoConfig.resolution,
    });

    logger.info('[视频节点] 视频生成任务已提交', { taskId });

    // 通知进度：开始处理
    config?.onProgress?.(15, '视频生成任务已提交，等待处理...');

    // 轮询任务状态
    let videoUrl: string | undefined;
    let lastProgress = 15;
    const maxPollingTime = 10 * 60 * 1000; // 最多轮询 10 分钟
    const pollingInterval = 3000; // 每 3 秒查询一次
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollingTime) {
      try {
        // 查询任务状态
        const taskStatus = await client.queryVideoTask(taskId);

        logger.info('[视频节点] 任务状态查询', {
          taskId,
          status: taskStatus.status,
          progress: taskStatus.progress,
        });

        // 更新进度
        if (taskStatus.progress > lastProgress) {
          const progressDiff = taskStatus.progress - lastProgress;
          lastProgress = taskStatus.progress;
          config?.onProgress?.(
            taskStatus.progress,
            `正在生成视频... ${taskStatus.progress}%`
          );
        }

        // 检查任务状态
        if (taskStatus.status === 'completed') {
          videoUrl = taskStatus.video_url;
          logger.info('[视频节点] 视频生成完成', { taskId, videoUrl });
          break;
        }

        if (taskStatus.status === 'failed') {
          throw new Error(taskStatus.error || '视频生成失败');
        }

        // 等待一段时间后继续轮询
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error('[视频节点] 任务状态查询失败', {
          taskId,
          error: errorMessage,
        });

        // 如果是查询失败，继续重试
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));
      }
    }

    // 检查是否超时
    if (!videoUrl) {
      throw new Error('视频生成超时（超过 10 分钟）');
    }

    // 生成视频数据
    const videos: VideoOutput[] = [
      {
        id: uuidv4(),
        url: videoUrl,
        status: 'completed',
        progress: 100,
        taskId: taskId,
        createdAt: Date.now(),
      },
    ];

    // 通知进度：生成完成
    config?.onProgress?.(100, '视频生成完成');

    logger.info('[视频节点] 生成完成', { count: videos.length, taskId });

    return {
      videos,
      currentNode: NodeNames.VIDEO,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[视频节点] 执行失败', errorMessage);

    // 通知进度：生成失败
    config?.onProgress?.(0, `视频生成失败: ${errorMessage}`);

    return {
      error: errorMessage,
      currentNode: NodeNames.VIDEO,
    };
  }
}
