import { test, expect, ElectronApp, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

/**
 * Electron 应用启动测试
 * 测试应用能否正常启动并显示主窗口
 */

let electronApp: ElectronApp;
let page: Page;

test.describe('Electron 应用启动测试', () => {
  // 在所有测试前启动 Electron 应用
  test.beforeAll(async () => {
    // 获取应用主进程入口文件路径
    const appPath = path.join(process.cwd(), 'out/main/index.js');

    // 启动 Electron 应用
    electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // 等待应用启动
    await electronApp.waitForEvent('window');

    // 获取第一个窗口
    page = await electronApp.firstWindow();

    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded');
  });

  // 在所有测试后关闭应用
  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('应用启动成功', async () => {
    // 验证应用已启动
    expect(electronApp).toBeDefined();
    expect(page).toBeDefined();
  });

  test('窗口标题正确', async () => {
    // 获取窗口标题
    const title = await page.title();

    // 验证标题包含预期文本
    expect(title).toContain('VideoStitcher');
  });

  test('主窗口可见', async () => {
    // 检查窗口是否可见
    const isVisible = await page.isVisible('body');
    expect(isVisible).toBe(true);
  });

  test('窗口尺寸正确', async () => {
    // 获取窗口尺寸
    const size = await page.viewportSize();

    // 验证窗口尺寸合理
    expect(size).toBeDefined();
    expect(size!.width).toBeGreaterThan(0);
    expect(size!.height).toBeGreaterThan(0);
  });

  test('无控制台错误', async () => {
    // 收集控制台错误
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // 等待一段时间收集错误
    await page.waitForTimeout(2000);

    // 验证无严重错误（忽略开发环境警告）
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('Warning:') &&
        !error.includes('DevTools') &&
        !error.includes('Electron Security')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('导航栏显示正常', async () => {
    // 等待导航栏加载
    await page.waitForSelector('nav', { timeout: 10000 });

    // 验证导航栏可见
    const nav = await page.$('nav');
    expect(nav).toBeDefined();
  });

  test('主内容区域显示正常', async () => {
    // 等待主内容区域加载
    await page.waitForSelector('main', { timeout: 10000 });

    // 验证主内容区域可见
    const main = await page.$('main');
    expect(main).toBeDefined();
  });
});
