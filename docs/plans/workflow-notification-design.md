# 工作流实时通知机制设计

## 1. 事件类型

### 1.1 进度事件
```typescript
// 事件名: aside:workflow:progress
{
  screenplayId: string;
  step: number;          // 步骤编号 (2-5)
  stepName: string;      // 步骤名称 (art_director, casting_director, etc.)
  status: 'started' | 'completed';
  message?: string;      // 人类可读的进度消息
  timestamp: number;
}
```

### 1.2 角色生成完成事件
```typescript
// 事件名: aside:workflow:characters
{
  screenplayId: string;
  characters: Character[];  // 角色列表
  message: string;          // Agent 发送的消息
}
```

### 1.3 人物形象生成完成事件
```typescript
// 事件名: aside:workflow:character-image
{
  screenplayId: string;
  characterId: string;
  characterName: string;
  imageUrl: string;         // 三视图图片 URL
  message: string;          // Agent 发送的消息
}
```

### 1.4 分镜图生成完成事件
```typescript
// 事件名: aside:workflow:storyboard
{
  screenplayId: string;
  storyboard: Storyboard;   // 分镜图数据
  message: string;          // Agent 发送的消息
}
```

### 1.5 视频生成完成事件
```typescript
// 事件名: aside:workflow:video
{
  screenplayId: string;
  videoUrl: string;         // 视频 URL
  videoIndex: number;       // 视频序号（可能生成多个）
  message: string;          // Agent 发送的消息
}
```

### 1.6 工作流完成事件
```typescript
// 事件名: aside:workflow:complete
{
  screenplayId: string;
  finalVideoUrl: string;    // 最终拼接的视频 URL
  message: string;          // 完成消息
}
```

### 1.7 错误事件
```typescript
// 事件名: aside:workflow:error
{
  screenplayId: string;
  step: number;
  error: string;
  timestamp: number;
}
```

## 2. 实现架构

### 2.1 后端（主进程）

**executor.ts**:
- 使用 `graph.stream({ streamMode: "updates" })` 替代 `graph.invoke()`
- 监听每个节点的状态更新
- 通过 `BrowserWindow.webContents.send()` 发送事件

**节点函数（art-director.ts 等）**:
- 使用 `get_stream_writer()` 发送自定义进度消息
- 在节点完成时发送结构化数据

### 2.2 前端（渲染进程）

**preload/index.ts**:
- 添加事件监听器接口：
  - `onWorkflowProgress`
  - `onWorkflowCharacters`
  - `onWorkflowCharacterImage`
  - `onWorkflowStoryboard`
  - `onWorkflowVideo`
  - `onWorkflowComplete`
  - `onWorkflowError`

**ChatPanel.tsx**:
- 在组件挂载时添加事件监听
- 接收到事件后更新聊天消息
- 调用 `directorMode` 方法更新画板数据

**useDirectorMode.ts**:
- 提供状态管理方法：
  - `updateCharacters()`
  - `updateCharacterImage()`
  - `updateStoryboard()`
  - `updateVideos()`

## 3. 事件流程示例

### 艺术总监创作角色：

```
1. 前端调用: asideGenerateCharacters(screenplayId)
2. 后端 executor:
   - 发送 aside:workflow:progress { step: 2, status: 'started' }
   - 执行 art_director 节点
   - 节点完成后发送 aside:workflow:characters { characters: [...] }
   - 发送 aside:workflow:progress { step: 2, status: 'completed' }
3. 前端监听:
   - 收到 progress → 显示 typing 动画
   - 收到 characters → 添加聊天消息 + 更新画板
```

### 选角导演生成人物形象：

```
1. 前端调用: asideGenerateCharacterImage(screenplayId, characterId)
2. 后端:
   - 发送 aside:workflow:progress { step: 3, status: 'started' }
   - 执行 casting_director 节点（每个角色）
   - 每完成一个角色发送 aside:workflow:character-image { imageUrl }
3. 前端监听:
   - 收到 character-image → 添加消息 + 更新角色卡片图片
```

## 4. 兼容性考虑

- 保留现有的 `asideGenerateCharacters` 等同步 API（用于向后兼容）
- 添加新的流式 API：`asideStartWorkflowStream`（可选）
- 前端可以根据 `isWorkflowInitialized` 选择使用哪种模式

## 5. 关键技术点

### 5.1 获取 BrowserWindow 实例

```typescript
// 在 IPC handler 中
import { BrowserWindow } from 'electron';

const getFocusedWindow = () => {
  const window = BrowserWindow.getFocusedWindow();
  if (!window) {
    console.warn('[Workflow] 无法获取焦点窗口');
    return null;
  }
  return window;
};
```

### 5.2 使用 LangGraph Stream API

```typescript
// 在 executor.ts 中
const stream = await graph.stream(initialState, { streamMode: "updates" });

for await (const event of stream) {
  const [nodeName, output] = event;
  console.log(`[Workflow] 节点 ${nodeName} 完成`);

  // 发送 IPC 事件
  const window = getFocusedWindow();
  if (window) {
    window.webContents.send('aside:workflow:progress', {
      screenplayId,
      step: getStepNumber(nodeName),
      stepName: nodeName,
      status: 'completed',
      timestamp: Date.now(),
    });
  }
}
```

### 5.3 节点中的自定义事件

```typescript
// 在 art-director.ts 中
import { get_stream_writer } from '@langchain/langgraph';

export async function artDirectorNode(state: WorkflowState) {
  const writer = get_stream_writer();

  writer("正在创作角色和场景...");  // 发送进度消息

  // ... 执行 LLM 调用

  const characters = parseArtDirectorOutput(result.content);

  // 返回状态更新
  return {
    step2_characters: { content: characters, metadata: {...} },
    currentStep: 3,
  };
}
```

## 6. 前端使用示例

```typescript
// ChatPanel.tsx
useEffect(() => {
  // 监听角色生成完成
  const unsubscribe = window.api.onWorkflowCharacters((data) => {
    // 移除 typing 消息
    setMessages(prev => prev.filter(m => m.type !== 'typing'));

    // 添加 Agent 消息
    addAgentMessage('art-director', data.message, [
      { label: '重新生成', value: 'regenerate' },
      { label: '无需修改', value: 'confirm' },
    ]);

    // 更新画板
    directorMode.updateCharacters(data.characters);
  });

  return () => unsubscribe();
}, [screenplayId]);
```
