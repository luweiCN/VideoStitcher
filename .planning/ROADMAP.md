# Roadmap: Agent 提示词重构

## Phase 1: 艺术总监 Agent 重构 ✅

**Goal:** 将艺术总监 Agent 的提示词改造成三层架构（EDITABLE + LOCKED + DYNAMIC），使其可以在 PromptStudio 中自定义。

**Requirements:** ARTDIR-01, ARTDIR-02, ARTDIR-03, ARTDIR-04, ARTDIR-05

**Success Criteria:**
1. `artDirectorTemplates.ts` 文件创建，包含三层提示词
2. `art-director/` Agent 目录创建，实现完整的 Agent 调用逻辑
3. `BUILTIN_PROMPT_TEMPLATES` 已注册艺术总监 Agent
4. PromptStudio 能正确展示艺术总监 Agent 的编辑界面
5. 工作流能正常调用新的艺术总监 Agent

**Plans:**
- [x] 01-01-PLAN.md — 艺术总监 Agent 三层架构重构（5 tasks）

---

## Phase 2: 选角导演 Agent 重构 ✅

**Goal:** 将选角导演 Agent 的提示词改造成三层架构，同时修正当前实现缺陷（直接透传改为 AI 生成图像提示词）。

**Requirements:** CAST-01, CAST-02, CAST-03, CAST-04, CAST-05

**Success Criteria:**
1. `castingDirectorTemplates.ts` 文件创建，包含三层提示词
2. `casting-director/` Agent 目录创建，实现完整的 Agent 调用逻辑
3. `BUILTIN_PROMPT_TEMPLATES` 已注册选角导演 Agent
4. PromptStudio 能正确展示选角导演 Agent 的编辑界面
5. 工作流能正常调用新的选角导演 Agent（AI 生成图像提示词）
6. 导演模式支持 `humanApproval` 暂停

**Plans:**
- [x] 02-01-PLAN.md — 创建 castingDirectorTemplates.ts 三层提示词常量文件（CAST-01, CAST-02）
- [x] 02-02-PLAN.md — 创建 casting-director/index.ts Agent 实现（CAST-03）
- [x] 02-03-PLAN.md — 注册 BUILTIN_PROMPT_TEMPLATES 并重构 LangGraph Node（CAST-04, CAST-05）

---

## Phase 2.5: 选角导演多阶段架构重构 (✅ Completed)

**Goal:** 将选角导演 Agent 从单阶段拆分为多阶段架构（Planner + Visualizer），与分镜设计 Agent 保持一致。

**Requirements:** CASTM-01, CASTM-02, CASTM-03, CASTM-04, CASTM-05

**Success Criteria:**
1. `castingDirectorMultiTemplates.ts` 文件创建，包含 Planner 和 Visualizer 的提示词 ✅
2. `casting-director/index.ts` 实现多阶段调用函数 ✅
3. `BUILTIN_PROMPT_TEMPLATES` 已注册 Planner 和 Visualizer ✅
4. PromptStudio 能分别配置两个阶段 ✅
5. 工作流支持 `useMultiStage` 选项调用多阶段选角导演 ✅
6. 导演模式支持两个阶段的 `humanApproval` 暂停 ✅

**Plans:**
3/3 plans executed
- [x] 02.5-01-PLAN.md — 创建 castingDirectorMultiTemplates.ts 三层提示词常量文件（CASTM-01, CASTM-02）
- [x] 02.5-02-PLAN.md — 实现 casting-director 多阶段 Agent（CASTM-03）
- [x] 02.5-03-PLAN.md — 注册 BUILTIN_PROMPT_TEMPLATES 并更新 LangGraph Node（CASTM-04, CASTM-05）

---

## Phase 3: 分镜设计 Agent 重构 ✅

**Goal:** 将分镜设计 Agent 的提示词改造成三层架构，同时迁移图像生成和 sharp 切割逻辑到 Agent 内部。

**Requirements:** STORY-01, STORY-02, STORY-03, STORY-04, STORY-05

**Success Criteria:**
1. `storyboardArtistTemplates.ts` 文件创建，包含三层提示词（EDITABLE + LOCKED + DYNAMIC）✅
2. `storyboard-artist/` Agent 目录创建，实现完整的 Agent 调用逻辑（LLM + 图像生成 + sharp 切割）✅
3. `BUILTIN_PROMPT_TEMPLATES` 已注册分镜设计 Agent ✅
4. PromptStudio 能正确展示分镜设计 Agent 的编辑界面 ✅
5. 工作流能正常调用新的分镜设计 Agent ✅
6. 导演模式支持 `humanApproval` 暂停 ✅

**Plans:**
- [x] 03-01-PLAN.md — 创建 storyboardArtistTemplates.ts 三层提示词常量文件（STORY-01, STORY-02）
- [x] 03-02-PLAN.md — 创建 storyboard-artist/index.ts Agent 实现（STORY-03）
- [x] 03-03-PLAN.md — 注册 BUILTIN_PROMPT_TEMPLATES 并重构 LangGraph Node（STORY-04, STORY-05）

---

## Phase 4: 摄像师 Agent 重构 (In Progress)

**Goal:** 将摄像师 Agent 的提示词改造成三层架构，实现多阶段架构（Planner + Executor）。

**Requirements:** CINE-01 ~ CINE-05

**Success Criteria:**
1. `cinematographerTemplates.ts` 文件创建，包含三层提示词
2. `cinematographer/` Agent 目录创建，实现完整的 Agent 调用逻辑
3. `BUILTIN_PROMPT_TEMPLATES` 已注册摄像师 Agent
4. PromptStudio 能正确展示摄像师 Agent 的编辑界面
5. 工作流能正常调用新的摄像师 Agent
6. 支持多阶段模式（Planner + Executor）

**Plans:**
2/3 plans executed
- [x] 04-01-PLAN.md — 创建 cinematographerTemplates.ts 三层提示词常量文件（CINE-01, CINE-02）
- [x] 04-02-PLAN.md — 实现 cinematographer 多阶段 Agent（CINE-03）
- [ ] 04-03-PLAN.md — 注册 BUILTIN_PROMPT_TEMPLATES 并更新 LangGraph Node（CINE-04, CINE-05）

---

## Traceability Matrix

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| ARTDIR-01 | 1 | 01-PLAN.md | completed |
| ARTDIR-02 | 1 | 01-PLAN.md | completed |
| ARTDIR-03 | 1 | 01-PLAN.md | completed |
| ARTDIR-04 | 1 | 01-PLAN.md | completed |
| ARTDIR-05 | 1 | 01-PLAN.md | completed |
| CAST-01 | 2 | 02-01-PLAN.md | completed |
| CAST-02 | 2 | 02-01-PLAN.md | completed |
| CAST-03 | 2 | 02-02-PLAN.md | completed |
| CAST-04 | 2 | 02-03-PLAN.md | completed |
| CAST-05 | 2 | 02-03-PLAN.md | completed |
| CASTM-01 | 2.5 | 02.5-01-PLAN.md | completed |
| CASTM-02 | 2.5 | 02.5-01-PLAN.md | completed |
| CASTM-03 | 2.5 | 02.5-02-PLAN.md | completed |
| CASTM-04 | 2.5 | 02.5-03-PLAN.md | completed |
| CASTM-05 | 2.5 | 02.5-03-PLAN.md | completed |
| STORY-01 | 3 | 03-01-PLAN.md | completed |
| STORY-02 | 3 | 03-01-PLAN.md | completed |
| STORY-03 | 3 | 03-02-PLAN.md | completed |
| STORY-04 | 3 | 03-03-PLAN.md | completed |
| STORY-05 | 3 | 03-03-PLAN.md | completed |
| CINE-01 | 4 | 04-01-PLAN.md | pending |
| CINE-02 | 4 | 04-01-PLAN.md | pending |
| CINE-03 | 4 | 04-02-PLAN.md | completed |
| CINE-04 | 4 | 04-03-PLAN.md | pending |
| CINE-05 | 4 | 04-03-PLAN.md | pending |

---

*Last updated: 2026-04-01*
