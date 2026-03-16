# LangChain + LangGraph 学习指南

> 本文档面向想学习 LangChain 和 LangGraph 的开发者，结合 A 面视频生产项目讲解核心概念

---

## 📚 什么是 LangChain 和 LangGraph？

### LangChain
**定义:** LangChain 是一个开发 AI 应用的框架，提供了构建 LLM 应用的组件和工具。

**核心价值:**
- 统一的 LLM 接口（支持 OpenAI、火山引擎等多个提供商）
- 链式调用（将多个 LLM 调用串联）
- 记忆管理（对话历史）
- 工具调用（让 LLM 使用外部工具）

**类比:** 就像 jQuery 统一了浏览器 API，LangChain 统一了 LLM API

### LangGraph
**定义:** LangGraph 是 LangChain 的扩展库，用于构建**有状态的、多角色的** LLM 应用。

**核心价值:**
- 工作流图（定义多步骤的执行流程）
- 状态管理（在步骤间传递和修改数据）
- 循环和分支（根据条件选择执行路径）
- 人工介入点（暂停等待人工确认）

**类比:** LangChain 是单线程，LangGraph 是多线程 + 状态机

---

## 🔄 核心概念对比

| 概念 | LangChain | LangGraph |
|------|-----------|-----------|
| **执行方式** | 链式（Chain） | 图（Graph） |
| **状态管理** | 无状态或有记忆 | 显式状态管理 |
| **流程控制** | 线性执行 | 条件分支、循环 |
| **人工介入** | 不支持 | 支持暂停/恢复 |
| **适用场景** | 简单的 LLM 调用 | 复杂的多步骤工作流 |

---

## 🏗️ LangGraph 工作原理

### 1. 状态（State）

**定义:** 工作流的数据容器，在所有节点间共享

```typescript
// 示例：视频生产工作流状态
interface WorkflowState {
  // 输入
  scriptContent: string;

  // 中间结果
  step1_script?: Script;
  step2_characters?: CharacterCard[];
  step3_storyboard?: StoryboardFrame[];
  step4_video?: Video;

  // 控制
  currentStep: number;
  executionMode: 'fast' | 'director';
}
```

**类比:** 就像装配流水线上的产品，每个工位（节点）都可以读取和修改它

### 2. 节点（Node）

**定义:** 执行具体任务的函数，接收状态，返回状态更新

```typescript
// 示例：脚本编写节点
async function scriptWriterNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  // 1. 读取输入
  const { scriptContent, creativeDirection, persona } = state;

  // 2. 调用 LLM
  const result = await llm.generateText(scriptContent, {
    systemPrompt: `你是脚本编写专家...`,
  });

  // 3. 返回状态更新
  return {
    step1_script: {
      content: result.content,
      metadata: { timestamp: Date.now() }
    },
    currentStep: 2, // 进入下一步
  };
}
```

**类比:** 工厂流水线上的一个工位，完成特定任务（如：焊接、喷漆、组装）

### 3. 边（Edge）

**定义:** 定义节点之间的流转关系

**类型:**
- **普通边:** 固定跳转到下一个节点
- **条件边:** 根据状态决定跳转到哪个节点

```typescript
// 普通边：A → B
workflow.addEdge('node_a', 'node_b');

// 条件边：根据状态选择路径
workflow.addConditionalEdges(
  'node_a',
  (state) => {
    if (state.executionMode === 'director') {
      return 'wait_for_human'; // 导演模式：暂停
    }
    return 'continue'; // 快速生成：继续
  },
  {
    wait_for_human: END,
    continue: 'node_b',
  }
);
```

**类比:** 普通边 = 直路，条件边 = 十字路口（根据信号灯选择方向）

### 4. 图（Graph）

**定义:** 节点和边的集合，定义完整的工作流

```typescript
import { StateGraph, END } from '@langchain/langgraph';

// 1. 创建图
const workflow = new StateGraph<WorkflowState>({
  channels: {
    scriptContent: { value: null },
    currentStep: { value: 1 },
    // ... 其他状态字段
  },
});

// 2. 添加节点
workflow.addNode('script_writer', scriptWriterNode);
workflow.addNode('casting_director', castingDirectorNode);
workflow.addNode('storyboard_artist', storyboardArtistNode);
workflow.addNode('camera_director', cameraDirectorNode);

// 3. 添加边
workflow.addEdge('script_writer', 'casting_director');
workflow.addEdge('casting_director', 'storyboard_artist');
workflow.addEdge('storyboard_artist', 'camera_director');
workflow.addEdge('camera_director', END);

// 4. 设置入口
workflow.setEntryPoint('script_writer');

// 5. 编译
const graph = workflow.compile();
```

**类比:** 地铁线路图 - 站点是节点，轨道是边

---

## 🎬 实战示例：视频生产工作流

### 场景描述
我们需要实现一个视频生产流程，包含 4 个步骤：
1. 脚本编写
2. 人物卡片生成
3. 分镜图生成
4. 视频生成

支持两种模式：
- **快速生成:** 自动执行所有步骤
- **导演模式:** 每步暂停，人工确认后才继续

### 完整代码实现

#### Step 1: 定义状态

```typescript
// src/main/ai/workflows/state.ts
import type { BaseMessage } from '@langchain/core/messages';

export interface WorkflowState {
  // 输入
  scriptContent: string;
  projectId: string;

  // 配置
  executionMode: 'fast' | 'director';
  videoSpec: {
    duration: 'short' | 'long';
    aspectRatio: '16:9' | '9:16';
  };

  // Agent 输出
  step1_script?: {
    content: string;
    metadata: { timestamp: number; duration: number };
  };
  step2_characters?: Array<{
    name: string;
    description: string;
    imageUrl: string;
  }>;
  step3_storyboard?: Array<{
    imageUrl: string;
    description: string;
  }>;
  step4_video?: {
    videoUrl: string;
    duration: number;
  };

  // 控制
  currentStep: number;
  humanApproval: boolean;

  // 消息历史
  messages: BaseMessage[];
}
```

#### Step 2: 实现节点

```typescript
// src/main/ai/workflows/nodes/script-writer.ts
import { ChatOpenAI } from '@langchain/openai';
import type { WorkflowState } from '../state';

export async function scriptWriterNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 1] 脚本编写开始');

  const startTime = Date.now();

  // 1. 创建 LLM 客户端
  const llm = new ChatOpenAI({
    modelName: 'doubao-pro-32k',
    openAIApiKey: '635a4f87-91d7-44f3-b09c-a580aa6ba835',
    configuration: {
      baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    },
  });

  // 2. 调用 LLM
  const response = await llm.invoke([
    {
      role: 'system',
      content: `你是一位专业的视频脚本编写专家。
      根据用户的输入优化脚本，使其符合视频时长要求。`,
    },
    {
      role: 'user',
      content: state.scriptContent,
    },
  ]);

  const endTime = Date.now();

  // 3. 返回状态更新
  return {
    step1_script: {
      content: response.content.toString(),
      metadata: {
        timestamp: endTime,
        duration: endTime - startTime,
      },
    },
    currentStep: 2,
    messages: [...state.messages, response],
  };
}

// src/main/ai/workflows/nodes/casting-director.ts
export async function castingDirectorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 2] 选角导演开始');

  // 1. 从脚本提取人物
  const llm = new ChatOpenAI({ /* ... */ });
  const extractResult = await llm.invoke([
    {
      role: 'system',
      content: '从脚本中提取人物信息，返回 JSON 数组。',
    },
    {
      role: 'user',
      content: state.step1_script?.content || state.scriptContent,
    },
  ]);

  const characters = JSON.parse(extractResult.content.toString());

  // 2. 为每个人物生成图片
  const characterCards = [];
  for (const char of characters) {
    // 调用图片生成 API
    const imageResult = await generateImage(char.description);

    characterCards.push({
      name: char.name,
      description: char.description,
      imageUrl: imageResult.url,
    });
  }

  // 3. 返回状态更新
  return {
    step2_characters: characterCards,
    currentStep: 3,
  };
}

// 类似实现其他节点...
```

#### Step 3: 构建工作流图

```typescript
// src/main/ai/workflows/graph.ts
import { StateGraph, END } from '@langchain/langgraph';
import type { WorkflowState } from './state';
import { scriptWriterNode } from './nodes/script-writer';
import { castingDirectorNode } from './nodes/casting-director';
import { storyboardArtistNode } from './nodes/storyboard-artist';
import { cameraDirectorNode } from './nodes/camera-director';

/**
 * 人工检查点：决定是否暂停
 */
function humanCheckpoint(state: WorkflowState): string {
  if (state.executionMode === 'director') {
    return 'wait_for_human'; // 导演模式：暂停
  }
  return 'continue'; // 快速生成：继续
}

/**
 * 创建工作流图
 */
export function createVideoProductionGraph() {
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      scriptContent: { value: null },
      projectId: { value: null },
      executionMode: { value: null },
      videoSpec: { value: null },
      step1_script: { value: null },
      step2_characters: { value: null },
      step3_storyboard: { value: null },
      step4_video: { value: null },
      currentStep: { value: 1 },
      humanApproval: { value: false },
      messages: { value: [] },
    },
  });

  // 1. 添加节点
  workflow.addNode('script_writer', scriptWriterNode);
  workflow.addNode('casting_director', castingDirectorNode);
  workflow.addNode('storyboard_artist', storyboardArtistNode);
  workflow.addNode('camera_director', cameraDirectorNode);

  // 2. 添加条件边（关键：支持导演模式暂停）
  workflow.addConditionalEdges(
    'script_writer',
    humanCheckpoint,
    {
      wait_for_human: END, // 暂停，等待人工确认
      continue: 'casting_director', // 继续执行
    }
  );

  workflow.addConditionalEdges(
    'casting_director',
    humanCheckpoint,
    {
      wait_for_human: END,
      continue: 'storyboard_artist',
    }
  );

  workflow.addConditionalEdges(
    'storyboard_artist',
    humanCheckpoint,
    {
      wait_for_human: END,
      continue: 'camera_director',
    }
  );

  // 最后一个节点直接结束
  workflow.addEdge('camera_director', END);

  // 3. 设置入口
  workflow.setEntryPoint('script_writer');

  // 4. 编译
  return workflow.compile();
}
```

#### Step 4: 执行工作流

```typescript
// src/main/ai/workflows/executor.ts
import { createVideoProductionGraph } from './graph';

export async function startWorkflow(params: {
  scriptContent: string;
  executionMode: 'fast' | 'director';
}) {
  const graph = createVideoProductionGraph();

  // 初始化状态
  const initialState: WorkflowState = {
    scriptContent: params.scriptContent,
    projectId: 'project-123',
    executionMode: params.executionMode,
    videoSpec: {
      duration: 'short',
      aspectRatio: '16:9',
    },
    currentStep: 1,
    humanApproval: false,
    messages: [],
  };

  // 执行工作流
  const result = await graph.invoke(initialState);

  return result;
}

// 恢复工作流（导演模式确认后继续）
export async function resumeWorkflow(currentState: WorkflowState) {
  const graph = createVideoProductionGraph();

  // 清除暂停标记
  currentState.humanApproval = false;

  // 继续执行
  const result = await graph.invoke(currentState);

  return result;
}
```

#### Step 5: 使用示例

```typescript
// 快速生成模式
const fastResult = await startWorkflow({
  scriptContent: '麻将高手的故事...',
  executionMode: 'fast',
});

console.log('视频生成完成:', fastResult.step4_video);

// 导演模式
const directorResult = await startWorkflow({
  scriptContent: '麻将高手的故事...',
  executionMode: 'director',
});

// 工作流会在第一个 Agent 后暂停
console.log('脚本完成:', directorResult.step1_script);

// 用户查看并修改
const userModifiedScript = {
  ...directorResult,
  step1_script: {
    content: '用户修改后的脚本...',
  },
};

// 继续执行
const nextResult = await resumeWorkflow(userModifiedScript);

// 工作流会在第二个 Agent 后暂停
console.log('人物卡片:', nextResult.step2_characters);
```

---

## 🔍 执行流程图

### 快速生成模式

```
开始
  ↓
[脚本编写 Agent]
  ↓ (自动)
[选角导演 Agent]
  ↓ (自动)
[分镜师 Agent]
  ↓ (自动)
[摄像导演 Agent]
  ↓
结束（生成视频）
```

### 导演模式

```
开始
  ↓
[脚本编写 Agent]
  ↓
⏸️ 暂停（等待人工确认）
  ↓
用户确认/修改
  ↓
[选角导演 Agent]
  ↓
⏸️ 暂停（等待人工确认）
  ↓
用户确认/修改
  ↓
[分镜师 Agent]
  ↓
⏸️ 暂停（等待人工确认）
  ↓
用户确认/修改
  ↓
[摄像导演 Agent]
  ↓
结束（生成视频）
```

---

## 💡 核心优势

### 1. 统一的工作流定义

**传统方式（问题）：**
```typescript
// 不使用 LangGraph
async function traditionalApproach() {
  const script = await generateScript();

  // 问题：如何支持暂停？
  // 问题：如何支持重新生成？
  // 问题：如何传递状态？

  const characters = await generateCharacters(script);
  const storyboard = await generateStoryboard(characters);
  const video = await generateVideo(storyboard);

  return video;
}
```

**LangGraph 方式（优势）：**
```typescript
// 使用 LangGraph
const graph = createVideoProductionGraph();

// 优势1: 自动状态管理
const state = await graph.invoke(initialState);

// 优势2: 支持暂停
if (state.currentStep < 4) {
  // 保存状态，等待用户
  saveState(state);
}

// 优势3: 支持恢复
const resumed = await graph.invoke(savedState);

// 优势4: 支持重新生成
const regenerated = await graph.invoke({
  ...state,
  needsRegeneration: true,
});
```

### 2. 灵活的控制流

```typescript
// 条件分支示例
workflow.addConditionalEdges(
  'script_writer',
  (state) => {
    // 根据视频长度选择不同的路径
    if (state.videoSpec.duration === 'long') {
      return 'long_video_path';
    }
    return 'short_video_path';
  },
  {
    long_video_path: 'extended_storyboard',
    short_video_path: 'quick_storyboard',
  }
);
```

### 3. 可观察性

```typescript
// 所有状态变更都可追踪
const result = await graph.invoke(initialState, {
  callbacks: [
    {
      handleChainStart: () => console.log('工作流开始'),
      handleChainEnd: () => console.log('工作流结束'),
      handleLLMStart: () => console.log('LLM 调用开始'),
      handleLLMEnd: () => console.log('LLM 调用结束'),
    },
  ],
});
```

---

## 🎓 学习路径建议

### 初级（1-2 天）
1. 理解 LLM 基本概念
2. 学习 LangChain 基础（Chain、Prompt、Memory）
3. 实现简单的 LLM 调用

### 中级（3-5 天）
1. 理解状态管理
2. 学习 LangGraph 基础（State、Node、Edge）
3. 实现简单的 2-3 步工作流

### 高级（1-2 周）
1. 掌握条件边和循环
2. 实现人工介入点
3. 构建复杂的多 Agent 系统（如本项目）

---

## 📚 参考资料

### 官方文档
- [LangChain 文档](https://python.langchain.com/docs/)
- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [LangChain TypeScript](https://js.langchain.com/docs/)

### 项目示例
- [本项目代码](/src/main/ai/workflows/) - 完整的视频生产工作流实现
- [LangGraph 示例](https://langchain-ai.github.io/langgraph/tutorials/) - 官方教程

### 推荐阅读
- [LangGraph 核心概念](https://langchain-ai.github.io/langgraph/concepts/)
- [多 Agent 系统](https://langchain-ai.github.io/langgraph/concepts/multi_agent/)

---

## 🔧 常见问题

### Q1: 什么时候用 LangChain，什么时候用 LangGraph？

**用 LangChain:**
- 单次 LLM 调用
- 简单的链式调用（A → B → C）
- 不需要状态管理

**用 LangGraph:**
- 多步骤工作流
- 需要人工介入
- 需要条件分支或循环
- 需要 Agent 协作

### Q2: 状态存在哪里？

- **内存:** 默认存储在内存中（适合单次会话）
- **持久化:** 可以使用 checkpointer 持久化到数据库（适合长时间工作流）

```typescript
import { MemorySaver } from '@langchain/langgraph';

const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// 现在可以保存和恢复状态
const threadId = 'user-123';
const result = await graph.invoke(initialState, {
  configurable: { thread_id: threadId },
});

// 稍后恢复
const resumed = await graph.invoke(null, {
  configurable: { thread_id: threadId },
});
```

### Q3: 如何调试？

```typescript
// 1. 查看状态快照
const snapshot = await graph.getState(threadId);
console.log('当前状态:', snapshot.values);

// 2. 查看执行历史
const history = await graph.getStateHistory(threadId);
for (const state of history) {
  console.log(`步骤 ${state.values.currentStep}:`, state.values);
}
```

---

**创建时间:** 2026-03-17
**作者:** Claude
**适用人群:** 想学习 LangChain + LangGraph 的开发者
