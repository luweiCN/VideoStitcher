# 重构前准备清单

## ✅ 需要你并行准备的事项

### 1. API Key 管理（可选，推荐）

**当前状态：** API Key 硬编码在代码中
```typescript
const DEFAULT_VOLCENGINE_API_KEY = '635a4f87-91d7-44f3-b09c-a580aa6ba835';
```

**推荐方案：** 使用环境变量

**操作步骤：**
```bash
# 在项目根目录创建 .env 文件（如果还没有）
echo "VOLCENGINE_API_KEY=635a4f87-91d7-44f3-b09c-a580aa6ba835" >> .env

# 确保 .env 在 .gitignore 中
echo ".env" >> .gitignore
```

**注意：** 如果不想用环境变量，保持现状也可以（新系统会兼容硬编码）

---

### 2. 备份当前配置（建议）

**操作：**
```bash
# 备份当前配置文件
cp ~/Library/Application\ Support/video-stitcher/ai/ai-config.json ~/Library/Application\ Support/video-stitcher/ai/ai-config.json.backup

# 如果文件不存在也没关系，系统会自动创建
```

---

### 3. 准备模型信息（如果知道的话）

**需要确认的信息：**

#### 3.1 文本模型信息
- [ ] 模型 ID：`doubao-1-5-pro-32k-250115` 是否正确？
- [ ] 是否还有其他文本模型在使用？
- [ ] 该模型的上下文窗口大小是多少？（我假设 32768）
- [ ] 该模型支持哪些能力？
  - [x] 函数调用 (function_calling)
  - [x] 流式响应 (streaming)
  - [ ] 视觉理解 (vision)
  - [ ] 其他？

#### 3.2 图片模型信息
- [ ] 模型 ID：`doubao-seedream-3-0-t2i-250428` 是否正确？
- [ ] 图片模型是否有特殊的配置参数？
- [ ] 支持的图片尺寸有哪些？

---

### 4. 准备测试场景（用于验证）

**建议准备：**
- [ ] 一个具体的测试创意方向（用于测试剧本生成）
- [ ] 一个编剧人设（用于测试完整流程）
- [ ] 预期生成的剧本数量（比如 3 个）

**示例：**
```json
{
  "projectId": "test-project-id",
  "creativeDirection": "科技感短视频，主题是 AI 改变生活",
  "persona": "幽默风趣型，擅长用夸张比喻",
  "model": "doubao-1-5-pro-32k-250115",
  "count": 3
}
```

---

### 5. LangChain 依赖确认（可选）

**检查是否已安装：**
```bash
npm list @langchain/openai @langchain/core
```

**如果没有安装：**
```bash
npm install @langchain/openai @langchain/core
```

**注意：** 根据代码，应该已经安装了。如果没有，告诉我，我会处理。

---

## ⏭️ 实施完成后需要你做的

### 验证步骤（我完成后会提示你）

1. **启动应用测试**
   ```bash
   npm run dev
   ```

2. **测试剧本生成**
   - 打开 Aside 项目
   - 选择创意方向
   - 选择编剧
   - 点击生成剧本

3. **检查配置文件**
   - 查看新的配置文件格式
   - 确认模型信息是否正确

4. **报告问题**（如果有）
   - 截图错误信息
   - 复制控制台日志

---

## 📞 如果遇到问题

**常见问题快速解决：**

1. **配置文件迁移失败**
   - 删除旧配置：`rm ~/Library/Application\ Support/video-stitcher/ai/ai-config.json`
   - 重启应用，会自动创建新配置

2. **模型调用失败**
   - 检查 API Key 是否正确
   - 检查网络连接
   - 查看控制台错误日志

3. **找不到模型**
   - 检查配置文件中模型 ID 是否正确
   - 确认供应商已启用

---

## ✅ 准备完成确认

**当你准备好后，回复：**
- "准备完成" - 我开始实施
- "有问题" + 具体问题 - 我先解答
- "稍等" - 你继续准备，我等你

**如果你什么都准备好了，直接说"开始"即可！**
