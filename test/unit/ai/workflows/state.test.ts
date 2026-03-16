/**
 * 工作流状态测试
 * 验证状态定义和工具函数的正确性
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialWorkflowState,
  updateWorkflowState,
  validateWorkflowState,
  getCurrentStep,
  isStepCompleted,
  markStepAsModified,
  clearError,
  setError,
  incrementRetryCount,
  WORKFLOW_STEPS,
  TOTAL_STEPS,
} from '../../../../src/main/ai/workflows/state';
import type { Script } from '@shared/types/aside';

describe('工作流状态定义', () => {
  describe('createInitialWorkflowState', () => {
    it('应该使用默认值创建初始状态', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试脚本内容',
        projectId: 'test-project-id',
      });

      expect(state.scriptContent).toBe('测试脚本内容');
      expect(state.projectId).toBe('test-project-id');
      expect(state.executionMode).toBe('fast');
      expect(state.videoSpec.duration).toBe('short');
      expect(state.videoSpec.aspectRatio).toBe('16:9');
      expect(state.currentStep).toBe(1);
      expect(state.humanApproval).toBe(false);
      expect(state.needsRegeneration).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.step1_script).toBeUndefined();
      expect(state.step2_characters).toBeUndefined();
      expect(state.step3_storyboard).toBeUndefined();
      expect(state.step4_video).toBeUndefined();
    });

    it('应该使用自定义执行模式创建状态', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'test-id',
        executionMode: 'director',
      });

      expect(state.executionMode).toBe('director');
      expect(state.humanApproval).toBe(true);
    });

    it('应该使用自定义视频规格创建状态', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'test-id',
        videoSpec: {
          duration: 'long',
          aspectRatio: '9:16',
        },
      });

      expect(state.videoSpec.duration).toBe('long');
      expect(state.videoSpec.aspectRatio).toBe('9:16');
    });
  });

  describe('updateWorkflowState', () => {
    it('应该更新工作流状态', () => {
      const initialState = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const updatedState = updateWorkflowState(initialState, {
        currentStep: 2,
        humanApproval: true,
      });

      expect(updatedState.currentStep).toBe(2);
      expect(updatedState.humanApproval).toBe(true);
      expect(updatedState.scriptContent).toBe('测试');
      expect(updatedState.projectId).toBe('test-id');
    });
  });

  describe('validateWorkflowState', () => {
    it('应该验证有效的状态', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试脚本',
        projectId: 'test-id',
      });

      expect(validateWorkflowState(state)).toBe(true);
    });

    it('应该拒绝无效的脚本内容', () => {
      const state = {
        ...createInitialWorkflowState({
          scriptContent: '测试',
          projectId: 'test-id',
        }),
        scriptContent: '',
      };

      expect(validateWorkflowState(state)).toBe(false);
    });

    it('应该拒绝无效的项目 ID', () => {
      const state = {
        ...createInitialWorkflowState({
          scriptContent: '测试',
          projectId: 'test-id',
        }),
        projectId: '',
      };

      expect(validateWorkflowState(state)).toBe(false);
    });

    it('应该拒绝无效的执行模式', () => {
      const state = {
        ...createInitialWorkflowState({
          scriptContent: '测试',
          projectId: 'test-id',
        }),
        executionMode: 'invalid' as any,
      };

      expect(validateWorkflowState(state)).toBe(false);
    });

    it('应该拒绝无效的当前步骤', () => {
      const state = {
        ...createInitialWorkflowState({
          scriptContent: '测试',
          projectId: 'test-id',
        }),
        currentStep: 10,
      };

      expect(validateWorkflowState(state)).toBe(false);
    });
  });

  describe('getCurrentStep', () => {
    it('应该返回当前步骤信息', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const step = getCurrentStep(state);

      expect(step.id).toBe(1);
      expect(step.name).toBe('script');
      expect(step.label).toBe('脚本编写');
    });

    it('应该为不同步骤返回正确信息', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const updatedState = updateWorkflowState(state, { currentStep: 3 });
      const step = getCurrentStep(updatedState);

      expect(step.id).toBe(3);
      expect(step.name).toBe('storyboard');
      expect(step.label).toBe('分镜设计');
    });
  });

  describe('isStepCompleted', () => {
    it('未完成的步骤应该返回 false', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      expect(isStepCompleted(state, 1)).toBe(false);
      expect(isStepCompleted(state, 2)).toBe(false);
    });

    it('完成的步骤应该返回 true', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const script: Script = {
        id: 'script-id',
        projectId: 'test-id',
        content: '脚本内容',
        status: 'library',
        createdAt: new Date().toISOString(),
      };

      const updatedState = updateWorkflowState(state, {
        step1_script: {
          content: script,
          metadata: {
            timestamp: Date.now(),
            duration: 1000,
          },
        },
      });

      expect(isStepCompleted(updatedState, 1)).toBe(true);
    });
  });

  describe('markStepAsModified', () => {
    it('应该标记步骤为已修改', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const updatedState = markStepAsModified(state, 1);

      expect(updatedState.userModifications.step1_modified).toBe(true);
    });
  });

  describe('错误处理函数', () => {
    it('应该设置错误信息', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const errorState = setError(state, 2, '测试错误');

      expect(errorState.error).toBeDefined();
      expect(errorState.error?.step).toBe(2);
      expect(errorState.error?.message).toBe('测试错误');
      expect(errorState.error?.retryCount).toBe(0);
    });

    it('应该清除错误信息', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const errorState = setError(state, 2, '测试错误');
      const clearedState = clearError(errorState);

      expect(clearedState.error).toBeUndefined();
    });

    it('应该增加重试计数', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const errorState = setError(state, 2, '测试错误');
      const retryState = incrementRetryCount(errorState);

      expect(retryState.error?.retryCount).toBe(1);

      const retryAgainState = incrementRetryCount(retryState);
      expect(retryAgainState.error?.retryCount).toBe(2);
    });

    it('没有错误时增加重试计数应该无操作', () => {
      const state = createInitialWorkflowState({
        scriptContent: '测试',
        projectId: 'test-id',
      });

      const retryState = incrementRetryCount(state);

      expect(retryState.error).toBeUndefined();
    });
  });

  describe('工作流步骤常量', () => {
    it('应该定义 4 个步骤', () => {
      expect(TOTAL_STEPS).toBe(4);
      expect(WORKFLOW_STEPS.length).toBe(4);
    });

    it('步骤应该有正确的结构', () => {
      const firstStep = WORKFLOW_STEPS[0];

      expect(firstStep.id).toBe(1);
      expect(firstStep.name).toBe('script');
      expect(firstStep.label).toBeDefined();
      expect(firstStep.description).toBeDefined();
    });
  });
});
