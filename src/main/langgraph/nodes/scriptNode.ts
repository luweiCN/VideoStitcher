/**
 * 脚本生成节点
 * 负责调用豆包 LLM API 批量生成脚本
 */

import { GraphStateType, NodeNames } from '../state';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * 脚本生成节点配置
 */
export interface ScriptNodeConfig {
  /** 进度回调函数 */
  onProgress?: ProgressCallback;
}

/**
 * 脚本生成节点函数
 * @param state 当前状态
 * @param config 配置选项
 */
export async function scriptNode(
  state: GraphStateType,
  config?: ScriptNodeConfig
): Promise<Partial<GraphStateType>> {
  logger.info('[脚本节点] 开始执行', {
    userRequirement: state.userRequirement,
    selectedStyle: state.selectedStyle,
    batchSize: state.batchSize,
  });

  try {
    // 验证输入参数
    if (!state.userRequirement || state.userRequirement.trim().length === 0) {
      throw new Error('用户需求不能为空');
    }

    if (!state.selectedStyle || state.selectedStyle.trim().length === 0) {
      throw new Error('脚本风格不能为空');
    }

    if (state.batchSize < 1 || state.batchSize > 10) {
      throw new Error('批量生成数量必须在 1-10 之间');
    }

    // 通知进度：开始生成
    config?.onProgress?.(0, '开始生成脚本...');

    // TODO: 调用豆包 LLM API 生成脚本
    // 这里先用模拟数据
    const scripts = [];

    for (let i = 0; i < state.batchSize; i++) {
      // 通知进度：正在生成第 i+1 个脚本
      const progress = Math.round(((i + 1) / state.batchSize) * 100);
      config?.onProgress?.(progress, `正在生成第 ${i + 1}/${state.batchSize} 个脚本...`);

      // 模拟 API 调用延迟
      await new Promise((resolve) => setTimeout(resolve, 200));

      scripts.push({
        id: uuidv4(),
        text: `这是第 ${i + 1} 条模拟脚本，风格：${state.selectedStyle}，需求：${state.userRequirement}`,
        style: state.selectedStyle,
        createdAt: Date.now(),
        selected: false,
      });
    }

    // 通知进度：生成完成
    config?.onProgress?.(100, '脚本生成完成');

    logger.info('[脚本节点] 生成完成', { count: scripts.length });

    return {
      scripts,
      currentNode: NodeNames.SCRIPT,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[脚本节点] 执行失败', errorMessage);

    // 通知进度：生成失败
    config?.onProgress?.(0, `脚本生成失败: ${errorMessage}`);

    return {
      error: errorMessage,
      currentNode: NodeNames.SCRIPT,
    };
  }
}
