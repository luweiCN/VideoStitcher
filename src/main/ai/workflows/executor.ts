/**
 * LangGraph 工作流执行器
 * 提供工作流的启动、恢复、重新生成等执行能力
 */

import type { BaseMessage } from '@langchain/core/messages';
import type { Project, CreativeDirection, Persona } from '@shared/types/aside';
import { getVideoProductionGraph } from './graph';
import type { WorkflowState, ExecutionMode, VideoSpec } from './state';
import { createInitialWorkflowState, updateWorkflowState, normalizeCurrentStep, TOTAL_STEPS, WORKFLOW_STEPS } from './state';

/**
 * 节点名称到步骤编号的映射
 */
const NODE_TO_STEP: Record<string, number> = {
  'art_director': 2,
  'casting_director': 3,
  'storyboard_artist': 4,
  'cinematographer': 5,
};

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
  /** 项目信息（可选） */
  project?: Project;
  /** 创意方向（可选） */
  creativeDirection?: CreativeDirection;
  /** 人设（可选） */
  persona?: Persona;
  /** 地区（可选） */
  region?: string;
  /** 创意方向 ID（可选，用于向后兼容） */
  creativeDirectionId?: string;
  /** 人设 ID（可选，用于向后兼容） */
  personaId?: string;
  /** 进度回调（可选） */
  onProgress?: (event: ProgressEvent) => void;
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
 * 进度事件
 */
export interface ProgressEvent {
  /** 步骤编号 */
  step: number;
  /** 节点名称 */
  nodeName: string;
  /** 状态 */
  status: 'started' | 'completed';
  /** 消息 */
  message?: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 规范化执行结果中的步骤编号
 *
 * @param state 工作流状态
 * @returns 规范化后的状态
 */
function normalizeWorkflowResultState(state: WorkflowState): WorkflowState {
  return {
    ...state,
    currentStep: normalizeCurrentStep(state.currentStep),
  };
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
    // 1. 创建初始状态（包含完整的上下文信息）
    const initialState = createInitialWorkflowState({
      scriptContent,
      projectId: options.projectId,
      executionMode: options.executionMode,
      project: options.project,
      creativeDirection: options.creativeDirection,
      persona: options.persona,
      region: options.region,
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
      state: normalizeWorkflowResultState(result as WorkflowState),
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
 * 恢复工作流（从暂停点继续）- 使用流式执行，支持实时进度通知
 *
 * @param currentState 当前状态（已修改）
 * @param onProgress 进度回调（可选）
 * @returns 执行结果
 */
export async function resumeWorkflow(
  currentState: WorkflowState,
  onProgress?: (event: ProgressEvent) => void,
): Promise<WorkflowExecutionResult> {
  console.log('[WorkflowExecutor] 恢复工作流（流式模式）');
  console.log(`[WorkflowExecutor] 从步骤 ${currentState.currentStep} 继续`);

  try {
    if (currentState.currentStep >= TOTAL_STEPS && currentState.step5_final) {
      console.log('[WorkflowExecutor] 工作流已完成，跳过重复执行');
      return {
        success: true,
        state: normalizeWorkflowResultState(currentState),
      };
    }

    // 1. 临时设置 humanApproval = true，让工作流继续执行下一步
    // 这一步执行完后，条件边会根据导演模式重新设置暂停
    currentState.humanApproval = true;

    // 2. 获取工作流图
    const graph = getVideoProductionGraph();

    // 3. 使用流式执行
    console.log('[WorkflowExecutor] 开始流式执行工作流');
    let finalState = currentState;

    try {
      // 使用 stream API 获取每个节点的执行结果
      const stream = await graph.stream(currentState, { streamMode: 'updates' });

      for await (const event of stream) {
        // event 格式: { nodeName: string, output: Partial<WorkflowState> }
        const nodeName = Object.keys(event)[0];
        const nodeOutput = event[nodeName];

        console.log(`[WorkflowExecutor] 节点 ${nodeName} 完成`);

        // 合并状态
        if (nodeOutput && typeof nodeOutput === 'object') {
          finalState = { ...finalState, ...nodeOutput } as WorkflowState;
        }

        // 发送进度事件
        if (onProgress && nodeName && NODE_TO_STEP[nodeName]) {
          const stepNumber = NODE_TO_STEP[nodeName];
          onProgress({
            step: stepNumber,
            nodeName,
            status: 'completed',
            message: `节点 ${nodeName} 执行完成`,
            timestamp: Date.now(),
          });
        }
      }
    } catch (streamError) {
      console.error('[WorkflowExecutor] 流式执行出错:', streamError);
      throw streamError;
    }

    console.log('[WorkflowExecutor] 工作流恢复完成');
    return {
      success: true,
      state: normalizeWorkflowResultState(finalState),
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
 * 重新生成指定步骤 - 使用流式执行，支持实时进度通知
 *
 * @param currentState 当前状态
 * @param targetStep 目标步骤（1-5）
 * @param onProgress 进度回调（可选）
 * @returns 执行结果
 */
export async function regenerateStep(
  currentState: WorkflowState,
  targetStep: number,
  onProgress?: (event: ProgressEvent) => void
): Promise<WorkflowExecutionResult> {
  const normalizedTargetStep = normalizeCurrentStep(targetStep);
  console.log(`[WorkflowExecutor] 重新生成步骤 ${normalizedTargetStep}（流式模式）`);

  try {
    // 1. 清除目标步骤及后续步骤的输出
    const newState = { ...currentState };

    if (normalizedTargetStep <= 1) newState.step1_script = undefined;
    if (normalizedTargetStep <= 2) newState.step2_characters = undefined;
    if (normalizedTargetStep <= 3) newState.step3_storyboard = undefined;
    if (normalizedTargetStep <= 4) newState.step4_video = undefined;
    if (normalizedTargetStep <= 5) newState.step5_final = undefined;

    // 2. 重置当前步骤
    newState.currentStep = normalizeCurrentStep(normalizedTargetStep);
    newState.humanApproval = false;
    newState.error = undefined;

    // 3. 获取工作流图
    const graph = getVideoProductionGraph();

    // 4. 使用流式执行
    console.log(`[WorkflowExecutor] 从步骤 ${normalizedTargetStep} 重新执行（流式）`);
    let finalState = newState;

    try {
      // 使用 stream API 获取每个节点的执行结果
      const stream = await graph.stream(newState, { streamMode: 'updates' });

      for await (const event of stream) {
        // event 格式: { nodeName: string, output: Partial<WorkflowState> }
        const nodeName = Object.keys(event)[0];
        const nodeOutput = event[nodeName];

        console.log(`[WorkflowExecutor] 节点 ${nodeName} 完成`);

        // 合并状态
        if (nodeOutput && typeof nodeOutput === 'object') {
          finalState = { ...finalState, ...nodeOutput } as WorkflowState;
        }

        // 发送进度事件
        if (onProgress && nodeName && NODE_TO_STEP[nodeName]) {
          const stepNumber = NODE_TO_STEP[nodeName];
          onProgress({
            step: stepNumber,
            nodeName,
            status: 'completed',
            message: `节点 ${nodeName} 重新生成完成`,
            timestamp: Date.now(),
          });
        }
      }
    } catch (streamError) {
      console.error('[WorkflowExecutor] 流式执行出错:', streamError);
      throw streamError;
    }

    console.log('[WorkflowExecutor] 重新生成完成');
    return {
      success: true,
      state: normalizeWorkflowResultState(finalState),
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
  modifications: unknown
): Promise<WorkflowExecutionResult> {
  const normalizedTargetStep = normalizeCurrentStep(targetStep);
  console.log(`[WorkflowExecutor] 应用用户修改到步骤 ${normalizedTargetStep}`);

  try {
    // 1. 应用修改
    const modifiedFlagKey = `step${normalizedTargetStep}_modified`;
    const modifiedPayloadKey = `step${normalizedTargetStep}_payload`;
    const newState = updateWorkflowState(currentState, {
      userModifications: {
        ...currentState.userModifications,
        [modifiedFlagKey]: true,
        [modifiedPayloadKey]: modifications,
      },
    });

    // 2. 标记为需要重新生成后续步骤
    if (normalizedTargetStep === 1) newState.step2_characters = undefined;
    if (normalizedTargetStep <= 2) newState.step3_storyboard = undefined;
    if (normalizedTargetStep <= 3) newState.step4_video = undefined;
    if (normalizedTargetStep <= 4) newState.step5_final = undefined;

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
