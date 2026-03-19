/**
 * 艺术总监 Agent
 * 根据剧本提炼精华、创作角色和场景
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';
import { ArtDirectorAgentPrompts } from '../../prompts/art-director-agent';
import { createHash } from 'crypto';

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

    // 1. 获取 AI 提供商
    const provider = getProvider();
    if (!provider) {
      throw new Error('[艺术总监] AI 提供商未初始化');
    }

    // 2. 获取上下文信息
    const { project, creativeDirection, persona, region, step1_script, videoSpec } = state;

    if (!project || !creativeDirection || !persona || !step1_script) {
      throw new Error('[艺术总监] 缺少必要的上下文信息');
    }

    // 3. 使用 ArtDirectorAgentPrompts 构建提示词
    const systemPrompt = ArtDirectorAgentPrompts.buildSystemPrompt(
      project,
      creativeDirection,
      persona,
      region || 'universal'
    );

    const durationFlag = videoSpec.duration === 'short' ? 'short_<15s' : 'long_>15s';
    const userPrompt = ArtDirectorAgentPrompts.buildUserPrompt(
      step1_script.content,
      durationFlag,
      videoSpec.aspectRatio,
      creativeDirection
    );

    // 4. 调用 LLM
    const options: TextGenerationOptions = {
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt,
    };

    console.log('[艺术总监] 调用 LLM...');
    const result = await provider.generateText(userPrompt, options);

    // 5. 解析 LLM 输出
    console.log('[艺术总监] 解析 LLM 输出');
    const parsed = parseArtDirectorOutput(result.content);

    // 关键修复：为每个角色生成稳定的 ID（如果 LLM 没有生成）
    if (parsed && parsed.character_profiles && Array.isArray(parsed.character_profiles)) {
      parsed.character_profiles = parsed.character_profiles.map((profile: any, index: number) => {
        // 如果已有 ID，保留；否则生成稳定 ID
        if (!profile.id) {
          // 使用剧本内容哈希 + 索引生成稳定 ID
          const stableId = `char-${createHash('md5')
            .update(state.step1_script?.content || state.inputScript || '')
            .digest('hex')
            .substring(0, 8)}-${index}`;
          console.log(`[艺术总监] 为角色 ${profile.name} 生成 ID: ${stableId}`);
          profile.id = stableId;
        } else {
          console.log(`[艺术总监] 角色 ${profile.name} 已有 ID: ${profile.id}`);
        }
        return profile;
      });
    }

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

/**
 * 获取 AI 提供商
 */
import { getGlobalProvider } from '../../provider-manager';

function getProvider() {
  return getGlobalProvider();
}

/**
 * 解析艺术总监输出
 */
function parseArtDirectorOutput(llmOutput: string): any {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个输出
    return JSON.parse(llmOutput);
  } catch (error) {
    console.warn('[艺术总监] JSON 解析失败，返回原始输出');
    throw new Error('艺术总监输出格式错误：无法解析 JSON');
  }
}
