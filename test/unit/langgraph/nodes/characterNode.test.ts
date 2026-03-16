/**
 * 角色设定节点测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { characterNode } from '../../../../src/main/langgraph/nodes/characterNode';
import { GraphStateType, NodeNames } from '../../../../src/main/langgraph/state';
import * as logger from '../../../../src/main/utils/logger';

// Mock logger
vi.mock('../../../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'character-uuid-1234'),
}));

describe('角色设定节点 (characterNode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常流程测试', () => {
    it('应该成功生成角色设定', async () => {
      const state: GraphStateType = {
        userRequirement: '产品宣传',
        selectedStyle: '解说',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '这是一个测试脚本，用于角色生成测试，内容需要超过五十个字符以确保截断功能正常工作',
            style: '解说',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.characters).toBeDefined();
      expect(result.characters?.length).toBe(1);
      expect(result.error).toBeNull();
      expect(result.currentNode).toBe(NodeNames.CHARACTER);

      // 验证角色属性
      const character = result.characters?.[0];
      expect(character?.id).toBe('character-uuid-1234');
      expect(character?.name).toBe('主角');
      expect(character?.description).toContain('基于脚本');
      expect(character?.imageUrl).toBeDefined();
      expect(character?.createdAt).toBeDefined();
    });

    it('应该使用选中脚本的内容生成角色', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '第一个脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: false,
          },
          {
            id: 'script-2',
            text: '选中的脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-2',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.characters?.[0].description).toContain('选中的脚本内容');
    });

    it('应该记录日志信息', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '测试脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      await characterNode(state);

      expect(logger.logger.info).toHaveBeenCalledWith(
        '[角色节点] 开始执行',
        expect.objectContaining({
          selectedScriptId: 'script-1',
        })
      );

      expect(logger.logger.info).toHaveBeenCalledWith(
        '[角色节点] 生成完成',
        expect.objectContaining({
          count: 1,
        })
      );
    });
  });

  describe('错误处理测试', () => {
    it('应该在未找到选中脚本时抛出错误', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '测试脚本',
            style: '幽默',
            createdAt: Date.now(),
            selected: false,
          },
        ],
        selectedScriptId: 'non-existent-script',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.error).toBe('未找到选中的脚本');
      expect(result.currentNode).toBe(NodeNames.CHARACTER);
      expect(result.characters).toBeUndefined();

      expect(logger.logger.error).toHaveBeenCalledWith(
        '[角色节点] 执行失败',
        '未找到选中的脚本'
      );
    });

    it('应该在脚本列表为空时抛出错误', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.error).toBe('未找到选中的脚本');
      expect(result.currentNode).toBe(NodeNames.CHARACTER);
    });

    it('应该捕获并处理 UUID 生成错误', async () => {
      const uuid = await import('uuid');
      vi.mocked(uuid.v4).mockImplementationOnce(() => {
        throw new Error('UUID 生成失败');
      });

      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '测试脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.error).toBe('UUID 生成失败');
      expect(result.currentNode).toBe(NodeNames.CHARACTER);
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
        scripts: [
          {
            id: 'script-1',
            text: '测试脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.error).toBe('未知错误');
    });
  });

  describe('边界条件测试', () => {
    it('应该处理 selectedScriptId 为 null 的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '测试脚本',
            style: '幽默',
            createdAt: Date.now(),
            selected: false,
          },
        ],
        selectedScriptId: null,
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.error).toBe('未找到选中的脚本');
    });

    it('应该处理脚本文本长度刚好为 50 的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '这是一个测试脚本内容长度刚好五十个字符1234567890',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.characters).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('应该处理脚本文本长度小于 50 的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '短脚本',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.characters).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('应该处理包含特殊字符的脚本内容', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 1,
        scripts: [
          {
            id: 'script-1',
            text: '脚本<script>alert("xss")</script>包含特殊字符，内容长度需要超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.characters).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('应该处理多个脚本时正确选择指定 ID 的脚本', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 5,
        scripts: [
          {
            id: 'script-1',
            text: '第一个脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: false,
          },
          {
            id: 'script-2',
            text: '第二个脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: false,
          },
          {
            id: 'script-3',
            text: '第三个脚本内容，这是一个很长的测试脚本内容，需要确保长度超过五十个字符',
            style: '幽默',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-2',
        videoConfig: null,
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await characterNode(state);

      expect(result.characters?.[0].description).toContain('第二个脚本内容');
    });
  });
});
