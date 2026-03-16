import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E 测试配置
 * 用于测试 Electron 应用的端到端功能
 */
export default defineConfig({
  // 测试目录
  testDir: './test/e2e',

  // 测试超时时间（30秒）
  timeout: 30000,

  // 每个测试的超时时间
  expect: {
    timeout: 10000,
  },

  // 完全并行运行测试
  fullyParallel: false,

  // CI 环境下失败时不重试
  retries: process.env.CI ? 2 : 0,

  // 并发工作者数量
  workers: process.env.CI ? 1 : 1,

  // 报告器配置
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // 全局配置
  use: {
    // 截图配置
    screenshot: 'only-on-failure',

    // 视频录制
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 },
    },

    // 追踪配置
    trace: 'retain-on-failure',

    // 基础超时时间
    actionTimeout: 10000,
  },

  // 项目配置
  projects: [
    {
      name: 'electron',
      use: {
        // Electron 特定配置会在测试文件中设置
      },
    },
  ],

  // 输出目录
  outputDir: 'test-results/artifacts',
});
