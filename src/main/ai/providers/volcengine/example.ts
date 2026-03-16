/**
 * 火山引擎提供商 - 使用示例
 *
 * 展示如何使用 VolcEngineProvider 的各项功能
 */

import { createVolcEngineProvider } from './index';
import type { ProviderConfig } from '../interface';

/**
 * 示例配置（请替换为真实的 API Key）
 */
const config: ProviderConfig = {
  type: 'volcengine',
  apiKey: process.env.VOLCENGINE_API_KEY || 'your-api-key-here',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  features: {
    textGeneration: true,
    imageGeneration: true,
    speechSynthesis: false,
    videoGeneration: false,
  },
};

/**
 * 主函数
 */
async function main() {
  console.log('======================================');
  console.log('火山引擎提供商使用示例');
  console.log('======================================\n');

  // 创建提供商实例
  const provider = createVolcEngineProvider(config);
  console.log(`提供商名称: ${provider.name}\n`);

  try {
    // ==================== 文本生成示例 ====================
    console.log('1. 文本生成示例');
    console.log('---');

    const textResult = await provider.generateText(
      '请用简短的话介绍什么是人工智能',
      {
        temperature: 0.7,
        maxTokens: 200,
      }
    );

    console.log('生成内容:', textResult.content);
    console.log('Token 使用:', textResult.usage);
    console.log();

    // ==================== 流式生成示例 ====================
    console.log('2. 流式生成示例');
    console.log('---');
    console.log('实时输出:');

    const stream = provider.generateTextStream!(
      '讲一个非常短的笑话',
      { maxTokens: 100 }
    );

    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }

    console.log('\n');

    // ==================== 图片生成示例 ====================
    console.log('3. 图片生成示例');
    console.log('---');

    const imageResult = await provider.generateImage(
      '一只可爱的小猫在阳光下打盹，写实风格',
      {
        size: '1024x1024',
        quality: 'standard',
        numberOfImages: 1,
      }
    );

    console.log('生成图片数量:', imageResult.images.length);
    console.log('图片 URL:', imageResult.images[0].url);
    if (imageResult.images[0].revisedPrompt) {
      console.log('优化后的提示词:', imageResult.images[0].revisedPrompt);
    }
    console.log();

    // ==================== 健康检查示例 ====================
    console.log('4. 健康检查示例');
    console.log('---');

    const isHealthy = await provider.healthCheck();
    console.log('服务状态:', isHealthy ? '正常 ✓' : '异常 ✗');
    console.log();

    // ==================== 错误处理示例 ====================
    console.log('5. 错误处理示例');
    console.log('---');

    try {
      // 尝试使用未启用的功能
      await provider.synthesizeSpeech?.('测试');
    } catch (error) {
      if (error instanceof Error) {
        console.log('捕获错误:', error.message);
      }
    }
    console.log();

  } catch (error) {
    console.error('执行出错:', error);
  }

  console.log('======================================');
  console.log('示例执行完成');
  console.log('======================================');
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

export { main as runVolcEngineExample };
