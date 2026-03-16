import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vitest 单元测试配置
 * 用于测试 React 组件和工具函数
 */
export default defineConfig({
  plugins: [react()],

  test: {
    // 全局变量
    globals: true,

    // 环境
    environment: 'jsdom',

    // 测试目录
    include: ['test/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // 排除目录
    exclude: ['node_modules', 'dist', 'out', 'test/e2e'],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/out/**',
      ],
    },

    // 设置文件
    setupFiles: ['./test/setup.ts'],
  },

  // 路径解析
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
