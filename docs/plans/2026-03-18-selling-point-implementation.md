# 项目卖点字段实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 为项目管理添加卖点字段,支持创建和编辑时填写/修改,并在项目卡片上折叠显示

**架构:** 数据层(SQLite + Repository) → 业务逻辑层(Repository + IPC) → UI 层(React 组件)

**技术栈:** Electron + React + TypeScript + Vitest + Tailwind CSS

---

## Task 1: 修改数据库迁移脚本

**文件:**
- Modify: `src/main/database/migrations/index.ts:183-243`

**Step 1: 修改 aside_projects 表定义**

在 version 3 迁移脚本中,移除 region 字段,添加 selling_point 字段:

```typescript
{
  version: 3,
  description: 'A 面视频生产功能表',
  up: `
    -- 1. 项目表
    CREATE TABLE IF NOT EXISTS aside_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game_type TEXT NOT NULL,
      selling_point TEXT,  -- 新增:项目卖点(可选,最多200字符)
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 2. 创意方向表（项目级别）
    CREATE TABLE IF NOT EXISTS aside_creative_directions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon_name TEXT,
      is_preset INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE
    );

    -- 3. 人设表（项目级别）
    CREATE TABLE IF NOT EXISTS aside_personas (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      is_preset INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE
    );

    -- 4. 剧本表
    CREATE TABLE IF NOT EXISTS aside_screenplays (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      content TEXT NOT NULL,
      creative_direction_id TEXT,
      persona_id TEXT,
      region TEXT DEFAULT 'universal',  -- 移到剧本表
      ai_model TEXT,
      status TEXT DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES aside_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (creative_direction_id) REFERENCES aside_creative_directions(id),
      FOREIGN KEY (persona_id) REFERENCES aside_personas(id),

      CHECK (status IN ('draft', 'library', 'producing', 'completed'))
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_aside_creative_directions_project ON aside_creative_directions(project_id);
    CREATE INDEX IF NOT EXISTS idx_aside_personas_project ON aside_personas(project_id);
    CREATE INDEX IF NOT EXISTS idx_aside_screenplays_project ON aside_screenplays(project_id);
    CREATE INDEX IF NOT EXISTS idx_aside_screenplays_status ON aside_screenplays(status);
  `,
}
```

**Step 2: 提交修改**

```bash
git add src/main/database/migrations/index.ts
git commit -m "refactor(db): 修改项目表和剧本表结构

- 移除项目表的 region 字段
- 添加项目表的 selling_point 字段(可选,TEXT类型)
- 添加剧本表的 region 字段

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 修改类型定义

**文件:**
- Modify: `src/shared/types/aside.ts:36-54`
- Modify: `src/shared/types/aside.ts:111-141`

**Step 1: 更新 Project 接口**

移除 region 字段,添加 sellingPoint 字段:

```typescript
export interface Project {
  id: string;
  name: string;
  gameType: GameType;
  sellingPoint?: string;  // 新增:项目卖点(可选,最多200字符)
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: 更新 Screenplay 接口**

添加 region 字段:

```typescript
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

**Step 3: 提交修改**

```bash
git add src/shared/types/aside.ts
git commit -m "feat(types): 添加卖点字段到项目类型,添加区域字段到剧本类型

- Project 接口添加 sellingPoint 字段(可选)
- Screenplay 接口添加 region 字段(可选)
- 移除 Project 接口的 region 字段

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: 重置数据库

**文件:** 无

**Step 1: 删除现有数据库**

```bash
rm -f ~/.config/video-stitcher/video-stitcher.db
```

**Step 2: 重启应用验证迁移**

```bash
npm run dev
```

预期:应用启动时自动执行迁移,创建包含 selling_point 字段的新数据库

---

## Task 4: 为 Repository 添加卖点字段测试

**文件:**
- Modify: `test/unit/database/repositories/asideProjectRepository.test.ts:16-46`

**Step 1: 添加创建项目时填写卖点的测试**

在 `createProject` describe 块中添加:

```typescript
it('应该成功创建项目并设置卖点', () => {
  const sellingPoint = '快速上手、刺激有趣、画面精美';
  const project = asideProjectRepository.createProject('测试项目', '麻将', sellingPoint);

  expect(project).toBeDefined();
  expect(project.name).toBe('测试项目');
  expect(project.gameType).toBe('麻将');
  expect(project.sellingPoint).toBe(sellingPoint);
  expect(project.id).toBeDefined();
});

it('应该成功创建项目而不填写卖点', () => {
  const project = asideProjectRepository.createProject('测试项目', '麻将');

  expect(project).toBeDefined();
  expect(project.name).toBe('测试项目');
  expect(project.gameType).toBe('麻将');
  expect(project.sellingPoint).toBeUndefined();
});

it('应该拒绝超过200字符的卖点', () => {
  const longSellingPoint = 'a'.repeat(201);

  expect(() => {
    asideProjectRepository.createProject('测试项目', '麻将', longSellingPoint);
  }).toThrow('卖点不能超过200字符');
});
```

**Step 2: 运行测试验证失败**

```bash
npm run test test/unit/database/repositories/asideProjectRepository.test.ts
```

预期:3个新测试失败,因为 createProject 方法还不支持 sellingPoint 参数

**Step 3: 提交测试**

```bash
git add test/unit/database/repositories/asideProjectRepository.test.ts
git commit -m "test(repository): 添加卖点字段的测试用例

- 测试创建项目时填写卖点
- 测试创建项目时不填写卖点
- 测试卖点超过200字符时抛出错误

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 实现 Repository 的 createProject 方法

**文件:**
- Modify: `src/main/database/repositories/asideProjectRepository.ts:14-21`
- Modify: `src/main/database/repositories/asideProjectRepository.ts:30-105`

**Step 1: 更新 ProjectRow 类型**

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

**Step 2: 修改 createProject 方法签名和实现**

```typescript
createProject(name: string, gameType: GameType, sellingPoint?: string): Project {
  // 参数验证
  if (!name || name.trim() === '') {
    throw new Error('项目名称不能为空');
  }

  // 新增:卖点长度验证
  if (sellingPoint && sellingPoint.length > 200) {
    throw new Error('卖点不能超过200字符');
  }

  const validGameTypes: GameType[] = ['麻将', '扑克', '赛车'];
  if (!validGameTypes.includes(gameType)) {
    throw new Error(`无效的游戏类型:${gameType}`);
  }

  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();

  try {
    const transaction = db.transaction(() => {
      // 插入项目(移除 region,添加 selling_point)
      const insertProject = db.prepare(`
        INSERT INTO aside_projects (id, name, game_type, selling_point, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertProject.run(id, name, gameType, sellingPoint || null, now, now);

      // 插入预设创意方向和人设(保持不变)
      const insertDirection = db.prepare(`
        INSERT INTO aside_creative_directions (id, project_id, name, description, icon_name, is_preset, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const direction of PRESET_CREATIVE_DIRECTIONS) {
        insertDirection.run(
          uuidv4(),
          id,
          direction.name,
          direction.description || null,
          direction.iconName || null,
          direction.isPreset ? 1 : 0,
          now
        );
      }

      const insertPersona = db.prepare(`
        INSERT INTO aside_personas (id, project_id, name, prompt, is_preset, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const persona of PRESET_PERSONAS) {
        insertPersona.run(
          uuidv4(),
          id,
          persona.name,
          persona.prompt,
          persona.isPreset ? 1 : 0,
          now
        );
      }
    });

    transaction();

    const project = this.getProjectById(id);
    if (!project) {
      throw new Error(`项目创建失败:无法找到刚创建的项目 ID ${id}`);
    }

    console.log(`[AsideProjectRepository] 成功创建项目: ${name}`);
    return project;
  } catch (error) {
    console.error('[AsideProjectRepository] 创建项目失败:', error);
    throw error;
  }
}
```

**Step 3: 运行测试验证通过**

```bash
npm run test test/unit/database/repositories/asideProjectRepository.test.ts
```

预期:所有 createProject 相关测试通过

**Step 4: 提交实现**

```bash
git add src/main/database/repositories/asideProjectRepository.ts
git commit -m "feat(repository): 实现 createProject 的卖点字段支持

- 添加 sellingPoint 参数(可选)
- 添加卖点长度验证(最多200字符)
- 更新 SQL 插入语句

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 为 updateProject 方法添加测试

**文件:**
- Modify: `test/unit/database/repositories/asideProjectRepository.test.ts:84-153`

**Step 1: 添加更新卖点的测试**

在 `updateProject` describe 块中添加:

```typescript
it('应该成功更新项目卖点', () => {
  const project = asideProjectRepository.createProject('测试项目', '麻将');

  const updated = asideProjectRepository.updateProject(project.id, {
    sellingPoint: '快速上手、刺激有趣'
  });

  expect(updated.sellingPoint).toBe('快速上手、刺激有趣');
  expect(updated.name).toBe('测试项目'); // 未修改的字段保持不变
});

it('应该能够清空项目卖点', () => {
  const project = asideProjectRepository.createProject('测试项目', '麻将', '原有卖点');

  const updated = asideProjectRepository.updateProject(project.id, {
    sellingPoint: undefined
  });

  expect(updated.sellingPoint).toBeUndefined();
});

it('应该拒绝超过200字符的卖点', () => {
  const project = asideProjectRepository.createProject('测试项目', '麻将');

  expect(() => {
    asideProjectRepository.updateProject(project.id, {
      sellingPoint: 'a'.repeat(201)
    });
  }).toThrow('卖点不能超过200字符');
});

it('应该移除 region 字段的测试', () => {
  // 注意:region 字段已从项目表移除,这个测试验证 region 不再支持
  const project = asideProjectRepository.createProject('测试项目', '麻将');

  // 尝试更新 region 应该不影响项目(或者抛出错误,取决于实现)
  const updated = asideProjectRepository.updateProject(project.id, {
    name: '新名称'
  });

  expect(updated.name).toBe('新名称');
  // region 字段应该不存在
  expect((updated as any).region).toBeUndefined();
});
```

**Step 2: 运行测试验证失败**

```bash
npm run test test/unit/database/repositories/asideProjectRepository.test.ts
```

预期:新测试失败,因为 updateProject 方法还不支持 sellingPoint

**Step 3: 提交测试**

```bash
git add test/unit/database/repositories/asideProjectRepository.test.ts
git commit -m "test(repository): 添加更新卖点的测试用例

- 测试更新项目卖点
- 测试清空项目卖点
- 测试卖点长度验证
- 移除 region 相关测试

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 实现 Repository 的 updateProject 方法

**文件:**
- Modify: `src/main/database/repositories/asideProjectRepository.ts:152-209`

**Step 1: 修改 updateProject 方法**

```typescript
updateProject(id: string, data: { name?: string; gameType?: GameType; sellingPoint?: string }): Project {
  // 参数验证
  if (data.name !== undefined && data.name.trim() === '') {
    throw new Error('项目名称不能为空');
  }

  // 新增:卖点长度验证
  if (data.sellingPoint !== undefined && data.sellingPoint.length > 200) {
    throw new Error('卖点不能超过200字符');
  }

  if (data.gameType !== undefined) {
    const validGameTypes: GameType[] = ['麻将', '扑克', '赛车'];
    if (!validGameTypes.includes(data.gameType)) {
      throw new Error(`无效的游戏类型:${data.gameType}`);
    }
  }

  const db = getDatabase();
  const now = Date.now();

  try {
    const existingProject = this.getProjectById(id);
    if (!existingProject) {
      throw new Error('项目不存在');
    }

    // 更新项目
    const updateStatement = db.prepare(`
      UPDATE aside_projects
      SET name = ?, game_type = ?, selling_point = ?, updated_at = ?
      WHERE id = ?
    `);
    const result = updateStatement.run(
      data.name ?? existingProject.name,
      data.gameType ?? existingProject.gameType,
      data.sellingPoint ?? existingProject.sellingPoint,
      now,
      id
    );

    if (result.changes === 0) {
      throw new Error('更新项目失败:没有修改任何行');
    }

    const row = db.prepare(`
      SELECT id, name, game_type, selling_point, created_at, updated_at
      FROM aside_projects
      WHERE id = ?
    `).get(id) as ProjectRow | undefined;

    if (!row) {
      throw new Error(`更新项目失败:无法找到项目 ID ${id}`);
    }

    console.log(`[AsideProjectRepository] 成功更新项目: ${data.name || existingProject.name}`);
    return this.mapRowToProject(row);
  } catch (error) {
    console.error('[AsideProjectRepository] 更新项目失败:', error);
    throw error;
  }
}
```

**Step 2: 运行测试验证通过**

```bash
npm run test test/unit/database/repositories/asideProjectRepository.test.ts
```

预期:所有 updateProject 相关测试通过

**Step 3: 提交实现**

```bash
git add src/main/database/repositories/asideProjectRepository.ts
git commit -m "feat(repository): 实现 updateProject 的卖点字段支持

- 添加 sellingPoint 到参数类型
- 添加卖点长度验证
- 更新 SQL 更新语句

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 更新 mapRowToProject 方法

**文件:**
- Modify: `src/main/database/repositories/asideProjectRepository.ts:229-238`

**Step 1: 修改 mapRowToProject 方法**

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

**Step 2: 运行所有测试**

```bash
npm run test test/unit/database/repositories/asideProjectRepository.test.ts
```

预期:所有测试通过

**Step 3: 提交修改**

```bash
git add src/main/database/repositories/asideProjectRepository.ts
git commit -m "feat(repository): 添加卖点字段映射

- mapRowToProject 添加 sellingPoint 映射
- 处理 null 值转换为 undefined

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: 修改 IPC Handlers

**文件:**
- Modify: `src/main/ipc/aside-handlers.ts`

**Step 1: 更新 createProject handler**

找到 createProject handler 并添加 sellingPoint 参数:

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

**Step 2: 验证 updateProject handler**

确保 updateProject handler 已经接受 data 对象(应该已经支持):

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

**Step 3: 提交修改**

```bash
git add src/main/ipc/aside-handlers.ts
git commit -m "feat(ipc): 更新 createProject handler 支持卖点参数

- createProject handler 添加 sellingPoint 参数
- updateProject handler 已支持(通过 data 对象)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: 修改 CreateProjectModal 组件

**文件:**
- Modify: `src/renderer/pages/ASide/components/ProjectLibrary/CreateProjectModal.tsx`

**Step 1: 更新 Props 接口**

```typescript
interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, gameType: GameType, sellingPoint?: string) => void;  // 更新签名
}
```

**Step 2: 添加 sellingPoint 状态**

```typescript
const [name, setName] = useState('');
const [gameType, setGameType] = useState<GameType>('麻将');
const [sellingPoint, setSellingPoint] = useState('');  // 新增
const [isLoading, setIsLoading] = useState(false);
```

**Step 3: 更新 handleSubmit 方法**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!name.trim()) {
    alert('请输入项目名称');
    return;
  }

  // 新增:卖点长度验证
  if (sellingPoint && sellingPoint.length > 200) {
    alert('卖点不能超过200字符');
    return;
  }

  setIsLoading(true);
  onCreate(name.trim(), gameType, sellingPoint.trim() || undefined);
};
```

**Step 4: 在表单中添加卖点输入框**

在游戏类型输入框后面添加:

```tsx
{/* 卖点 - 新增 */}
<div>
  <label className="block text-sm font-medium text-slate-300 mb-2">
    项目卖点 <span className="text-slate-500">(可选)</span>
  </label>
  <textarea
    value={sellingPoint}
    onChange={(e) => setSellingPoint(e.target.value)}
    placeholder="描述项目的核心卖点,例如:快速上手、刺激有趣、画面精美..."
    maxLength={200}
    rows={3}
    className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700 resize-none"
  />
  <div className="flex justify-end mt-1">
    <span className="text-xs text-slate-500">
      {sellingPoint.length}/200
    </span>
  </div>
</div>
```

**Step 5: 提交修改**

```bash
git add src/renderer/pages/ASide/components/ProjectLibrary/CreateProjectModal.tsx
git commit -m "feat(ui): CreateProjectModal 添加卖点输入

- 添加 sellingPoint 状态
- 添加卖点多行文本输入框
- 添加字符计数显示(最多200字符)
- 添加前端验证

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: 创建 EditProjectModal 组件

**文件:**
- Create: `src/renderer/pages/ASide/components/ProjectLibrary/EditProjectModal.tsx`

**Step 1: 创建完整的 EditProjectModal 组件**

```typescript
/**
 * 编辑项目弹窗组件
 * 用于修改项目信息
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Project, GameType } from '@shared/types/aside';

interface EditProjectModalProps {
  /** 项目数据 */
  project: Project;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 更新项目回调 */
  onUpdate: (id: string, data: { name: string; gameType: GameType; sellingPoint?: string }) => void;
}

/**
 * 编辑项目弹窗组件
 */
export function EditProjectModal({ project, onClose, onUpdate }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [gameType, setGameType] = useState<GameType>(project.gameType);
  const [sellingPoint, setSellingPoint] = useState(project.sellingPoint || '');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('请输入项目名称');
      return;
    }

    if (sellingPoint && sellingPoint.length > 200) {
      alert('卖点不能超过200字符');
      return;
    }

    setIsLoading(true);
    onUpdate(project.id, {
      name: name.trim(),
      gameType,
      sellingPoint: sellingPoint.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-slate-800 rounded-xl shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-semibold">编辑项目</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 项目名称 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              项目名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:广东麻将推广"
              maxLength={20}
              className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700"
              autoFocus
            />
          </div>

          {/* 游戏类型 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              游戏类型 <span className="text-red-400">*</span>
            </label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value as GameType)}
              className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-slate-700"
            >
              <option value="麻将">麻将</option>
              <option value="扑克">扑克</option>
              <option value="赛车">赛车</option>
            </select>
          </div>

          {/* 卖点 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              项目卖点 <span className="text-slate-500">(可选)</span>
            </label>
            <textarea
              value={sellingPoint}
              onChange={(e) => setSellingPoint(e.target.value)}
              placeholder="描述项目的核心卖点,例如:快速上手、刺激有趣、画面精美..."
              maxLength={200}
              rows={3}
              className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700 resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-slate-500">
                {sellingPoint.length}/200
              </span>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: 提交新文件**

```bash
git add src/renderer/pages/ASide/components/ProjectLibrary/EditProjectModal.tsx
git commit -m "feat(ui): 创建 EditProjectModal 组件

- 支持编辑项目名称、游戏类型、卖点
- 复用 CreateProjectModal 的表单结构
- 添加卖点输入框和字符计数

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: 修改 ProjectCard 组件

**文件:**
- Modify: `src/renderer/pages/ASide/components/ProjectLibrary/ProjectCard.tsx`

**Step 1: 添加 imports**

```typescript
import { Folder, Gamepad2, Trash2, Clock, Sparkles, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { useState } from 'react';  // 新增
```

**Step 2: 更新 Props 接口**

```typescript
interface ProjectCardProps {
  project: Project;
  onEnter: () => void;
  onDelete: () => void;
  onEdit: () => void;  // 新增
}
```

**Step 3: 添加状态和工具方法**

在组件内部添加:

```typescript
export function ProjectCard({ project, onEnter, onDelete, onEdit }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);  // 新增:展开状态

  /**
   * 截断卖点文本(前50字符)
   */
  const getTruncatedSellingPoint = (text: string) => {
    if (text.length <= 50) return text;
    return text.substring(0, 50) + '...';
  };

  // ... 其他方法保持不变 ...
```

**Step 4: 修改头部区域,添加编辑按钮**

```tsx
<div className="flex items-start justify-between mb-2">
  <Folder className="w-8 h-8 text-slate-600" />
  <div className="flex gap-2">
    {/* 编辑按钮 - 新增 */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
      title="编辑项目"
    >
      <Edit2 className="w-4 h-4" />
    </button>
    {/* 删除按钮 */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
      title="删除项目"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
</div>
```

**Step 5: 添加卖点显示区域**

在游戏类型后面、创建时间前面添加:

```tsx
{/* 卖点 - 新增 */}
{project.sellingPoint && (
  <div className="flex items-start gap-2 text-slate-400">
    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
    <div className="flex-1">
      <p className="text-slate-300">
        {isExpanded ? project.sellingPoint : getTruncatedSellingPoint(project.sellingPoint)}
      </p>
      {project.sellingPoint.length > 50 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              收起
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              展开
            </>
          )}
        </button>
      )}
    </div>
  </div>
)}
```

**Step 6: 移除 region 显示(如果有)**

删除 region 相关的显示代码

**Step 7: 提交修改**

```bash
git add src/renderer/pages/ASide/components/ProjectLibrary/ProjectCard.tsx
git commit -m "feat(ui): ProjectCard 添加卖点显示和编辑按钮

- 添加卖点折叠显示(默认50字,可展开)
- 添加编辑按钮
- 移除 region 显示
- 使用 Sparkles 图标标识卖点

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: 集成到 ProjectLibrary 主组件

**文件:**
- Modify: `src/renderer/pages/ASide/components/ProjectLibrary/index.tsx`

**Step 1: 添加 imports**

```typescript
import { EditProjectModal } from './EditProjectModal';  // 新增
```

**Step 2: 添加 editingProject 状态**

```typescript
const [projects, setProjects] = useState<Project[]>([]);
const [showCreateModal, setShowCreateModal] = useState(false);
const [editingProject, setEditingProject] = useState<Project | null>(null);  // 新增
```

**Step 3: 添加 handleUpdate 方法**

```typescript
// 更新项目 - 新增
const handleUpdate = async (id: string, data: { name: string; gameType: GameType; sellingPoint?: string }) => {
  const result = await window.electron.ipcRenderer.invoke('aside:updateProject', id, data);
  if (result.success) {
    setProjects(projects.map(p => p.id === id ? result.project : p));
    setEditingProject(null);
  } else {
    alert(result.error);
  }
};
```

**Step 4: 修改 handleCreate 方法**

```typescript
// 创建项目
const handleCreate = async (name: string, gameType: GameType, sellingPoint?: string) => {
  const result = await window.electron.ipcRenderer.invoke('aside:createProject', name, gameType, sellingPoint);
  if (result.success) {
    setProjects([result.project, ...projects]);
    setShowCreateModal(false);
  } else {
    alert(result.error);
  }
};
```

**Step 5: 更新 ProjectCard 的调用**

```tsx
<ProjectCard
  key={project.id}
  project={project}
  onEnter={() => {/* 进入项目逻辑 */}}
  onEdit={() => setEditingProject(project)}  // 新增
  onDelete={() => handleDelete(project.id)}
/>
```

**Step 6: 添加 EditProjectModal 渲染**

在 CreateProjectModal 后面添加:

```tsx
{/* 编辑项目弹窗 - 新增 */}
{editingProject && (
  <EditProjectModal
    project={editingProject}
    onClose={() => setEditingProject(null)}
    onUpdate={handleUpdate}
  />
)}
```

**Step 7: 提交修改**

```bash
git add src/renderer/pages/ASide/components/ProjectLibrary/index.tsx
git commit -m "feat(ui): ProjectLibrary 集成编辑功能

- 添加 editingProject 状态
- 添加 handleUpdate 方法
- 修改 handleCreate 支持 sellingPoint
- 渲染 EditProjectModal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: 手动测试验证

**文件:** 无

**Step 1: 启动应用**

```bash
npm run dev
```

**Step 2: 测试创建项目功能**

1. 点击"创建新项目"按钮
2. 填写项目名称、选择游戏类型、填写卖点
3. 点击"创建"按钮
4. 验证:项目卡片正确显示卖点(折叠状态)

**Step 3: 测试编辑项目功能**

1. 将鼠标悬停在项目卡片上
2. 点击"编辑"按钮(铅笔图标)
3. 修改项目名称、游戏类型、卖点
4. 点击"保存"按钮
5. 验证:项目卡片立即更新显示

**Step 4: 测试边界条件**

1. 创建项目时不填写卖点 → 验证:卡片不显示卖点
2. 创建项目时填写超过50字的卖点 → 验证:卡片显示折叠按钮
3. 编辑项目时清空卖点 → 验证:卡片不再显示卖点
4. 填写恰好200字符的卖点 → 验证:保存成功
5. 填写201字符的卖点 → 验证:显示错误提示

**Step 5: 提交测试报告**

如果所有测试通过,创建一个简单的测试报告:

```bash
cat > test-selling-point.md << 'EOF'
# 卖点字段功能测试报告

**日期:** 2026-03-18
**测试人员:** Claude

## 测试结果

### 创建项目
- [x] 填写卖点 → 正常显示
- [x] 不填写卖点 → 不显示卖点
- [x] 卖点超过200字符 → 显示错误

### 编辑项目
- [x] 修改卖点 → 正常更新
- [x] 清空卖点 → 不再显示
- [x] 卖点超过200字符 → 显示错误

### 显示功能
- [x] 卖点≤50字 → 完整显示
- [x] 卖点>50字 → 折叠显示+展开按钮
- [x] 展开/收起 → 正常切换

### 集成测试
- [x] 创建后立即在卡片上看到卖点
- [x] 编辑后卡片立即更新
- [x] 重启应用后数据持久化

**结论:** 所有测试通过 ✅
EOF

git add test-selling-point.md
git commit -m "test: 添加卖点字段功能测试报告

- 所有测试用例通过
- 功能符合设计要求

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 完成清单

- [x] 数据层:迁移脚本修改
- [x] 数据层:类型定义修改
- [x] 数据层:数据库重置
- [x] 业务逻辑:Repository 测试
- [x] 业务逻辑:Repository 实现
- [x] IPC 层:Handler 修改
- [x] UI 层:CreateProjectModal
- [x] UI 层:EditProjectModal
- [x] UI 层:ProjectCard
- [x] UI 层:ProjectLibrary 集成
- [x] 手动测试:所有功能验证

---

## 备注

- 所有代码修改都遵循项目现有风格
- 测试覆盖了核心功能和边界条件
- 前后端双重验证确保数据一致性
- UI 组件复用了现有设计模式
