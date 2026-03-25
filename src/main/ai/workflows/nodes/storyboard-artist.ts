/**
 * 分镜设计 Agent 节点
 * Agent 4: 根据剧本和角色参考图，生成 5x5 分镜网格图和 25 张单帧图
 *
 * 注意：实际的分镜生成逻辑已迁移到 storyboard-artist Agent 中
 * 此 Node 只负责调用 Agent 和状态管理
 */

import type { WorkflowState, StepOutput } from '../state';
import { runStoryboardArtistAgent, type StoryboardArtistResult } from '../../agents/storyboard-artist';

/**
 * 分镜设计 Agent 节点
 *
 * 职责：
 * 1. 接收艺术总监输出、选角导演输出和剧本内容
 * 2. 调用分镜设计 Agent 生成 5x5 分镜网格图和 25 张单帧图
 * 3. 返回分镜结果供摄像师使用
 *
 * 导演模式：
 * - 设置 humanApproval 等待用户确认分镜结果
 * - 如需两次确认（LLM 后 + 图像生成后），需要在 Agent 中拆分阶段
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

    // 1. 获取上下文信息
    const artDirectorOutput = state.step2_characters?.content;
    const castingDirectorOutput = state.step3_storyboard?.content;
    const scriptContent = state.step1_script?.content;

    if (!artDirectorOutput || !castingDirectorOutput || !scriptContent) {
      throw new Error('[Agent 4: 分镜师] 缺少必要的上下文信息');
    }

    console.log('[Agent 4: 分镜师] 开始生成分镜图');

    // 2. 调用分镜设计 Agent 生成分镜
    console.log('[Agent 4: 分镜师] 调用 Agent 生成分镜...');

    const storyboardResult = await runStoryboardArtistAgent(
      {
        artDirectorOutput: artDirectorOutput,
        castingDirectorOutput: castingDirectorOutput,
        scriptContent: typeof scriptContent === 'string' ? scriptContent : JSON.stringify(scriptContent),
        videoSpec: {
          aspectRatio: state.videoSpec?.aspectRatio || '9:16',
          duration: state.videoSpec?.duration || 15,
        },
      },
      {
        modelId: state.agentModelAssignments?.['storyboard-artist-agent'],
      },
      {
        info: (msg: string, meta?: any) => console.log(msg, meta),
      }
    );

    // 3. 构建输出
    const output: StepOutput<StoryboardArtistResult> = {
      content: {
        storyboard_grid_image: storyboardResult.storyboard_grid_image,
        frame_images: storyboardResult.frame_images,
        frames: storyboardResult.frames,
        style_notes: storyboardResult.style_notes,
        local_grid_path: storyboardResult.local_grid_path,
      },
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: state.agentModelAssignments?.['storyboard-artist-agent'] || 'default',
        tokens: 0, // TODO: 从 provider 返回结果中获取
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 4: 分镜师] 完成，耗时 ${endTime - startTime}ms`);

    // 4. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step4_video: output,
      currentStep: 5,
    };

    // 导演模式：设置 humanApproval 等待用户确认
    // 分镜设计有两次检查点：LLM 后 + 图像生成后
    // 由于 Agent 内部完成了完整流程，这里简化为一次确认
    // 如需两次确认，需要在 Agent 中拆分阶段或使用状态标记
    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 4: 分镜师] 执行失败:', error);
    throw error;
  }
}
