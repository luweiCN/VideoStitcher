# Requirements: Agent 提示词重构

## v1 Requirements

### 艺术总监 Agent 重构 (Phase 1)

**ARTDIR-01**: 艺术总监 Agent 提示词拆分为三层架构
- [ ] 提取可编辑层（EDITABLE）- Agent 人设、创作方法论、风格指南
- [ ] 提取锁定层（LOCKED）- JSON 输出格式、字段定义、自检清单
- [ ] 提取动态层（DYNAMIC）- 用户提示词模板，含变量占位符

**ARTDIR-02**: 创建 `artDirectorTemplates.ts` 共享常量文件
- [ ] 文件路径: `src/shared/constants/artDirectorTemplates.ts`
- [ ] 导出 EDITABLE、LOCKED、DYNAMIC 三部分
- [ ] 导出 `ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE` 元数据对象
- [ ] 遵循与 `screenplayAgentTemplates.ts` 相同的代码风格

**ARTDIR-03**: 创建/重构艺术总监 Agent 实现目录
- [ ] 目录路径: `src/main/ai/agents/art-director/`
- [ ] 创建 `index.ts` - Agent 主函数，包含 buildSystemPrompt、buildUserPrompt、parseOutput
- [ ] 定义 `ArtDirectorResult` 接口（LLM 输出结构）
- [ ] 定义 `ArtDirectorContext` 接口（输入上下文）
- [ ] 定义 `ArtDirectorAgentOptions` 接口（调用选项）

**ARTDIR-04**: 在 `BUILTIN_PROMPT_TEMPLATES` 中注册艺术总监 Agent
- [ ] 修改 `src/shared/constants/promptTemplates.ts`
- [ ] 导入 `ART_DIRECTOR_AGENT_BUILTIN_TEMPLATE`
- [ ] 添加到 `BUILTIN_PROMPT_TEMPLATES` 数组

**ARTDIR-05**: 确保 PromptStudio 能正确展示艺术总监 Agent
- [ ] 验证 agentId、agentName、agentDescription 正确显示
- [ ] 验证 editablePart、lockedPart 分离展示
- [ ] 验证 userPromptTemplate 变量高亮

## v2 Requirements (Deferred)

- **CAST-01~05**: 选角导演 Agent 三层架构重构
- **STORY-01~05**: 分镜设计 Agent 三层架构重构
- **CINE-01~05**: 摄像师 Agent 三层架构重构

## Out of Scope

- **UI 功能扩展** — PromptStudio 只展示已有功能，本期不新增编辑功能
- **AI 模型切换** — 保持现有 provider-manager 机制，不修改
- **工作流图修改** — LangGraph 节点调用关系保持不变
- **数据库 Schema 变更** — 使用现有的表结构

## Traceability

| Req ID | Phase | Plan | Status |
|--------|-------|------|--------|
| ARTDIR-01 | 1 | TBD | pending |
| ARTDIR-02 | 1 | TBD | pending |
| ARTDIR-03 | 1 | TBD | pending |
| ARTDIR-04 | 1 | TBD | pending |
| ARTDIR-05 | 1 | TBD | pending |

---
*Last updated: 2026-03-24*
