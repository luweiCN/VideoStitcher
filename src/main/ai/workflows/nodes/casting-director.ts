/**
 * 选角导演 Agent
 * Agent 3: 为每个角色生成三视图（正面、侧面、动作）并调用图像生成 API
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions, ImageGenerationOptions } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';
import { CastingDirectorAgentPrompts } from '../../prompts/casting-director-agent';

/**
 * 选角导演 Agent 节点
 *
 * 注意：在导演模式下，角色图像生成由前端单独调用 aside:generate-character-image
 * 工作流中的选角导演节点只负责生成分镜师需要的上下文数据
 */
export async function castingDirectorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 3: 选角导演] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成
    if (state.step3_storyboard) {
      console.log('[Agent 3: 选角导演] 步骤已完成，跳过执行');
      return {};
    }

    // 1. 获取艺术总监的输出
    const artDirectorOutput = state.step2_characters?.content;
    if (!artDirectorOutput || !artDirectorOutput.character_profiles) {
      throw new Error('[Agent 3: 选角导演] 缺少艺术总监的角色输出');
    }

    console.log(`[Agent 3: 选角导演] 准备上下文数据（角色图像由前端单独生成）`);

    // 2. 直接使用艺术总监的输出作为选角导演的输出
    // 前端会通过 aside:generate-character-image 单独生成图像并更新角色数据
    const output: StepOutput<any> = {
      content: {
        character_profiles: artDirectorOutput.character_profiles,
        scene_breakdowns: artDirectorOutput.scene_breakdowns || [],
      },
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'none', // 不调用 AI
        tokens: 0,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 3: 选角导演] 完成（仅传递上下文），耗时 ${endTime - startTime}ms`);

    // 3. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step3_storyboard: output,
      currentStep: 4,
    };

    // 导演模式：不设置 humanApproval = false，让工作流继续执行到分镜师
    // 分镜师节点会在完成后设置暂停
    return updates;
  } catch (error) {
    console.error('[Agent 3: 选角导演] 执行失败:', error);
    throw error;
  }
}
