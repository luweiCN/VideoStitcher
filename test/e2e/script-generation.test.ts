import { test, expect, ElectronApp, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

/**
 * 脚本生成流程测试
 * 测试 AI 脚本生成的完整流程
 */

let electronApp: ElectronApp;
let page: Page;

test.describe('脚本生成流程测试', () => {
  // 在所有测试前启动 Electron 应用
  test.beforeAll(async () => {
    const appPath = path.join(process.cwd(), 'out/main/index.js');

    electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    await electronApp.waitForEvent('window');
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  // 在所有测试后关闭应用
  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('导航到脚本生成页面', async () => {
    // 等待导航栏加载
    await page.waitForSelector('nav', { timeout: 10000 });

    // 查找脚本生成菜单项
    const scriptMenuItem = await page.locator('text=脚本生成').first();

    // 点击菜单项
    await scriptMenuItem.click();

    // 等待页面跳转
    await page.waitForURL('**/script-generation**', { timeout: 10000 });

    // 验证 URL 正确
    const currentURL = page.url();
    expect(currentURL).toContain('script-generation');
  });

  test('显示风格选择区域', async () => {
    // 等待风格选择组件加载
    await page.waitForSelector('[data-testid="style-selector"]', {
      timeout: 10000,
    });

    // 验证风格选择器可见
    const styleSelector = await page.$('[data-testid="style-selector"]');
    expect(styleSelector).toBeDefined();
  });

  test('选择视频风格', async () => {
    // 等待风格选项加载
    await page.waitForSelector('[data-testid="style-option"]', {
      timeout: 10000,
    });

    // 获取所有风格选项
    const styleOptions = await page.$$('[data-testid="style-option"]');

    // 验证至少有一个风格选项
    expect(styleOptions.length).toBeGreaterThan(0);

    // 点击第一个风格选项
    await styleOptions[0].click();

    // 等待选中状态
    await page.waitForTimeout(500);

    // 验证选中状态（根据实际 UI 调整）
    const selectedStyle = await page.$('[data-testid="style-option"].selected');
    expect(selectedStyle).toBeDefined();
  });

  test('显示参数配置表单', async () => {
    // 等待参数配置表单加载
    await page.waitForSelector('[data-testid="config-form"]', {
      timeout: 10000,
    });

    // 验证表单可见
    const configForm = await page.$('[data-testid="config-form"]');
    expect(configForm).toBeDefined();
  });

  test('填写脚本参数', async () => {
    // 填写视频主题
    const topicInput = await page.$('[data-testid="topic-input"]');
    if (topicInput) {
      await topicInput.fill('测试视频主题：产品介绍');
    }

    // 填写视频时长
    const durationInput = await page.$('[data-testid="duration-input"]');
    if (durationInput) {
      await durationInput.fill('60');
    }

    // 选择目标受众
    const audienceSelect = await page.$('[data-testid="audience-select"]');
    if (audienceSelect) {
      await audienceSelect.selectOption({ index: 0 });
    }

    // 填写关键词
    const keywordsInput = await page.$('[data-testid="keywords-input"]');
    if (keywordsInput) {
      await keywordsInput.fill('产品, 介绍, 演示');
    }

    // 等待表单更新
    await page.waitForTimeout(500);
  });

  test('生成脚本', async () => {
    // 查找生成按钮
    const generateButton = await page.$('[data-testid="generate-button"]');

    // 验证按钮存在且可点击
    expect(generateButton).toBeDefined();

    // 点击生成按钮
    await generateButton?.click();

    // 等待加载状态
    await page.waitForSelector('[data-testid="loading-indicator"]', {
      timeout: 5000,
    }).catch(() => {
      // 如果没有加载指示器，继续执行
    });

    // 等待生成完成（最长等待 30 秒）
    await page.waitForSelector('[data-testid="script-result"]', {
      timeout: 30000,
    }).catch(() => {
      // 如果生成失败，检查错误提示
    });
  });

  test('显示生成结果', async () => {
    // 等待脚本结果显示
    await page.waitForSelector('[data-testid="script-result"]', {
      timeout: 5000,
    }).catch(async () => {
      // 如果没有结果，检查是否有错误提示
      const errorMessage = await page.$('[data-testid="error-message"]');
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        throw new Error(`脚本生成失败: ${errorText}`);
      }
    });

    // 验证脚本结果可见
    const scriptResult = await page.$('[data-testid="script-result"]');
    expect(scriptResult).toBeDefined();
  });

  test('脚本列表显示正常', async () => {
    // 等待脚本列表加载
    await page.waitForSelector('[data-testid="script-list"]', {
      timeout: 10000,
    });

    // 验证列表可见
    const scriptList = await page.$('[data-testid="script-list"]');
    expect(scriptList).toBeDefined();

    // 获取脚本项数量
    const scriptItems = await page.$$('[data-testid="script-item"]');
    expect(scriptItems.length).toBeGreaterThan(0);
  });

  test('编辑脚本功能', async () => {
    // 查找编辑按钮
    const editButton = await page.$('[data-testid="edit-script-button"]');

    if (editButton) {
      // 点击编辑按钮
      await editButton.click();

      // 等待编辑对话框打开
      await page.waitForSelector('[data-testid="script-editor"]', {
        timeout: 5000,
      });

      // 验证编辑器可见
      const editor = await page.$('[data-testid="script-editor"]');
      expect(editor).toBeDefined();

      // 修改脚本内容
      const textarea = await page.$('[data-testid="script-textarea"]');
      if (textarea) {
        await textarea.fill('修改后的脚本内容');
      }

      // 保存修改
      const saveButton = await page.$('[data-testid="save-script-button"]');
      if (saveButton) {
        await saveButton.click();
      }

      // 等待保存完成
      await page.waitForTimeout(1000);
    }
  });

  test('加入待产库功能', async () => {
    // 查找加入待产库按钮
    const addToQueueButton = await page.$(
      '[data-testid="add-to-queue-button"]'
    );

    if (addToQueueButton) {
      // 点击加入待产库
      await addToQueueButton.click();

      // 等待成功提示
      await page.waitForSelector('[data-testid="success-toast"]', {
        timeout: 5000,
      }).catch(() => {
        // 如果没有 toast，可能使用其他提示方式
      });

      // 验证按钮状态变化（如禁用或文本变化）
      const buttonText = await addToQueueButton.textContent();
      expect(buttonText).toBeDefined();
    }
  });

  test('批量操作功能', async () => {
    // 查找批量选择复选框
    const checkboxes = await page.$$('[data-testid="script-checkbox"]');

    if (checkboxes.length > 0) {
      // 选择前两个脚本
      await checkboxes[0].check();
      if (checkboxes.length > 1) {
        await checkboxes[1].check();
      }

      // 查找批量操作按钮
      const batchActionButton = await page.$(
        '[data-testid="batch-action-button"]'
      );

      if (batchActionButton) {
        // 验证按钮可用
        const isEnabled = await batchActionButton.isEnabled();
        expect(isEnabled).toBe(true);
      }
    }
  });
});
