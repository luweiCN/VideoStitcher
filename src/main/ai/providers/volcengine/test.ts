/**
 * 火山引擎提供商测试脚本
 *
 * 验证 VolcEngineProvider 的功能完整性
 */

import { VolcEngineProvider, createVolcEngineProvider } from './index';
import type { ProviderConfig } from '../interface';

/**
 * 测试配置
 */
const testConfig: ProviderConfig = {
  type: 'volcengine',
  apiKey: 'test-api-key-for-validation',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  features: {
    textGeneration: true,
    imageGeneration: true,
    speechSynthesis: false,
    videoGeneration: false,
  },
};

console.log('========================================');
console.log('火山引擎提供商功能测试');
console.log('========================================\n');

// 测试 1: 创建实例
console.log('测试 1: 创建 VolcEngineProvider 实例');
try {
  const provider = new VolcEngineProvider(testConfig);
  console.log('✓ 实例创建成功');
  console.log(`  提供商名称: ${provider.name}\n`);
} catch (error) {
  console.log('✗ 实例创建失败:', error);
  process.exit(1);
}

// 测试 2: 使用工厂函数
console.log('测试 2: 使用工厂函数创建实例');
try {
  const provider = createVolcEngineProvider(testConfig);
  console.log('✓ 工厂函数创建成功');
  console.log(`  提供商名称: ${provider.name}\n`);
} catch (error) {
  console.log('✗ 工厂函数创建失败:', error);
  process.exit(1);
}

// 测试 3: 配置验证 - 空 API Key
console.log('测试 3: 配置验证 - 空 API Key');
try {
  const invalidConfig = { ...testConfig, apiKey: '' };
  new VolcEngineProvider(invalidConfig);
  console.log('✗ 应该抛出错误但没有\n');
  process.exit(1);
} catch (error) {
  if (error instanceof Error && error.message.includes('API 密钥不能为空')) {
    console.log('✓ 正确抛出错误:', error.message);
    console.log();
  } else {
    console.log('✗ 错误消息不正确:', error);
    process.exit(1);
  }
}

// 测试 4: 配置验证 - 没有启用任何功能
console.log('测试 4: 配置验证 - 没有启用任何功能');
try {
  const invalidConfig: ProviderConfig = {
    type: 'volcengine',
    apiKey: 'test-key',
    features: {
      textGeneration: false,
      imageGeneration: false,
      speechSynthesis: false,
      videoGeneration: false,
    },
  };
  new VolcEngineProvider(invalidConfig);
  console.log('✗ 应该抛出错误但没有\n');
  process.exit(1);
} catch (error) {
  if (error instanceof Error && error.message.includes('至少需要启用一个')) {
    console.log('✓ 正确抛出错误:', error.message);
    console.log();
  } else {
    console.log('✗ 错误消息不正确:', error);
    process.exit(1);
  }
}

// 测试 5: 功能未启用检查 - 语音合成
console.log('测试 5: 功能未启用检查 - 语音合成');
(async () => {
  try {
    const provider = new VolcEngineProvider(testConfig);
    await provider.synthesizeSpeech?.('测试文本');
    console.log('✗ 应该抛出错误但没有\n');
    process.exit(1);
  } catch (error) {
    if (error instanceof Error && error.message.includes('语音合成功能未启用')) {
      console.log('✓ 正确抛出错误:', error.message);
      console.log();
    } else {
      console.log('✗ 错误消息不正确:', error);
      process.exit(1);
    }
  }
})();

// 测试 6: 功能未启用检查 - 视频生成
console.log('测试 6: 功能未启用检查 - 视频生成');
(async () => {
  try {
    const provider = new VolcEngineProvider(testConfig);
    await provider.generateVideo?.('测试提示词');
    console.log('✗ 应该抛出错误但没有\n');
    process.exit(1);
  } catch (error) {
    if (error instanceof Error && error.message.includes('视频生成功能未启用')) {
      console.log('✓ 正确抛出错误:', error.message);
      console.log();
    } else {
      console.log('✗ 错误消息不正确:', error);
      process.exit(1);
    }
  }
})();

// 测试 7: 接口完整性检查
console.log('测试 7: 接口完整性检查');
try {
  const provider = new VolcEngineProvider(testConfig);

  // 检查必需方法
  const requiredMethods = ['generateText', 'generateImage', 'healthCheck'];
  for (const method of requiredMethods) {
    if (typeof (provider as any)[method] !== 'function') {
      console.log(`✗ 缺少方法: ${method}`);
      process.exit(1);
    }
  }

  // 检查可选方法
  const optionalMethods = ['generateTextStream', 'synthesizeSpeech', 'generateVideo'];
  for (const method of optionalMethods) {
    if (typeof (provider as any)[method] !== 'function') {
      console.log(`⚠ 可选方法未实现: ${method}`);
    } else {
      console.log(`✓ 可选方法已实现: ${method}`);
    }
  }

  console.log('✓ 接口完整性检查通过\n');
} catch (error) {
  console.log('✗ 接口检查失败:', error);
  process.exit(1);
}

// 测试总结
console.log('========================================');
console.log('所有基础测试通过！ ✓');
console.log('========================================\n');
console.log('注意事项:');
console.log('1. 文本生成和图片生成需要实际 API Key 才能调用');
console.log('2. 语音合成和视频生成功能已占位（未实现）');
console.log('3. 健康检查需要实际 API 才能执行');
console.log();
