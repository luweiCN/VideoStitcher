/**
 * 脚本生成节点
 * 负责调用豆包 LLM API 批量生成脚本
 */

import { GraphStateType, NodeNames } from '../state';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 脚本生成节点函数
 */
export async function scriptNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  logger.info('[脚本节点] 开始执行', {
    userRequirement: state.userRequirement,
    selectedStyle: state.selectedStyle,
    batchSize: state.batchSize,
  });

  try {
    // TODO: 调用豆包 LLM API 生成脚本
    // 这里先用模拟数据
    const scripts = [];

    for (let i = 0; i < state.batchSize; i++) {
      scripts.push({
        id: uuidv4(),
        text: `这是第 ${i + 1} 条模拟脚本，风格：${state.selectedStyle}，需求：${state.userRequirement}`,
        style: state.selectedStyle,
        createdAt: Date.now(),
        selected: false,
      });
    }

    logger.info('[脚本节点] 生成完成', { count: scripts.length });

    return {
      scripts,
      currentNode: NodeNames.SCRIPT,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[脚本节点] 执行失败', errorMessage);

    return {
      error: errorMessage,
      currentNode: NodeNames.SCRIPT,
    };
  }
}
