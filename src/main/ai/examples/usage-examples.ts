/**
 * 统一 AI 模型管理系统 - 使用示例
 */

import { AdapterRegistry } from '../registry/AdapterRegistry';
import type { UnifiedMessage, InvokeOptions } from '../types';

/**
 * 示例 1: 基本文本生成
 */
export async function example1_BasicTextGeneration() {
  console.log('=== 示例 1: 基本文本生成 ===');

  // 获取注册表实例
  const registry = AdapterRegistry.getInstance();

  // 获取模型（使用默认供应商的默认文本模型）
  const model = registry.getDefaultModel('text');

  if (!model) {
    throw new Error('没有可用的文本模型');
  }

  // 构建消息
  const messages: UnifiedMessage[] = [
    {
      role: 'system',
      content: '你是一位专业的短视频剧本编剧。',
    },
    {
      role: 'user',
      content: '请生成一个关于 AI 改变生活的短视频剧本',
    },
  ];

  // 调用模型
  const response = await model.invoke(messages, {
    temperature: 0.8,
    maxTokens: 2000,
  });

  console.log('生成结果:', response.content);
  console.log('Token 使用量:', response.usage);
  console.log('模型信息:', model.getModelInfo());
}

/**
 * 示例 2: 流式文本生成
 */
export async function example2_StreamTextGeneration() {
  console.log('=== 示例 2: 流式文本生成 ===');

  const registry = AdapterRegistry.getInstance();
  const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');

  const messages: UnifiedMessage[] = [
    {
      role: 'user',
      content: '请讲一个有趣的故事',
    },
  ];

  // 流式调用
  console.log('开始流式生成:');
  for await (const chunk of model.stream(messages)) {
    if (chunk.delta) {
      process.stdout.write(chunk.delta);
    }
    if (chunk.done) {
      console.log('\n[完成]');
    }
  }
}

/**
 * 示例 3: 图片生成
 */
export async function example3_ImageGeneration() {
  console.log('=== 示例 3: 图片生成 ===');

  const registry = AdapterRegistry.getInstance();
  const model = registry.getModel('volcengine', 'image', 'doubao-seedream-3-0-t2i-250428');

  const messages: UnifiedMessage[] = [
    {
      role: 'user',
      content: '一只可爱的小猫坐在窗台上，阳光照进来，温暖舒适的氛围',
    },
  ];

  const response = await model.invoke(messages, {
    imageSize: '1024x1024',
    imageStyle: 'vivid',
    imageQuality: 'standard',
  });

  // 处理图片响应
  if (Array.isArray(response.content)) {
    const images = response.content.filter((c) => c.type === 'image');
    console.log(`生成了 ${images.length} 张图片:`);
    images.forEach((img, index) => {
      console.log(`  图片 ${index + 1}: ${img.url}`);
      if (img.revisedPrompt) {
        console.log(`  优化后的提示词: ${img.revisedPrompt}`);
      }
    });
  }
}

/**
 * 示例 4: 列出所有可用模型
 */
export function example4_ListModels() {
  console.log('=== 示例 4: 列出所有可用模型 ===');

  const registry = AdapterRegistry.getInstance();

  // 列出所有模型
  const allModels = registry.listModels();
  console.log(`\n所有模型 (共 ${allModels.length} 个):`);
  allModels.forEach((model) => {
    console.log(`  - ${model.provider}/${model.type}/${model.id}: ${model.name}`);
  });

  // 列出火山引擎的文本模型
  const textModels = registry.listModels('volcengine', 'text');
  console.log(`\n火山引擎文本模型 (共 ${textModels.length} 个):`);
  textModels.forEach((model) => {
    console.log(`  - ${model.id}: ${model.name}`);
    console.log(`    上下文窗口: ${model.contextWindow} tokens`);
    console.log(`    能力: ${model.features.join(', ')}`);
  });
}

/**
 * 示例 5: 健康检查
 */
export async function example5_HealthCheck() {
  console.log('=== 示例 5: 健康检查 ===');

  const registry = AdapterRegistry.getInstance();
  const model = registry.getDefaultModel('text');

  if (!model) {
    console.log('没有可用的文本模型');
    return;
  }

  console.log('正在检查模型健康状态...');
  const isHealthy = await model.healthCheck();
  console.log(`健康检查结果: ${isHealthy ? '✅ 正常' : '❌ 异常'}`);
}

/**
 * 示例 6: Aside 项目剧本生成集成
 */
export async function example6_AsideIntegration() {
  console.log('=== 示例 6: Aside 项目剧本生成集成 ===');

  const registry = AdapterRegistry.getInstance();

  // 获取模型（可以通过用户选择或配置）
  const model = registry.getModel('volcengine', 'text', 'doubao-1-5-pro-32k-250115');

  // 构建系统提示词
  const systemPrompt = `你是一位专业的短视频剧本编剧。
你的任务是根据创意方向生成多个创意十足的短视频剧本。

要求：
1. 每个剧本包含标题、场景描述、台词、动作指导
2. 时长控制在 15-60 秒
3. 内容要有吸引力，适合短视频平台
4. 语言生动有趣，符合目标受众`;

  // 构建用户提示词
  const userPrompt = `创意方向：科技感短视频，主题是 AI 如何改变日常生活

请生成 3 个不同风格的短视频剧本。`;

  // 构建消息
  const messages: UnifiedMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // 调用选项
  const options: InvokeOptions = {
    temperature: 0.8,
    maxTokens: 3000,
  };

  try {
    console.log('开始生成剧本...');

    // 调用模型
    const response = await model.invoke(messages, options);

    console.log('\n生成成功！');
    console.log('剧本内容:\n');
    console.log(response.content);

    if (response.usage) {
      console.log('\n资源使用:');
      console.log(`  输入 tokens: ${response.usage.inputTokens}`);
      console.log(`  输出 tokens: ${response.usage.outputTokens}`);
      console.log(`  总 tokens: ${response.usage.totalTokens}`);
    }

    // 解析剧本（示例）
    const screenplays = parseScreenplays(response.content as string);
    console.log(`\n解析出 ${screenplays.length} 个剧本`);

    return {
      success: true,
      screenplays,
      usage: response.usage,
    };
  } catch (error) {
    console.error('生成失败:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * 解析剧本（简化示例）
 */
function parseScreenplays(content: string): any[] {
  // TODO: 实现实际的剧本解析逻辑
  // 这里只是简化示例
  return [
    {
      id: 'script-1',
      content: content.substring(0, 500),
    },
  ];
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  try {
    await example1_BasicTextGeneration();
    console.log('\n' + '='.repeat(50) + '\n');

    await example2_StreamTextGeneration();
    console.log('\n' + '='.repeat(50) + '\n');

    await example3_ImageGeneration();
    console.log('\n' + '='.repeat(50) + '\n');

    example4_ListModels();
    console.log('\n' + '='.repeat(50) + '\n');

    await example5_HealthCheck();
    console.log('\n' + '='.repeat(50) + '\n');

    await example6_AsideIntegration();
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}
