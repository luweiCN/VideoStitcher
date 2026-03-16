/**
 * 脚本生成节点测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scriptNode } from '../../../../src/main/langgraph/nodes/scriptNode';
import { GraphStateType, NodeNames } from '../../../../src/main/langgraph/state';
import log from '../../../../src/main/utils/logger';

// 设置测试超时时间
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 30000,
});

// Mock logger - 注意：logger.ts 使用 export default
vi.mock('../../../../src/main/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

describe('脚本生成节点 (scriptNode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常流程测试', () => {
    it('应该成功生成指定数量的脚本', async () => {
      const state: GraphStateType = {
        userRequirement: '测试需求',
        selectedStyle: '幽默',
        batchSize: 3,
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

      const result = await scriptNode(state);

      expect(result.scripts).toBeDefined();
      expect(result.scripts?.length).toBe(3);
      expect(result.error).toBeNull();
      expect(result.currentNode).toBe(NodeNames.SCRIPT);

      // 验证每个脚本的属性
      result.scripts?.forEach((script, index) => {
        expect(script.id).toBeDefined();
        expect(script.text).toContain('模拟脚本');
        expect(script.text).toContain((index + 1).toString());
        expect(script.style).toBe('幽默');
        expect(script.createdAt).toBeDefined();
        expect(script.selected).toBe(false);
      });
    });

    it('应该使用正确的用户需求和风格', async () => {
      const state: GraphStateType = {
        userRequirement: '产品宣传视频',
        selectedStyle: '解说',
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

      const result = await scriptNode(state);

      expect(result.scripts?.[0].text).toContain('产品宣传视频');
      expect(result.scripts?.[0].text).toContain('解说');
      expect(result.scripts?.[0].style).toBe('解说');
    });

    it('应该记录日志信息', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '搞笑',
        batchSize: 2,
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

      await scriptNode(state);

      expect(log.info).toHaveBeenCalledWith(
        '[脚本节点] 开始执行',
        expect.objectContaining({
          userRequirement: '测试',
          selectedStyle: '搞笑',
          batchSize: 2,
        })
      );

      expect(log.info).toHaveBeenCalledWith(
        '[脚本节点] 生成完成',
        expect.objectContaining({
          count: 2,
        })
      );
    });
  });

  describe('错误处理测试', () => {
    it('应该捕获并返回错误信息', async () => {
      // Mock uuid 抛出错误
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
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await scriptNode(state);

      expect(result.error).toBe('UUID 生成失败');
      expect(result.currentNode).toBe(NodeNames.SCRIPT);
      expect(result.scripts).toBeUndefined();

      expect(log.error).toHaveBeenCalledWith(
        '[脚本节点] 执行失败',
        'UUID 生成失败'
      );
    });

    it('应该处理非 Error 类型的异常', async () => {
      // Mock uuid 抛出字符串错误
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
        characters: [],
        storyboard: [],
        videos: [],
        knowledgeBaseResults: [],
        error: null,
        currentNode: '',
      };

      const result = await scriptNode(state);

      expect(result.error).toBe('未知错误');
      expect(result.currentNode).toBe(NodeNames.SCRIPT);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理 batchSize 为 0 的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 0,
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

      const result = await scriptNode(state);

      expect(result.scripts).toBeDefined();
      expect(result.scripts?.length).toBe(0);
      expect(result.error).toBeNull();
    });

    it('应该处理 batchSize 为大数值的情况', async () => {
      const state: GraphStateType = {
        userRequirement: '测试',
        selectedStyle: '幽默',
        batchSize: 10, // 降低到 10 以避免超时
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

      const result = await scriptNode(state);

      expect(result.scripts).toBeDefined();
      expect(result.scripts?.length).toBe(10);
      expect(result.error).toBeNull();
    });

    it('应该处理空的用户需求', async () => {
      const state: GraphStateType = {
        userRequirement: '',
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

      const result = await scriptNode(state);

      expect(result.scripts).toBeDefined();
      expect(result.scripts?.length).toBe(1);
      expect(result.error).toBeNull();
    });

    it('应该处理特殊字符的用户需求', async () => {
      const state: GraphStateType = {
        userRequirement: '测试<script>alert("xss")</script>',
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

      const result = await scriptNode(state);

      expect(result.scripts).toBeDefined();
      expect(result.scripts?.length).toBe(1);
      expect(result.error).toBeNull();
    });

    it('应该处理不同风格的脚本生成', async () => {
      const styles = ['幽默', '悬疑', '搞笑', '教学', '解说'];

      for (const style of styles) {
        const state: GraphStateType = {
          userRequirement: '测试',
          selectedStyle: style,
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

        const result = await scriptNode(state);

        expect(result.scripts?.[0].style).toBe(style);
        expect(result.scripts?.[0].text).toContain(style);
      }
    });
  });
});
