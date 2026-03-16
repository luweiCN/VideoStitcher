# 测试文档

VideoStitcher 项目自动化测试文档

## 测试框架

- **E2E 测试**: Playwright - 用于端到端测试 Electron 应用
- **单元测试**: Vitest - 用于测试 React 组件和工具函数

## 目录结构

```
test/
├── e2e/                        # E2E 测试
│   ├── electron-launch.test.ts # Electron 启动测试
│   └── script-generation.test.ts # 脚本生成流程测试
├── unit/                       # 单元测试
│   └── utils.test.ts          # 工具函数测试
├── fixtures/                   # 测试夹具
│   ├── test-data.ts           # 测试数据
│   └── README.md              # 测试夹具说明
└── setup.ts                    # Vitest 测试设置
```

## 运行测试

### 单元测试

```bash
# 运行所有单元测试
npm run test

# 使用 UI 界面运行单元测试
npm run test:ui

# 生成测试覆盖率报告
npm run test:coverage
```

### E2E 测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 使用 UI 界面运行 E2E 测试
npm run test:e2e:ui

# 运行特定测试文件
npx playwright test electron-launch.test.ts

# 调试模式
npx playwright test --debug
```

### 运行所有测试

```bash
# 运行单元测试和 E2E 测试
npm run test:all
```

## 测试用例

### 1. Electron 启动测试

**文件**: `test/e2e/electron-launch.test.ts`

**测试内容**:
- ✅ 应用启动成功
- ✅ 窗口标题正确
- ✅ 主窗口可见
- ✅ 窗口尺寸正确
- ✅ 无控制台错误
- ✅ 导航栏显示正常
- ✅ 主内容区域显示正常

### 2. 脚本生成流程测试

**文件**: `test/e2e/script-generation.test.ts`

**测试内容**:
- ✅ 导航到脚本生成页面
- ✅ 显示风格选择区域
- ✅ 选择视频风格
- ✅ 显示参数配置表单
- ✅ 填写脚本参数
- ✅ 生成脚本
- ✅ 显示生成结果
- ✅ 脚本列表显示正常
- ✅ 编辑脚本功能
- ✅ 加入待产库功能
- ✅ 批量操作功能

### 3. 工具函数测试

**文件**: `test/unit/utils.test.ts`

**测试内容**:
- ✅ 数字验证
- ✅ 持续时间格式化
- ✅ 唯一 ID 生成
- ✅ 文件扩展名验证
- ✅ 文本截断

## 测试数据

测试数据位于 `test/fixtures/test-data.ts`，包含：

- **scriptStyles**: 脚本风格列表
- **scriptConfigs**: 脚本配置参数
- **generatedScripts**: 生成的脚本内容
- **videoProjects**: 视频项目数据
- **apiResponses**: API 响应模拟数据
- **userSettings**: 用户配置数据

### 使用测试数据

```typescript
import { scriptStyles, generatedScripts } from '../fixtures/test-data';

test('测试风格选择', async () => {
  // 使用测试数据
  const styles = scriptStyles;
  expect(styles.length).toBeGreaterThan(0);
});
```

## 配置文件

### Playwright 配置

**文件**: `playwright.config.ts`

- 测试目录: `./test/e2e`
- 超时时间: 30 秒
- 截图: 失败时截图
- 视频录制: 失败时保留
- 测试报告: HTML + JSON + 列表

### Vitest 配置

**文件**: `vitest.config.ts`

- 测试目录: `test/unit/`
- 测试环境: jsdom
- 覆盖率: v8 提供器
- 全局变量: 启用

## 最佳实践

### 编写单元测试

1. **测试命名**: 使用清晰的描述性名称
   ```typescript
   describe('功能模块', () => {
     it('应该在特定条件下产生预期结果', () => {
       // 测试代码
     });
   });
   ```

2. **AAA 模式**: Arrange, Act, Assert
   ```typescript
   it('应该正确计算结果', () => {
     // Arrange - 准备数据
     const input = 10;

     // Act - 执行操作
     const result = calculate(input);

     // Assert - 验证结果
     expect(result).toBe(20);
   });
   ```

3. **边界测试**: 测试边界情况
   ```typescript
   it('应该处理空输入', () => {
     expect(processData(null)).toBeNull();
   });

   it('应该处理零值', () => {
     expect(processData(0)).toBe(0);
   });
   ```

### 编写 E2E 测试

1. **使用 data-testid**: 使用测试 ID 定位元素
   ```typescript
   await page.waitForSelector('[data-testid="submit-button"]');
   await page.click('[data-testid="submit-button"]');
   ```

2. **等待策略**: 合理使用等待
   ```typescript
   // 等待元素出现
   await page.waitForSelector('.element');

   // 等待导航完成
   await page.waitForURL('**/new-page');

   // 等待网络请求
   await page.waitForResponse('**/api/data');
   ```

3. **错误处理**: 处理可能的错误
   ```typescript
   try {
     await page.click('.button');
   } catch (error) {
     // 记录错误并继续
     console.error('点击失败:', error);
   }
   ```

## 调试测试

### 单元测试调试

```bash
# 使用 UI 模式调试
npm run test:ui

# 在控制台查看详细输出
npm run test -- --reporter=verbose
```

### E2E 测试调试

```bash
# 使用调试模式
npx playwright test --debug

# 使用 UI 模式
npm run test:e2e:ui

# 查看测试报告
npx playwright show-report
```

## CI/CD 集成

测试可以在 CI/CD 流程中自动运行：

```yaml
# GitHub Actions 示例
- name: 运行测试
  run: |
    npm run test:coverage
    npm run test:e2e

- name: 上传测试报告
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: |
      coverage/
      test-results/
```

## 常见问题

### 1. 测试超时

**问题**: 测试因超时而失败

**解决方案**:
```typescript
// 增加单个测试的超时时间
test('长时间测试', async () => {
  // ...
}, 60000); // 60 秒超时
```

### 2. 元素未找到

**问题**: 找不到页面元素

**解决方案**:
```typescript
// 增加等待时间
await page.waitForSelector('.element', { timeout: 10000 });

// 使用更宽松的选择器
const element = await page.$('[data-testid="my-element"]');
```

### 3. Electron 应用未启动

**问题**: E2E 测试无法启动 Electron

**解决方案**:
```bash
# 确保已构建应用
npm run build

# 检查 out/main/index.js 是否存在
ls out/main/index.js
```

## 测试覆盖率目标

- **语句覆盖率**: > 80%
- **分支覆盖率**: > 75%
- **函数覆盖率**: > 80%
- **行覆盖率**: > 80%

## 持续改进

1. **定期更新测试数据**: 确保测试数据与生产环境一致
2. **添加新测试**: 为新功能添加测试用例
3. **优化测试性能**: 减少不必要的等待和重复操作
4. **维护测试文档**: 保持文档与实际测试同步

## 参考资源

- [Playwright 文档](https://playwright.dev/)
- [Vitest 文档](https://vitest.dev/)
- [Testing Library 文档](https://testing-library.com/)
- [Electron 测试指南](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
