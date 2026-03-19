/**
 * 摄像师 Agent
 * Agent 5: 根据分镜图生成视频合成计划
 */

import type { WorkflowState, StepOutput } from '../state';
import { TOTAL_STEPS } from '../state';
import type { AIProvider, TextGenerationOptions } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';
import { CinematographerAgentPrompts } from '../../prompts/cinematographer-agent';

interface RenderQueueItem {
  chunk_id: number;
  duration_seconds: number;
  start_frame: number;
  end_frame: number;
  reference_images: string[];
  video_generation_prompt: string;
  camera_movement: string;
  transition_note: string;
}

interface FinalOutputSettings {
  resolution: string;
  fps: number;
  codec: string;
}

interface CinematographerOutput {
  total_video_chunks: number;
  render_queue: RenderQueueItem[];
  total_duration_seconds: number;
  final_output_settings: FinalOutputSettings;
}

/**
 * 摄像师 Agent 节点
 */
export async function cinematographerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 5: 摄像师] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成
    // 注意：摄像师是最后一个节点，暂不检查跳过逻辑

    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取上下文信息
    const storyboardOutput = state.step4_video?.content; // 分镜师输出
    const videoSpec = state.videoSpec;

    if (!storyboardOutput) {
      throw new Error('[Agent 5: 摄像师] 缺少分镜师输出');
    }

    console.log('[Agent 5: 摄像师] 开始生成视频合成计划');

    // 3. 使用 CinematographerAgentPrompts 构建提示词
    const systemPrompt = CinematographerAgentPrompts.buildSystemPrompt();
    const userPrompt = CinematographerAgentPrompts.buildUserPrompt(
      storyboardOutput,
      {
        duration: videoSpec.duration,
        aspectRatio: videoSpec.aspectRatio,
      }
    );

    // 4. 调用 LLM
    const options: TextGenerationOptions = {
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt,
    };

    console.log('[Agent 5: 摄像师] 调用 LLM...');
    const result = await provider.generateText(userPrompt, options);

    // 5. 解析输出
    console.log('[Agent 5: 摄像师] 解析 LLM 输出');
    const videoPlan = parseCinematographerOutput(result.content);

    console.log(`[Agent 5: 摄像师] 成功生成视频合成计划，共 ${videoPlan.total_video_chunks || 0} 个视频块`);

    // 6. 构建输出
    const output: StepOutput<any> = {
      content: videoPlan,
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao',
        tokens: result.usage?.totalTokens ?? 0,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 5: 摄像师] 完成，耗时 ${endTime - startTime}ms`);

    // 7. 返回状态更新
    // 注意：摄像师是最后一个节点，需要标记工作流完成
    const updates: Partial<WorkflowState> = {
      step5_final: output,
      currentStep: TOTAL_STEPS,
    };

    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 5: 摄像师] 执行失败:', error);
    throw error;
  }
}

/**
 * 解析摄像师输出
 */
function parseCinematographerOutput(llmOutput: string): CinematographerOutput {
  let parsed: unknown;

  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // 尝试直接解析整个输出
      parsed = JSON.parse(llmOutput);
    }
  } catch (error) {
    console.warn('[Agent 5: 摄像师] JSON 解析失败，返回原始输出');
    throw new Error('摄像师输出格式错误：无法解析 JSON');
  }

  validateCinematographerOutput(parsed);
  return parsed;
}

function validateCinematographerOutput(output: unknown): asserts output is CinematographerOutput {
  if (!output || typeof output !== 'object') {
    throw new Error('摄像师输出格式错误：缺少对象结构');
  }

  const data = output as Record<string, unknown>;

  if (typeof data.total_video_chunks !== 'number') {
    throw new Error('摄像师输出格式错误：缺少 total_video_chunks 数字字段');
  }

  if (!Array.isArray(data.render_queue)) {
    throw new Error('摄像师输出格式错误：缺少 render_queue 数组字段');
  }

  if (typeof data.total_duration_seconds !== 'number') {
    throw new Error('摄像师输出格式错误：缺少 total_duration_seconds 数字字段');
  }

  if (!data.final_output_settings || typeof data.final_output_settings !== 'object') {
    throw new Error('摄像师输出格式错误：缺少 final_output_settings 对象字段');
  }

  const settings = data.final_output_settings as Record<string, unknown>;
  if (typeof settings.resolution !== 'string' || typeof settings.fps !== 'number' || typeof settings.codec !== 'string') {
    throw new Error('摄像师输出格式错误：final_output_settings 字段不完整');
  }
}

// 兼容性导出（保持旧名称可用）
export const cameraDirectorNode = cinematographerNode;
