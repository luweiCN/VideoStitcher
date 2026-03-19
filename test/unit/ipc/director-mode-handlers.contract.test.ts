/**
 * 导演模式 IPC 契约测试
 * 冻结 generate-storyboard / compose-video 的步骤消费语义
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import {
  resumeWorkflow,
  regenerateStep,
} from '../../../src/main/ai/workflows/executor';
import { registerDirectorModeHandlers } from '../../../src/main/ipc/director-mode-handlers';
import { createInitialWorkflowState } from '../../../src/main/ai/workflows/state';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('../../../src/main/ai/workflows/executor', () => ({
  startWorkflow: vi.fn(),
  resumeWorkflow: vi.fn(),
  regenerateStep: vi.fn(),
}));

vi.mock('../../../src/main/database/repositories/asideScreenplayRepository', () => ({
  AsideScreenplayRepository: vi.fn(function MockAsideScreenplayRepository() {
    return {
      getScreenplayById: vi.fn().mockReturnValue({
        id: 'screenplay-1',
        projectId: 'project-1',
        title: '测试剧本',
        content: '测试剧本内容',
      }),
    };
  }),
}));

describe('导演模式 IPC 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDirectorModeHandlers();
  });

  it('generate-storyboard 应消费 step3_storyboard 并返回稳定 storyboard DTO', async () => {
    const baseState = createInitialWorkflowState({
      scriptContent: '测试剧本内容',
      projectId: 'project-1',
      executionMode: 'director',
      videoSpec: {
        duration: 'short',
        aspectRatio: '16:9',
      },
    });

    const stateAfterStep2 = {
      ...baseState,
      step2_characters: {
        content: {
          character_profiles: [
            {
              id: 'char-1',
              name: '角色一',
              role_type: 'protagonist',
              appearance: '短发',
              costume: '风衣',
              personality_traits: ['冷静'],
              key_actions: ['奔跑'],
              image_generation_prompt: '角色一提示词',
            },
          ],
        },
        metadata: {
          timestamp: Date.now(),
          duration: 10,
        },
      },
      currentStep: 3,
    };

    const stateAfterStep3 = {
      ...stateAfterStep2,
      step3_storyboard: {
        content: [
          {
            id: 'frame-1',
            frameNumber: 1,
            description: '镜头一',
            imageUrl: 'https://example.com/frame-1.jpg',
          },
          {
            id: 'frame-2',
            frameNumber: 2,
            description: '镜头二',
            imageUrl: 'https://example.com/frame-2.jpg',
          },
        ],
        metadata: {
          timestamp: Date.now(),
          duration: 12,
        },
      },
      currentStep: 4,
    };

    vi.mocked(resumeWorkflow)
      .mockResolvedValueOnce({ success: true, state: stateAfterStep2 } as any)
      .mockResolvedValueOnce({ success: true, state: stateAfterStep3 } as any);

    const handlers = vi.mocked(ipcMain.handle).mock.calls;
    const generateCharactersHandler = handlers.find((call) => call[0] === 'aside:generate-characters')?.[1] as any;
    const generateStoryboardHandler = handlers.find((call) => call[0] === 'aside:generate-storyboard')?.[1] as any;

    await generateCharactersHandler({}, 'screenplay-1', {
      duration: 'short',
      aspectRatio: '16:9',
    });

    const result = await generateStoryboardHandler({}, 'screenplay-1');

    expect(result.success).toBe(true);
    expect(result.storyboard).toBeDefined();
    expect(result.storyboard.scenes).toHaveLength(2);
    expect(result.storyboard.scenes[0]).toMatchObject({
      id: 'frame-1',
      index: 1,
      description: '镜头一',
      imageUrl: 'https://example.com/frame-1.jpg',
    });
    expect(result.storyboard.scenes[1]).toMatchObject({
      id: 'frame-2',
      index: 2,
      description: '镜头二',
      imageUrl: 'https://example.com/frame-2.jpg',
    });
  });

  it('compose-video 应消费 step5_final 并返回稳定视频结果 DTO', async () => {
    const baseState = createInitialWorkflowState({
      scriptContent: '测试剧本内容',
      projectId: 'project-1',
      executionMode: 'director',
      videoSpec: {
        duration: 'short',
        aspectRatio: '16:9',
      },
    });

    const stateAfterStep2 = {
      ...baseState,
      step2_characters: {
        content: {
          character_profiles: [
            {
              id: 'char-1',
              name: '角色一',
              role_type: 'protagonist',
              appearance: '短发',
              costume: '风衣',
              personality_traits: ['冷静'],
              key_actions: ['奔跑'],
              image_generation_prompt: '角色一提示词',
            },
          ],
        },
        metadata: {
          timestamp: Date.now(),
          duration: 10,
        },
      },
      currentStep: 3,
    };

    vi.mocked(resumeWorkflow).mockResolvedValueOnce({
      success: true,
      state: stateAfterStep2,
    } as any);

    vi.mocked(regenerateStep).mockResolvedValueOnce({
      success: true,
      state: {
        ...stateAfterStep2,
        step4_video: undefined,
        step5_final: {
          content: {
            videoUrl: 'https://example.com/final.mp4',
          },
          metadata: {
            timestamp: Date.now(),
            duration: 30,
          },
        },
        currentStep: 5,
      },
    } as any);

    const handlers = vi.mocked(ipcMain.handle).mock.calls;
    const generateCharactersHandler = handlers.find((call) => call[0] === 'aside:generate-characters')?.[1] as any;
    const composeVideoHandler = handlers.find((call) => call[0] === 'aside:compose-video')?.[1] as any;

    await generateCharactersHandler({}, 'screenplay-1', {
      duration: 'short',
      aspectRatio: '16:9',
    });

    const result = await composeVideoHandler({}, 'screenplay-1');

    expect(regenerateStep).toHaveBeenCalledWith(expect.anything(), 4);
    expect(result).toEqual({
      success: true,
      videoUrl: 'https://example.com/final.mp4',
    });
  });
});
