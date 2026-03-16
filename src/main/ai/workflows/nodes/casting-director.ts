/**
 * 选角导演 Agent
 * Agent 2: 根据脚本生成人物卡片
 */

import type { WorkflowState, CharacterCard } from '../state';

/**
 * 选角导演 Agent 节点
 */
export async function castingDirectorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 2: 选角导演] 开始执行');

  // TODO: 实现人物卡片生成逻辑
  // 1. 从脚本中提取人物
  // 2. 为每个人物生成概念图
  // 3. 创建人物卡片

  const characters: CharacterCard[] = [
    {
      id: 'char-1',
      name: '主角',
      description: '根据脚本生成的人物描述',
      imageUrl: 'https://example.com/placeholder.jpg',
    },
  ];

  console.log('[Agent 2: 选角导演] 完成');
  return {
    step2_characters: characters,
    currentStep: 3,
  };
}
