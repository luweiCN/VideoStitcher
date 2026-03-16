# A 面视频生产完全重设计方案

**创建时间**: 2026-03-17
**设计者**: AI 开发团队
**状态**: ✅ 已批准

---

## 📋 设计概览

本设计文档描述了 VideoStitcher Phase 2 **A 面视频生产**功能的完全重构方案。

### 核心决策

- **完全重写**: 废弃现有实现，从零开始
- **SQLite 持久化**: 所有项目级数据永久存储
- **分层架构**: Renderer(UI 层) + Main(业务层)
- **遵循原型**: 严格按照 `docs/demo/第二阶段原型.jsx` 实现

### 技术栈

**前端**:
- React 18 + TypeScript
- Tailwind CSS (已有配置)
- Zustand (状态管理)
- Lucide React (图标库)

**后端**:
- Electron 主进程
- SQLite3 (已集成)
- LangGraph.js (AI 工作流)
- LangChain (AI 编排)
- 火山引擎 API (Doubao LLM)

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

## 🏗️ 架构设计

### 分层架构

```
┌─────────────────────────────────────────────┐
│          Renderer 进程（UI 层）              │
├─────────────────────────────────────────────┤
│ Components (React)                         │
│ ├─ ProjectLibrary                          │
│ ├─ CreativeDirectionSelector               │
│ ├─ RegionSelector                          │
│ ├─ PersonaManager                          │
│ └─ ScriptGenerator                         │
│                                             │
│ Stores (Zustand)                           │
│ └─ workflowStore                           │
│                                             │
│ IPC Client                                 │
│ └─ window.api.*                            │
└─────────────────────────────────────────────┘
              ↕ IPC 通信
┌─────────────────────────────────────────────┐
│          Main 进程（业务层）                 │
├─────────────────────────────────────────────┤
│ Database (SQLite)                          │
│ └─ database.ts                             │
│                                             │
│ IPC Handlers                               │
│ └─ aside-handlers.ts                       │
│                                             │
│ LangGraph Workflow                         │
│ ├─ langgraph/graph.ts                      │
│ ├─ langgraph/nodes/scriptNode.ts           │
│ └─ langgraph/state.ts                      │
│                                             │
│ Services                                   │
│ └─ ASideService.ts                         │
└─────────────────────────────────────────────┘
```

### 组件结构

```
src/renderer/pages/ASide/
├── index.tsx（主页面 - 完全重写）
│
├── components/
│   ├── ProjectLibrary.tsx（新增）
│   │   ├── ProjectCard.tsx
│   │   └── CreateProjectModal.tsx
│   │
│   ├── CreativeDirectionSelector.tsx（重写）
│   │   ├── DirectionCard.tsx
│   │   └── AddDirectionModal.tsx
│   │
│   ├── RegionSelector.tsx（新增）
│   │   └── RegionGroup.tsx
│   │
│   ├── PersonaManager.tsx（新增）
│   │   ├── PersonaCard.tsx
│   │   ├── AddPersonaModal.tsx
│   │   └── EditPersonaModal.tsx
│   │
│   ├── ScriptGenerator.tsx（重写）
│   │   ├── ModelSelector.tsx
│   │   ├── ScriptCard.tsx
│   │   └── ScriptEditor.tsx
│   │
│   └── ProductionQueue.tsx（优化）
│       ├── QueueItem.tsx
│       └── QueueModal.tsx
│
└── types.ts（新增）
```

---

## 🔄 完整用户流程

### 流程图

```
1. 用户点击 "A 面视频生产"
   ↓
2. 显示项目库（ProjectLibrary）
   - 用户选择已有项目 或 点击"新建项目"
   - 填写：项目名称 + 游戏类型（麻将/扑克/赛车）
   ↓
3. 进入项目工作流 - Step 1: 创意方向选择
   - 显示该项目的创意方向卡片（预设 5 个）
   - 用户可以新增自定义创意方向
   - 点击某个方向后 → 进入 Step 2
   ↓
4. Step 2: 区域选择
   - 显示区域选择器（REGION_GROUPS）
   - 默认选中"全国通用"
   - 用户可以选择特定省份区域
   - 点击"下一步" → 进入 Step 3
   ↓
5. Step 3: 人设 + 模型 + 脚本生成
   - 页面顶部显示该项目的人设卡片（预设 4 个）
   - 支持新增/编辑人设（弹窗）
   - 中部选择 AI 模型（Gemini/Doubao/Qwen/ChatGPT）
   - 底部设置数量（默认 5，最多 10）
   - 点击"生成脚本"按钮
   - 显示生成的脚本列表
   ↓
6. 脚本管理
   - 每条脚本可以：编辑、重新生成、添加到待产库
   - 添加到待产库时有飞行动画
   ↓
7. 待产库管理
   - 弹窗查看待产库内容
   - 支持拖拽排序
   - 可以删除
   ↓
8. 两种生产路径
   A. 快速生成 → video-factory（批量自动化）
   B. 导演模式 → director-mode（精细化 agent 协作）
```

---

## 📡 IPC 接口设计

### Renderer → Main 的 IPC 接口

```typescript
window.api = {
  // ========== 项目管理 ==========
  getProjects(): Promise<{ success: boolean; projects: Project[]; error?: string }>
  createProject(data: { name: string; gameType: string; region?: string }): Promise<{ success: boolean; project: Project; error?: string }>
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

  saveScriptToLibrary(scriptId: string): Promise<{ success: boolean; error?: string }>
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
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
```

---

## 🤖 LangGraph 工作流

### 脚本生成节点流程

```
用户请求生成脚本
  ↓
[ScriptNode] 执行
  ├─ 1. 从 SQLite 读取项目配置
  ├─ 2. 获取创意方向和人设 prompt
  ├─ 3. 构造 LLM prompt（结合上下文）
  ├─ 4. 调用火山引擎 API
  ├─ 5. 解析返回的脚本
  ├─ 6. 保存到 scripts 表（status=draft）
  └─ 7. 返回生成的脚本列表
```

---

## 📝 区域数据

```typescript
const REGION_GROUPS = [
  {
    category: "通用",
    regions: [{ id: "universal", name: "全国通用", icon: "🇨🇳" }],
  },
  {
    category: "华北",
    regions: [
      { id: "beijing", name: "北京", icon: "🏯" },
      { id: "hebei", name: "河北", icon: "🏹" },
      { id: "neimenggu", name: "内蒙古", icon: "🐎" },
      { id: "shanxi", name: "山西", icon: "🏺" },
      { id: "tianjin", name: "天津", icon: "🎡" },
    ],
  },
  {
    category: "东北",
    regions: [
      { id: "heilongjiang", name: "黑龙江", icon: "🐻" },
      { id: "jilin", name: "吉林", icon: "❄️" },
      { id: "liaoning", name: "辽宁", icon: "⚓" },
    ],
  },
  // ... 其他区域（华东、华中、华南、西南、西北）
];
```

---

## 🔧 技术要点

### 1. 数据库操作封装

```typescript
// src/main/database.ts
import sqlite3 from 'sqlite3';

export class Database {
  private db: sqlite3.Database;

  async initialize() {
    // 创建表结构
    // 插入预设数据
  }

  // 项目 CRUD
  async getProjects(): Promise<Project[]>
  async createProject(data: CreateProjectData): Promise<Project>
  async deleteProject(id: string): Promise<void>

  // 创意方向 CRUD
  async getCreativeDirections(projectId: string): Promise<CreativeDirection[]>
  async addCreativeDirection(data: AddDirectionData): Promise<CreativeDirection>

  // 人设 CRUD
  async getPersonas(projectId: string): Promise<Persona[]>
  async addPersona(data: AddPersonaData): Promise<Persona>

  // 脚本 CRUD
  async getScripts(projectId: string, status?: string): Promise<Script[]>
  async createScript(data: CreateScriptData): Promise<Script>
  async updateScriptStatus(id: string, status: string): Promise<void>
}
```

### 2. LangGraph 节点实现

```typescript
// src/main/langgraph/nodes/scriptNode.ts
export async function scriptNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  const { projectId, creativeDirectionId, personaId, aiModel, count } = state;

  // 1. 从数据库读取配置
  const project = await db.getProject(projectId);
  const direction = await db.getCreativeDirection(creativeDirectionId);
  const persona = await db.getPersona(personaId);

  // 2. 构造 prompt
  const systemPrompt = `你是一位${persona.name}。${persona.prompt}`;
  const userPrompt = `请根据"${direction.name}"风格，为${project.gameType}游戏生成${count}条营销脚本文案。`;

  // 3. 调用 LLM API
  const scripts = await callLLMAPI(aiModel, systemPrompt, userPrompt, count);

  // 4. 保存到数据库
  const savedScripts = await Promise.all(
    scripts.map(content => db.createScript({
      projectId,
      content,
      creativeDirectionId,
      personaId,
      aiModel,
      status: 'draft'
    }))
  );

  return { scripts: savedScripts };
}
```

### 3. React 组件示例

```typescript
// src/renderer/pages/ASide/components/ProjectLibrary.tsx
import { useASideStore } from '../../stores/asideStore';

export function ProjectLibrary() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const selectProject = useASideStore(state => state.selectProject);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const response = await window.api.getProjects();
    if (response.success) {
      setProjects(response.projects);
    }
  };

  const handleCreateProject = async (data: CreateProjectData) => {
    setIsCreating(true);
    const response = await window.api.createProject(data);
    if (response.success) {
      selectProject(response.project);
      useASideStore.getState().setCurrentView('step1-direction');
    }
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen p-8">
      {/* 项目列表 */}
      {/* 新建项目按钮 */}
    </div>
  );
}
```

---

## ✅ 质量保证

### 已安装的最佳实践 Skills

1. **vercel-react-best-practices** - React 前端最佳实践
2. **nodejs-backend-typescript** - Node.js + TypeScript 后端最佳实践
3. **electron-best-practices** - Electron 框架最佳实践
4. **database-design-expert** - 数据库设计专家
5. **langgraph-fundamentals** - LangGraph 基础和最佳实践

### 代码质量标准

- ✅ 所有代码使用 TypeScript 严格类型
- ✅ 遵循 React 函数式组件最佳实践
- ✅ 遵循 Electron 主进程/渲染进程分离原则
- ✅ SQLite 数据库设计遵循第三范式
- ✅ LangGraph 工作流设计清晰可维护

---

## 🚀 实施计划

详见 `writing-plans` skill 生成的实施计划文档。

---

**设计批准人**: 用户
**批准时间**: 2026-03-17
**文档状态**: ✅ 完成
