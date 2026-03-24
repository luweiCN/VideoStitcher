/**
 * 剧本写作 Agent
 * Agent 1: 根据项目、创意方向、人设和地区生成剧本
 */

import type { WorkflowState } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';
import {
  SCREENPLAY_AGENT_BUILTIN_TEMPLATE,
  SCREENPLAY_AGENT_USER_PROMPT_TEMPLATE,
} from '@shared/constants/screenplayAgentTemplates';
import { getCultureProfile } from '../../prompts/culture-profiles';

/**
 * 替换模板中的变量
 */
function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * 剧本写作 Agent 节点
 *
 * @param state 当前工作流状态
 * @returns 状态更新（部分）
 */
export async function screenplayNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[剧本写作 Agent] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成（用于恢复工作流时跳过已完成的步骤）
    if (state.step1_script) {
      console.log('[剧本写作 Agent] 步骤已完成，跳过执行');
      return {}; // 返回空对象，不更新状态
    }

    // 1. 获取 AI 提供商
    const provider = getProvider();
    if (!provider) {
      throw new Error('[剧本写作 Agent] AI 提供商未初始化');
    }

    // 2. 获取上下文信息
    const { project, creativeDirection, persona, region: regionId } = state;

    if (!project || !creativeDirection || !persona) {
      throw new Error('[剧本写作 Agent] 缺少必要的上下文信息（project、creativeDirection 或 persona）');
    }

    // 3. 获取地区文化档案（使用统一的 culture-profiles 模块）
    const cultureProfile = getCultureProfile(regionId);

    // 获取地区名称用于日志显示
    const regionName = regionId?.replace('region_', '').replace('_', ' ') || '通用';

    // 4. 构建系统提示词（使用内置模板）
    const systemPrompt = SCREENPLAY_AGENT_BUILTIN_TEMPLATE.systemPrompt;

    // 5. 构建用户提示词（注入动态变量）
    const userPromptVariables = {
      gameName: project.name,
      gameType: project.gameType,
      sellingPoint: project.sellingPoint || '玩法丰富，乐趣无穷',
      creativeDirectionName: creativeDirection.name,
      creativeDirectionDescription: creativeDirection.description || '无特定要求，自由发挥',
      personaName: persona.name,
      personaPrompt: persona.prompt,
      cultureProfile: cultureProfile,
    };

    const userPrompt = replaceTemplateVariables(
      SCREENPLAY_AGENT_USER_PROMPT_TEMPLATE,
      userPromptVariables
    );

    // 6. 输出完整提示词到日志（用于调试和优化）
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              【剧本写作 Agent】完整提示词                     ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ 系统提示词 (System Prompt):                                    ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(systemPrompt);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ 用户提示词 (User Prompt):                                      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(userPrompt);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ 动态变量注入详情:                                               ║');
    console.log(`║   - 游戏名称: ${project.name}`);
    console.log(`║   - 游戏类型: ${project.gameType}`);
    console.log(`║   - 创意方向: ${creativeDirection.name}`);
    console.log(`║   - 编剧人设: ${persona.name}`);
    console.log(`║   - 目标地区: ${regionName}`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // 7. 调用 LLM
    const options: TextGenerationOptions = {
      temperature: 0.8,
      maxTokens: 2048,
      systemPrompt,
    };

    console.log('[剧本写作 Agent] 调用 LLM...');
    const result = await provider.generateText(userPrompt, options);

    // 8. 解析 LLM 输出（JSON 格式）
    console.log('[剧本写作 Agent] 解析 LLM 输出');
    const parsed = parseScreenplayOutput(result.content);

    // 9. 构建输出
    const output = {
      content: parsed,
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao',
        tokens: result.usage.totalTokens,
        // 记录使用的提示词摘要（用于追溯）
        promptSummary: {
          templateVersion: SCREENPLAY_AGENT_BUILTIN_TEMPLATE.templateId,
          gameName: project.name,
          creativeDirection: creativeDirection.name,
          persona: persona.name,
          region: regionName,
        },
      },
    };

    const endTime = Date.now();
    console.log(`[剧本写作 Agent] 完成，耗时 ${endTime - startTime}ms`);

    // 10. 返回状态更新
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
    console.error('[剧本写作 Agent] 失败:', error);
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
function parseScreenplayOutput(llmOutput: string): unknown {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个输出
    return JSON.parse(llmOutput);
  } catch (error) {
    console.warn('[剧本写作 Agent] JSON 解析失败，返回原始输出');
    throw new Error('剧本输出格式错误：无法解析 JSON');
  }
}
