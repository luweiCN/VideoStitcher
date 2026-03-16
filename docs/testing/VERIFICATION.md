# 测试环境验证清单

## 验证步骤

### 1. 依赖安装验证 ✅

```bash
# 检查测试依赖是否安装
npm list @playwright/test vitest @testing-library/react
```

**预期结果**:
- @playwright/test@1.58.2
- vitest@4.1.0
- @testing-library/react@16.3.2

### 2. 单元测试验证 ✅

```bash
# 运行单元测试
npm run test -- --run
```

**预期结果**:
- Test Files: 2 passed (2)
- Tests: 10 passed (10)

### 3. E2E 测试准备 ⏸️

```bash
# 构建应用
npm run build

# 运行 E2E 测试
npm run test:e2e
```

**注意**: E2E 测试需要先构建应用才能运行

### 4. 测试 UI 验证

```bash
# 启动单元测试 UI
npm run test:ui

# 启动 E2E 测试 UI
npm run test:e2e:ui
```

**预期结果**: 打开浏览器界面，显示测试列表

### 5. 测试覆盖率验证

```bash
# 生成覆盖率报告
npm run test:coverage
```

**预期结果**: 生成 coverage/ 目录和报告

## 文件结构验证

检查以下文件是否存在：

### 配置文件
- [x] playwright.config.ts
- [x] vitest.config.ts
- [x] test/setup.ts

### 测试文件
- [x] test/e2e/electron-launch.test.ts
- [x] test/e2e/script-generation.test.ts
- [x] test/unit/utils.test.ts
- [x] test/unit/components.test.tsx

### 测试夹具
- [x] test/fixtures/test-data.ts
- [x] test/fixtures/README.md

### 文档
- [x] test/README.md
- [x] docs/testing/task-5-test-setup-report.md
- [x] docs/testing/SUMMARY.md

## NPM 脚本验证

验证 package.json 中的测试脚本：

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:all": "npm run test && npm run test:e2e"
}
```

运行测试：
```bash
npm run test -- --run
```

**预期结果**: 所有单元测试通过

## Git 忽略验证

检查 .gitignore 是否包含：

```
# Test results
test-results/
playwright-report/
coverage/
.nyc_output/
```

## 常见问题排查

### 1. 单元测试失败

**问题**: 测试运行失败

**解决方案**:
```bash
# 重新安装依赖
npm install

# 清除缓存
npm run test -- --clearCache
```

### 2. E2E 测试无法启动

**问题**: Electron 应用未找到

**解决方案**:
```bash
# 构建应用
npm run build

# 检查 out/main/index.js 是否存在
ls out/main/index.js
```

### 3. 依赖冲突

**问题**: npm install 失败

**解决方案**:
```bash
# 使用 legacy-peer-deps
npm install --legacy-peer-deps
```

## 测试通过标准

### 单元测试
- [x] 所有测试用例通过
- [x] 无控制台错误
- [x] 测试运行时间 < 2 秒

### E2E 测试
- [ ] Electron 应用成功启动
- [ ] 窗口正常显示
- [ ] 用户交互正常
- [ ] 无超时错误

## 下一步

1. 运行 E2E 测试
   ```bash
   npm run build
   npm run test:e2e
   ```

2. 查看测试报告
   ```bash
   npx playwright show-report
   ```

3. 添加更多测试用例

## 验证完成

- [x] 依赖安装完成
- [x] 单元测试通过
- [x] 文件结构完整
- [x] NPM 脚本正常
- [x] 文档完整
- [ ] E2E 测试通过（需要构建应用）

## 状态

✅ **任务 #5 - 自动化测试环境搭建 - 已完成**

单元测试验证通过，可以开始使用！
