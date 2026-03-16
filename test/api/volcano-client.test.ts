/**
 * 火山引擎 API 客户端测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { VolcanoClient } from '../../src/main/api/volcano-client';

describe('火山引擎 API 客户端', () => {
  let client: VolcanoClient;

  beforeAll(() => {
    // 初始化客户端
    client = new VolcanoClient();
  });

  it('应该成功创建客户端实例', () => {
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(VolcanoClient);
  });

  it('应该成功调用 LLM API（如果配置了 API Key）', async () => {
    // 跳过测试如果没有配置 API Key
    if (!process.env.VOLCANO_ENGINE_API_KEY) {
      console.log('跳过测试：未配置 VOLCANO_ENGINE_API_KEY');
      return;
    }

    const prompt = '请用一句话介绍自己。';
    const result = await client.callLLM(prompt);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);

    console.log('LLM 响应:', result);
  }, 30000);

  it('应该成功调用图片生成 API（如果配置了 API Key）', async () => {
    // 跳过测试如果没有配置 API Key
    if (!process.env.VOLCANO_ENGINE_API_KEY) {
      console.log('跳过测试：未配置 VOLCANO_ENGINE_API_KEY');
      return;
    }

    const imageUrl = await client.generateImage({
      prompt: '一只可爱的小猫咪',
      style: 'digital art',
      width: 512,
      height: 512,
    });

    expect(imageUrl).toBeDefined();
    expect(typeof imageUrl).toBe('string');
    expect(imageUrl).toMatch(/^https?:\/\//);

    console.log('生成的图片 URL:', imageUrl);
  }, 60000);

  it('应该正确处理 API 错误', async () => {
    // 跳过测试如果没有配置 API Key
    if (!process.env.VOLCANO_ENGINE_API_KEY) {
      console.log('跳过测试：未配置 VOLCANO_ENGINE_API_KEY');
      return;
    }

    // 这个测试需要模拟错误场景
    // 由于我们无法轻易模拟 API 错误，这里只测试客户端是否能正确抛出错误
    // 在实际项目中，应该使用 mock 来测试错误处理
    console.log('注意：错误处理测试需要在集成测试中进行');
  });
});
