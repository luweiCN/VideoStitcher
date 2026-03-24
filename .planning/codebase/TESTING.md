# 测试规范

**分析日期:** 2026-03-24

## 测试框架

**单元测试:**
- **框架:** Vitest v4.1.0
- **配置:** `vitest.config.ts`
- **环境:** jsdom (用于 React 组件测试)
- **断言库:** Vitest 内置 + @testing-library/jest-dom

**E2E 测试:**
- **框架:** Playwright v1.58.2
- **配置:** `playwright.config.ts`
- **目标:** Electron 桌面应用

**测试工具库:**
- `@testing-library/react` v16.3.2 - React 组件测试
- `@testing-library/user-event` v14.6.1 - 用户交互模拟
- `@testing-library/dom` v10.4.1 - DOM 查询
- `@vitest/coverage-v8` v4.1.0 - 覆盖率报告
- `@vitest/ui` v4.1.0 - UI 测试界面

## 测试命令

```bash
# 运行所有单元测试
npm run test

# 运行单元测试并显示 UI
npm run test:ui

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e

# 运行 E2E 测试并显示 UI
npm run test:e2e:ui

# 运行所有测试
npm run test:all
```

## 测试文件组织

**目录结构:**

```
test/
├── setup.ts                    # 测试环境设置
├── unit/                       # 单元测试
│   ├── utils.test.ts          # 工具函数测试
│   ├── components.test.tsx    # React 组件测试
│   ├── stores/                # Store 测试
│   │   └── asideStore.test.ts
│   ├── ipc/                   # IPC 处理器测试
│   │   └── aside-handlers.test.ts
│   ├── langgraph/             # LangGraph 节点测试
│   │   └── nodes/
│   │       ├── characterNode.test.ts
│   │       ├── scriptNode.test.ts
│   │       ├── storyboardNode.test.ts
│   │       └── videoNode.test.ts
│   └── rag/                   # RAG 模块测试
│       └── KnowledgeBase.test.ts
├── e2e/                        # E2E 测试
│   ├── electron-launch.test.ts
│   └── script-generation.test.ts
├── api/                        # API 测试
│   └── volcano-client.test.ts
└── performance/                # 性能测试
    └── ai-response-time.test.ts
```

**测试文件命名:**
- 单元测试: `*.test.ts` 或 `*.test.tsx`
- E2E 测试: `*.test.ts`
- 与源文件同名，放在 test 目录下

## Vitest 配置

```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],

  test: {
    globals: true,           // 启用全局变量
    environment: 'jsdom',    // 浏览器环境
    include: ['test/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'out', 'test/e2e'],

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

    setupFiles: ['./test/setup.ts'],  // 测试前加载
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@main': resolve(__dirname, './src/main'),
      '@renderer': resolve(__dirname, './src/renderer'),
      '@shared': resolve(__dirname, './src/shared'),
      '@preload': resolve(__dirname, './src/preload'),
    },
  },
});
```

## 测试环境设置

```typescript
// test/setup.ts
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
```

## 单元测试模式

### 工具函数测试

```typescript
// test/unit/utils.test.ts
import { describe, it, expect } from 'vitest';

describe('基础工具函数测试', () => {
  it('应该正确验证数字', () => {
    const isValidNumber = (value: unknown): value is number => {
      return typeof value === 'number' && !isNaN(value);
    };

    expect(isValidNumber(123)).toBe(true);
    expect(isValidNumber(NaN)).toBe(false);
    expect(isValidNumber('123')).toBe(false);
  });

  it('应该正确格式化持续时间', () => {
    const formatDuration = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(90)).toBe('1:30');
  });
});
```

### React 组件测试

```typescript
// test/unit/components.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('React 组件测试', () => {
  it('应该渲染按钮文本', () => {
    render(<SimpleButton text="点击我" />);
    expect(screen.getByText('点击我')).toBeDefined();
  });

  it('应该在点击时调用回调函数', () => {
    const handleClick = vi.fn();
    render(<SimpleButton text="点击我" onClick={handleClick} />);

    const button = screen.getByText('点击我');
    button.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('禁用状态下不应该响应点击', () => {
    const handleClick = vi.fn();
    render(
      <SimpleButton text="点击我" onClick={handleClick} disabled={true} />
    );

    const button = screen.getByText('点击我');
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
```

### Store 测试

```typescript
// test/unit/stores/asideStore.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useASideStore } from '../../../src/renderer/stores/asideStore';

describe('A面视频生产 Store (asideStore)', () => {
  beforeEach(() => {
    // 重置 store
    useASideStore.setState({
      currentStep: 'style',
      selectedStyle: null,
      // ...
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该有正确的初始状态', () => {
    const state = useASideStore.getState();
    expect(state.currentStep).toBe('style');
    expect(state.selectedStyle).toBeNull();
  });

  it('应该能够设置当前步骤', () => {
    const { setCurrentStep } = useASideStore.getState();
    setCurrentStep('config');
    expect(useASideStore.getState().currentStep).toBe('config');
  });
});
```

## E2E 测试模式

### Electron 应用启动测试

```typescript
// test/e2e/electron-launch.test.ts
import { test, expect, ElectronApp, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

let electronApp: ElectronApp;
let page: Page;

test.describe('Electron 应用启动测试', () => {
  test.beforeAll(async () => {
    const appPath = path.join(process.cwd(), 'out/main/index.js');
    electronApp = await electron.launch({
      args: [appPath],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('应用启动成功', async () => {
    expect(electronApp).toBeDefined();
    expect(page).toBeDefined();
  });

  test('窗口标题正确', async () => {
    const title = await page.title();
    expect(title).toContain('VideoStitcher');
  });

  test('无控制台错误', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('Warning:') &&
        !error.includes('DevTools') &&
        !error.includes('Electron Security')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
```

## Playwright 配置

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,

  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    screenshot: 'only-on-failure',
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 },
    },
    trace: 'retain-on-failure',
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'electron',
      use: {},
    },
  ],

  outputDir: 'test-results/artifacts',
});
```

## Mocking 模式

### 函数 Mock

```typescript
import { vi } from 'vitest';

// Mock 函数
const mockFn = vi.fn();
mockFn.mockReturnValue('mocked value');

// Mock 模块
vi.mock('@shared/ffmpeg', () => ({
  runFfmpeg: vi.fn().mockResolvedValue({ success: true }),
  getFfmpegPath: vi.fn().mockReturnValue('/path/to/ffmpeg'),
}));

// 恢复原始实现
afterEach(() => {
  vi.restoreAllMocks();
});
```

### Store Mock

```typescript
// Mock Zustand store
const mockStore = {
  currentView: 'library',
  setCurrentView: vi.fn(),
};

vi.mock('@/stores/asideStore', () => ({
  useASideStore: () => mockStore,
}));
```

## 覆盖率配置

**覆盖率报告:**
- 文本报告 (控制台)
- JSON 报告 (`coverage/coverage-final.json`)
- HTML 报告 (`coverage/index.html`)

**排除项:**
- `node_modules/`
- `test/`
- `**/*.d.ts`
- `**/*.config.*`
- `**/dist/**`
- `**/out/**`

**查看覆盖率:**

```bash
npm run test:coverage
# 打开 coverage/index.html 查看详细报告
```

## 测试最佳实践

### 测试结构

```typescript
describe('功能模块', () => {
  // 测试前置条件
  beforeAll(() => {});
  beforeEach(() => {});

  describe('子功能 A', () => {
    it('应该正确执行操作 X', () => {});
    it('应该处理错误情况 Y', () => {});
  });

  describe('子功能 B', () => {
    it('应该正确执行操作 Z', () => {});
  });

  // 测试清理
  afterEach(() => {});
  afterAll(() => {});
});
```

### 命名规范

- 测试套件: `describe('功能模块', () => {})`
- 测试用例: `it('应该...', () => {})` 或 `it('能够...', () => {})`
- 使用中文描述，清晰表达测试意图

### 断言风格

```typescript
// 基本断言
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toBeDefined();
expect(value).toBeNull();
expect(value).toBeTruthy();

// 数组/对象断言
expect(array).toHaveLength(3);
expect(array).toContain(item);
expect(object).toHaveProperty('key');

// 异步断言
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();

// DOM 断言 (使用 jest-dom)
expect(element).toBeInTheDocument();
expect(element).toHaveClass('className');
expect(element).toBeDisabled();
```

## 测试类型覆盖

| 测试类型 | 目录 | 工具 | 用途 |
|----------|------|------|------|
| 单元测试 | `test/unit/` | Vitest | 函数、组件、Store |
| E2E 测试 | `test/e2e/` | Playwright | 应用启动、用户流程 |
| API 测试 | `test/api/` | Vitest | 外部 API 客户端 |
| 性能测试 | `test/performance/` | Vitest | 响应时间测试 |
| RAG 测试 | `test/unit/rag/` | Vitest | 知识库功能 |
| LangGraph 测试 | `test/unit/langgraph/` | Vitest | AI 工作流节点 |

---

*测试规范分析: 2026-03-24*
