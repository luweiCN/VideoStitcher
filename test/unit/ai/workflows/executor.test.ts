/**
 * 工作流执行器测试
 * 验证执行器推进语义与状态机契约一致
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startWorkflow,
  resumeWorkflow,
  regenerateStep,
  applyUserModifications,
  type WorkflowExecutionOptions,
} from '../../../../src/main/ai/workflows/executor';
import {
  createInitialWorkflowState,
  TOTAL_STEPS,
  validateWorkflowState,
} from '../../../../src/main/ai/workflows/state';

const mockInvoke = vi.fn();

vi.mock('../../../../src/main/ai/workflows/graph', () => ({
  getVideoProductionGraph: () => ({
    invoke: mockInvoke,
  }),
}));

describe('工作流执行器推进语义', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('startWorkflow 在完成态不应返回超过 TOTAL_STEPS 的 currentStep', async () => {
    const overflowState = {
      ...createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'project-1',
      }),
      currentStep: TOTAL_STEPS + 1,
      step5_final: {
        content: { done: true },
        metadata: {
          timestamp: Date.now(),
          duration: 1,
        },
      },
    };

    mockInvoke.mockResolvedValueOnce(overflowState);

    const options: WorkflowExecutionOptions = {
      executionMode: 'fast',
      videoSpec: {
        duration: 'short',
        aspectRatio: '16:9',
      },
      projectId: 'project-1',
    };

    const result = await startWorkflow('测试脚本', options);

    expect(result.success).toBe(true);
    expect(result.state?.currentStep).toBe(TOTAL_STEPS);
    expect(result.state && validateWorkflowState(result.state)).toBe(true);
  });

  it('resumeWorkflow 在已完成状态不应再次调用 graph.invoke', async () => {
    const currentState = {
      ...createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'project-1',
        executionMode: 'director',
      }),
      currentStep: TOTAL_STEPS,
      step5_final: {
        content: { done: true },
        metadata: {
          timestamp: Date.now(),
          duration: 1,
        },
      },
      humanApproval: false,
    };

    const result = await resumeWorkflow(currentState);

    expect(result.success).toBe(true);
    expect(result.state).toEqual(currentState);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('regenerateStep 从较早步骤重生时，传给 graph.invoke 的后续产物应被清空（含 step5_final）', async () => {
    const currentState = {
      ...createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'project-1',
        executionMode: 'director',
      }),
      step1_script: {
        content: { text: 'step1' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step2_characters: {
        content: { text: 'step2' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step3_storyboard: {
        content: { text: 'step3' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step4_video: {
        content: { text: 'step4' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step5_final: {
        content: { text: 'step5' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      currentStep: 5,
    };

    mockInvoke.mockImplementationOnce(async (state) => state);

    const result = await regenerateStep(currentState, 2);

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    const invokeInput = mockInvoke.mock.calls[0][0];
    expect(invokeInput.step1_script).toBeDefined();
    expect(invokeInput.step2_characters).toBeUndefined();
    expect(invokeInput.step3_storyboard).toBeUndefined();
    expect(invokeInput.step4_video).toBeUndefined();
    expect(invokeInput.step5_final).toBeUndefined();
  });

  it('applyUserModifications 修改较早步骤时，应清空后续产物并保留更早产物（含 step5_final）', async () => {
    const currentState = {
      ...createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'project-1',
        executionMode: 'director',
      }),
      step1_script: {
        content: { text: 'step1' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step2_characters: {
        content: { text: 'step2' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step3_storyboard: {
        content: { text: 'step3' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step4_video: {
        content: { text: 'step4' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step5_final: {
        content: { text: 'step5' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      currentStep: 5,
      userModifications: {
        existing: true,
      },
    };

    mockInvoke.mockImplementationOnce(async (state) => state);

    const result = await applyUserModifications(currentState, 3, {
      note: '调整分镜节奏',
    });

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    const invokeInput = mockInvoke.mock.calls[0][0];
    expect(invokeInput.step1_script).toBeDefined();
    expect(invokeInput.step2_characters).toBeDefined();
    expect(invokeInput.step3_storyboard).toBeDefined();
    expect(invokeInput.step4_video).toBeUndefined();
    expect(invokeInput.step5_final).toBeUndefined();
    expect(invokeInput.userModifications.existing).toBe(true);
    expect(invokeInput.userModifications.step3_modified).toBe(true);
    expect((invokeInput.userModifications as any).step3_payload).toEqual({
      note: '调整分镜节奏',
    });
  });

  it('applyUserModifications 传入越界 targetStep 时，应按归一化步骤写入修改键并执行对应清理策略', async () => {
    const baseState = {
      ...createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'project-1',
        executionMode: 'director',
      }),
      step1_script: {
        content: { text: 'step1' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step2_characters: {
        content: { text: 'step2' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step3_storyboard: {
        content: { text: 'step3' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step4_video: {
        content: { text: 'step4' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      step5_final: {
        content: { text: 'step5' },
        metadata: { timestamp: Date.now(), duration: 1 },
      },
      currentStep: 5,
      userModifications: {},
    };

    // 子场景 1：targetStep 下溢，归一化为 1，需清空 step2-step5
    mockInvoke.mockImplementationOnce(async (state) => state);
    const underflowResult = await applyUserModifications(baseState, 0, {
      reason: '下溢修改',
    });

    expect(underflowResult.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    const underflowInvokeInput = mockInvoke.mock.calls[0][0];
    expect(underflowInvokeInput.step1_script).toBeDefined();
    expect(underflowInvokeInput.step2_characters).toBeUndefined();
    expect(underflowInvokeInput.step3_storyboard).toBeUndefined();
    expect(underflowInvokeInput.step4_video).toBeUndefined();
    expect(underflowInvokeInput.step5_final).toBeUndefined();
    expect(underflowInvokeInput.userModifications.step1_modified).toBe(true);
    expect((underflowInvokeInput.userModifications as any).step1_payload).toEqual({
      reason: '下溢修改',
    });
    expect((underflowInvokeInput.userModifications as any).step0_modified).toBeUndefined();

    // 子场景 2：targetStep 上溢，归一化为 TOTAL_STEPS，应写 step5_* 且不触发 graph.invoke
    const overflowResult = await applyUserModifications(baseState, TOTAL_STEPS + 2, {
      reason: '上溢修改',
    });

    expect(overflowResult.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(overflowResult.state?.userModifications.step5_modified).toBe(true);
    expect((overflowResult.state?.userModifications as any).step5_payload).toEqual({
      reason: '上溢修改',
    });
    expect((overflowResult.state?.userModifications as any).step7_modified).toBeUndefined();
  });

  it('regenerateStep 传入越界 targetStep 时，写入前后的 currentStep 都应被限制在有效范围', async () => {
    const currentState = createInitialWorkflowState({
      scriptContent: '测试脚本',
      projectId: 'project-1',
      executionMode: 'director',
    });

    mockInvoke.mockImplementationOnce(async (state) => ({
      ...state,
      currentStep: TOTAL_STEPS + 3,
    }));

    const result = await regenerateStep(currentState, TOTAL_STEPS + 2);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const invokeInput = mockInvoke.mock.calls[0][0];
    expect(invokeInput.currentStep).toBe(TOTAL_STEPS);

    expect(result.success).toBe(true);
    expect(result.state?.currentStep).toBe(TOTAL_STEPS);
    expect(result.state && validateWorkflowState(result.state)).toBe(true);
  });
});
