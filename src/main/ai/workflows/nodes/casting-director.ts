/**
 * 选角导演 Agent 节点
 * Agent 3: 为每个角色生成三视图的图像生成提示词
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';
import {
  runCastingDirectorAgent,
  type CastingDirectorContext,
  type CastingDirectorAgentOptions,
} from '../../agents/casting-director';

/**
 * 选角导演 Agent 节点
 *
 * 职责：
 * 1. 接收艺术总监的角色设定和场景描述
 * 2. 调用选角导演 Agent 为每个角色生成三个视角的图像生成提示词
 * 3. 返回包含图像提示词的结果供分镜师使用
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

    console.log(`[Agent 3: 选角导演] 为 ${artDirectorOutput.character_profiles.length} 个角色生成图像提示词`);

    // 2. 构建选角导演上下文
    const context: CastingDirectorContext = {
      characterProfiles: artDirectorOutput.character_profiles,
      sceneBreakdowns: artDirectorOutput.scene_breakdowns || [],
      scriptBrief: artDirectorOutput.script_brief,
      visualStyleTags: artDirectorOutput.script_brief?.visual_style_tags,
      overallTone: artDirectorOutput.script_brief?.overall_tone,
    };

    // 3. 调用选角导演 Agent
    const agentOptions: CastingDirectorAgentOptions = {
      // 可以传入自定义可编辑部分（来自 PromptStudio）
      // customEditablePart: state.promptOverrides?.castingDirectorEditablePart,
    };

    const castingResult = await runCastingDirectorAgent(context, agentOptions, {
      info: (msg: string, meta?: any) => console.log(msg, meta),
    });

    console.log(`[Agent 3: 选角导演] 成功生成 ${castingResult.character_images.length} 个角色的图像提示词`);

    // 4. 构建输出
    const output: StepOutput<any> = {
      content: {
        character_profiles: artDirectorOutput.character_profiles,
        character_images: castingResult.character_images,
        global_style_guide: castingResult.global_style_guide,
        scene_breakdowns: artDirectorOutput.scene_breakdowns || [],
      },
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'casting-director-agent',
        tokens: 0, // TODO: 从 provider 结果中获取
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 3: 选角导演] 完成，耗时 ${endTime - startTime}ms`);

    // 5. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step3_storyboard: output,
      currentStep: 4,
    };

    // 导演模式：设置 humanApproval 等待用户确认
    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 3: 选角导演] 执行失败:', error);
    throw error;
  }
}
