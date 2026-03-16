/**
 * AI 响应时间性能测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scriptNode } from '../../../src/main/langgraph/nodes/scriptNode';
import { characterNode } from '../../../src/main/langgraph/nodes/characterNode';
import { storyboardNode } from '../../../src/main/langgraph/nodes/storyboardNode';
import { videoNode } from '../../../src/main/langgraph/nodes/videoNode';
import { GraphStateType } from '../../../src/main/langgraph/state';

// 设置性能测试超时时间
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
  v4: vi.fn(() => `uuid-${Date.now()}`),
}));

describe('AI 响应时间性能测试', () => {
  let baseState: GraphStateType;

  beforeEach(() => {
    vi.clearAllMocks();

    baseState = {
      userRequirement: '产品宣传视频',
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

  describe('脚本生成性能', () => {
    it('脚本生成应该在 5 秒内完成', async () => {
      const startTime = Date.now();

      const result = await scriptNode(baseState);

      const duration = Date.now() - startTime;

      expect(result.error).toBeNull();
      expect(duration).toBeLessThan(5000);

      console.log(`✓ 脚本生成耗时: ${duration}ms`);
    }, 10000);

    it('批量生成 5 个脚本应该在 5 秒内完成', async () => {
      const state = { ...baseState, batchSize: 5 };

      const startTime = Date.now();

      const result = await scriptNode(state);

      const duration = Date.now() - startTime;

      expect(result.error).toBeNull();
      expect(duration).toBeLessThan(5000);
      expect(result.scripts?.length).toBe(5);

      console.log(`✓ 批量生成 5 个脚本耗时: ${duration}ms`);
    }, 10000);

    it('批量生成 10 个脚本应该在 5 秒内完成', async () => {
      const state = { ...baseState, batchSize: 10 };

      const startTime = Date.now();

      const result = await scriptNode(state);

      const duration = Date.now() - startTime;

      expect(result.error).toBeNull();
      expect(duration).toBeLessThan(5000);
      expect(result.scripts?.length).toBe(10);

      console.log(`✓ 批量生成 10 个脚本耗时: ${duration}ms`);
    }, 10000);
  });

  describe('角色生成性能', () => {
    it('角色生成应该在 3 秒内完成', async () => {
      const state: GraphStateType = {
        ...baseState,
        scripts: [
          {
            id: 'script-1',
            text: '这是一个产品宣传脚本，用于测试角色生成性能，内容需要足够长以便进行性能测试',
            style: '解说',
            createdAt: Date.now(),
            selected: true,
          },
        ],
        selectedScriptId: 'script-1',
      };

      const startTime = Date.now();

      const result = await characterNode(state);

      const duration = Date.now() - startTime;

      expect(result.error).toBeNull();
      expect(duration).toBeLessThan(3000);

      console.log(`✓ 角色生成耗时: ${duration}ms`);
    }, 10000);
  });

  describe('分镜生成性能', () => {
    it('分镜生成应该在 5 秒内完成', async () => {
      const state: GraphStateType = {
        ...baseState,
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

      const result = await storyboardNode(state);

      const duration = Date.now() - startTime;

      expect(result.error).toBeNull();
      expect(duration).toBeLessThan(5000);

      console.log(`✓ 分镜生成耗时: ${duration}ms`);
    }, 10000);
  });

  describe('视频生成性能', () => {
    it('视频生成应该在 10 秒内完成', async () => {
      const state: GraphStateType = {
        ...baseState,
        videoConfig: {
          length: 60,
          ratio: '16:9',
          resolution: '1080p',
        },
        storyboard: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            description: '场景 1',
            duration: 3,
            createdAt: Date.now(),
          },
          {
            id: 'scene-2',
            sceneNumber: 2,
            description: '场景 2',
            duration: 3,
            createdAt: Date.now(),
          },
        ],
      };

      const startTime = Date.now();

      const result = await videoNode(state);

      const duration = Date.now() - startTime;

      expect(result.error).toBeNull();
      expect(duration).toBeLessThan(10000);

      console.log(`✓ 视频生成耗时: ${duration}ms`);
    }, 15000);
  });

  describe('完整工作流性能', () => {
    it('完整工作流（脚本到视频）应该在 20 秒内完成', async () => {
      const startTime = Date.now();

      // 步骤 1: 脚本生成
      let currentState = { ...baseState, batchSize: 3 };
      const scriptResult = await scriptNode(currentState);
      expect(scriptResult.error).toBeNull();

      currentState = {
        ...currentState,
        scripts: scriptResult.scripts!,
        selectedScriptId: scriptResult.scripts![0].id,
      } as GraphStateType;

      // 步骤 2: 角色生成
      const characterResult = await characterNode(currentState);
      expect(characterResult.error).toBeNull();

      currentState = {
        ...currentState,
        characters: characterResult.characters!,
      } as GraphStateType;

      // 步骤 3: 分镜生成
      const storyboardResult = await storyboardNode(currentState);
      expect(storyboardResult.error).toBeNull();

      currentState = {
        ...currentState,
        storyboard: storyboardResult.storyboard!,
        videoConfig: {
          length: 60,
          ratio: '16:9',
          resolution: '1080p',
        },
      } as GraphStateType;

      // 步骤 4: 视频生成
      const videoResult = await videoNode(currentState);
      expect(videoResult.error).toBeNull();

      const totalDuration = Date.now() - startTime;

      expect(totalDuration).toBeLessThan(20000);

      console.log(`✓ 完整工作流耗时: ${totalDuration}ms`);
      console.log(`  - 平均每步: ${Math.round(totalDuration / 4)}ms`);
    }, 30000);

    it('应该测量每个步骤的性能指标', async () => {
      const metrics: { step: string; duration: number }[] = [];

      // 测量脚本生成
      let start = Date.now();
      const scriptResult = await scriptNode({ ...baseState, batchSize: 3 });
      metrics.push({ step: '脚本生成', duration: Date.now() - start });

      // 准备下一步状态
      const stateWithScript: GraphStateType = {
        ...baseState,
        scripts: scriptResult.scripts!,
        selectedScriptId: scriptResult.scripts![0].id,
      };

      // 测量角色生成
      start = Date.now();
      const characterResult = await characterNode(stateWithScript);
      metrics.push({ step: '角色生成', duration: Date.now() - start });

      // 准备下一步状态
      const stateWithCharacter: GraphStateType = {
        ...stateWithScript,
        characters: characterResult.characters!,
      };

      // 测量分镜生成
      start = Date.now();
      const storyboardResult = await storyboardNode(stateWithCharacter);
      metrics.push({ step: '分镜生成', duration: Date.now() - start });

      // 准备下一步状态
      const stateWithStoryboard: GraphStateType = {
        ...stateWithCharacter,
        storyboard: storyboardResult.storyboard!,
        videoConfig: {
          length: 60,
          ratio: '16:9',
          resolution: '1080p',
        },
      };

      // 测量视频生成
      start = Date.now();
      await videoNode(stateWithStoryboard);
      metrics.push({ step: '视频生成', duration: Date.now() - start });

      // 输出性能报告
      console.log('\n性能报告:');
      console.log('='.repeat(50));

      let totalDuration = 0;
      for (const metric of metrics) {
        console.log(`${metric.step.padEnd(15)} ${metric.duration.toString().padStart(5)}ms`);
        totalDuration += metric.duration;
      }

      console.log('-'.repeat(50));
      console.log(`总耗时: ${totalDuration}ms`);
      console.log('='.repeat(50));

      // 验证所有步骤都成功
      expect(scriptResult.error).toBeNull();
      expect(characterResult.error).toBeNull();
      expect(storyboardResult.error).toBeNull();
    }, 30000);
  });

  describe('并发性能测试', () => {
    it('应该能够并发处理多个脚本生成请求', async () => {
      const concurrentRequests = 5;
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          scriptNode({
            ...baseState,
            batchSize: 3,
          })
        );
      }

      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;

      // 验证所有请求都成功
      results.forEach((result) => {
        expect(result.error).toBeNull();
        expect(result.scripts?.length).toBe(3);
      });

      // 并发执行时间应该小于串行执行时间的 2 倍
      console.log(`✓ 并发 ${concurrentRequests} 个脚本生成耗时: ${duration}ms`);

      // 单次请求的平均时间
      const avgSingleTime = duration / concurrentRequests;
      console.log(`  平均每个请求: ${avgSingleTime.toFixed(0)}ms`);
    }, 20000);
  });

  describe('内存使用测试', () => {
    it('应该监控内存使用情况', async () => {
      const memoryBefore = process.memoryUsage();

      // 执行完整工作流
      const scriptResult = await scriptNode({ ...baseState, batchSize: 3 });

      const memoryAfter = process.memoryUsage();

      const memoryDiff = {
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        external: memoryAfter.external - memoryBefore.external,
      };

      console.log('\n内存使用报告:');
      console.log('='.repeat(50));
      console.log(`Heap Used: ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Heap Total: ${(memoryDiff.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`External: ${(memoryDiff.external / 1024 / 1024).toFixed(2)} MB`);
      console.log('='.repeat(50));

      // 验证脚本生成成功
      expect(scriptResult.error).toBeNull();
    });
  });
});
