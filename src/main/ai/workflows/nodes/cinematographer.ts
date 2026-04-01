/**
 * 摄像师 Agent 节点
 * Agent 5: 根据分镜图生成最终视频
 *
 * 流程：
 * 1. 接收 Agent 5（摄像师）节点调用
 * 2. 检测 useMultiStage 选项（多阶段/单阶段模式）
 * 3. 调用 runCinematographerAgent 生成视频
 *    - 多阶段模式：Planner 生成渲染计划 -> Executor 生成视频片段
 *    - 单阶段模式：使用旧版提示词直接生成（向后兼容）
 * 4. 使用 ffmpeg 拼接视频（如果有多段）
 * 5. 返回最终视频 URL
 *
 * 注意：实际的视频生成逻辑已迁移到 cinematographer Agent 中
 * 此 Node 只负责调用 Agent 和状态管理
 */

import type { WorkflowState, StepOutput } from '../state';
import { downloadToCache } from '@main/utils/cache';

// 导入多阶段摄像师 Agent
import {
  runCinematographerAgent,
  type CinematographerResult,
  type StoryboardOutput,
  type VideoSpec,
} from '../../agents/cinematographer';

/**
 * 摄像师 Agent 节点
 *
 * 职责：
 * 1. 接收分镜输出和视频规格
 * 2. 检测 useMultiStage 选项（多阶段/单阶段模式）
 * 3. 调用 runCinematographerAgent 生成视频
 * 4. 更新 WorkflowState
 *
 * 导演模式：
 * - 根据 D-01，导演模式不设置人工确认（humanApproval = false）
 */
export async function cinematographerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 5: 摄像师] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成
    if (state.step5_final) {
      console.log('[Agent 5: 摄像师] 步骤已完成，跳过执行');
      return {};
    }

    // 1. 获取上下文信息
    const storyboardOutput = state.step4_video?.content;
    const videoSpec = state.videoSpec;

    if (!storyboardOutput) {
      throw new Error('[Agent 5: 摄像师] 缺少分镜师输出');
    }

    console.log('[Agent 5: 摄像师] 开始生成视频');

    // 2. 检测 useMultiStage 选项（从配置中读取，默认 false 保持向后兼容）
    const useMultiStage = state.config?.cinematographerOptions?.useMultiStage ?? false;
    console.log(`[Agent 5: 摄像师] 使用 ${useMultiStage ? '多阶段' : '单阶段'} 模式`);

    // 3. 准备输入数据
    const storyboardData: StoryboardOutput = {
      frames: storyboardOutput.frames || [],
      imageUrl: storyboardOutput.imageUrl,
      styleNotes: storyboardOutput.style_notes,
    };

    const videoSpecData: VideoSpec = {
      aspectRatio: videoSpec?.aspectRatio || '9:16',
      duration: videoSpec?.duration || 15,
      resolution: videoSpec?.resolution || '1080p',
    };

    // 4. 调用摄像师 Agent
    console.log('[Agent 5: 摄像师] 调用摄像师 Agent...');

    const cinematographerResult: CinematographerResult = await runCinematographerAgent(
      storyboardData,
      videoSpecData,
      {
        useMultiStage,
        modelId: state.agentModelAssignments?.['cinematographer-agent'],
        directorMode: true, // D-01: 导演模式不暂停
      },
      {
        info: (msg: string, meta?: any) => console.log(msg, meta),
      }
    );

    // 5. 构建输出
    const output: StepOutput<any> = {
      content: {
        videoUrl: cinematographerResult.videoUrl,
        localVideoPath: cinematographerResult.localVideoPath,
        localVideoSegments: cinematographerResult.localVideoSegments,
        totalDuration: cinematographerResult.totalDuration,
        videoChunks: cinematographerResult.videoChunks,
        renderPlan: cinematographerResult.renderPlan,
        // 多阶段模式下包含详细阶段结果
        stageResults: cinematographerResult.stageResults,
      },
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: state.agentModelAssignments?.['cinematographer-agent'] || 'default',
        useMultiStage,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 5: 摄像师] 完成，耗时 ${endTime - startTime}ms`);

    // 6. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step5_final: output,
      currentStep: 6,
    };

    // 导演模式：根据 D-01，不设置人工确认
    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 5: 摄像师] 执行失败:', error);
    throw error;
  }
}

// 兼容性导出（保持旧名称可用）
export const cameraDirectorNode = cinematographerNode;
