/**
 * 艺术总监 Agent Node
 * 根据剧本提炼精华、创作角色和场景
 */

import type { WorkflowState, StepOutput } from '../state';
import { runArtDirectorAgent, type ArtDirectorContext } from '../../agents/art-director';
import { getCultureProfile } from '../../prompts/culture-profiles';

/**
 * 艺术总监 Agent 节点
 *
 * @param state 当前工作流状态
 * @returns 状态更新（部分）
 */
export async function artDirectorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[艺术总监] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成
    if (state.step2_characters) {
      console.log('[艺术总监] 步骤已完成，跳过执行');
      return {};
    }

    // 2. 获取上下文信息
    const { project, creativeDirection, persona, region, step1_script, videoSpec } = state;

    if (!project || !creativeDirection || !persona || !step1_script) {
      throw new Error('[艺术总监] 缺少必要的上下文信息');
    }

    // 3. 获取地区文化档案
    const cultureProfile = getCultureProfile(region);

    // 4. 构建 ArtDirectorContext
    const context: ArtDirectorContext = {
      project,
      creativeDirection,
      persona,
      cultureProfile,
      regionName: region,
      scriptContent: step1_script.content,
      duration: videoSpec.duration === 'short' ? '15秒' : '30秒',
      aspectRatio: videoSpec.aspectRatio,
    };

    // 5. 调用 Agent 函数
    console.log('[艺术总监] 调用 LLM...');
    const parsed = await runArtDirectorAgent(context, {}, { info: console.log });

    console.log('[艺术总监] 解析完成');

    // 6. 构建输出
    const output: StepOutput<any> = {
      content: parsed,
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao',
        tokens: 0,
      },
    };

    const endTime = Date.now();
    console.log(`[艺术总监] 完成，耗时 ${endTime - startTime}ms`);

    // 7. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step2_characters: output,
      currentStep: 3,
    };

    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[艺术总监] 失败:', error);
    throw error;
  }
}
