/**
 * AI 工作流 IPC 处理器
 * 暴露 LangGraph 工作流能力到渲染进程
 */

import { ipcMain } from 'electron';
import {
  startWorkflow,
  resumeWorkflow,
  regenerateStep,
  applyUserModifications,
} from '../ai/workflows/executor';
import type { WorkflowExecutionOptions } from '../ai/workflows/executor';
import type { WorkflowState } from '../ai/workflows/state';

/**
 * 注册 AI 工作流 IPC 处理器
 */
export function registerAIWorkflowHandlers() {
  console.log('[IPC] 注册 AI 工作流处理器');

  // ========== 工作流控制 ==========

  /**
   * 启动工作流
   */
  ipcMain.handle(
    'ai:startWorkflow',
    async (
      event,
      scriptContent: string,
      options: WorkflowExecutionOptions
    ) => {
      try {
        console.log('[IPC] ai:startWorkflow 被调用');
        const result = await startWorkflow(scriptContent, options);
        return result;
      } catch (error) {
        console.error('[IPC] ai:startWorkflow 失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '启动工作流失败',
        };
      }
    }
  );

  /**
   * 恢复工作流（导演模式确认后继续）
   */
  ipcMain.handle(
    'ai:resumeWorkflow',
    async (event, currentState: WorkflowState) => {
      try {
        console.log('[IPC] ai:resumeWorkflow 被调用');
        const result = await resumeWorkflow(currentState);
        return result;
      } catch (error) {
        console.error('[IPC] ai:resumeWorkflow 失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '恢复工作流失败',
        };
      }
    }
  );

  /**
   * 重新生成指定步骤
   */
  ipcMain.handle(
    'ai:regenerateStep',
    async (event, currentState: WorkflowState, targetStep: number) => {
      try {
        console.log(`[IPC] ai:regenerateStep 被调用 (步骤 ${targetStep})`);
        const result = await regenerateStep(currentState, targetStep);
        return result;
      } catch (error) {
        console.error('[IPC] ai:regenerateStep 失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '重新生成失败',
        };
      }
    }
  );

  /**
   * 应用用户修改
   */
  ipcMain.handle(
    'ai:applyUserModifications',
    async (
      event,
      currentState: WorkflowState,
      targetStep: number,
      modifications: any
    ) => {
      try {
        console.log(`[IPC] ai:applyUserModifications 被调用 (步骤 ${targetStep})`);
        const result = await applyUserModifications(
          currentState,
          targetStep,
          modifications
        );
        return result;
      } catch (error) {
        console.error('[IPC] ai:applyUserModifications 失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '应用修改失败',
        };
      }
    }
  );

  console.log('[IPC] AI 工作流处理器注册完成');
}
