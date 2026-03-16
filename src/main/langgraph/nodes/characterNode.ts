/**
 * 角色设定节点
 * 负责调用豆包 Vision API 生成角色设定和概念图
 */

import { GraphStateType, NodeNames } from '../state';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 角色设定节点函数
 */
export async function characterNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.info('[角色节点] 开始执行', {
    selectedScriptId: state.selectedScriptId,
  });

  try {
    // 找到选中的脚本
    const selectedScript = state.scripts.find((s) => s.id === state.selectedScriptId);

    if (!selectedScript) {
      throw new Error('未找到选中的脚本');
    }

    // TODO: 调用豆包 Vision API 生成角色设定
    // 这里先用模拟数据
    const characters = [
      {
        id: uuidv4(),
        name: '主角',
        description: `基于脚本"${selectedScript.text.substring(0, 50)}..."生成的角色描述`,
        imageUrl: 'https://example.com/character.png',
        createdAt: Date.now(),
      },
    ];

    logger.info('[角色节点] 生成完成', { count: characters.length });

    return {
      characters,
      currentNode: NodeNames.CHARACTER,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[角色节点] 执行失败', errorMessage);

    return {
      error: errorMessage,
      currentNode: NodeNames.CHARACTER,
    };
  }
}
