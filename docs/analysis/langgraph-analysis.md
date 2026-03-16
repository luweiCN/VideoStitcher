# 现有 LangGraph 代码分析报告

> 检查项目中现有的 LangGraph 代码是否符合 A 面视频生产需求

---

## 🔍 发现的情况

### 1. 现有 LangGraph 代码

**位置:** `src/main/langgraph/`

**包含内容:**
```typescript
// 状态定义
interface Script {
  id: string;
  text: string;
  style: string;  // 幽默、悬疑、搞笑、教学、解说
  createdAt: number;
}

interface VideoConfig {
  length: number;  // 视频时长
  ratio: '16:9' | '9:16' | '1:1';
}

interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

interface StoryboardScene {
  id: string;
  sceneNumber: number;
  description: string;
  imageUrl?: string;
  duration?: number;
}

interface VideoOutput {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}
```

**工作流节点:**
- scriptNode - 脚本生成
- characterNode - 角色设定
- storyboardNode - 分镜生成
- videoNode - 视频生成

### 2. 使用情况

**检查结果:** ❌ **没有被使用**

```bash
# 搜索引用
$ grep -r "langgraphApp\|createWorkflow" src/main --exclude-dir="langgraph"
# 结果：无任何引用
```

**当前 A 面实现:**
```typescript
// src/main/ipc/aside-handlers.ts
async function handleGenerateScripts(data) {
  // 直接调用 Repository，生成 mock 数据
  const scripts = asideScriptRepository.generateScripts(data);
  return { success: true, scripts };
}
```

### 3. LangChain 代码

**位置:** `src/main/models/`

**包含内容:**
```typescript
// src/main/models/llm/doubao.ts
// 豆包大模型封装

// src/main/models/embeddings/doubao.ts
// 豆包 Embeddings 封装
```

**使用情况:** ❌ **也没有被使用**（RAG 功能暂未集成）

---

## ⚠️ 关键问题

### 问题 1: 架构不匹配

**现有 LangGraph 设计:**
```
用户需求 → 脚本生成 → 角色设定 → 分镜 → 视频
```
- 面向：通用的 AI 视频生成流程
- 状态：包含 `userRequirement`、`selectedStyle` 等通用字段

**A 面需求设计:**
```
项目 → 创意方向 → 人设 → 脚本生成 → 待产库 → 快速生成/导演模式
```
- 面向：游戏视频生产（麻将/扑克/赛车）
- 状态：包含 `projectId`、`creativeDirectionId`、`personaId`、`executionMode` 等

### 问题 2: 字段不一致

**现有 LangGraph 状态字段:**
```typescript
{
  userRequirement: string;
  selectedStyle: string;
  batchSize: number;
  scripts: Script[];
  selectedScriptId: string | null;
  videoConfig: VideoConfig | null;
  characters: Character[];
  storyboard: StoryboardScene[];
  videos: VideoOutput[];
}
```

**A 面需求的状态字段:**
```typescript
{
  projectId: string;
  creativeDirection: CreativeDirection;
  persona: Persona;
  scriptContent: string;
  executionMode: 'fast' | 'director';
  videoSpec: { duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' };

  step1_script?: Script;
  step2_characters?: CharacterCard[];
  step3_storyboard?: StoryboardFrame[];
  step4_video?: Video;

  currentStep: number;
  humanApproval: boolean;
  userModifications: any;
}
```

### 问题 3: 功能缺失

**缺失的关键功能:**
1. ❌ 没有项目级别的上下文（游戏类型、创意方向、人设）
2. ❌ 没有导演模式的暂停/恢复机制
3. ❌ 没有用户修改步骤输出的能力
4. ❌ 没有重新生成单个步骤的功能
5. ❌ 没有快速生成模式和导演模式的切换

---

## ✅ 解决方案

### 方案 1: 重构现有 LangGraph（推荐）

**优点:**
- ✅ 保留已有代码
- ✅ 符合项目架构
- ✅ 最小改动

**步骤:**
1. 更新 `state.ts` 以匹配 A 面需求
2. 更新节点实现以支持火山引擎 API
3. 添加条件边以支持导演模式暂停
4. 添加执行器支持恢复和重新生成

**工作量:** 中等（2-3 天）

### 方案 2: 创建新的 LangGraph（清晰）

**优点:**
- ✅ 干净的实现
- ✅ 完全符合需求
- ✅ 不影响现有代码

**步骤:**
1. 创建 `src/main/langgraph/aside/` 目录
2. 按照新设计实现完整工作流
3. 保留旧代码作为参考

**工作量:** 中等（2-3 天）

### 方案 3: 完全重写（不推荐）

**缺点:**
- ❌ 浪费已有工作
- ❌ 工作量大

---

## 🎯 我的建议

**采用方案 1（重构现有代码）+ 保留旧的作为参考**

### 理由

1. **现有代码有价值:**
   - ✅ 已经有 4 个 Agent 节点的骨架
   - ✅ 已经有工作流图的编译
   - ✅ 已经有豆包 LLM 封装

2. **改动可控:**
   - 主要是更新状态定义和节点实现
   - 不需要从头开始

3. **保持清晰:**
   - 可以将旧代码移到 `langgraph/legacy/` 作为参考
   - 新代码放在 `langgraph/aside/`

### 实施步骤

```
1. 移动现有代码
   src/main/langgraph/ → src/main/langgraph/legacy/

2. 创建新的 A 面工作流
   src/main/langgraph/aside/
   ├── state.ts           # A 面状态定义
   ├── nodes/             # 4 个 Agent
   ├── graph.ts           # 工作流图
   └── executor.ts        # 执行器

3. 复用 LangChain 代码
   src/main/models/llm/doubao.ts  # 已有，直接使用
   src/main/api/volcano-client.ts # 已有，直接使用

4. 删除 mock 实现
   src/main/database/repositories/asideScriptRepository.ts
   // 删除 generateMockContent() 方法
```

---

## 📊 工作量评估

| 任务 | 工作量 | 优先级 |
|------|--------|--------|
| 重构 LangGraph 状态 | 2 小时 | P0 |
| 实现 4 个 Agent 节点 | 8 小时 | P0 |
| 添加导演模式支持 | 4 小时 | P0 |
| 集成火山引擎 API | 4 小时 | P0 |
| 测试和调试 | 4 小时 | P1 |
| **总计** | **22 小时（约 3 天）** | - |

---

## 🚀 下一步行动

**建议立即开始:**
1. ✅ 创建 `src/main/langgraph/aside/` 目录
2. ✅ 按照新计划实现状态和节点
3. ✅ 集成火山引擎 API
4. ✅ 添加到 IPC 处理器

**或者:**
1. 使用 `superpowers:subagent-driven-development`
2. 按照 `docs/plans/2026-03-17-ai-integration-implementation.md` 执行
3. 每个任务完成后自动审查和测试

---

**创建时间:** 2026-03-17
**结论:** 现有 LangGraph 是遗留代码，不符合 A 面需求，需要重构
