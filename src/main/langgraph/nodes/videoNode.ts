/**
 * 视频生成节点
 * 负责调用火山视频 API 生成最终视频
 */

import { GraphStateType, NodeNames } from '../state';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

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

    // 模拟准备延迟
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 通知进度：提交任务到火山引擎
    config?.onProgress?.(10, '正在提交任务到火山引擎...');

    // TODO: 调用火山视频 API 生成视频
    // 这里先用模拟数据
    const taskId = `volcano-task-${Date.now()}`;

    // 模拟任务处理过程
    const progressSteps = [
      { progress: 20, message: '火山引擎已接受任务...' },
      { progress: 40, message: '正在合成视频...' },
      { progress: 60, message: '正在添加特效...' },
      { progress: 80, message: '正在渲染视频...' },
      { progress: 90, message: '正在上传视频...' },
    ];

    for (const step of progressSteps) {
      config?.onProgress?.(step.progress, step.message);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // 生成视频数据
    const videos = [
      {
        id: uuidv4(),
        url: 'https://example.com/video.mp4',
        status: 'completed' as const,
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
