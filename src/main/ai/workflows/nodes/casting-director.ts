/**
 * 选角导演 Agent
 * Agent 3: 根据艺术总监的角色设定生成人物图像提示词
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';
import { CastingDirectorAgentPrompts } from '../../prompts/casting-director-agent';

/**
 * 选角导演 Agent 节点
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

    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取艺术总监的输出
    const artDirectorOutput = state.step2_characters?.content;
    if (!artDirectorOutput) {
      throw new Error('[Agent 3: 选角导演] 缺少艺术总监的输出');
    }

    console.log('[Agent 3: 选角导演] 开始为角色生成人物图像提示词');

    // 3. 使用 CastingDirectorAgentPrompts 构建提示词
    const systemPrompt = CastingDirectorAgentPrompts.buildSystemPrompt();
    const userPrompt = CastingDirectorAgentPrompts.buildUserPrompt(
      artDirectorOutput,
      artDirectorOutput.scene_breakdowns || []
    );

    // 4. 调用 LLM 生成人物图像提示词
    const options: TextGenerationOptions = {
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt,
    };

    console.log('[Agent 3: 选角导演] 调用 LLM...');
    const result = await provider.generateText(userPrompt, options);

    // 5. 解析输出
    console.log('[Agent 3: 选角导演] 解析 LLM 输出');
    const characterImages = parseCastingDirectorOutput(result.content);

    console.log(`[Agent 3: 选角导演] 成功为 ${characterImages.character_images?.length || 0} 个角色生成图像提示词`);

    // 6. 构建输出
    const output: StepOutput<any> = {
      content: characterImages,
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao',
        tokens: result.usage.totalTokens,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 3: 选角导演] 完成，耗时 ${endTime - startTime}ms`);

    // 7. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step3_storyboard: output, // 注意：这里暂时使用 step3_storyboard 存储，后续需要调整
      currentStep: 4,
    };

    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 3: 选角导演] 执行失败:', error);
    throw error;
  }
}

/**
 * 解析选角导演输出
 */
function parseCastingDirectorOutput(llmOutput: string): any {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个输出
    return JSON.parse(llmOutput);
  } catch (error) {
    console.warn('[Agent 3: 选角导演] JSON 解析失败，返回原始输出');
    throw new Error('选角导演输出格式错误：无法解析 JSON');
  }
}
