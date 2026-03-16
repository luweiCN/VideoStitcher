/**
 * LangGraph 工作流执行器
 * 提供工作流的启动、恢复、重新生成等执行能力
 */

import type { BaseMessage } from '@langchain/core/messages';
import { getVideoProductionGraph } from './graph';
import type { WorkflowState, ExecutionMode, VideoSpec } from './state';
import { createInitialWorkflowState, updateWorkflowState, setError } from './state';

/**
 * 工作流执行选项
 */
export interface WorkflowExecutionOptions {
  /** 执行模式：快速生成或导演模式 */
  executionMode: ExecutionMode;
  /** 视频规格 */
  videoSpec: VideoSpec;
  /** 项目 ID */
  projectId: string;
  /** 创意方向 ID（可选） */
  creativeDirectionId?: string;
  /** 人设 ID（可选） */
  personaId?: string;
}

/**
 * 工作流执行结果
 */
export interface WorkflowExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 最终状态 */
  state?: WorkflowState;
  /** 错误信息 */
  error?: string;
}

/**
 * 启动工作流
 *
 * @param scriptContent 脚本内容
 * @param options 执行选项
 * @returns 执行结果
 */
export async function startWorkflow(
  scriptContent: string,
  options: WorkflowExecutionOptions
): Promise<WorkflowExecutionResult> {
  console.log('[WorkflowExecutor] 启动工作流');
  console.log(`[WorkflowExecutor] 执行模式: ${options.executionMode}`);

  try {
    // 1. 创建初始状态
    const initialState = createInitialWorkflowState({
      scriptContent,
      projectId: options.projectId,
      executionMode: options.executionMode,
    });

    // 更新视频规格
    initialState.videoSpec = options.videoSpec;

    // 2. 获取工作流图
    const graph = getVideoProductionGraph();

    // 3. 执行工作流
    console.log('[WorkflowExecutor] 开始执行工作流图');
    const result = await graph.invoke(initialState);

    console.log('[WorkflowExecutor] 工作流执行完成');
    return {
      success: true,
      state: result as WorkflowState,
    };
  } catch (error) {
    console.error('[WorkflowExecutor] 工作流执行失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 恢复工作流（从暂停点继续）
 *
 * @param currentState 当前状态（已修改）
 * @returns 执行结果
 */
export async function resumeWorkflow(
  currentState: WorkflowState
): Promise<WorkflowExecutionResult> {
  console.log('[WorkflowExecutor] 恢复工作流');
  console.log(`[WorkflowExecutor] 从步骤 ${currentState.currentStep} 继续`);

  try {
    // 1. 清除暂停标记
    currentState.humanApproval = false;

    // 2. 获取工作流图
    const graph = getVideoProductionGraph();

    // 3. 继续执行
    console.log('[WorkflowExecutor] 继续执行工作流');
    const result = await graph.invoke(currentState);

    console.log('[WorkflowExecutor] 工作流恢复完成');
    return {
      success: true,
      state: result as WorkflowState,
    };
  } catch (error) {
    console.error('[WorkflowExecutor] 工作流恢复失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 重新生成指定步骤
 *
 * @param currentState 当前状态
 * @param targetStep 目标步骤（1-4）
 * @returns 执行结果
 */
export async function regenerateStep(
  currentState: WorkflowState,
  targetStep: number
): Promise<WorkflowExecutionResult> {
  console.log(`[WorkflowExecutor] 重新生成步骤 ${targetStep}`);

  try {
    // 1. 清除目标步骤及后续步骤的输出
    const newState = { ...currentState };

    if (targetStep <= 1) newState.step1_script = undefined;
    if (targetStep <= 2) newState.step2_characters = undefined;
    if (targetStep <= 3) newState.step3_storyboard = undefined;
    if (targetStep <= 4) newState.step4_video = undefined;

    // 2. 重置当前步骤
    newState.currentStep = targetStep;
    newState.humanApproval = false;
    newState.error = undefined;

    // 3. 获取工作流图
    const graph = getVideoProductionGraph();

    // 4. 从目标步骤重新执行
    console.log(`[WorkflowExecutor] 从步骤 ${targetStep} 重新执行`);
    const result = await graph.invoke(newState);

    console.log('[WorkflowExecutor] 重新生成完成');
    return {
      success: true,
      state: result as WorkflowState,
    };
  } catch (error) {
    console.error('[WorkflowExecutor] 重新生成失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 应用用户修改
 *
 * @param currentState 当前状态
 * @param targetStep 目标步骤
 * @param modifications 修改内容
 * @returns 执行结果
 */
export async function applyUserModifications(
  currentState: WorkflowState,
  targetStep: number,
  modifications: any
): Promise<WorkflowExecutionResult> {
  console.log(`[WorkflowExecutor] 应用用户修改到步骤 ${targetStep}`);

  try {
    // 1. 应用修改
    const newState = updateWorkflowState(currentState, {
      userModifications: {
        ...currentState.userModifications,
        [`step${targetStep}_modified`]: true,
      },
    });

    // 2. 标记为需要重新生成后续步骤
    if (targetStep === 1) newState.step2_characters = undefined;
    if (targetStep <= 2) newState.step3_storyboard = undefined;
    if (targetStep <= 3) newState.step4_video = undefined;

    // 3. 恢复工作流（从修改后的步骤继续）
    return await resumeWorkflow(newState);
  } catch (error) {
    console.error('[WorkflowExecutor] 应用修改失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
