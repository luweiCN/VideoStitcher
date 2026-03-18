# 项目卖点字段设计文档

**日期:** 2026-03-18
**状态:** 设计完成,待实施
**作者:** Claude

---

## 概述

为项目管理功能添加"卖点"字段,支持在创建和编辑项目时填写项目卖点,并在项目卡片上折叠显示。

---

## 需求

### 功能需求
1. 创建项目时可以填写卖点(可选)
2. 编辑项目时可以修改卖点(可选)
3. 项目卡片上折叠显示卖点(默认显示前50字,点击展开查看完整200字)
4. 卖点最多200字符

### 非功能需求
- 前端和后端双重验证(200字符限制)
- 符合现有架构模式
- 保持代码简洁易维护

---

## 数据层设计

### 数据库 Schema

**修改 version 3 迁移脚本** (`src/main/database/migrations/index.ts`):

#### aside_projects 表修改
- ❌ **移除字段**: `region` (移到剧本表)
- ✅ **新增字段**: `selling_point TEXT` (可为空,最多200字符)

```sql
CREATE TABLE IF NOT EXISTS aside_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL,
  selling_point TEXT,  -- 新增
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### aside_screenplays 表修改
- ✅ **新增字段**: `region TEXT DEFAULT 'universal'` (从项目表移过来)

```sql
CREATE TABLE IF NOT EXISTS aside_screenplays (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  creative_direction_id TEXT,
  persona_id TEXT,
  region TEXT DEFAULT 'universal',  -- 新增
  ai_model TEXT,
  status TEXT DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  -- ...
);
```

### 类型定义

**修改 `src/shared/types/aside.ts`:**

```typescript
export interface Project {
  id: string;
  name: string;
  gameType: GameType;
  sellingPoint?: string;  // 新增:项目卖点(可选,最多200字符)
  createdAt: string;
  updatedAt: string;
}

export interface Screenplay {
  id: string;
  projectId: string;
  content: string;
  creativeDirectionId?: string;
  personaId?: string;
  region?: string;  // 新增:从项目表移过来
  aiModel?: AIModel;
  status: ScreenplayStatus;
  estimatedDuration?: number;
  videoUrl?: string;
  createdAt: string;
}
```

---

## 业务逻辑层设计

### AsideProjectRepository 修改

**修改 `src/main/database/repositories/asideProjectRepository.ts`:**

#### 数据库行类型
```typescript
interface ProjectRow {
  id: string;
  name: string;
  game_type: string;
  selling_point: string | null;  // 新增
  created_at: number;
  updated_at: number;
}
```

#### createProject 方法
- **参数**: 添加 `sellingPoint?: string`
- **验证**: 卖点长度不超过200字符
- **SQL**: 插入 `selling_point` 字段

#### updateProject 方法
- **参数**: data 对象添加 `sellingPoint?: string`
- **验证**: 卖点长度不超过200字符
- **SQL**: 更新 `selling_point` 字段

#### mapRowToProject 方法
```typescript
private mapRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    gameType: row.game_type as GameType,
    sellingPoint: row.selling_point || undefined,  // 新增
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
```

---

## IPC 层设计

### aside-handlers.ts 修改

**修改 `src/main/ipc/aside-handlers.ts`:**

#### createProject Handler
```typescript
ipcMain.handle('aside:createProject', async (event, name, gameType, sellingPoint) => {
  try {
    const project = asideProjectRepository.createProject(name, gameType, sellingPoint);
    return { success: true, project };
  } catch (error) {
    console.error('[IPC] 创建项目失败:', error);
    return { success: false, error: (error as Error).message };
  }
});
```

#### updateProject Handler
```typescript
ipcMain.handle('aside:updateProject', async (event, id, data) => {
  try {
    const project = asideProjectRepository.updateProject(id, data);
    return { success: true, project };
  } catch (error) {
    console.error('[IPC] 更新项目失败:', error);
    return { success: false, error: (error as Error).message };
  }
});
```

---

## UI 层设计

### CreateProjectModal 修改

**修改 `src/renderer/pages/ASide/components/ProjectLibrary/CreateProjectModal.tsx`:**

- **状态**: 添加 `sellingPoint` 状态
- **验证**: 提交时验证200字符限制
- **UI**: 添加卖点多行文本输入框(3行,显示字符计数)
- **Props**: `onCreate` 回调添加 `sellingPoint` 参数

### EditProjectModal 新增

**新建 `src/renderer/pages/ASide/components/ProjectLibrary/EditProjectModal.tsx`:**

- **Props**: 接收 `project` 对象
- **状态**: 初始化为现有项目数据
- **功能**: 可修改项目名称、游戏类型、卖点
- **UI**: 与 CreateProjectModal 相同的表单结构

### ProjectCard 修改

**修改 `src/renderer/pages/ASide/components/ProjectLibrary/ProjectCard.tsx`:**

- **状态**: 添加 `isExpanded` 状态(控制卖点展开/折叠)
- **Props**: 添加 `onEdit` 回调
- **UI**:
  - 添加编辑按钮(编辑图标)
  - 卖点显示:Sparkles 图标 + 文本
  - 折叠逻辑:默认显示前50字,超过50字显示展开/收起按钮

### ProjectLibrary 主组件修改

**修改 `src/renderer/pages/ASide/components/ProjectLibrary/index.tsx`:**

- **状态**: 添加 `editingProject` 状态
- **回调**: 添加 `handleUpdate` 方法
- **渲染**: 条件渲染 EditProjectModal

---

## 实施步骤

1. 数据层
   - 修改 version 3 迁移脚本(添加 selling_point,移除 region)
   - 修改 Project 和 Screenplay 类型定义
   - 重置数据库

2. 业务逻辑层
   - 修改 AsideProjectRepository 的 createProject 方法
   - 修改 AsideProjectRepository 的 updateProject 方法
   - 修改 AsideProjectRepository 的 mapRowToProject 方法

3. IPC 层
   - 修改 createProject handler
   - 修改 updateProject handler

4. UI 层
   - 修改 CreateProjectModal(添加卖点输入)
   - 新建 EditProjectModal
   - 修改 ProjectCard(添加编辑按钮和卖点显示)
   - 修改 ProjectLibrary(集成编辑功能)

---

## 测试要点

### 功能测试
- [ ] 创建项目时可以填写卖点
- [ ] 创建项目时可以不填卖点
- [ ] 编辑项目时可以修改卖点
- [ ] 编辑项目时可以清空卖点
- [ ] 卖点超过200字符时显示错误
- [ ] 项目卡片正确显示卖点(折叠/展开)

### 边界测试
- [ ] 卖点恰好200字符
- [ ] 卖点为空字符串
- [ ] 卖点恰好51字符(需要展开按钮)
- [ ] 卖点恰好50字符(不需要展开按钮)

### 集成测试
- [ ] 创建项目后立即在卡片上看到卖点
- [ ] 编辑项目后卡片立即更新卖点
- [ ] 重启应用后卖点数据持久化

---

## 风险评估

**风险等级:** 低

**原因:**
- 功能简单,修改范围明确
- 不涉及复杂逻辑
- 有现成模式可参考(CreateProjectModal)

**缓解措施:**
- 前后端双重验证
- 完整的测试覆盖
- 保持代码风格一致

---

## 时间估算

- 数据层修改: 15分钟
- 业务逻辑层修改: 15分钟
- IPC 层修改: 5分钟
- UI 层修改: 30分钟
- 测试验证: 15分钟

**总计:** 约 1.5 小时

---

## 备注

- region 字段从项目表移到剧本表,符合业务逻辑(一个项目可以有不同区域的剧本)
- 卖点字段设计为可选,不影响现有项目
- 折叠显示避免项目卡片过长
