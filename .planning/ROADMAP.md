# Roadmap: Agent 提示词重构

## Phase 1: 艺术总监 Agent 重构

**Goal:** 将艺术总监 Agent 的提示词改造成三层架构（EDITABLE + LOCKED + DYNAMIC），使其可以在 PromptStudio 中自定义。

**Requirements:** ARTDIR-01, ARTDIR-02, ARTDIR-03, ARTDIR-04, ARTDIR-05

**Success Criteria:**
1. `artDirectorTemplates.ts` 文件创建，包含三层提示词
2. `art-director/` Agent 目录创建，实现完整的 Agent 调用逻辑
3. `BUILTIN_PROMPT_TEMPLATES` 已注册艺术总监 Agent
4. PromptStudio 能正确展示艺术总监 Agent 的编辑界面
5. 工作流能正常调用新的艺术总监 Agent

---

## Phase 2: 选角导演 Agent 重构 (Deferred)

**Goal:** 将选角导演 Agent 的提示词改造成三层架构。

**Requirements:** CAST-01 ~ CAST-05

---

## Phase 3: 分镜设计 Agent 重构 (Deferred)

**Goal:** 将分镜设计 Agent 的提示词改造成三层架构。

**Requirements:** STORY-01 ~ STORY-05

---

## Phase 4: 摄像师 Agent 重构 (Deferred)

**Goal:** 将摄像师 Agent 的提示词改造成三层架构。

**Requirements:** CINE-01 ~ CINE-05

---

## Traceability Matrix

| Requirement | Phase | Success Criteria |
|-------------|-------|------------------|
| ARTDIR-01 | 1 | 提示词分层完成 |
| ARTDIR-02 | 1 | 共享常量文件创建 |
| ARTDIR-03 | 1 | Agent 实现目录创建 |
| ARTDIR-04 | 1 | BUILTIN_PROMPT_TEMPLATES 注册 |
| ARTDIR-05 | 1 | PromptStudio 展示验证 |

---

*Last updated: 2026-03-24*
