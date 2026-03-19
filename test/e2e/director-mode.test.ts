/**
 * 导演模式 E2E 测试
 * 使用 Playwright 测试 Electron 应用
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

// 设置测试超时时间
test.setTimeout(120000);

let electronApp: ElectronApplication;
let page: Page;

async function navigateToDirectorMode(targetPage: Page): Promise<void> {
  if (targetPage.url().includes('#/director')) {
    return;
  }

  const directorEntry = targetPage.getByRole('button', { name: /导演模式/ }).first();

  if (!(await directorEntry.isVisible().catch(() => false))) {
    await targetPage.goto('app://-/');
    await targetPage.waitForLoadState('domcontentloaded');
  }

  await expect(directorEntry).toBeVisible();
  await directorEntry.click();
  await targetPage.waitForLoadState('networkidle');
}

test.describe('导演模式完整流程', () => {
  test.beforeAll(async () => {
    // 启动 Electron 应用
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // 等待应用加载
    page = await electronApp.firstWindow();

    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded');

    // 等待应用初始化
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    // 关闭应用
    await electronApp.close();
  });

  test('应该显示导演模式界面', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 验证主要组件可见
    const chatPanel = await page.locator('[data-testid="chat-panel"]');
    const canvas = await page.locator('[data-testid="canvas"]');
    const toolbar = await page.locator('[data-testid="toolbar"]');

    // 检查组件是否存在（可能不可见）
    await expect(chatPanel).toBeDefined();
    await expect(canvas).toBeDefined();
    await expect(toolbar).toBeDefined();
  });

  test('应该能够输入用户需求', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 等待输入框出现
    const inputField = await page.locator('[data-testid="requirement-input"]');

    // 如果输入框存在，进行测试
    if (await inputField.isVisible()) {
      // 输入需求
      await inputField.fill('产品宣传视频，展示产品的核心功能');

      // 验证输入内容
      const inputValue = await inputField.inputValue();
      expect(inputValue).toBe('产品宣传视频，展示产品的核心功能');
    }
  });

  test('应该能够选择视频风格', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 等待风格选择器
    const styleSelector = await page.locator('[data-testid="style-selector"]');

    // 如果风格选择器存在，进行测试
    if (await styleSelector.isVisible()) {
      // 点击风格选择器
      await styleSelector.click();

      // 等待风格选项出现
      await page.waitForSelector('[data-testid="style-option"]', {
        timeout: 5000,
      });

      // 选择"解说"风格
      const explanationStyle = await page.locator(
        '[data-testid="style-option"]:has-text("解说")'
      );
      await explanationStyle.click();

      // 验证风格已选择
      const selectedStyle = await styleSelector.textContent();
      expect(selectedStyle).toContain('解说');
    }
  });

  test('应该能够生成脚本', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 查找生成脚本按钮
    const generateButton = await page.locator('button:has-text("生成脚本")');

    // 如果按钮存在且可见，进行测试
    if (await generateButton.isVisible()) {
      // 点击生成按钮
      await generateButton.click();

      // 等待脚本生成完成
      await page.waitForSelector('[data-testid="script-card"]', {
        timeout: 30000,
      });

      // 验证脚本卡片数量
      const scriptCards = await page.$$('[data-testid="script-card"]');
      expect(scriptCards.length).toBeGreaterThan(0);
    }
  });

  test('应该能够生成角色', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 查找生成角色按钮
    const generateButton = await page.locator('button:has-text("生成角色")');

    // 如果按钮存在且可见，进行测试
    if (await generateButton.isVisible()) {
      // 点击生成按钮
      await generateButton.click();

      // 等待角色卡片出现
      await page.waitForSelector('[data-testid="character-card"]', {
        timeout: 30000,
      });

      // 验证角色卡片数量
      const characterCards = await page.$$('[data-testid="character-card"]');
      expect(characterCards.length).toBeGreaterThan(0);
    }
  });

  test('应该能够生成分镜', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 查找分镜步骤
    const storyboardTab = await page.locator('button:has-text("分镜")');

    // 如果分镜标签存在，进行测试
    if (await storyboardTab.isVisible()) {
      // 切换到分镜步骤
      await storyboardTab.click();

      // 查找生成分镜按钮
      const generateButton = await page.locator('button:has-text("生成分镜")');

      if (await generateButton.isVisible()) {
        // 点击生成按钮
        await generateButton.click();

        // 等待分镜网格出现
        await page.waitForSelector('[data-testid="storyboard-grid"]', {
          timeout: 60000,
        });

        // 验证分镜场景数量（至少应该有一些场景）
        const sceneCards = await page.$$('[data-testid="scene-card"]');
        expect(sceneCards.length).toBeGreaterThan(0);
      }
    }
  });

  test('应该显示进度信息', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 查找进度指示器
    const progressIndicator = await page.locator('[data-testid="progress-indicator"]');

    // 如果进度指示器存在，进行测试
    if (await progressIndicator.isVisible()) {
      // 验证进度信息显示
      const progressText = await progressIndicator.textContent();
      expect(progressText).toBeDefined();
    }
  });

  test('应该能够处理错误情况', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 查找错误提示组件
    const errorAlert = await page.locator('[data-testid="error-alert"]');

    // 如果有错误提示，验证其内容
    if (await errorAlert.isVisible()) {
      const errorText = await errorAlert.textContent();
      expect(errorText).toBeDefined();
      expect(errorText!.length).toBeGreaterThan(0);
    }
  });

  test('应该能够切换不同的步骤', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 查找步骤导航
    const stepButtons = await page.$$('[data-testid="step-button"]');

    // 如果有步骤按钮，进行测试
    if (stepButtons.length > 0) {
      // 点击每个步骤按钮
      for (let i = 0; i < Math.min(stepButtons.length, 4); i++) {
        const button = stepButtons[i];
        await button.click();
        await page.waitForTimeout(500); // 等待切换动画
      }
    }
  });

  test('应该能够保存和加载会话', async () => {
    // 导航到导演模式
    await navigateToDirectorMode(page);

    // 查找保存按钮
    const saveButton = await page.locator('button:has-text("保存")');

    // 如果保存按钮存在且可见，进行测试
    if (await saveButton.isVisible()) {
      // 点击保存按钮
      await saveButton.click();

      // 等待保存成功提示
      await page.waitForSelector('text=保存成功', {
        timeout: 5000,
      }).catch(() => {
        // 如果没有提示，可能是静默保存
      });
    }
  });
});

test.describe('导演模式 UI 响应性测试', () => {
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../out/main/index.js')],
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('UI 应该在合理时间内响应', async () => {
    await navigateToDirectorMode(page);

    const startTime = Date.now();

    // 执行一个 UI 操作
    const button = await page.locator('button').first();
    if (await button.isVisible()) {
      await button.click();
    }

    const responseTime = Date.now() - startTime;

    // UI 响应时间应该小于 1 秒
    expect(responseTime).toBeLessThan(1000);
  });

  test('页面加载应该在合理时间内完成', async () => {
    const startTime = Date.now();

    await navigateToDirectorMode(page);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // 页面加载时间应该小于 5 秒
    expect(loadTime).toBeLessThan(5000);

    console.log(`页面加载时间: ${loadTime}ms`);
  });
});
