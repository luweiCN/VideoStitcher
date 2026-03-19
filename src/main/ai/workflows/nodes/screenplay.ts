/**
 * 剧本写作 Agent
 * Agent 1: 根据项目、创意方向、人设和地区生成剧本
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';
import { ScreenplayAgentPrompts } from '../../prompts/screenplay-agent';

/**
 * 剧本写作 Agent 节点
 *
 * @param state 当前工作流状态
 * @returns 状态更新（部分）
 */
export async function screenplayNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 1: 剧本写作] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成（用于恢复工作流时跳过已完成的步骤）
    if (state.step1_script) {
      console.log('[Agent 1: 剧本写作] 步骤已完成，跳过执行');
      return {}; // 返回空对象，不更新状态
    }

    // 1. 获取 AI 提供商
    const provider = getProvider();
    if (!provider) {
      throw new Error('[Agent 1: 剧本写作] AI 提供商未初始化');
    }

    // 2. 获取上下文信息
    const { project, creativeDirection, persona, region } = state;

    if (!project || !creativeDirection || !persona) {
      throw new Error('[Agent 1: 剧本写作] 缺少必要的上下文信息（project、creativeDirection 或 persona）');
    }

    // 3. 使用 ScreenplayAgentPrompts 构建提示词
    const systemPrompt = ScreenplayAgentPrompts.buildSystemPrompt(
      project,
      creativeDirection,
      persona,
      region || 'universal'
    );

    const userPrompt = ScreenplayAgentPrompts.buildUserPrompt(1, 1);

    // 4. 调用 LLM
    const options: TextGenerationOptions = {
      temperature: 0.8,
      maxTokens: 2048,
      systemPrompt,
    };

    console.log('[Agent 1: 剧本写作] 调用 LLM...');
    const result = await provider.generateText(userPrompt, options);

    // 5. 解析 LLM 输出（JSON 格式）
    console.log('[Agent 1: 剧本写作] 解析 LLM 输出');
    const parsed = parseScreenplayOutput(result.content);

    // 6. 构建输出
    const output: StepOutput<any> = {
      content: parsed,
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao',
        tokens: result.usage.totalTokens,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 1: 剧本写作] 完成，耗时 ${endTime - startTime}ms`);

    // 7. 返回状态更新
    // 导演模式：步骤完成后设置 humanApproval = false，让条件边暂停
    const updates: Partial<WorkflowState> = {
      step1_script: output,
      currentStep: 2,
    };

    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 1: 剧本写作] 失败:', error);
    throw error;
  }
}

/**
 * 获取 AI 提供商
 */
import { getGlobalProvider } from '../../provider-manager';

function getProvider() {
  return getGlobalProvider();
}

/**
 * 解析剧本输出
 */
function parseScreenplayOutput(llmOutput: string): any {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个输出
    return JSON.parse(llmOutput);
  } catch (error) {
    console.warn('[Agent 1: 剧本写作] JSON 解析失败，返回原始输出');
    throw new Error('剧本输出格式错误：无法解析 JSON');
  }
}
