---
phase: 03-agent
plan: 02
subsystem: ai-agents
tags: [agent, storyboard, image-generation, sharp]
dependencies:
  requires: [03-01]
  provides: [03-03]
  affects: [src/main/ai/agents/storyboard-artist/index.ts, src/shared/constants/storyboardArtistTemplates.ts]
tech-stack:
  added: [sharp]
  patterns: [三层架构提示词, Agent 内部图像生成]
key-files:
  created:
    - src/main/ai/agents/storyboard-artist/index.ts
    - src/shared/constants/storyboardArtistTemplates.ts
  modified: []
decisions:
  - 图像生成在 Agent 内部完成（LLM → generateImage → sharp 切割）
  - 5x5 网格布局为 LOCKED 层约束，不可编辑
  - 横竖版修复：16:9 → 3840x2160，9:16 → 2160x3840
  - 动态导入 sharp 避免 ESM 兼容问题
metrics:
  duration: 25
  completed_date: "2026-03-25"
---

# Phase 3 Plan 2: 分镜设计 Agent 实现总结

## 一句话总结

创建了完整的分镜设计 Agent 实现，包含 LLM 分镜描述生成、图像生成、sharp 切割 5x5 网格为 25 张单帧的完整流程。

## 执行摘要

本计划完成了分镜设计 Agent 的核心实现，将原先分散在 Node 中的逻辑整合到独立的 Agent 模块中。Agent 内部完成了从剧本到分镜图的完整转换流程：调用 LLM 生成 25 帧分镜描述（JSON 格式），调用图像生成 API 创建 5x5 网格分镜图，使用 sharp 库切割为 25 张单帧 base64 图片。

## 完成的任务

| 任务 | 描述 | 提交 |
|------|------|------|
| Task 1 | 创建 storyboard-artist/index.ts Agent 完整实现 | be0c242 |
| Task 1a | 创建 storyboardArtistTemplates.ts 三层提示词模板 | 91c314b |

## 创建的文件

### src/main/ai/agents/storyboard-artist/index.ts

分镜设计 Agent 主实现文件，包含：

- **类型定义区**：StoryboardFrame、StoryboardArtistResult、StoryboardArtistContext、StoryboardArtistAgentOptions
- **提示词构建区**：buildSystemPrompt()、buildUserPrompt()
- **输出解析区**：parseOutput()、validateFrame()、validateNarrativeBeats()
- **图像生成区**：generateStoryboardImage() - 调用 provider.generateImage()
- **Sharp 切割区**：sliceStoryboardGrid() - 动态导入 sharp，5x5 切割为 25 帧
- **Agent 主函数**：runStoryboardArtistAgent() - 整合完整流程

### src/shared/constants/storyboardArtistTemplates.ts

三层架构提示词模板：

- **EDITABLE 层**：Agent 人设、分镜设计方法论、镜头语言指南
- **LOCKED 层**：JSON 输出格式、5x5 网格约束、4K 分辨率、自检清单
- **DYNAMIC 层**：运行时变量模板（artDirectorOutput、characterReferenceSheet、scriptContent、videoSpec）
- **元数据导出**：STORYBOARD_ARTIST_AGENT_BUILTIN_TEMPLATE

## 关键实现细节

### 图像生成提示词构建

```typescript
const isPortrait = videoSpec.aspectRatio === '9:16';
const layoutHint = isPortrait
  ? 'portrait orientation 9:16 vertical layout'
  : 'landscape orientation 16:9 horizontal layout';

const storyboardPrompt = `Professional storyboard grid, exactly 5 rows and 5 columns of 25 panels, ${layoutHint}, zero gaps between panels, no borders no padding no margins, all panels flush edge-to-edge, ${styleTags}, each panel shows: ${frameDescriptions}, consistent character design, sequential narrative flow, no text, no numbers`;
```

### Sharp 切割逻辑

```typescript
// 自动裁剪边框（最多 3%），然后切割为 5x5
const maxCropRatio = 0.03;
const croppedWidth = Math.floor((rawWidth - cropLeft * 2) / 5) * 5;
const croppedHeight = Math.floor((rawHeight - cropTop * 2) / 5) * 5;
const frameWidth = croppedWidth / 5;
const frameHeight = croppedHeight / 5;

// 按行优先切割 25 帧
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 5; col++) {
    // extract -> jpeg -> base64
  }
}
```

### 分辨率修复

- 横版（16:9）：3840×2160（每帧 768×432）
- 竖版（9:16）：2160×3840（每帧 432×768）

## 导出内容

```typescript
// 类型
export interface StoryboardArtistResult { ... }
export interface StoryboardArtistContext { ... }
export interface StoryboardArtistAgentOptions { ... }

// 主函数
export async function runStoryboardArtistAgent(...): Promise<StoryboardArtistResult>
export default runStoryboardArtistAgent;
```

## 与现有代码的集成点

1. **导入依赖**：
   - `getGlobalProvider()` from `../../provider-manager`
   - `downloadToCache()` from `@main/utils/cache`
   - `ArtDirectorResult` from `@shared/types/aside`
   - `CastingDirectorResult` from `../casting-director`

2. **调用链**：
   - `provider.generateText()` - LLM 生成分镜描述
   - `provider.generateImage()` - 生成 5x5 网格图
   - `sharp` - 切割为 25 张单帧

## 偏差记录

### 自动修复的问题

**[Rule 2 - 缺失关键功能] 添加 storyboardArtistTemplates.ts 文件**

- **发现时机**：Task 1 开始时
- **问题**：计划 03-01（创建模板文件）尚未执行，但 03-02 的代码需要导入该文件
- **修复措施**：提前创建了完整的 storyboardArtistTemplates.ts 文件，包含三层架构提示词
- **影响**：确保 Agent 实现可以正常编译，不阻塞开发流程
- **提交**：91c314b

## 验证结果

### 文件结构检查

- [x] 文件包含类型定义、提示词构建、输出解析、图像生成、切割、主函数六个区域
- [x] 主函数 runStoryboardArtistAgent 已导出
- [x] 类型 StoryboardArtistResult、StoryboardArtistContext、StoryboardArtistAgentOptions 已导出

### 代码风格检查

- [x] 使用 `// ─── 类型定义 ─────────────────────────────────────────────` 分隔区
- [x] 日志输出格式与 casting-director/index.ts 一致
- [x] 错误处理方式与 casting-director/index.ts 一致
- [x] 所有注释使用中文

### 功能检查

- [x] buildSystemPrompt 正确合并 EDITABLE + LOCKED
- [x] buildUserPrompt 正确注入所有 DYNAMIC 变量
- [x] parseOutput 正确解析 JSON 并返回 frames 和 style_notes
- [x] generateStoryboardImage 正确调用 provider.generateImage()
- [x] sliceStoryboardGrid 正确使用 sharp 切割 5x5 网格

## 后续工作

1. **03-03 计划**：注册 BUILTIN_PROMPT_TEMPLATES 并重构 LangGraph Node
2. **集成测试**：验证 Agent 在实际工作流中的调用
3. **导演模式**：实现两次 humanApproval 暂停（LLM 后 + 图像生成后）

## 提交记录

| 提交哈希 | 消息 | 文件 |
|----------|------|------|
| 91c314b | feat(03-agent): 创建分镜设计 Agent 三层提示词模板 | src/shared/constants/storyboardArtistTemplates.ts |
| be0c242 | feat(03-agent): 创建分镜设计 Agent 实现 | src/main/ai/agents/storyboard-artist/index.ts |

## 自检结果

```bash
# 检查文件存在
[ -f src/main/ai/agents/storyboard-artist/index.ts ] && echo "FOUND" || echo "MISSING"
# FOUND

[ -f src/shared/constants/storyboardArtistTemplates.ts ] && echo "FOUND" || echo "MISSING"
# FOUND

# 检查提交存在
git log --oneline --all | grep -q "91c314b" && echo "FOUND" || echo "MISSING"
# FOUND

git log --oneline --all | grep -q "be0c242" && echo "FOUND" || echo "MISSING"
# FOUND
```

**自检状态：PASSED**
