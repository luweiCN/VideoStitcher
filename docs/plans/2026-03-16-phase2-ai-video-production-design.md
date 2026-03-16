# VideoStitcher 第二阶段设计文档

## 产品定位

**AI 驱动的营销视频批量生产工具**

通过 LangGraph 状态机自动编排多个 AI Agent，实现从脚本生成到视频导出的完整批量生产流程。

## 核心功能（完整 A 面）

### 1. 脚本批量生成
- 选择风格（幽默、悬疑、搞笑、教学、解说）
- 配置参数（地区、产品名、数量）
- AI 批量生成文案（3/5/10 条）
- 编辑/重新生成单条
- 存入待产库

### 2. 导演模式（精细化创作）
- 从待产库选择一条脚本
- 配置视频规格（时长、横竖版）
- 生成人物设定 + 概念图
- 生成分镜矩阵
- 渲染最终视频

### 3. 知识库上传
- 上传实机转化视频 + 文案
- AI 分析素材特征（向量化）
- 学习高转化文案结构
- 应用到新脚本生成

---

## 技术架构

### 单体 Electron + LangGraph 嵌入式

```
Electron App (主进程 - Node.js)
├── Renderer 进程 (React UI)
│   ├── A 面制作界面
│   ├── 导演模式画布
│   └── 知识库管理
├── LangGraph 状态机
│   ├── ScriptNode → 豆包 LLM API
│   ├── CharacterNode → 豆包 Vision API
│   ├── StoryboardNode → 豆包 Vision API
│   └── VideoNode → 火山视频 API
├── RAG 服务
│   ├── SQLite + sqlite-vec
│   └── DoubaoEmbeddings
└── 文件管理
    ├── 项目存储
    └── 视频缓存
```

### 关键技术栈

- **前端**: React + Vite + Tailwind CSS + Electron
- **后端**: LangGraph.js + LangChain + Node.js (嵌入主进程)
- **向量数据库**: SQLite + sqlite-vec
- **AI API**: 火山引擎（豆包 LLM + Vision + Video + Audio）
- **状态管理**: Zustand (前端) + LangGraph State (后端)

---

## LangGraph 状态机设计

```typescript
// 状态定义
{
  // 用户输入
  userRequirement: string;
  selectedStyle: string;
  batchSize: number;

  // 脚本生成
  scripts: Array<{ id, text, style }>;
  selectedScript: string;

  // 导演模式
  videoConfig: { length, ratio };
  characters: Array<{ id, name, description, imageUrl }>;
  storyboard: Array<{ id, sceneNumber, description, imageUrl }>;

  // 视频输出
  videos: Array<{ id, url, status, progress }>;

  // 知识库
  knowledgeBaseResults: Array<{ id, similarity, content }>;
}

// 状态图
ScriptNode (脚本生成) → END (等待用户选择)
CharacterNode (人物设定) → StoryboardNode (分镜)
StoryboardNode → VideoNode (视频渲染)
VideoNode → END
```

---

## 火山引擎模型适配器

```typescript
// LLM 适配器
class DoubaoLLM extends BaseLLM {
  async _generate(prompts: string[]): Promise<LLMResult> {
    // 调用豆包大模型 API
    return await fetch('https://ark.cn-beijing.volces.com/api/v3/chat', ...);
  }
}

// Embeddings 适配器
class DoubaoEmbeddings extends Embeddings {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    // 调用豆包 Embeddings API
  }
}

// 视频模型适配器
class VolcanoVideoModel {
  async generateVideo(params): Promise<{ taskId }> {
    // 调用火山视频生成 API
  }

  async queryTaskStatus(taskId): Promise<{ status, progress, videoUrl }> {
    // 查询任务状态
  }
}
```

---

## 前端 UI 设计

### 保持 Demo 交互风格

**1. A 面制作界面**
- 左侧配置面板（风格选择、参数配置）
- 右侧结果展示区（脚本列表、编辑、待产库）
- 顶部导航（返回、主题切换、待产库入口）

**2. 导演模式界面**
- 分屏布局：左侧对话 + 右侧画布
- 画布支持节点拖拽、缩放、连接
- 对话历史记录

**3. 知识库上传界面**
- 文件上传区域（支持视频 + 文案）
- AI 分析进度显示
- 素材列表管理

---

## IPC 通信设计

```typescript
// 脚本生成
ipcMain.handle('script:generate', async (event, params) => {
  return await langgraphApp.invoke({
    userRequirement: params.requirement,
    selectedStyle: params.style,
    batchSize: params.count,
  });
});

// 导演模式
ipcMain.handle('director:start', async (event, scriptId) => {
  return await langgraphApp.invoke({
    selectedScript: scriptId,
    videoConfig: params.config,
  });
});

// 知识库
ipcMain.handle('knowledge:upload', async (event, files) => {
  return await uploadToKnowledgeBase(files);
});
```

---

## 开发计划

### 阶段 1：基础设施（1 周）
- 搭建 LangGraph 状态机框架
- 实现火山引擎适配器（LLM、Vision、Video）
- 配置 SQLite 向量数据库
- IPC 通信基础接口

### 阶段 2：脚本生成功能（1 周）
- 前端：风格选择 + 参数配置界面
- 后端：ScriptNode 实现 + RAG 检索
- 前端：脚本结果展示 + 待产库管理
- 集成测试

### 阶段 3：导演模式（2 周）
- 前端：导演模式 UI（对话 + 画布）
- 后端：CharacterNode + StoryboardNode + VideoNode
- 视频生成任务队列
- 进度跟踪

### 阶段 4：知识库（1 周）
- 前端：上传界面 + 素材管理
- 后端：向量化 + 检索集成
- 测试和优化

### 阶段 5：测试和打磨（1 周）
- 自动化测试
- UI 细节优化
- 性能优化
- Bug 修复

**总计：6 周**

---

## 风险和注意事项

1. **火山引擎 API 稳定性** - 需要错误重试机制
2. **视频生成时间** - 长视频可能需要 5-10 分钟，需要异步队列
3. **向量数据库性能** - 大量素材时检索速度，需要优化索引
4. **包体积** - LangChain + LangGraph 会增加打包体积，需要注意优化

---

## 团队分工

- **产品经理**：分析 Demo，输出详细 PRD，验收功能
- **设计师**：确保 UI 风格一致性，设计交互细节
- **前端工程师**：实现 React UI + Electron 集成
- **后端工程师**：实现 LangGraph 编排 + 火山引擎 API 集成
- **测试工程师**：自动化测试 + Bug 回归
