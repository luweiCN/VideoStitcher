/**
 * 分镜师 Agent
 * Agent 4: 根据人物图和剧本生成分镜图
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';
import { StoryboardArtistAgentPrompts } from '../../prompts/storyboard-artist-agent';

/**
 * 分镜师 Agent 节点
 */
export async function storyboardArtistNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 4: 分镜师] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成
    if (state.step4_video) {
      console.log('[Agent 4: 分镜师] 步骤已完成，跳过执行');
      return {};
    }

    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取上下文信息
    const artDirectorOutput = state.step2_characters?.content;
    const characterImages = state.step3_storyboard?.content; // 选角导演输出的人物图像提示词
    const scriptContent = state.step1_script?.content;

    if (!artDirectorOutput || !characterImages || !scriptContent) {
      throw new Error('[Agent 4: 分镜师] 缺少必要的上下文信息');
    }

    console.log('[Agent 4: 分镜师] 开始生成分镜图');

    // 3. 使用 StoryboardArtistAgentPrompts 构建提示词
    const systemPrompt = StoryboardArtistAgentPrompts.buildSystemPrompt();
    const userPrompt = StoryboardArtistAgentPrompts.buildUserPrompt(
      artDirectorOutput,
      characterImages,
      JSON.stringify(scriptContent)
    );

    // 4. 调用 LLM
    const options: TextGenerationOptions = {
      temperature: 0.7,
      maxTokens: 8192,
      systemPrompt,
    };

    console.log('[Agent 4: 分镜师] 调用 LLM...');
    const result = await provider.generateText(userPrompt, options);

    // 5. 解析输出
    console.log('[Agent 4: 分镜师] 解析 LLM 输出');
    const storyboard = parseStoryboardOutput(result.content);

    console.log(`[Agent 4: 分镜师] 成功生成 ${storyboard.storyboard_groups?.length || 0} 组分镜`);

    // 6. 构建输出
    const output: StepOutput<any> = {
      content: storyboard,
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao',
        tokens: result.usage.totalTokens,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 4: 分镜师] 完成，耗时 ${endTime - startTime}ms`);

    // 7. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step4_video: output, // 注意：这里暂时使用 step4_video 存储，后续需要调整
      currentStep: 5,
    };

    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 4: 分镜师] 执行失败:', error);
    throw error;
  }
}

/**
 * 解析分镜师输出
 */
function parseStoryboardOutput(llmOutput: string): any {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个输出
    return JSON.parse(llmOutput);
  } catch (error) {
    console.warn('[Agent 4: 分镜师] JSON 解析失败，返回原始输出');
    throw new Error('分镜师输出格式错误：无法解析 JSON');
  }
}
