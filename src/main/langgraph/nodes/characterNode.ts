/**
 * 角色设定节点
 * 负责调用豆包 Vision API 生成角色设定和概念图
 */

import { GraphStateType, NodeNames } from '../state';
import log from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// 使用 logger
const logger = log;

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: number, message: string) => void;

/**
 * 角色设定节点配置
 */
export interface CharacterNodeConfig {
  /** 进度回调函数 */
  onProgress?: ProgressCallback;
}

/**
 * 角色设定节点函数
 * @param state 当前状态
 * @param config 配置选项
 */
export async function characterNode(
  state: GraphStateType,
  config?: CharacterNodeConfig
): Promise<Partial<GraphStateType>> {
  logger.info('[角色节点] 开始执行', {
    selectedScriptId: state.selectedScriptId,
  });

  try {
    // 验证输入参数
    if (!state.selectedScriptId) {
      throw new Error('未选择脚本');
    }

    // 找到选中的脚本
    const selectedScript = state.scripts.find((s) => s.id === state.selectedScriptId);

    if (!selectedScript) {
      throw new Error('未找到选中的脚本');
    }

    // 通知进度：开始分析脚本
    config?.onProgress?.(10, '正在分析脚本内容...');

    // 模拟脚本分析延迟
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 通知进度：生成角色设定
    config?.onProgress?.(30, '正在生成角色设定...');

    // TODO: 调用豆包 Vision API 生成角色设定
    // 这里先用模拟数据
    const characters = [];

    // 通知进度：生成主角
    config?.onProgress?.(50, '正在生成主角设定...');

    await new Promise((resolve) => setTimeout(resolve, 400));

    characters.push({
      id: uuidv4(),
      name: '主角',
      description: `基于脚本"${selectedScript.text.substring(0, 50)}..."生成的角色描述`,
      imageUrl: 'https://example.com/character.png',
      createdAt: Date.now(),
    });

    // 通知进度：生成配角
    config?.onProgress?.(70, '正在生成配角设定...');

    await new Promise((resolve) => setTimeout(resolve, 300));

    characters.push({
      id: uuidv4(),
      name: '配角',
      description: '基于脚本生成的次要角色描述',
      imageUrl: 'https://example.com/character2.png',
      createdAt: Date.now(),
    });

    // 通知进度：生成完成
    config?.onProgress?.(100, '角色设定生成完成');

    logger.info('[角色节点] 生成完成', { count: characters.length });

    return {
      characters,
      currentNode: NodeNames.CHARACTER,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('[角色节点] 执行失败', errorMessage);

    // 通知进度：生成失败
    config?.onProgress?.(0, `角色设定生成失败: ${errorMessage}`);

    return {
      error: errorMessage,
      currentNode: NodeNames.CHARACTER,
    };
  }
}
