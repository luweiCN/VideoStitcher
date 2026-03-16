/**
 * 分镜生成节点测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storyboardNode } from '../../../../src/main/langgraph/nodes/storyboardNode';
import { GraphStateType, NodeNames } from '../../../../src/main/langgraph/state';
import * as logger from '../../../../src/main/utils/logger';

// 设置测试超时时间
vi.setConfig({
  testTimeout: 30000,
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

// Mock uuid - 模拟生成 4 个 UUID（对应 4 个场景）
vi.mock('uuid', () => ({
  v4: vi
    .fn()
    .mockReturnValueOnce('storyboard-uuid-1')
    .mockReturnValueOnce('storyboard-uuid-2')
    .mockReturnValueOnce('storyboard-uuid-3')
    .mockReturnValueOnce('storyboard-uuid-4'),
}));

describe('分镜生成节点 (storyboardNode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常流程测试', () => {
    it('应该成功生成分镜', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      expect(result.storyboard).toBeDefined();
      expect(result.storyboard?.length).toBe(2);
      expect(result.error).toBeNull();
      expect(result.currentNode).toBe(NodeNames.STORYBOARD);

      // 验证第一个分镜
      const scene1 = result.storyboard?.[0];
      expect(scene1?.id).toBe('storyboard-uuid-1');
      expect(scene1?.sceneNumber).toBe(1);
      expect(scene1?.description).toContain('开场镜头');
      expect(scene1?.imageUrl).toBeDefined();
      expect(scene1?.duration).toBe(3);
      expect(scene1?.createdAt).toBeDefined();

      // 验证第二个分镜
      const scene2 = result.storyboard?.[1];
      expect(scene2?.id).toBe('storyboard-uuid-2');
      expect(scene2?.sceneNumber).toBe(2);
      expect(scene2?.description).toContain('发展镜头');
      expect(scene2?.duration).toBe(4);
    });

    it('应该生成包含角色信息的分镜描述', async () => {
      const state: GraphStateType = {
        userRequirement: '产品宣传',
        selectedStyle: '解说',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '产品经理',
            description: '专业的产品经理形象',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      result.storyboard?.forEach((scene) => {
        expect(scene.description).toContain('角色');
      });
    });

    it('应该记录日志信息', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      await storyboardNode(state);

      expect(logger.logger.info).toHaveBeenCalledWith(
        '[分镜节点] 开始执行',
        expect.objectContaining({
          characterCount: 1,
        })
      );

      expect(logger.logger.info).toHaveBeenCalledWith(
        '[分镜节点] 生成完成',
        expect.objectContaining({
          count: 2,
        })
      );
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
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      expect(result.error).toBe('UUID 生成失败');
      expect(result.currentNode).toBe(NodeNames.STORYBOARD);
      expect(result.storyboard).toBeUndefined();

      expect(logger.logger.error).toHaveBeenCalledWith(
        '[分镜节点] 执行失败',
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
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      expect(result.error).toBe('未知错误');
      expect(result.currentNode).toBe(NodeNames.STORYBOARD);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理角色列表为空的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      // 即使没有角色也应该生成分镜
      expect(result.storyboard).toBeDefined();
      expect(result.storyboard?.length).toBe(2);
      expect(result.error).toBeNull();
    });

    it('应该处理多个角色的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色1',
            createdAt: Date.now(),
          },
          {
            id: 'char-2',
            name: '配角',
            description: '测试角色2',
            createdAt: Date.now(),
          },
          {
            id: 'char-3',
            name: '路人',
            description: '测试角色3',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      expect(result.storyboard).toBeDefined();
      expect(result.storyboard?.length).toBe(2);
      expect(result.error).toBeNull();
    });

    it('应该处理角色信息包含特殊字符的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角<script>alert("xss")</script>',
            description: '测试<script>角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      expect(result.storyboard).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('应该验证生成的分镜包含必需的字段', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      result.storyboard?.forEach((scene) => {
        expect(scene).toHaveProperty('id');
        expect(scene).toHaveProperty('sceneNumber');
        expect(scene).toHaveProperty('description');
        expect(scene).toHaveProperty('imageUrl');
        expect(scene).toHaveProperty('duration');
        expect(scene).toHaveProperty('createdAt');

        expect(typeof scene.id).toBe('string');
        expect(typeof scene.sceneNumber).toBe('number');
        expect(typeof scene.description).toBe('string');
        expect(typeof scene.duration).toBe('number');
        expect(typeof scene.createdAt).toBe('number');
      });
    });

    it('应该按场景序号生成分镜', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      const sceneNumbers = result.storyboard?.map((s) => s.sceneNumber);
      expect(sceneNumbers).toEqual([1, 2]);
    });

    it('应该处理已有的分镜状态', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: null,
        videoConfig: null,
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
            id: 'old-scene-1',
            sceneNumber: 1,
            description: '旧的分镜',
            createdAt: Date.now() - 1000,
          },
        ],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await storyboardNode(state);

      // 应该生成新的分镜，不保留旧的
      expect(result.storyboard?.length).toBe(2);
      expect(result.storyboard?.[0].id).not.toBe('old-scene-1');
    });
  });
});
