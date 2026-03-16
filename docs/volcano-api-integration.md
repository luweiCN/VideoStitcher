# 火山引擎 API 集成使用指南

## 概述

本项目已集成火山引擎 AI API，支持以下功能：

1. **豆包 LLM API** - 脚本生成、角色描述、分镜场景生成
2. **豆包 Vision API** - 角色概念图、分镜图生成
3. **火山视频生成 API** - 最终视频合成

## 环境配置

### 1. 获取 API Key

1. 访问火山引擎官网：https://www.volcengine.com/
2. 注册并登录账号
3. 开通豆包 LLM、Vision 和视频生成服务
4. 在控制台获取 API Key

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
VOLCANO_ENGINE_API_KEY=your_actual_api_key_here
```

## API 调用示例

### 1. 脚本生成（scriptNode）

```typescript
import { VolcanoClient } from './api/volcano-client';

const client = new VolcanoClient();

// 调用 LLM 生成脚本
const prompt = `
你是一位专业的视频脚本编剧。

请为以下产品生成一个短视频脚本。

产品需求：一款智能手表
脚本风格：科技感
`;

const script = await client.callLLM(prompt, '你是一位专业的视频脚本编剧。');
console.log(script);
```

### 2. 角色概念图生成（characterNode）

```typescript
import { VolcanoClient } from './api/volcano-client';

const client = new VolcanoClient();

// 生成角色概念图
const imageUrl = await client.generateImage({
  prompt: '年轻的创业者，穿着休闲西装，自信阳光，现代办公室背景',
  style: 'digital art',
  width: 1024,
  height: 1024,
});

console.log('角色图片 URL:', imageUrl);
```

### 3. 分镜图生成（storyboardNode）

```typescript
import { VolcanoClient } from './api/volcano-client';

const client = new VolcanoClient();

// 生成分镜图
const imageUrl = await client.generateImage({
  prompt: '开场镜头：主角从远处走来，背景是城市天际线，镜头缓慢推进',
  style: 'cinematic',
  width: 1920,
  height: 1080,
});

console.log('分镜图片 URL:', imageUrl);
```

### 4. 视频生成（videoNode）

```typescript
import { VolcanoClient } from './api/volcano-client';

const client = new VolcanoClient();

// 提交视频生成任务
const taskId = await client.generateVideo({
  images: [
    'https://example.com/scene1.png',
    'https://example.com/scene2.png',
    'https://example.com/scene3.png',
  ],
  duration: 30,
  ratio: '16:9',
  resolution: '1080p',
});

console.log('任务 ID:', taskId);

// 查询任务状态
const status = await client.queryVideoTask(taskId);
console.log('任务状态:', status);

if (status.status === 'completed') {
  console.log('视频 URL:', status.video_url);
}
```

## 异步任务管理

使用 `TaskQueue` 管理长时间运行的任务：

```typescript
import { TaskQueue, TaskType } from './services/TaskQueue';

const taskQueue = new TaskQueue();

// 添加任务
const taskId = taskQueue.addTask(
  TaskType.VIDEO_GENERATION,
  '开始生成视频'
);

// 更新进度
await taskQueue.updateProgress(taskId, 50, '正在合成视频...');

// 标记完成
await taskQueue.completeTask(taskId, {
  videoUrl: 'https://example.com/video.mp4',
});

// 查询任务状态
const task = taskQueue.getTaskStatus(taskId);
console.log('任务状态:', task);
```

## 错误处理

所有 API 调用都包含以下错误处理机制：

1. **自动重试** - 网络错误时自动重试最多 3 次
2. **指数退避** - 重试间隔按指数增长（2^n 秒）
3. **超时控制** - 单次请求超时 30 秒
4. **错误日志** - 所有错误都会记录到日志文件

示例：

```typescript
try {
  const result = await client.callLLM(prompt);
  console.log('成功:', result);
} catch (error) {
  console.error('失败:', error.message);
  // 自动重试已执行，仍失败则抛出异常
}
```

## 测试

运行测试：

```bash
# 测试 API 客户端
npm run test test/api/volcano-client.test.ts

# 注意：需要配置 VOLCANO_ENGINE_API_KEY 环境变量
```

## 日志查看

所有 API 调用都会记录到日志文件：

- **macOS**: `~/Library/Logs/VideoStitcher/main.log`
- **Windows**: `%USERPROFILE%\AppData\Roaming\VideoStitcher\logs\main.log`

## 注意事项

1. **API Key 安全** - 不要将 API Key 提交到代码仓库
2. **费用控制** - 火山引擎 API 按使用量计费，注意控制调用次数
3. **并发限制** - 避免同时发起大量 API 请求
4. **超时设置** - 视频生成可能需要较长时间（最长 10 分钟）
5. **错误重试** - 已实现自动重试机制，无需手动重试

## 文件结构

```
src/main/
├── api/
│   └── volcano-client.ts       # 火山引擎 API 客户端
├── langgraph/
│   └── nodes/
│       ├── scriptNode.ts       # 脚本生成节点（使用 LLM API）
│       ├── characterNode.ts    # 角色生成节点（使用 Vision API）
│       ├── storyboardNode.ts   # 分镜生成节点（使用 Vision API）
│       └── videoNode.ts        # 视频生成节点（使用视频 API）
└── services/
    └── TaskQueue.ts            # 异步任务队列管理器
```

## 下一步

1. 配置 `.env` 文件中的 API Key
2. 运行测试验证 API 连接
3. 启动应用开始使用 AI 功能

## 支持

如有问题，请查看日志文件或联系开发团队。
