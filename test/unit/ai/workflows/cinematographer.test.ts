/**
 * 摄像师节点测试
 * 验证 Agent 5 输出字段契约
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cinematographerNode } from '../../../../src/main/ai/workflows/nodes/cinematographer';
import type { WorkflowState } from '../../../../src/main/ai/workflows/state';
import { TOTAL_STEPS } from '../../../../src/main/ai/workflows/state';

const mockGenerateText = vi.fn();

vi.mock('../../../../src/main/ai/provider-manager', () => ({
  getGlobalProvider: () => ({
    generateText: mockGenerateText,
  }),
}));

function createBaseState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    scriptContent: '测试剧本',
    projectId: 'project-1',
    executionMode: 'director',
    videoSpec: {
      duration: 'short',
      aspectRatio: '9:16',
    },
    step1_script: {
      content: '测试剧本',
      metadata: {
        timestamp: Date.now(),
        duration: 0,
        model: 'external',
        tokens: 0,
      },
    },
    step2_characters: undefined,
    step3_storyboard: undefined,
    step4_video: {
      content: {
        storyboard_groups: [
          {
            group_id: 1,
            frames: [1, 2, 3],
            description: '测试分镜组',
          },
        ],
      },
      metadata: {
        timestamp: Date.now(),
        duration: 1000,
        model: 'volcengine-doubao',
        tokens: 500,
      },
    },
    step5_final: undefined,
    currentStep: 5,
    humanApproval: false,
    userModifications: {},
    needsRegeneration: false,
    messages: [],
    error: undefined,
    ...overrides,
  };
}

describe('摄像师节点字段契约', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({
        total_video_chunks: 1,
        render_queue: [
          {
            chunk_id: 1,
            duration_seconds: 10,
            start_frame: 1,
            end_frame: 10,
            reference_images: ['分镜1-10'],
            video_generation_prompt: '测试视频提示词',
            camera_movement: 'Tracking shot',
            transition_note: 'cut',
          },
        ],
        total_duration_seconds: 10,
        final_output_settings: {
          resolution: '1080x1920',
          fps: 30,
          codec: 'H.264',
        },
      }),
      usage: {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      },
      finishReason: 'stop',
    });
  });

  it('应仅写入 step5_final 且不覆盖前序步骤字段', async () => {
    const state = createBaseState();

    const originalStep4Video = JSON.parse(JSON.stringify(state.step4_video));
    const updates = await cinematographerNode(state);

    expect(updates.step5_final).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(updates, 'step4_video')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(updates, 'step3_storyboard')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(updates, 'step2_characters')).toBe(false);
    expect(updates.currentStep).toBe(TOTAL_STEPS);

    expect(state.step4_video).toEqual(originalStep4Video);

    const finalContent = updates.step5_final?.content;
    expect(finalContent?.total_video_chunks).toBeTypeOf('number');
    expect(Array.isArray(finalContent?.render_queue)).toBe(true);
    expect(finalContent?.render_queue[0]).toMatchObject({
      chunk_id: expect.any(Number),
      duration_seconds: expect.any(Number),
      video_generation_prompt: expect.any(String),
    });
    expect(finalContent?.final_output_settings).toMatchObject({
      resolution: expect.any(String),
      fps: expect.any(Number),
      codec: expect.any(String),
    });
  });

  it('缺少分镜师输出时应抛出错误且不调用 LLM', async () => {
    const state = createBaseState({
      step4_video: undefined,
    });

    await expect(cinematographerNode(state)).rejects.toThrow('[Agent 5: 摄像师] 缺少分镜师输出');
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('非导演模式不应写入 humanApproval 字段', async () => {
    const state = createBaseState({
      executionMode: 'fast',
    });

    const updates = await cinematographerNode(state);
    expect(Object.prototype.hasOwnProperty.call(updates, 'humanApproval')).toBe(false);
  });

  it('LLM usage 缺失时应使用默认 token 值', async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({
        total_video_chunks: 1,
        render_queue: [],
        total_duration_seconds: 10,
        final_output_settings: {
          resolution: '1080x1920',
          fps: 30,
          codec: 'H.264',
        },
      }),
      finishReason: 'stop',
    });

    const state = createBaseState();
    const updates = await cinematographerNode(state);

    expect(updates.step5_final?.metadata.tokens).toBe(0);
  });

  it('LLM 返回缺少关键字段的 JSON 时应抛出格式错误', async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({
        total_video_chunks: 1,
        total_duration_seconds: 10,
        final_output_settings: {
          resolution: '1080x1920',
          fps: 30,
          codec: 'H.264',
        },
      }),
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      finishReason: 'stop',
    });

    const state = createBaseState();
    await expect(cinematographerNode(state)).rejects.toThrow('摄像师输出格式错误：缺少 render_queue 数组字段');
  });
});
