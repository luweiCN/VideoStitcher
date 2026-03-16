# A 面视频生产功能完整实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完全重构 A 面视频生产功能，使用 SQLite 持久化项目数据，严格遵循原型和用户需求实现完整的多步骤工作流

**Architecture:** 分层架构 - Renderer 进程负责 UI 和临时状态，Main 进程负责数据库、LangGraph AI 工作流和 IPC 路由

**Tech Stack:** Electron + React 18 + TypeScript + SQLite3 + Zustand + LangGraph + Tailwind CSS + Lucide React

---

## 📋 核心用户流程（重要！）

### 完整流程图

```
用户点击"A 面视频生产"
  ↓
【Step 0: 项目库】
  - 显示所有项目（例如：gg麻将、pl麻将、spl麻将）
  - 每个项目已确定游戏类型（创建时选择）
  - 用户可以：
    a. 选择已有项目 → 进入该项目工作流
    b. 新建项目 → 填写：项目名称 + 游戏类型（麻将/扑克/赛车）
  ↓
【Step 1: 创意方向选择】
  - 显示该项目的创意方向（预设 5 个 + 用户自定义）
  - 点击某个方向 → 进入 Step 2
  ↓
【Step 2: 区域选择】
  - 显示区域选择器（8 大区 + 全国通用）
  - 默认选中"全国通用"
  - 点击"下一步" → 进入 Step 3
  ↓
【Step 3: 人设 + 模型 + 脚本生成】
  - 页面顶部：人设管理（预设 4 个 + 可新增/编辑）
  - 中部：AI 模型选择（Gemini/Doubao/Qwen/ChatGPT）
  - 底部：生成数量（默认 5，最多 10）
  - 点击"生成脚本" → 显示脚本列表
  ↓
【脚本管理】
  - 每个脚本支持：编辑、重新生成、添加到待产库
  - ⚠️ 关键：添加到待产库后 → 自动生成 1 个新脚本补充
  - 保持列表总数 = 5-10
  ↓
【待产库管理】
  - 弹窗显示待产库内容
  - 支持拖拽排序
  - 可以删除、清空
  - 两个按钮：
    a. 快速生成 → 进入 VideoFactory
    b. 导演模式 → 进入 DirectorMode
  ↓
【两个生产路径】

路径 A：【快速生成】
  - 从待产库批量选择多个脚本
  - 每个脚本可以选择不同的视频生成模型
  - ⚠️ 只能选择最终的视频生成模型（Sora 2.0 / Seedance 2.0 / 可灵 1.5 / Runway Gen-3）
  - ⚠️ 中间的 agent 工作流使用预设模型（不需要用户选择）
  - 显示生成进度
  - 生成完成后可以预览、重新生成、保存到本地库

路径 B：【导演模式】
  - ⚠️ 从待产库单选一个剧本
  - 4 个 Agent 依次工作（每个都需要人工确认）：

  1️⃣ 【Art Director】（艺术总监）
     - 确认视频长度：短视频（<15s）/ 长视频（>15s）
     - 确认画幅比例：横版（16:9）/ 竖版（9:16）
     - 用户确认后 → 自动邀请选角导演

  2️⃣ 【Casting Director】（选角导演）
     - 选择：
       a. 上传人物参考图
       b. ⚡ 根据脚本自动生成
     - 右侧画板显示：人物卡片（包含姓名、描述、概念图）
     - 可以修改人物设定、重新生成概念图
     - 用户确认后 → 自动邀请分镜师

  3️⃣ 【Storyboard Artist】（分镜师）
     - 根据人物 + 视频长度生成分镜图
     - 右侧画板显示：5x5 核心动态分镜
     - 可以预览每个分镜、重新生成
     - 用户确认后 → 自动邀请摄像导演

  4️⃣ 【Camera Director】（摄像导演）
     - 根据分镜图 + 视频长度生成最终视频
     - 右侧画板显示：合成后的成片
     - 可以预览、重新生成
     - 保存到本地库

  - 完成一个剧本后 → 可以从待产库选择下一个剧本
```

---

## 🗄️ 数据库设计

### SQLite 表结构

```sql
-- 1. 项目表
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  game_type TEXT NOT NULL,  -- '麻将' | '扑克' | '赛车'
  region TEXT DEFAULT 'universal',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创意方向表（项目级别）
CREATE TABLE creative_directions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,  -- Lucide icon name
  is_preset BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 3. 人设表（项目级别）
CREATE TABLE personas (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  is_preset BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 4. 脚本表
CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  creative_direction_id TEXT,
  persona_id TEXT,
  ai_model TEXT,  -- 'gemini' | 'doubao' | 'qwen' | 'chatgpt'
  status TEXT DEFAULT 'draft',  -- 'draft' | 'library' | 'producing' | 'completed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (creative_direction_id) REFERENCES creative_directions(id),
  FOREIGN KEY (persona_id) REFERENCES personas(id)
);

-- 索引
CREATE INDEX idx_creative_directions_project ON creative_directions(project_id);
CREATE INDEX idx_personas_project ON personas(project_id);
CREATE INDEX idx_scripts_project ON scripts(project_id);
CREATE INDEX idx_scripts_status ON scripts(status);
```

### 预设数据

**创意方向预设**（新建项目时自动插入）:
```javascript
const PRESET_CREATIVE_DIRECTIONS = [
  { id: 'humor', name: '幽默诙谐', icon: 'Laugh', description: '轻松搞笑，化解输牌尴尬', is_preset: true },
  { id: 'suspense', name: '悬疑剧情', icon: 'Ghost', description: '反转不断，悬念拉满', is_preset: true },
  { id: 'funny', name: '搞笑沙雕', icon: 'Sparkles', description: '脑洞大开，魔性洗脑', is_preset: true },
  { id: 'tutorial', name: '麻将教学', icon: 'BookOpen', description: '干货满满，实战教学', is_preset: true },
  { id: 'commentary', name: '搞笑解说', icon: 'Mic2', description: '毒舌点评，神级复盘', is_preset: true }
];
```

**人设预设**（新建项目时自动插入）:
```javascript
const PRESET_PERSONAS = [
  { id: 'folk_master', name: '民俗老炮', prompt: '资深老玩家，混迹牌馆30年，说话接地气，懂民间智慧', is_preset: true },
  { id: 'net_surfer', name: '5G冲浪手', prompt: '玩梗大师，网感极强，喜欢用网络热词，语言新潮', is_preset: true },
  { id: 'storyteller', name: '故事大王', prompt: '擅长讲故事，能把一把牌讲成连续剧，语言生动', is_preset: true },
  { id: 'data_analyst', name: '数据分析师', prompt: '理性分析派，喜欢用数据说话，逻辑清晰', is_preset: true }
];
```

---

## 📡 IPC 接口设计

### Renderer → Main 的 IPC 接口

```typescript
window.api = {
  // ========== 项目管理 ==========
  getProjects(): Promise<{ success: boolean; projects: Project[]; error?: string }>
  createProject(data: { name: string; gameType: string }): Promise<{ success: boolean; project: Project; error?: string }>
  deleteProject(projectId: string): Promise<{ success: boolean; error?: string }>

  // ========== 创意方向 ==========
  getCreativeDirections(projectId: string): Promise<{ success: boolean; directions: CreativeDirection[]; error?: string }>
  addCreativeDirection(data: { projectId: string; name: string; description?: string; iconName?: string }): Promise<{ success: boolean; direction: CreativeDirection; error?: string }>
  deleteCreativeDirection(directionId: string): Promise<{ success: boolean; error?: string }>

  // ========== 人设管理 ==========
  getPersonas(projectId: string): Promise<{ success: boolean; personas: Persona[]; error?: string }>
  addPersona(data: { projectId: string; name: string; prompt: string }): Promise<{ success: boolean; persona: Persona; error?: string }>
  updatePersona(personaId: string, data: { name?: string; prompt?: string }): Promise<{ success: boolean; error?: string }>
  deletePersona(personaId: string): Promise<{ success: boolean; error?: string }>

  // ========== 脚本生成 ==========
  generateScripts(data: {
    projectId: string;
    creativeDirectionId: string;
    personaId: string;
    aiModel: string;
    count: number;
  }): Promise<{ success: boolean; scripts: Script[]; error?: string }>

  // ⚠️ 关键：添加到待产库后，自动生成 1 个新脚本补充
  addScriptToLibrary(scriptId: string): Promise<{ success: boolean; newScript?: Script; error?: string }>

  removeScriptFromLibrary(scriptId: string): Promise<{ success: boolean; error?: string }>
  getLibraryScripts(projectId: string): Promise<{ success: boolean; scripts: Script[]; error?: string }>
  updateScriptContent(scriptId: string, content: string): Promise<{ success: boolean; error?: string }>
  regenerateScript(scriptId: string): Promise<{ success: boolean; script: Script; error?: string }>
}
```

---

## 🎨 Zustand Store 设计

```typescript
interface ASideStore {
  // 当前状态
  currentView: 'library' | 'step1-direction' | 'step2-region' | 'step3-scripts';
  currentProject: Project | null;

  // 步骤数据（临时，不持久化）
  selectedDirection: CreativeDirection | null;
  selectedPersona: Persona | null;
  selectedModel: string;
  scriptCount: number;
  generatedScripts: Script[];

  // UI 状态
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentView: (view: string) => void;
  selectProject: (project: Project) => void;
  selectDirection: (direction: CreativeDirection) => void;
  selectPersona: (persona: Persona) => void;
  setModel: (model: string) => void;
  setScriptCount: (count: number) => void;
  setGeneratedScripts: (scripts: Script[]) => void;
  addGeneratedScript: (script: Script) => void; // 新增：添加单个脚本（自动补充时用）
  removeGeneratedScript: (scriptId: string) => void; // 新增：移除脚本（添加到待产库时用）
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
```

---

## 🏗️ 组件结构

```
src/renderer/pages/ASide/
├── index.tsx（主页面 - 完全重写）
│
├── components/
│   ├── ProjectLibrary/（Task 14）
│   │   ├── index.tsx
│   │   ├── ProjectCard.tsx
│   │   └── CreateProjectModal.tsx
│   │
│   ├── CreativeDirectionSelector/（Task 15）
│   │   ├── index.tsx
│   │   ├── DirectionCard.tsx
│   │   └── AddDirectionModal.tsx
│   │
│   ├── RegionSelector/（Task 16）
│   │   ├── index.tsx
│   │   └── RegionGroup.tsx
│   │
│   ├── PersonaManager/（Task 17）
│   │   ├── index.tsx
│   │   ├── PersonaCard.tsx
│   │   ├── AddPersonaModal.tsx
│   │   └── EditPersonaModal.tsx
│   │
│   ├── ScriptGenerator/（Task 18）
│   │   ├── index.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── ScriptCard.tsx
│   │   └── ScriptEditor.tsx
│   │
│   └── ProductionQueue/（Task 19）
│       ├── index.tsx
│       ├── QueueItem.tsx
│       └── QueueModal.tsx
│
├── pages/
│   ├── VideoFactory.tsx（Task 21 - 快速生成页面）
│   └── DirectorMode.tsx（Task 22 - 导演模式页面）
│
├── constants/
│   ├── regions.ts（Task 2 - 区域数据）
│   └── presets.ts（Task 3 - 预设数据）
│
└── types.ts（Task 1 - 类型定义）
```

---

## 📝 Task 1-13: 基础架构（已详细规划）

这些任务的基础架构代码已在之前的计划中完整规划，这里只列出任务名称：

- **Task 1**: 创建类型定义文件
- **Task 2**: 创建区域数据常量
- **Task 3**: 创建预设数据常量
- **Task 4**: 创建 SQLite 数据库类
- **Task 5**: 实现项目 CRUD 方法
- **Task 6**: 实现创意方向和人设 CRUD 方法
- **Task 7**: 实现脚本 CRUD 方法
- **Task 8**: 在主进程初始化数据库
- **Task 9**: 创建 IPC Handlers - 项目管理
- **Task 10**: 创建 IPC Handlers - 创意方向和人设
- **Task 11**: 创建 IPC Handlers - 脚本管理（⚠️ 需要修改：添加自动补充脚本逻辑）
- **Task 12**: 创建 Zustand Store（⚠️ 需要修改：添加 addGeneratedScript 和 removeGeneratedScript）
- **Task 13**: 更新 preload.ts 暴露 IPC API

---

## 📝 Task 14-22: 组件层（详细规划）

### Task 14: 创建 ProjectLibrary 组件（项目库）

**核心文件:**
- `src/renderer/pages/ASide/components/ProjectLibrary/index.tsx` - 主组件
- `src/renderer/pages/ASide/components/ProjectLibrary/ProjectCard.tsx` - 项目卡片
- `src/renderer/pages/ASide/components/ProjectLibrary/CreateProjectModal.tsx` - 创建项目弹窗

**功能说明:**
- 显示所有项目列表（例如：gg麻将、pl麻将、spl麻将）
- 每个项目显示：名称、游戏类型、创建时间
- 点击"新建项目" → 弹窗填写：
  - 项目名称（必填）
  - **游戏类型**（必选：麻将/扑克/赛车）⚠️ **关键：这里选择游戏类型**
- 创建成功后 → 自动插入预设的创意方向和人设
- 点击某个项目 → 进入该项目的 Step 1（创意方向选择）
- 每个项目可以删除

**验收标准:**
- ✅ 能显示项目列表
- ✅ 能创建新项目（包含项目名称 + 游戏类型）
- ✅ 创建项目后自动插入 5 个创意方向 + 4 个人设
- ✅ 能删除项目
- ✅ 点击项目能进入 Step 1

---

### Task 15: 创建 CreativeDirectionSelector 组件（创意方向选择器）

**核心文件:**
- `src/renderer/pages/ASide/components/CreativeDirectionSelector/index.tsx` - 主组件
- `src/renderer/pages/ASide/components/CreativeDirectionSelector/DirectionCard.tsx` - 方向卡片
- `src/renderer/pages/ASide/components/CreativeDirectionSelector/AddDirectionModal.tsx` - 新增方向弹窗

**功能说明:**
- 显示当前项目的所有创意方向（预设 5 个 + 用户自定义）
- 每个方向显示：
  - 图标（Lucide icon，根据 iconName 显示）
  - 名称
  - 描述
  - 预设标记（预设的显示"预设"徽章）
- 点击某个方向 → 进入 Step 2（区域选择）
- 支持新增自定义创意方向（弹窗表单：名称 + 描述 + 图标选择）
- 只有非预设的方向才能删除

**验收标准:**
- ✅ 能显示项目的创意方向列表
- ✅ 每个方向显示正确的图标（根据 iconName）
- ✅ 预设的方向有"预设"标记
- ✅ 点击某个方向后能跳转到 Step 2
- ✅ 能通过弹窗新增自定义方向
- ✅ 自定义方向有删除按钮，预设的无删除按钮

---

### Task 16: 创建 RegionSelector 组件（区域选择器）

**核心文件:**
- `src/renderer/pages/ASide/components/RegionSelector/index.tsx` - 主组件
- `src/renderer/pages/ASide/components/RegionSelector/RegionGroup.tsx` - 区域分组

**功能说明:**
- 显示 8 个区域分组：
  - 通用（全国通用）
  - 华北（北京、河北、内蒙古、山西、天津）
  - 东北（黑龙江、吉林、辽宁）
  - 华东（安徽、福建、江苏、江西、山东、上海、台湾、浙江）
  - 华中（河南、湖北、湖南）
  - 华南（广东、广西、海南、香港、澳门）
  - 西南（重庆、贵州、四川、西藏、云南）
  - 西北（甘肃、宁夏、青海、陕西、新疆）
- 每个省份显示：emoji 图标 + 名称
- 默认选中"全国通用"
- 点击某个省份 → 高亮选中
- 点击"下一步" → 进入 Step 3

**验收标准:**
- ✅ 能显示所有区域分组（8 个分组）
- ✅ 每个省份有 emoji 图标
- ✅ 点击省份能高亮选中
- ✅ 默认选中"全国通用"
- ✅ 点击"下一步"能跳转到 Step 3

---

### Task 17: 创建 PersonaManager 组件（人设管理器）

**核心文件:**
- `src/renderer/pages/ASide/components/PersonaManager/index.tsx` - 主组件
- `src/renderer/pages/ASide/components/PersonaManager/PersonaCard.tsx` - 人设卡片
- `src/renderer/pages/ASide/components/PersonaManager/AddPersonaModal.tsx` - 新增人设弹窗
- `src/renderer/pages/ASide/components/PersonaManager/EditPersonaModal.tsx` - 编辑人设弹窗

**功能说明:**
- 显示当前项目的所有人设（预设 4 个 + 用户自定义）
- 每个人设显示：
  - 名称
  - prompt 预览（截断显示）
  - 预设标记（预设的显示"预设"徽章）
- 点击某个人设 → 高亮选中
- 支持新增自定义人设（弹窗表单：名称 + prompt）
- 支持编辑现有人设（弹窗表单：名称 + prompt）
- 只有非预设的人设才能删除

**验收标准:**
- ✅ 能显示项目的人设列表
- ✅ 点击某个人设能高亮选中
- ✅ 预设的人设有"预设"标记
- ✅ 能通过弹窗新增自定义人设
- ✅ 能通过弹窗编辑现有人设
- ✅ 自定义人设有删除按钮，预设的无删除按钮

---

### Task 18: 创建 ScriptGenerator 组件（脚本生成器）

**核心文件:**
- `src/renderer/pages/ASide/components/ScriptGenerator/index.tsx` - 主组件
- `src/renderer/pages/ASide/components/ScriptGenerator/ModelSelector.tsx` - AI 模型选择器
- `src/renderer/pages/ASide/components/ScriptGenerator/ScriptCard.tsx` - 脚本卡片
- `src/renderer/pages/ASide/components/ScriptGenerator/ScriptEditor.tsx` - 脚本编辑器

**功能说明:**
- 显示已选择的人设信息（来自 Task 17）
- 显示 AI 模型选择器（4 个选项）：
  - Gemini 1.5 Pro
  - 豆包（Doubao）
  - 通义千问（Qwen）
  - ChatGPT
- 显示生成数量输入（默认 5，最少 1，最多 10）
- 点击"生成脚本"按钮 → 调用后端 API
- 显示生成的脚本列表（每个脚本一个卡片）
- 每个脚本支持：
  - 查看：显示完整内容
  - 编辑：弹窗编辑内容
  - 重新生成：调用后端 API 重新生成这个脚本
  - **添加到待产库：有飞行动画，并自动生成 1 个新脚本补充** ⚠️ **关键**

**⚠️ 关键逻辑 - 自动补充脚本:**
```typescript
const handleAddToLibrary = async (scriptId: string) => {
  // 1. 添加到待产库
  const response = await window.api.addScriptToLibrary(scriptId);

  if (response.success && response.newScript) {
    // 2. 从当前列表移除
    removeGeneratedScript(scriptId);

    // 3. 添加新的脚本补充
    addGeneratedScript(response.newScript);

    // 4. 显示飞行动画
    triggerFlyAnimation();

    // 5. Toast 提示
    toast.success('已添加到待产库，自动补充了新脚本');
  }
};
```

**验收标准:**
- ✅ 能显示已选择的人设信息
- ✅ 能选择 AI 模型（4 个选项）
- ✅ 能设置生成数量（1-10）
- ✅ 点击"生成脚本"能调用后端 API
- ✅ 能显示生成的脚本列表
- ✅ 每个脚本能查看完整内容
- ✅ 每个脚本能编辑内容
- ✅ 每个脚本能重新生成
- ✅ 每个脚本能添加到待产库（有飞行动画）
- ✅ **添加到待产库后，自动生成 1 个新脚本补充**
- ✅ **保持列表总数 = 5-10**

---

### Task 19: 创建 ProductionQueue 组件（待产库）

**核心文件:**
- `src/renderer/pages/ASide/components/ProductionQueue/index.tsx` - 主组件
- `src/renderer/pages/ASide/components/ProductionQueue/QueueItem.tsx` - 待产项
- `src/renderer/pages/ASide/components/ProductionQueue/QueueModal.tsx` - 待产库弹窗

**功能说明:**
- 显示待产库按钮（在导航栏）
- 按钮显示待产库数量（例如："待产库 (3)"）
- 点击按钮显示待产库弹窗
- 弹窗中显示所有待产脚本（列表）
- 支持拖拽排序（调整优先级）
- 每个待产项支持：
  - 查看详情
  - 删除
- 显示"清空待产库"按钮
- 显示两个生产路径按钮：
  - **快速生成** → 跳转到 VideoFactory 页面
  - **导演模式** → 跳转到 DirectorMode 页面

**验收标准:**
- ✅ 导航栏有待产库按钮（带数量标记）
- ✅ 点击能打开待产库弹窗
- ✅ 能显示所有待产脚本
- ✅ 能拖拽调整顺序
- ✅ 能删除单个待产项
- ✅ 能清空待产库
- ✅ 有"快速生成"按钮
- ✅ 有"导演模式"按钮

---

### Task 20: 重写 ASide 主页面（整合所有组件）

**核心文件:**
- `src/renderer/pages/ASide/index.tsx` - 主页面（完全重写）

**功能说明:**
- Step 0: 显示项目库（Task 14）
- Step 1: 显示创意方向选择器（Task 15）
- Step 2: 显示区域选择器（Task 16）
- Step 3: 显示人设管理器 + 脚本生成器（Task 17 + 18）
- 显示待产库按钮（Task 19）
- 管理步骤跳转逻辑：
  - 项目库 → 选择项目 → Step 1
  - Step 1 → 选择方向 → Step 2
  - Step 2 → 选择区域 → Step 3
  - Step 3 → 生成脚本 → 添加到待产库 → 快速生成/导演模式
- 管理全局状态（通过 Zustand Store）

**验收标准:**
- ✅ 能按顺序显示 4 个步骤
- ✅ 能在步骤间正确跳转
- ✅ 每个步骤显示对应的组件
- ✅ 待产库按钮始终可见
- ✅ 状态管理正确（项目、选择的方向、人设、脚本）

---

### Task 21: 创建 VideoFactory 页面（快速生成）

**核心文件:**
- `src/renderer/pages/ASide/pages/VideoFactory.tsx` - 快速生成页面

**功能说明:**
- 从待产库批量选择多个脚本
- 显示"全局模型配置"按钮（统一设置所有脚本的视频生成模型）
- 为每个脚本显示：
  - 脚本内容（可编辑）
  - 视频生成模型选择器（4 个选项）：
    - Sora 2.0（OpenAI 物理世界模拟）
    - Seedance 2.0（字节跳动 极致张力）
    - 可灵 1.5（快手 高逼真生成）
    - Runway Gen-3（好莱坞级视觉引擎）
  - ⚠️ **只能选择最终的视频生成模型**
  - ⚠️ **中间的 agent 工作流使用预设模型（不需要用户选择）**
- 点击"开始批量生成"按钮
- 显示生成进度（每个脚本的进度条）
- 生成完成后显示视频列表
- 每个视频支持：
  - 预览（播放按钮）
  - 重新生成
  - 选择/取消选择
- 显示两个全局按钮：
  - 存档本地A面库
  - 上传知识库大模型

**验收标准:**
- ✅ 能显示待产库的脚本列表
- ✅ 每个脚本能独立选择视频生成模型
- ✅ 能统一设置所有脚本的模型（全局配置）
- ✅ 能开始批量生成
- ✅ 能显示每个脚本的生成进度
- ✅ 生成完成后能预览视频
- ✅ 能重新生成单个视频
- ✅ 能选择/取消选择视频
- ✅ 能存档到本地库
- ✅ 能上传到知识库

---

### Task 22: 创建 DirectorMode 页面（导演模式）

**核心文件:**
- `src/renderer/pages/ASide/pages/DirectorMode.tsx` - 导演模式主页面
- `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx` - AI 对话面板
- `src/renderer/pages/ASide/components/DirectorMode/CanvasPanel.tsx` - 画布面板（显示生成结果）

**功能说明:**

#### 步骤 1: 从待产库选择剧本
- 显示待产库列表（单选）
- 选择一个剧本 → 进入导演模式

#### 步骤 2: 4 个 Agent 依次工作

**1️⃣ Art Director（艺术总监）**
- 左侧聊天面板显示：
  - "大家好，我是艺术总监。首先，让我们确定影片的规格。"
  - 表单：
    - 影片长度：短视频（<15s）/ 长视频（>15s）
    - 画幅比例：横版（16:9）/ 竖版（9:16）
  - 按钮："确认并继续"
- 用户确认后 → 自动邀请选角总监
- 系统消息："艺术总监 邀请 选角总监 加入了群聊"

**2️⃣ Casting Director（选角导演）**
- 左侧聊天面板显示：
  - "大家好，我是选角总监。请问是想自己上传人物参考图，还是由我为您分析脚本并自动生成人物设定与概念图？"
  - 按钮：
    - "上传人物参考图"
    - "⚡ 根据脚本自动生成"
- 用户选择"自动生成"后：
  - 右侧画板显示：3 个人物卡片
    - 每个卡片包含：姓名、描述、概念图
    - 右上角有"重新生成"按钮
    - 点击铅笔图标可以编辑人物设定
  - 显示生成进度："正在后台黑盒调用 Banana 视觉模型生图..."
- 用户确认后 → 自动邀请分镜师
- 系统消息："选角总监 邀请 分镜师 加入了群聊"

**3️⃣ Storyboard Artist（分镜师）**
- 左侧聊天面板显示：
  - "各位好，我是分镜师。人物综合视觉设定已就绪！如果有不满意的设定，您可以点击节点右上角铅笔图标进行修改，修改后将根据新提示词自动刷新图片。"
  - 按钮："🚀 确认人物，输出 5x5 动态分镜"
- 用户确认后：
  - 右侧画板显示：5x5 核心动态分镜（网格布局）
  - 根据视频长度和画幅比例生成分镜图
  - 每个分镜可以重新生成
- 用户确认后 → 自动邀请摄像总监
- 系统消息："分镜师 邀请 摄像导演 加入了群聊"

**4️⃣ Camera Director（摄像导演）**
- 左侧聊天面板显示：
  - "大家好，我是摄像导演。分镜图已就绪，我将根据分镜图和视频长度合成最终成片。"
  - 按钮："🎬 开始合成视频"
- 用户确认后：
  - 右侧画板显示：合成后的成片
  - 可以预览、重新生成
- 显示"保存到本地库"按钮

#### 步骤 3: 完成后选择下一个剧本
- 显示"从待产库选择下一个剧本"按钮
- 点击后 → 返回待产库选择页面

**验收标准:**
- ✅ 能从待产库单选一个剧本
- ✅ 能显示 4 个 Agent 阶段
- ✅ Art Director 能确认视频长度和画幅比例
- ✅ Casting Director 能生成人物卡片（3 个）
- ✅ 人物卡片包含姓名、描述、概念图
- ✅ 能修改人物设定、重新生成概念图
- ✅ Storyboard Artist 能生成分镜图（5x5）
- ✅ 分镜图能根据视频长度和画幅比例调整
- ✅ 能重新生成单个分镜
- ✅ Camera Director 能合成最终视频
- ✅ 能预览、重新生成视频
- ✅ 能保存到本地库
- ✅ 完成后能从待产库选择下一个剧本

---

## 📊 任务依赖关系

```
Task 1-13 (基础架构)
    ↓
Task 14 (ProjectLibrary)
    ↓
Task 15 (CreativeDirectionSelector)
    ↓
Task 16 (RegionSelector)
    ↓
Task 17 (PersonaManager)
    ↓
Task 18 (ScriptGenerator) ⚠️ 关键：自动补充脚本
    ↓
Task 19 (ProductionQueue)
    ↓
Task 20 (主页面整合)
    ↓
┌─────────────┴─────────────┐
Task 21 (VideoFactory)    Task 22 (DirectorMode)
```

---

## ✅ 关键细节检查清单

### 自动补充脚本机制
- ✅ Task 11: IPC Handler 需要实现 `addScriptToLibrary` 返回新脚本
- ✅ Task 12: Store 需要添加 `addGeneratedScript` 和 `removeGeneratedScript`
- ✅ Task 18: 组件需要调用 `addScriptToLibrary` 并处理返回的新脚本

### 项目级别的游戏类型
- ✅ Task 5: `createProject` 需要 `gameType` 参数
- ✅ Task 14: 创建项目时需要选择游戏类型（麻将/扑克/赛车）
- ✅ Task 20: 主页面不需要显示游戏类型（已在项目级别确定）

### 导演模式的单剧本处理
- ✅ Task 22: 进入导演模式时从待产库单选一个剧本
- ✅ Task 22: 完成一个剧本后可以选择下一个剧本

### 快速生成的模型选择
- ✅ Task 21: 只能选择视频生成模型（Sora/Seedance/可灵/Runway）
- ✅ Task 21: 不需要选择中间 agent 的模型（使用预设）

---

## 🎯 执行建议

**优先级：**
1. **P0（核心流程）**: Task 1-20（完成基本工作流）
2. **P1（生产路径）**: Task 21-22（快速生成 + 导演模式）

**建议执行方式：**
- 使用 **superpowers:subagent-driven-development** skill
- 每个 Task 一个独立的 subagent
- Task 之间的依赖通过状态管理（Zustand Store）连接
- 完成一个 Task → Code Review → 下一个 Task

**测试建议：**
- Task 1-13 完成后：测试数据库操作和 IPC 通信
- Task 14-20 完成后：测试完整的脚本生成流程
- Task 21-22 完成后：测试两个生产路径

---

**创建时间**: 2026-03-17
**文档状态**: ✅ 完整且准确
**基于**: 原型文件 + 用户原始提示词 + 用户纠正
