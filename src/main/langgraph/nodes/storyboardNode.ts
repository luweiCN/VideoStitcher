/**
 * 分镜生成节点
 * 负责调用豆包 Vision API 生成分镜图像
 */

import { GraphStateType, NodeNames } from '../state';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * 分镜生成节点配置
 */
export interface StoryboardNodeConfig {
  /** 进度回调函数 */
  onProgress?: ProgressCallback;
}

/**
 * 分镜生成节点函数
 * @param state 当前状态
 * @param config 配置选项
 */
export async function storyboardNode(
  state: GraphStateType,
  config?: StoryboardNodeConfig
): Promise<Partial<GraphStateType>> {
  logger.info('[分镜节点] 开始执行', {
    characterCount: state.characters.length,
  });

  try {
    // 验证输入参数
    if (!state.characters || state.characters.length === 0) {
      throw new Error('角色列表不能为空');
    }

    if (!state.selectedScriptId) {
      throw new Error('未选择脚本');
    }

    // 通知进度：开始生成分镜
    config?.onProgress?.(10, '正在分析角色和脚本...');

    // 模拟分析延迟
    await new Promise((resolve) => setTimeout(resolve, 300));

    // TODO: 调用豆包 Vision API 生成分镜
    // 这里先用模拟数据
    const storyboard = [];

    // 生成分镜场景列表
    const scenes = [
      { sceneNumber: 1, description: '开场镜头 - 基于角色和脚本生成的场景描述', duration: 3 },
      { sceneNumber: 2, description: '发展镜头 - 基于角色和脚本生成的场景描述', duration: 4 },
      { sceneNumber: 3, description: '高潮镜头 - 基于角色和脚本生成的场景描述', duration: 5 },
      { sceneNumber: 4, description: '结尾镜头 - 基于角色和脚本生成的场景描述', duration: 3 },
    ];

    // 逐个生成分镜
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const progress = Math.round(((i + 1) / scenes.length) * 100);
      config?.onProgress?.(progress, `正在生成分镜 ${i + 1}/${scenes.length}...`);

      // 模拟图像生成延迟
      await new Promise((resolve) => setTimeout(resolve, 500));

      storyboard.push({
        id: uuidv4(),
        sceneNumber: scene.sceneNumber,
        description: scene.description,
        imageUrl: `https://example.com/scene${scene.sceneNumber}.png`,
        duration: scene.duration,
        createdAt: Date.now(),
      });
    }

    // 通知进度：生成完成
    config?.onProgress?.(100, '分镜生成完成');

    logger.info('[分镜节点] 生成完成', { count: storyboard.length });

    return {
      storyboard,
      currentNode: NodeNames.STORYBOARD,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[分镜节点] 执行失败', errorMessage);

    // 通知进度：生成失败
    config?.onProgress?.(0, `分镜生成失败: ${errorMessage}`);

    return {
      error: errorMessage,
      currentNode: NodeNames.STORYBOARD,
    };
  }
}
