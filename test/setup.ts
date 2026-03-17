/**
 * Vitest 测试环境设置
 * 配置全局测试环境和工具
 */
import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});

// 全局测试设置
beforeAll(() => {
  // 添加全局设置逻辑
});

// 全局测试清理
afterAll(() => {
  // 添加清理逻辑
});
