# AI 视频生产 - 文档索引

## 📚 文档导航

### 快速开始
- **[快速开始指南](./quick-start.md)** - 5 分钟快速配置和使用
- **[API 集成文档](./volcano-api-integration.md)** - 详细的 API 使用说明

### 实现文档
- **[实现报告](./implementation-report.md)** - 详细的实现说明和代码示例
- **[集成总结](./AI_API_INTEGRATION_SUMMARY.md)** - 完整的任务完成总结

## 🚀 5 分钟快速开始

```bash
# 1. 配置 API Key
cp .env.example .env
# 编辑 .env 文件，填入你的火山引擎 API Key

# 2. 启动应用
npm run dev

# 3. 开始使用
# 输入产品需求 → 生成脚本 → 选择脚本 → 生成角色 → 生成分镜 → 生成视频
```

## 📖 文档说明

### quick-start.md
**适合人群**: 第一次使用的用户  
**内容**: 
- 如何获取 API Key
- 如何配置环境变量
- 如何验证 API 连接
- 常见问题解答

### volcano-api-integration.md
**适合人群**: 开发者  
**内容**:
- API 详细说明
- 完整的调用示例
- 错误处理机制
- 性能优化建议

### implementation-report.md
**适合人群**: 开发者、维护者  
**内容**:
- 创建和修改的文件列表
- 核心功能实现说明
- 代码示例
- 下一步建议

### AI_API_INTEGRATION_SUMMARY.md
**适合人群**: 项目管理者、开发者  
**内容**:
- 任务完成状态
- 功能清单
- 技术细节
- 费用说明

## 🔧 核心功能

### 1. 脚本生成
- 调用豆包 LLM API
- 支持批量生成（1-10 个）
- 多种风格选择

### 2. 角色生成
- 智能分析脚本提取角色
- 调用 Vision API 生成角色概念图
- 支持主角和配角

### 3. 分镜生成
- 根据脚本自动生成场景列表
- 调用 Vision API 生成分镜图
- 支持自定义时长

### 4. 视频生成
- 调用火山视频 API
- 异步任务轮询
- 实时进度更新

## 📝 环境配置

### 必需配置
```bash
VOLCANO_ENGINE_API_KEY=your_api_key_here
```

### 可选配置
```bash
VOLCANO_ENGINE_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCANO_ENGINE_MODEL=doubao-pro-32k
```

## 🧪 测试

```bash
# 配置环境变量
export VOLCANO_ENGINE_API_KEY=your_api_key

# 运行测试
npm run test test/api/volcano-client.test.ts
```

## 📊 性能数据

| 操作 | 平均时间 |
|------|---------|
| 脚本生成 | 5-10 秒/个 |
| 角色生成 | 10-20 秒/个 |
| 分镜生成 | 10-20 秒/个 |
| 视频生成 | 1-5 分钟 |

## 💰 费用说明

火山引擎 API 按使用量计费：
- **LLM API**: 按 Token 计费
- **Vision API**: 按图片数量计费
- **视频 API**: 按时长计费

建议：合理控制批量生成数量，定期查看用量统计。

## 🔍 故障排查

### 查看日志
```bash
# macOS
tail -f ~/Library/Logs/VideoStitcher/main.log

# Windows
type %USERPROFILE%\AppData\Roaming\VideoStitcher\logs\main.log
```

### 常见问题
1. **API 调用失败** → 检查 API Key 配置
2. **生成速度慢** → 正常现象，耐心等待
3. **费用过高** → 控制批量生成数量

## 📞 获取帮助

1. 查看相关文档
2. 检查日志文件
3. 运行测试验证
4. 联系开发团队

## 🎯 下一步

- [ ] 配置环境变量
- [ ] 启动应用
- [ ] 生成第一个视频
- [ ] 查看使用文档了解高级功能

---

**开始你的 AI 视频生产之旅！** 🚀
