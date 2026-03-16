/**
 * 脚本编写 Agent
 * Agent 1: 根据创意方向和人设优化脚本
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';

/**
 * 脚本编写 Agent 节点
 *
 * @param state 当前工作流状态
 * @returns 状态更新（部分）
 */
export async function scriptWriterNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 1: 脚本编写] 开始执行');
  const startTime = Date.now();

  try {
    // 1. 获取 AI 提供商
    const provider = getProvider();
    if (!provider) {
      throw new Error('[Agent 1: 脚本编写] AI 提供商未初始化');
    }

    // 2. 构建系统提示词
    const systemPrompt = buildSystemPrompt(state);

    // 3. 构建用户提示词
    const userPrompt = buildUserPrompt(state);

    // 4. 调用 LLM
    const options: TextGenerationOptions = {
      temperature: 0.8,
      maxTokens: 2048,
      systemPrompt,
    };

    console.log('[Agent 1: 脚本编写] 调用 LLM...');
    const result = await provider.generateText(userPrompt, options);

    // 5. 解析 LLM 输出（JSON 格式）
    console.log('[Agent 1: 脚本编写] 解析 LLM 输出');
    const parsed = parseScriptOutput(result.content);

    // 6. 构建输出
    const output: StepOutput<Script> = {
      content: {
        id: `script-${Date.now()}`,
        projectId: state.projectId,
        content: parsed.optimizedScript,
        status: 'draft',
        estimatedDuration: parsed.estimatedDuration,
        createdAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao',
        tokens: result.usage.totalTokens,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 1: 脚本编写] 完成，耗时 ${endTime - startTime}ms`);

    // 6. 返回状态更新
    return {
      step1_script: output,
      currentStep: 2,
    };
  } catch (error) {
    console.error('[Agent 1: 脚本编写] 失败:', error);
    throw error;
  }
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(state: WorkflowState): string {
  const { creativeDirection, persona } = state.context;

  return `你是一位专业的视频脚本编写专家。

角色设定：
${persona ? `- 你是"${persona.name}"：${persona.prompt}` : '- 你是一位通用的脚本编写专家'}

创意方向：
${creativeDirection ? `- 方向：${creativeDirection.name}
- 描述：${creativeDirection.description || '无'}` : '- 使用通用创意风格'}

任务：
根据用户提供的脚本内容进行优化和扩展，使其：
1. 符合角色设定
2. 符合创意方向
3. 适合视频制作（包含场景描述、动作、对白）
4. 根据剧情内容预估合理的视频时长（注意：不要过长，避免浪费 token）

输出格式（必须严格遵守 JSON 格式）：
\`\`\`json
{
  "optimizedScript": "优化后的脚本内容",
  "estimatedDuration": 30,
  "reasoning": "预估时长理由（1-2句话）"
}
\`\`\`

重要提示：
- estimatedDuration 单位是秒
- 根据剧情复杂度合理预估，一般建议 15-45 秒之间
- 简单剧情（单个场景）预估 15-20 秒
- 中等剧情（2-3个场景）预估 20-35 秒
- 复杂剧情（多个场景、多人物）预估 35-45 秒
- 不要超过 60 秒，避免浪费 token 和成本`;
}

/**
 * 构建用户提示词
 */
function buildUserPrompt(state: WorkflowState): string {
  const { scriptContent, videoSpec } = state;

  return `请优化以下脚本内容：

---
${scriptContent}
---

要求：
1. 视频时长：${videoSpec.duration === 'short' ? '短视频（<15秒）' : '长视频（>15秒）'}
2. 画幅比例：${videoSpec.aspectRatio}
3. 保持原意的同时增强表现力
4. 添加必要的场景描述和动作提示`;
}

/**
 * 获取 AI 提供商
 */
import { getGlobalProvider } from '../../provider-manager';

function getProvider() {
  return getGlobalProvider();
}

/**
 * 解析脚本输出
 */
function parseScriptOutput(llmOutput: string): {
  optimizedScript: string;
  estimatedDuration: number;
  reasoning: string;
} {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        optimizedScript: parsed.optimizedScript || llmOutput,
        estimatedDuration: parsed.estimatedDuration || 30,
        reasoning: parsed.reasoning || 'AI 预估时长',
      };
    }

    // 尝试直接解析整个输出
    const parsed = JSON.parse(llmOutput);
    return {
      optimizedScript: parsed.optimizedScript || llmOutput,
      estimatedDuration: parsed.estimatedDuration || 30,
      reasoning: parsed.reasoning || 'AI 预估时长',
    };
  } catch (error) {
    console.warn('[Agent 1: 脚本编写] JSON 解析失败，使用原始输出');
    // 如果解析失败，返回原始内容
    return {
      optimizedScript: llmOutput,
      estimatedDuration: 30, // 默认 30 秒
      reasoning: '无法解析 JSON，使用默认时长',
    };
  }
}
