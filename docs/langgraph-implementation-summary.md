# LangGraph 状态机框架实现总结

## 已完成的工作

### 1. 依赖安装
- ✅ @langchain/core
- ✅ @langchain/community
- ✅ @langchain/langgraph
- ✅ sqlite-vec
- ✅ uuid
- ✅ @types/uuid

### 2. 目录结构
```
src/main/
├── langgraph/
│   ├── state.ts          # 状态定义
│   ├── graph.ts          # 状态图定义
│   ├── index.ts          # 模块导出
│   ├── taskManager.ts    # 任务进度管理
│   └── nodes/
│       ├── scriptNode.ts     # 脚本生成节点
│       ├── characterNode.ts  # 角色设定节点
│       ├── storyboardNode.ts # 分镜生成节点
│       └── videoNode.ts      # 视频生成节点
├── models/
│   ├── llm/
│   │   └── doubao.ts    # 火山引擎豆包 LLM 适配器
│   └── embeddings/
│       └── doubao.ts    # 火山引擎豆包 Embeddings 适配器
└── rag/
    └── vectorStore.ts   # 向量存储（SQLite + sqlite-vec）
```

### 3. 核心实现

#### 3.1 状态定义 (state.ts)
- ✅ GraphState 定义（包含脚本、角色、分镜、视频等状态）
- ✅ TypeScript 类型定义（Script, Character, StoryboardScene, VideoOutput 等）
- ✅ 节点名称常量（NodeNames）

#### 3.2 状态图 (graph.ts)
- ✅ 创建工作流（createWorkflow）
- ✅ 编译应用（langgraphApp）
- ✅ 路由决策函数（routeAfterScript, routeAfterCharacter 等）
- ✅ 初始状态工厂函数（createInitialState, createDirectorState）

#### 3.3 节点实现 (nodes/*.ts)
- ✅ scriptNode - 脚本生成（TODO: 调用豆包 LLM API）
- ✅ characterNode - 角色设定（TODO: 调用豆包 Vision API）
- ✅ storyboardNode - 分镜生成（TODO: 调用豆包 Vision API）
- ✅ videoNode - 视频生成（TODO: 调用火山视频 API）

#### 3.4 火山引擎适配器
- ✅ DoubaoLLM - LLM 适配器（支持文本生成）
- ✅ DoubaoEmbeddings - Embeddings 适配器（支持向量化）
- ✅ 环境变量配置（VOLCANO_ENGINE_API_KEY）

#### 3.5 向量存储 (vectorStore.ts)
- ✅ VectorStore 类
- ✅ 文档添加（addDocument, addDocuments）
- ✅ 相似度搜索（similaritySearch）
- ✅ 文档管理（getDocument, deleteDocument, clear）
- ✅ SQLite + sqlite-vec 集成

#### 3.6 任务管理 (taskManager.ts)
- ✅ AITaskProgress 接口
- ✅ 创建任务进度（createAITaskProgress）
- ✅ 更新任务进度（updateAITaskProgress）
- ✅ 获取任务进度（getAITaskProgress）
- ✅ 清理已完成任务（clearCompletedAITaskProgress）

### 4. 数据库扩展
- ✅ 添加迁移版本 2
- ✅ AI 脚本表（ai_scripts）
- ✅ AI 角色表（ai_characters）
- ✅ AI 分镜表（ai_storyboard_scenes）
- ✅ AI 视频表（ai_videos）
- ✅ 知识库文档表（knowledge_documents）

## 工作流程

### 脚本生成流程
1. 用户提供需求、风格、数量
2. ScriptNode 调用豆包 LLM API 生成脚本
3. 返回脚本列表，等待用户选择
4. 用户选择脚本并配置视频参数

### 导演模式流程
1. 用户从待产库选择脚本
2. CharacterNode 生成角色设定和概念图
3. StoryboardNode 生成分镜矩阵
4. VideoNode 渲染最终视频
5. 返回视频 URL

### 知识库检索
1. 上传实机转化视频 + 文案
2. DoubaoEmbeddings 生成向量
3. VectorStore 存储到 SQLite
4. ScriptNode 检索相似内容优化生成

## 后续工作

### 需要实现的功能
1. **完善 ScriptNode**
   - 集成豆包 LLM API
   - 实现 RAG 检索优化
   - 添加重试机制

2. **完善 CharacterNode**
   - 集成豆包 Vision API
   - 生成角色概念图
   - 支持角色调整

3. **完善 StoryboardNode**
   - 集成豆包 Vision API
   - 生成分镜图像
   - 支持分镜编辑

4. **完善 VideoNode**
   - 集成火山视频 API
   - 实现异步任务队列
   - 进度跟踪

5. **IPC 通信接口**
   - script:generate - 脚本生成
   - director:start - 导演模式启动
   - knowledge:upload - 知识库上传
   - task:progress - 任务进度查询

6. **前端 UI 集成**
   - 脚本生成界面
   - 导演模式界面
   - 知识库管理界面

## 技术要点

### 1. LangGraph 状态机
- 使用 Annotation API 定义状态
- 使用 StateGraph 创建工作流
- 条件边实现动态路由
- 节点函数异步执行

### 2. 火山引擎 API
- LLM API：https://ark.cn-beijing.volces.com/api/v3/chat
- Embeddings API：https://ark.cn-beijing.volces.com/api/v3/embeddings
- Video API：待集成
- 认证方式：Bearer Token

### 3. SQLite + sqlite-vec
- 使用 better-sqlite3 作为数据库
- sqlite-vec 扩展实现向量存储
- 支持余弦相似度搜索
- 批处理优化性能

### 4. 错误处理
- try-catch 捕获节点错误
- 错误状态持久化
- 自动重试机制（maxRetry）

## 测试验证
- ✅ TypeScript 编译通过
- ✅ 目录结构正确
- ✅ 依赖安装成功
- ⏳ 功能测试（待实现）

## 注意事项

1. **环境变量**
   - 需要设置 VOLCANO_ENGINE_API_KEY
   - 在 .env 文件中配置

2. **sqlite-vec 扩展**
   - 需要在数据库初始化时加载
   - 可能需要编译原生模块

3. **API 限流**
   - 火山引擎 API 有调用频率限制
   - 需要实现请求队列

4. **错误重试**
   - 网络错误自动重试
   - API 错误记录日志

## 完成时间
2026-03-16

## 任务状态
✅ 任务 #3 - 搭建 LangGraph 状态机框架 - 已完成
