# A 面视频生产 UI 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 根据 UI 重构设计文档，重构 A 面视频生产的 4 个步骤页面，实现传送带动画、拼音搜索、新的剧本生成布局、快速合成和导演模式。

**Architecture:** 使用统一的 StepLayout 组件提供一致的导航体验，分四个阶段逐步重构：基础组件 → Step 1-3 重构 → 快速合成 → 导演模式。

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, pinyin (拼音搜索), React Flow (节点编辑器)

---

## Phase 1: 基础组件 (Task 1-2)

### Task 1: 创建 StepLayout 组件

**Files:**
- Create: `src/renderer/pages/ASide/components/StepLayout/index.tsx`
- Create: `src/renderer/pages/ASide/components/StepLayout/StepHeader.tsx`
- Test: `src/renderer/pages/ASide/components/StepLayout/__tests__/StepLayout.test.tsx`

**实施步骤:**

1. 编写测试用例
2. 运行测试验证失败
3. 实现 StepLayout 组件（包含顶部工具栏、内容区、底部导航）
4. 实现 StepHeader 子组件（显示标题、步骤指示器、待产库）
5. 运行测试验证通过
6. 提交代码

**关键实现点:**
- 支持 `nextButtons` prop 用于自定义下一步按钮（快速合成/导演模式）
- 只有步骤 3-4 才显示待产库入口（通过 `showLibrary && stepNumber >= 3` 判断）
- 使用 Tailwind CSS 实现渐变按钮和粘性布局

---

### Task 2: 更新 asideStore 添加导航方法

**Files:**
- Modify: `src/renderer/stores/asideStore.ts`
- Test: `src/renderer/stores/__tests__/asideStore.test.ts`

**实施步骤:**

1. 在 ASideView 类型中确认 `quick-compose` 和 `director-mode` 视图
2. 实现 `goToNextStep()` 方法按顺序导航步骤
3. 实现 `goToPrevStep()` 方法返回上一步
4. 编写导航测试
5. 提交代码

---

## Phase 2: Step 1-3 重构 (Task 3-11)

### Task 3: 安装 pinyin 包

**命令:** `npm install pinyin @types/pinyin`

---

### Task 4: 实现区域搜索 Hook

**Files:**
- Create: `src/renderer/pages/ASide/hooks/useRegionSearch.ts`
- Test: `src/renderer/pages/ASide/hooks/__tests__/useRegionSearch.test.ts`

**功能要求:**
- 支持中文匹配（"北" → 北京）
- 支持全拼匹配（"beijing" → 北京）
- 支持首字母匹配（"bj" → 北京）
- 不区分大小写

---

### Task 5: 重构 RegionSelector 组件

**Files:**
- Modify: `src/renderer/pages/ASide/components/RegionSelector/index.tsx`
- Create: `src/renderer/pages/ASide/components/RegionSelector/RegionSearch.tsx`
- Create: `src/renderer/pages/ASide/components/RegionSelector/RecentRegions.tsx`

**关键功能:**
1. 搜索框居中显示，支持拼音搜索
2. 显示最近 10 次选择的地区（存储在 localStorage）
3. 按热门/其他分组显示地区
4. 使用 StepLayout 包裹

---

### Task 6: 实现传送带动画 CSS

**Files:**
- Modify: `src/renderer/styles/conveyor.css`

**CSS 关键帧:**
```css
@keyframes conveyor-belt {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.conveyor-row {
  animation: conveyor-belt 30s linear infinite;
}

.conveyor-row:hover {
  animation-play-state: paused;
}
```

---

### Task 7: 重构 CreativeDirectionSelector 组件

**Files:**
- Modify: `src/renderer/pages/ASide/components/CreativeDirectionSelector/index.tsx`
- Create: `src/renderer/pages/ASide/components/CreativeDirectionSelector/ConveyorBelt.tsx`

**关键功能:**
1. 传送带动画展示创意方向卡片
2. 视图切换按钮（卡片视图/列表视图）
3. 左上角返回项目库按钮
4. 使用 StepLayout 包裹

---

### Task 8: 重构 ScreenplayGenerator 布局

**Files:**
- Modify: `src/renderer/pages/ASide/components/ScreenplayGenerator/index.tsx`
- Modify: `src/renderer/pages/ASide/components/PersonaManager/index.tsx`

**布局调整:**
1. 上半部分：左侧控制栏（模型、数量、生成按钮）+ 右侧人设管理
2. 下半部分：生成的剧本列表
3. 底部导航：两个按钮（快速合成、导演模式）
4. 右上角：添加人设按钮、待产库入口

---

## Phase 3: 快速合成 (Task 12-16)

### Task 12-15: QuickCompose 组件

**Files:**
- Create: `src/renderer/pages/ASide/components/QuickCompose/index.tsx`
- Create: `src/renderer/pages/ASide/components/QuickCompose/QuickComposeCard.tsx`

**关键功能:**
1. 显示待产库中的剧本列表
2. 每个剧本独立模型选择
3. 底部统一模型选择器
4. 批量生成功能
5. 预览和保存/重新生成

---

## Phase 4: 导演模式 (Task 17-22)

### Task 17-19: AgentChat 工作流

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx`

**Agent 工作流:**
1. 艺术总监 → 确认视频长度和方向
2. 选角导演 → 生成角色
3. 分镜师 → 生成关键帧
4. 摄像导演 → 生成分镜视频
5. 合成成片

---

### Task 20-21: DirectorCanvas 画板

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/CanvasPanel.tsx`
- Consider: 安装 React Flow 库

**画板功能:**
1. 类似脑图的节点编辑器
2. 人物卡片 + 关系箭头
3. 分镜图（N×M 网格）
4. 每个卡片支持编辑和重新生成

---

## 实施顺序

1. ✅ Phase 1 完成（基础组件）
2. ✅ Phase 2 完成（Step 1-3 重构）
3. ⏳ Phase 3（快速合成）- 待实施
4. ⏳ Phase 4（导演模式）- 待实施

---

**注:** 完整的详细步骤请参考设计文档 `docs/plans/2026-03-17-aside-video-production-redesign-design.md`
