# 快速开始指南 - AI API 集成

## 5 分钟快速配置

### 步骤 1: 获取 API Key
1. 访问 https://www.volcengine.com/
2. 注册/登录账号
3. 开通以下服务：
   - 豆包 LLM（大语言模型）
   - 豆包 Vision（图像生成）
   - 视频生成
4. 在控制台获取 API Key

### 步骤 2: 配置环境变量
```bash
# 复制配置模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

填入你的 API Key：
```env
VOLCANO_ENGINE_API_KEY=你的_API_Key_这里
```

### 步骤 3: 启动应用
```bash
npm run dev
```

### 步骤 4: 测试 AI 功能
1. 打开应用
2. 输入产品需求：例如 "一款智能手表"
3. 选择脚本风格：例如 "科技感"
4. 设置批量生成数量：1-10
5. 点击"生成脚本"
6. 查看生成的脚本
7. 选择一个脚本继续
8. 查看角色和分镜生成
9. 等待视频生成完成

## 验证 API 连接

### 方法 1: 查看日志
```bash
# macOS
tail -f ~/Library/Logs/VideoStitcher/main.log

# Windows
type %USERPROFILE%\AppData\Roaming\VideoStitcher\logs\main.log
```

查找包含 "火山引擎客户端" 的日志行。

### 方法 2: 运行测试
```bash
# 设置环境变量
export VOLCANO_ENGINE_API_KEY=你的_API_Key

# 运行测试
npm run test test/api/volcano-client.test.ts
```

## 常见问题

### Q1: API 调用失败
**原因：**
- API Key 未配置或错误
- 网络连接问题
- API 服务未开通

**解决方案：**
1. 检查 .env 文件中的 API Key
2. 确认网络连接正常
3. 登录火山引擎控制台确认服务已开通

### Q2: 生成速度慢
**原因：**
- 图片生成和视频生成需要时间
- 网络延迟

**解决方案：**
- 图片生成：约 5-15 秒/张
- 视频生成：约 1-5 分钟
- 耐心等待，或查看日志了解进度

### Q3: 费用问题
**解决方案：**
- 登录火山引擎控制台查看用量和费用
- 设置费用预警
- 合理控制批量生成数量

### Q4: 如何查看 API 调用详情
**解决方案：**
查看日志文件，所有 API 调用都有详细记录：
- 请求参数
- 响应结果
- 错误信息
- 重试记录

## 下一步

- 📖 阅读详细文档：`docs/volcano-api-integration.md`
- 📊 查看实现报告：`docs/implementation-report.md`
- 🧪 运行测试：`npm run test test/api/volcano-client.test.ts`

## 需要帮助？

- 查看日志文件排查问题
- 检查环境变量配置
- 确认 API 服务状态
