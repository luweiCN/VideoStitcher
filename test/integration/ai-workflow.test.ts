/**
 * AI 工作流集成测试
 * 测试从脚本到视频的完整流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scriptNode } from '../../../src/main/langgraph/nodes/scriptNode';
import { characterNode } from '../../../src/main/langgraph/nodes/characterNode';
import { storyboardNode } from '../../../src/main/langgraph/nodes/storyboardNode';
import { videoNode } from '../../../src/main/langgraph/nodes/videoNode';
import { GraphStateType } from '../../../src/main/langgraph/state';

// 设置测试超时时间
vi.setConfig({
  testTimeout: 60000,
  hookTimeout: 30000,
});

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi
    .fn()
    .mockReturnValueOnce('script-1')
    .mockReturnValueOnce('script-2')
    .mockReturnValueOnce('script-3')
    .mockReturnValueOnce('character-1')
    .mockReturnValueOnce('character-2')
    .mockReturnValueOnce('scene-1')
    .mockReturnValueOnce('scene-2')
    .mockReturnValueOnce('scene-3')
    .mockReturnValueOnce('scene-4')
    .mockReturnValueOnce('video-1'),
}));

describe('AI 工作流集成测试', () => {
  let initialState: GraphStateType;

  beforeEach(() => {
    vi.clearAllMocks();

    // 初始状态
    initialState = {
      userRequirement: '产品宣传视频，展示产品的核心功能和使用场景',
      selectedStyle: '解说',
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
  });

  describe('完整工作流测试', () => {
    it('应该完成从脚本到视频的完整流程', async () => {
      // 步骤 1: 生成脚本
      console.log('步骤 1: 生成脚本...');
      const scriptResult = await scriptNode(initialState);

      expect(scriptResult.scripts).toBeDefined();
      expect(scriptResult.scripts?.length).toBe(3);
      expect(scriptResult.error).toBeNull();

      // 更新状态
      const stateAfterScript: GraphStateType = {
        ...initialState,
        scripts: scriptResult.scripts!,
        selectedScriptId: scriptResult.scripts![0].id,
        currentNode: scriptResult.currentNode!,
      };

      // 步骤 2: 生成角色
      console.log('步骤 2: 生成角色...');
      const characterResult = await characterNode(stateAfterScript);

      expect(characterResult.characters).toBeDefined();
      expect(characterResult.characters!.length).toBeGreaterThan(0);
      expect(characterResult.error).toBeNull();

      // 更新状态
      const stateAfterCharacter: GraphStateType = {
        ...stateAfterScript,
        characters: characterResult.characters!,
        currentNode: characterResult.currentNode!,
      };

      // 步骤 3: 生成分镜
      console.log('步骤 3: 生成分镜...');
      const storyboardResult = await storyboardNode(stateAfterCharacter);

      expect(storyboardResult.storyboard).toBeDefined();
      expect(storyboardResult.storyboard!.length).toBeGreaterThan(0);
      expect(storyboardResult.error).toBeNull();

      // 更新状态（添加视频配置）
      const stateAfterStoryboard: GraphStateType = {
        ...stateAfterCharacter,
        storyboard: storyboardResult.storyboard!,
        videoConfig: {
          length: 60,
          ratio: '16:9',
          resolution: '1080p',
        },
        currentNode: storyboardResult.currentNode!,
      };

      // 步骤 4: 生成视频
      console.log('步骤 4: 生成视频...');
      const videoResult = await videoNode(stateAfterStoryboard);

      expect(videoResult.videos).toBeDefined();
      expect(videoResult.videos!.length).toBeGreaterThan(0);
      expect(videoResult.error).toBeNull();

      // 验证最终视频
      const finalVideo = videoResult.videos![0];
      expect(finalVideo.status).toBe('completed');
      expect(finalVideo.url).toBeDefined();
      expect(finalVideo.progress).toBe(100);

      console.log('完整工作流测试通过！');
    }, 60000);

    it('应该正确处理工作流中的错误传播', async () => {
      // 创建一个无效的初始状态（没有选择脚本）
      const invalidState: GraphStateType = {
        ...initialState,
        scripts: [],
        selectedScriptId: null,
      };

      // 尝试生成角色应该失败
      const characterResult = await characterNode(invalidState);

      expect(characterResult.error).toBeDefined();
      expect(characterResult.characters).toBeUndefined();
    }, 30000);
  });

  describe('状态管理测试', () => {
    it('应该正确维护和更新状态', async () => {
      let currentState = { ...initialState };

      // 执行脚本节点
      const scriptResult = await scriptNode(currentState);
      currentState = {
        ...currentState,
        ...scriptResult,
      } as GraphStateType;

      expect(currentState.scripts?.length).toBe(3);
      expect(currentState.currentNode).toBe('script');

      // 选择第一个脚本
      currentState.selectedScriptId = currentState.scripts[0].id;

      // 执行角色节点
      const characterResult = await characterNode(currentState);
      currentState = {
        ...currentState,
        ...characterResult,
      } as GraphStateType;

      expect(currentState.characters?.length).toBeGreaterThan(0);
      expect(currentState.currentNode).toBe('character');

      // 验证之前的状态仍然存在
      expect(currentState.scripts?.length).toBe(3);
      expect(currentState.selectedScriptId).toBeDefined();
    }, 30000);
  });

  describe('进度回调测试', () => {
    it('应该正确调用进度回调函数', async () => {
      const progressMessages: Array<{ progress: number; message: string }> = [];

      const onProgress = (progress: number, message: string) => {
        progressMessages.push({ progress, message });
      };

      // 执行脚本节点并捕获进度
      await scriptNode(initialState, { onProgress });

      // 验证进度消息
      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages[0].progress).toBeGreaterThanOrEqual(0);
      expect(progressMessages[0].message).toBeDefined();
    }, 15000);
  });

  describe('性能测试', () => {
    it('脚本生成应该在 5 秒内完成', async () => {
      const startTime = Date.now();

      await scriptNode(initialState);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);

      console.log(`脚本生成耗时: ${duration}ms`);
    }, 10000);

    it('角色生成应该在 3 秒内完成', async () => {
      const stateWithScript: GraphStateType = {
        ...initialState,
        scripts: [
          {
            id: 'script-1',
            text: '这是一个测试脚本，用于性能测试，内容需要超过五十个字符以确保性能测试的准确性',
            style: '解说',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
      };

      const startTime = Date.now();

      await characterNode(stateWithScript);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);

      console.log(`角色生成耗时: ${duration}ms`);
    }, 10000);

    it('分镜生成应该在 5 秒内完成', async () => {
      const stateWithCharacters: GraphStateType = {
        ...initialState,
        selectedScriptId: 'script-1',
        characters: [
          {
            id: 'char-1',
            name: '主角',
            description: '测试角色',
            createdAt: Date.now(),
          },
        ],
      };

      const startTime = Date.now();

      await storyboardNode(stateWithCharacters);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);

      console.log(`分镜生成耗时: ${duration}ms`);
    }, 10000);
  });
});
