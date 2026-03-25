---
phase: 03-agent
plan: 03
subsystem: agent-integration
completed_at: "2026-03-25"
duration: 15
tasks_completed: 2
tasks_total: 2
key-decisions:
  - 在 BUILTIN_PROMPT_TEMPLATES 中注册分镜设计 Agent，保持与其他 Agent 一致的注册模式
  - LangGraph Node 重构为调用 runStoryboardArtistAgent，移除内联的 LLM/图像生成/sharp 切割逻辑
  - 导演模式 humanApproval 简化为一次确认（Agent 内部完成完整流程）
tech-stack:
  added: []
  patterns:
    - 三层提示词架构（EDITABLE + LOCKED + DYNAMIC）
    - Agent 与 Node 分离模式
key-files:
  created: []
  modified:
    - src/shared/constants/promptTemplates.ts
    - src/main/ai/workflows/nodes/storyboard-artist.ts
---

# Phase 03 Plan 03: 注册 BUILTIN_PROMPT_TEMPLATES 并重构 LangGraph Node 总结

## 一句话总结

在 BUILTIN_PROMPT_TEMPLATES 中注册分镜设计 Agent，并重构 LangGraph Node 以调用新的 Agent 实现，支持导演模式 humanApproval。

## 任务执行记录

### Task 1: 在 BUILTIN_PROMPT_TEMPLATES 中注册分镜设计 Agent

**状态**: 完成

**修改内容**:
- 在 `src/shared/constants/promptTemplates.ts` 中添加分镜设计 Agent 提示词导入
- 在 `BUILTIN_PROMPT_TEMPLATES` 数组中添加分镜设计 Agent 条目

**关键代码**:
```typescript
// 导入分镜设计 Agent 提示词
import {
  STORYBOARD_ARTIST_AGENT_EDITABLE_PART,
  STORYBOARD_ARTIST_AGENT_LOCKED_PART,
  STORYBOARD_ARTIST_AGENT_USER_PROMPT_TEMPLATE,
  STORYBOARD_ARTIST_AGENT_BUILTIN_TEMPLATE,
} from './storyboardArtistTemplates';

// BUILTIN_PROMPT_TEMPLATES 数组条目
{
  agentId: 'storyboard-artist-agent',
  agentName: '分镜设计 Agent',
  agentDescription: '根据剧本和角色参考图，生成 5x5 分镜网格图和 25 张单帧图',
  templateId: 'builtin-storyboard-artist-v1',
  name: '内置默认模板 v1',
  editablePart: STORYBOARD_ARTIST_AGENT_EDITABLE_PART,
  lockedPart: STORYBOARD_ARTIST_AGENT_LOCKED_PART,
  userPromptTemplate: STORYBOARD_ARTIST_AGENT_USER_PROMPT_TEMPLATE,
  get systemPrompt() {
    return `${this.editablePart}\n\n${this.lockedPart}`;
  },
},
```

**提交**: `281e247` - feat(03-agent-03): 在 BUILTIN_PROMPT_TEMPLATES 中注册分镜设计 Agent

### Task 2: 重构 LangGraph Node 调用 runStoryboardArtistAgent

**状态**: 完成

**修改内容**:
- 更新文件头注释，说明 Node 职责变更
- 添加 `runStoryboardArtistAgent` 和 `StoryboardArtistResult` 导入
- 移除旧的 LLM 调用、图像生成、sharp 切割等内联逻辑
- 调用 `runStoryboardArtistAgent` 处理完整的分镜生成流程
- 添加导演模式 `humanApproval = false` 逻辑

**关键代码**:
```typescript
import { runStoryboardArtistAgent, type StoryboardArtistResult } from '../../agents/storyboard-artist';

// 调用分镜设计 Agent
const storyboardResult = await runStoryboardArtistAgent(
  {
    artDirectorOutput: artDirectorOutput,
    castingDirectorOutput: castingDirectorOutput,
    scriptContent: typeof scriptContent === 'string' ? scriptContent : JSON.stringify(scriptContent),
    videoSpec: {
      aspectRatio: state.videoSpec?.aspectRatio || '9:16',
      duration: state.videoSpec?.duration || 15,
    },
  },
  {
    modelId: state.agentModelAssignments?.['storyboard-artist-agent'],
  },
  {
    info: (msg: string, meta?: any) => console.log(msg, meta),
  }
);

// 导演模式 humanApproval
if (state.executionMode === 'director') {
  updates.humanApproval = false;
}
```

**提交**: `dca982b` - feat(03-agent-03): 重构 LangGraph Node 调用 runStoryboardArtistAgent

## 偏差记录

### 预存问题（非本计划引入）

**问题**: `src/shared/constants/castingDirectorTemplates.ts` 第84行包含 Unicode 框线字符，导致 TypeScript 编译错误

**影响**: 这是项目已存在的技术债务，不影响本计划修改的文件功能

**处理**: 不处理（超出本计划范围）

## 验证结果

| 检查项 | 状态 | 说明 |
|--------|------|------|
| BUILTIN_PROMPT_TEMPLATES 注册 | 通过 | grep 确认 storyboard-artist-agent 已注册 |
| Node 重构 | 通过 | grep 确认 runStoryboardArtistAgent 已导入和调用 |
| humanApproval 逻辑 | 通过 | grep 确认导演模式逻辑已添加 |
| 代码风格一致性 | 通过 | 与其他 Agent 注册模式一致 |

## 文件变更统计

| 文件 | 变更类型 | 行数变化 |
|------|----------|----------|
| src/shared/constants/promptTemplates.ts | 修改 | +21 |
| src/main/ai/workflows/nodes/storyboard-artist.ts | 修改 | -162（简化） |

## 后续工作

- Phase 3 已完成（03-01、03-02、03-03 全部完成）
- 可进入 Phase 4：摄像师 Agent 重构

## Self-Check: PASSED

- [x] 修改的文件存在且内容正确
- [x] 提交记录存在（281e247, dca982b）
- [x] BUILTIN_PROMPT_TEMPLATES 包含分镜设计 Agent 条目
- [x] storyboard-artist.ts Node 调用 runStoryboardArtistAgent
- [x] 导演模式 humanApproval 逻辑已添加
