/**
 * 视频生成节点测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { videoNode } from '../../../../src/main/langgraph/nodes/videoNode';
import { GraphStateType, NodeNames } from '../../../../src/main/langgraph/state';
import * as logger from '../../../../src/main/utils/logger';

// 设置测试超时时间
vi.setConfig({
  testTimeout: 60000, // 视频生成需要更长时间
  hookTimeout: 30000,
});

// Mock logger
vi.mock('../../../../src/main/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock VolcanoClient
vi.mock('../../../../src/main/api/volcano-client', () => ({
  VolcanoClient: vi.fn().mockImplementation(() => ({
    generateVideo: vi.fn().mockResolvedValue('volcano-task-123'),
    queryVideoTask: vi.fn().mockResolvedValue({
      status: 'completed',
      progress: 100,
      video_url: 'https://example.com/video.mp4',
    }),
  })),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'video-uuid-1234'),
}));

describe('视频生成节点 (videoNode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常流程测试', () => {
    it('应该成功生成视频', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
          resolution: '1080p',
        },
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '开场镜头',
            duration: 3,
            imageUrl: 'https://example.com/scene1.png',
            createdAt: Date.now(),
          },
          {
            id: 'scene-2',
            sceneNumber: 2,
            description: '发展镜头',
            duration: 4,
            imageUrl: 'https://example.com/scene2.png',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      expect(result.videos).toBeDefined();
      expect(result.videos?.length).toBe(1);
      expect(result.error).toBeNull();
      expect(result.currentNode).toBe(NodeNames.VIDEO);

      // 验证视频属性
      const video = result.videos?.[0];
      expect(video?.id).toBe('video-uuid-1234');
      expect(video?.url).toBeDefined();
      expect(video?.status).toBe('completed');
      expect(video?.progress).toBe(100);
      expect(video?.taskId).toBeDefined();
      expect(video?.createdAt).toBeDefined();
    });

    it('应该使用视频配置参数', async () => {
      const state: GraphStateType = {
        userRequirement: '产品宣传',
        selectedStyle: '解说',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 120,
          ratio: '9:16',
          resolution: '4K',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      expect(result.videos).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('应该记录日志信息包含分镜数量', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
          {
            id: 'scene-2',
            sceneNumber: 2,
            description: '场景2',
            createdAt: Date.now(),
          },
          {
            id: 'scene-3',
            sceneNumber: 3,
            description: '场景3',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      await videoNode(state);

      expect(logger.logger.info).toHaveBeenCalledWith(
        '[视频节点] 开始执行',
        expect.objectContaining({
          storyboardCount: 3,
          videoConfig: state.videoConfig,
        })
      );

      expect(logger.logger.info).toHaveBeenCalledWith(
        '[视频节点] 生成完成',
        expect.objectContaining({
          count: 1,
        })
      );
    });

    it('应该生成包含任务 ID 的视频', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      const video = result.videos?.[0];
      expect(video?.taskId).toBe('volcano-task-123');
    });
  });

  describe('错误处理测试', () => {
    it('应该捕获并返回错误信息', async () => {
      const uuid = await import('uuid');
      vi.mocked(uuid.v4).mockImplementationOnce(() => {
        throw new Error('UUID 生成失败');
      });

      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      expect(result.error).toBe('UUID 生成失败');
      expect(result.currentNode).toBe(NodeNames.VIDEO);
      expect(result.videos).toBeUndefined();

      expect(logger.logger.error).toHaveBeenCalledWith(
        '[视频节点] 执行失败',
        'UUID 生成失败'
      );
    });

    it('应该处理非 Error 类型的异常', async () => {
      const uuid = await import('uuid');
      vi.mocked(uuid.v4).mockImplementationOnce(() => {
        throw '字符串错误';
      });

      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      expect(result.error).toBe('未知错误');
      expect(result.currentNode).toBe(NodeNames.VIDEO);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理分镜列表为空的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      // 即使没有分镜也应该生成视频
      expect(result.videos).toBeDefined();
      expect(result.videos?.length).toBe(1);
      expect(result.error).toBeNull();
    });

    it('应该处理 videoConfig 为 null 的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      expect(result.videos).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('应该处理不同视频比例的配置', async () => {
      const ratios: Array<'16:9' | '9:16' | '1:1'> = ['16:9', '9:16', '1:1'];

      for (const ratio of ratios) {
        const state: GraphStateType = {
          userRequirement: '测试',
          selectedStyle: '幽默',
          batchSize: 1,
          scripts: [],
          selectedScriptId: null,
          videoConfig: {
            length: 60,
            ratio: ratio,
          },
          characters: [],
          storyboard: [
            {
              id: 'scene-1',
              sceneNumber: 1,
              description: '场景1',
              createdAt: Date.now(),
            },
          ],
          videos: [],
          knowledgeBaseResults: [],
          error: null,
          currentNode: '',
        };

        const result = await videoNode(state);

        expect(result.videos).toBeDefined();
        expect(result.error).toBeNull();
      }
    });

    it('应该处理大量分镜的情况', async () => {
      const storyboard = Array.from({ length: 100 }, (_, i) => ({
        id: `scene-${i}`,
        sceneNumber: i + 1,
        description: `场景 ${i + 1}`,
        createdAt: Date.now(),
      }));

      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 300,
          ratio: '16:9',
        },
        characters: [],
        storyboard,
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      expect(result.videos).toBeDefined();
      expect(result.videos?.length).toBe(1);
      expect(result.error).toBeNull();
    });

    it('应该验证生成的视频状态为已完成', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      const video = result.videos?.[0];
      expect(video?.status).toBe('completed');
      expect(video?.progress).toBe(100);
    });

    it('应该处理已有的视频状态', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [
          {
            id: 'old-video-1',
            url: 'https://example.com/old-video.mp4',
            status: 'pending',
            progress: 50,
            createdAt: Date.now() - 1000,
          },
        ],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      // 应该生成新的视频，不保留旧的
      expect(result.videos?.length).toBe(1);
      expect(result.videos?.[0].id).not.toBe('old-video-1');
      expect(result.videos?.[0].status).toBe('completed');
    });

    it('应该处理视频配置的不同时长', async () => {
      const lengths = [15, 30, 60, 120, 300, 600];

      for (const length of lengths) {
        const state: GraphStateType = {
          userRequirement: '测试',
          selectedStyle: '幽默',
          batchSize: 1,
          scripts: [],
          selectedScriptId: null,
          videoConfig: {
            length,
            ratio: '16:9',
          },
          characters: [],
          storyboard: [
            {
              id: 'scene-1',
              sceneNumber: 1,
              description: '场景1',
              createdAt: Date.now(),
            },
          ],
          videos: [],
          knowledgeBaseResults: [],
          error: null,
          currentNode: '',
        };

        const result = await videoNode(state);

        expect(result.videos).toBeDefined();
        expect(result.error).toBeNull();
      }
    });

    it('应该验证视频对象包含所有必需字段', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: {
          length: 60,
          ratio: '16:9',
        },
        characters: [],
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景1',
            createdAt: Date.now(),
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await videoNode(state);

      const video = result.videos?.[0];
      expect(video).toHaveProperty('id');
      expect(video).toHaveProperty('url');
      expect(video).toHaveProperty('status');
      expect(video).toHaveProperty('progress');
      expect(video).toHaveProperty('taskId');
      expect(video).toHaveProperty('createdAt');

      expect(typeof video?.id).toBe('string');
      expect(typeof video?.url).toBe('string');
      expect(['pending', 'processing', 'completed', 'failed']).toContain(video?.status);
      expect(typeof video?.progress).toBe('number');
      expect(typeof video?.taskId).toBe('string');
      expect(typeof video?.createdAt).toBe('number');
    });
  });
});
