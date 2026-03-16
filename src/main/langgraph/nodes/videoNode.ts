/**
 * 视频生成节点
 * 负责调用火山视频 API 生成最终视频
 */

import { GraphStateType, NodeNames } from '../state';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 视频生成节点函数
 */
export async function videoNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.info('[视频节点] 开始执行', {
    storyboardCount: state.storyboard.length,
    videoConfig: state.videoConfig,
  });

  try {
    // TODO: 调用火山视频 API 生成视频
    // 这里先用模拟数据
    const videos = [
      {
        id: uuidv4(),
        url: 'https://example.com/video.mp4',
        status: 'completed' as const,
        progress: 100,
        taskId: 'volcano-task-123',
        createdAt: Date.now(),
      },
    ];

    logger.info('[视频节点] 生成完成', { count: videos.length });

    return {
      videos,
      currentNode: NodeNames.VIDEO,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[视频节点] 执行失败', errorMessage);

    return {
      error: errorMessage,
      currentNode: NodeNames.VIDEO,
    };
  }
}
