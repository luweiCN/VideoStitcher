/**
 * 导演模式 IPC handlers - 集成真实 AI Agent 工作流
 * 处理角色生成、分镜图生成、视频合成
 */

import { ipcMain } from 'electron';
import type { Character, Storyboard } from '@shared/types/aside';
import {
  startWorkflow,
  resumeWorkflow,
  regenerateStep,
  type WorkflowExecutionOptions
} from '@main/ai/workflows/executor';
import type { WorkflowState } from '@main/ai/workflows/state';

// 工作流状态缓存（临时方案，后续可存数据库）
const workflowStates = new Map<string, WorkflowState>();

/**
 * 将工作流角色转换为前端 Character 类型
 */
function convertToCharacter(cards: any[]): Character[] {
  return cards.map((card) => ({
    id: card.id,
    name: card.name,
    description: card.description,
    imageUrl: card.imageUrl,
  }));
}

/**
 * 将工作流分镜图转换为前端 Storyboard 类型
 */
function convertToStoryboard(frames: any[]): Storyboard {
  // 计算 3x3 网格
  const cols = 3;
  const rows = Math.ceil(frames.length / cols);

  return {
    id: `storyboard-${Date.now()}`,
    rows,
    cols,
    scenes: frames.map((frame) => ({
      id: frame.id,
      index: frame.frameNumber,
      description: frame.description,
      imageUrl: frame.imageUrl,
    })),
  };
}

/**
 * 注册导演模式 IPC handlers
 */
export function registerDirectorModeHandlers() {
  // ===== 生成角色 =====
  ipcMain.handle('aside:generate-characters', async (_event, screenplayId: string) => {
    console.log('[DirectorMode] 生成角色，剧本 ID:', screenplayId);

    try {
      // 从缓存获取工作流状态
      const state = workflowStates.get(screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 执行步骤 2: 选角导演
      const result = await regenerateStep(state, 2);

      if (!result.success || !result.state?.step2_characters) {
        throw new Error(result.error || '角色生成失败');
      }

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      return {
        success: true,
        characters: convertToCharacter(result.state.step2_characters.content),
      };
    } catch (error) {
      console.error('[DirectorMode] 生成角色失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 添加角色 =====
  ipcMain.handle('aside:add-character', async (_event, data: { screenplayId: string; name: string; description: string }) => {
    console.log('[DirectorMode] 添加角色:', data.name);

    try {
      const state = workflowStates.get(data.screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 创建新角色
      const newCharacter = {
        id: `char-${Date.now()}`,
        name: data.name,
        description: data.description,
        imageUrl: undefined, // 用户上传的角色可能没有图片
      };

      // 添加到现有角色列表
      if (state.step2_characters) {
        state.step2_characters.content.push({
          id: newCharacter.id,
          name: newCharacter.name,
          description: newCharacter.description,
          imageUrl: newCharacter.imageUrl || '',
        });
      }

      return {
        success: true,
        character: newCharacter,
      };
    } catch (error) {
      console.error('[DirectorMode] 添加角色失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 编辑角色 =====
  ipcMain.handle('aside:edit-character', async (_event, data: { characterId: string; name: string; description: string }) => {
    console.log('[DirectorMode] 编辑角色:', data.characterId);

    // TODO: 更新数据库或工作流状态
    return {
      success: true,
    };
  });

  // ===== 重新生成角色 =====
  ipcMain.handle('aside:regenerate-character', async (_event, characterId: string) => {
    console.log('[DirectorMode] 重新生成角色:', characterId);

    try {
      // 找到对应的工作流状态
      let targetScreenplayId: string | null = null;
      let targetState: WorkflowState | null = null;

      for (const [screenplayId, state] of workflowStates.entries()) {
        if (state.step2_characters?.content.some((c) => c.id === characterId)) {
          targetScreenplayId = screenplayId;
          targetState = state;
          break;
        }
      }

      if (!targetState || !targetScreenplayId) {
        throw new Error('找不到角色对应的工作流');
      }

      // 重新生成角色
      const result = await regenerateStep(targetState, 2);

      if (!result.success || !result.state?.step2_characters) {
        throw new Error(result.error || '重新生成角色失败');
      }

      // 更新缓存
      workflowStates.set(targetScreenplayId, result.state);

      // 返回更新后的角色
      const updatedCharacter = result.state.step2_characters.content.find((c) => c.id === characterId);

      return {
        success: true,
        character: updatedCharacter ? {
          id: updatedCharacter.id,
          name: updatedCharacter.name,
          description: updatedCharacter.description,
          imageUrl: updatedCharacter.imageUrl,
        } : undefined,
      };
    } catch (error) {
      console.error('[DirectorMode] 重新生成角色失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 生成分镜图 =====
  ipcMain.handle('aside:generate-storyboard', async (_event, screenplayId: string) => {
    console.log('[DirectorMode] 生成分镜图，剧本 ID:', screenplayId);

    try {
      const state = workflowStates.get(screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 执行步骤 3: 分镜师
      const result = await regenerateStep(state, 3);

      if (!result.success || !result.state?.step3_storyboard) {
        throw new Error(result.error || '分镜图生成失败');
      }

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      return {
        success: true,
        storyboard: convertToStoryboard(result.state.step3_storyboard.content),
      };
    } catch (error) {
      console.error('[DirectorMode] 生成分镜图失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 重新生成分镜图 =====
  ipcMain.handle('aside:regenerate-storyboard', async (_event, storyboardId: string) => {
    console.log('[DirectorMode] 重新生成分镜图:', storyboardId);

    try {
      // 找到对应的工作流状态
      let targetScreenplayId: string | null = null;
      let targetState: WorkflowState | null = null;

      for (const [screenplayId, state] of workflowStates.entries()) {
        if (state.step3_storyboard) {
          targetScreenplayId = screenplayId;
          targetState = state;
          break;
        }
      }

      if (!targetState || !targetScreenplayId) {
        throw new Error('找不到分镜图对应的工作流');
      }

      // 重新生成分镜图
      const result = await regenerateStep(targetState, 3);

      if (!result.success || !result.state?.step3_storyboard) {
        throw new Error(result.error || '重新生成分镜图失败');
      }

      // 更新缓存
      workflowStates.set(targetScreenplayId, result.state);

      return {
        success: true,
        storyboard: convertToStoryboard(result.state.step3_storyboard.content),
      };
    } catch (error) {
      console.error('[DirectorMode] 重新生成分镜图失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 合成视频 =====
  ipcMain.handle('aside:compose-video', async (_event, screenplayId: string) => {
    console.log('[DirectorMode] 合成视频.剧本 ID:', screenplayId);

    try {
      const state = workflowStates.get(screenplayId);
      if (!state) {
        throw new Error('工作流状态不存在');
      }

      // 执行步骤 4: 摄像导演
      const result = await regenerateStep(state, 4);

      if (!result.success || !result.state?.step4_video) {
        throw new Error(result.error || '视频合成失败');
      }

      // 更新缓存
      workflowStates.set(screenplayId, result.state);

      return {
        success: true,
        videoUrl: result.state.step4_video.content.videoUrl,
      };
    } catch (error) {
      console.error('[DirectorMode] 合成视频失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ===== 初始化工作流（供内部调用） =====
  ipcMain.handle('aside:init-director-workflow', async (_event, data: {
    screenplayId: string;
    scriptContent: string;
    videoSpec: { duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' };
  }) => {
    console.log('[DirectorMode] 初始化工作流');

    try {
      const options: WorkflowExecutionOptions = {
        executionMode: 'director',
        videoSpec: data.videoSpec,
        projectId: screenplayId, // 使用 screenplayId 作为 projectId
      };

      const result = await startWorkflow(data.scriptContent, options);

      if (!result.success || !result.state) {
        throw new Error(result.error || '初始化工作流失败');
      }

      // 缓存工作流状态
      workflowStates.set(data.screenplayId, result.state);

      return {
        success: true,
        state: result.state,
      };
    } catch (error) {
      console.error('[DirectorMode] 初始化工作流失败:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });
}
