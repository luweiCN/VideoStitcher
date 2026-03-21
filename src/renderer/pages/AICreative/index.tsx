import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Film,
  Zap,
  Video,
  SlidersHorizontal,
  ChevronRight,
  FileText,
  Palette,
  Lightbulb,
  Plus,
  Check,
  Edit2,
  Trash2,
  Clock,
  Lock,
  Unlock,
  Cpu,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { BUILTIN_PROMPT_TEMPLATES } from '@shared/constants/promptTemplates';

// ─── 类型定义 ─────────────────────────────────────────────

type AICreativeView = 'hub' | 'prompt-studio' | 'prompt-templates';

type ModelType = 'text' | 'image' | 'video';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  description?: string;
}

/** 每个 Agent 支持的模型类型，以及各类型当前选中的 modelId */
type AgentModelConfig = Partial<Record<ModelType, string>>;

interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  iconColor: string;
  bgColor: string;
  icon: React.ElementType;
  /** 该 Agent 使用哪些类型的模型，决定渲染几个选择器 */
  modelTypes: ModelType[];
}

interface PromptTemplate {
  id: string;
  agentId: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

// ─── 常量配置 ─────────────────────────────────────────────

/** 各 Agent 配置（含描述，方便非技术成员理解职责） */
const AGENTS: AgentConfig[] = [
  {
    id: 'screenplay-agent',
    name: '剧本写作 Agent',
    role: '内容创作',
    description:
      '根据游戏信息、创意方向和目标受众，生成 15 秒短视频广告剧本。负责黄金 3 秒钩子、无厘头反转、B 面衔接三段式结构。',
    icon: FileText,
    iconColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10 group-hover:bg-violet-500',
    modelTypes: ['text'],
  },
  {
    id: 'art-director-agent',
    name: '艺术总监 Agent',
    role: '视觉设计',
    description:
      '分析剧本内容，设计角色形象与整体视觉风格，生成人物三视图图像提示词，为后续分镜和图像生成提供视觉方向指引。',
    icon: Palette,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10 group-hover:bg-blue-500',
    modelTypes: ['text', 'image'],
  },
  {
    id: 'creative-direction-agent',
    name: '创意方向生成 Agent',
    role: '创意策划',
    description:
      '根据游戏名称、类型和核心卖点，自动生成项目专属的创意方向选项，替代通用预设，让每个项目都有量身定制的创作风格。',
    icon: Lightbulb,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10 group-hover:bg-amber-500',
    modelTypes: ['text'],
  },
];

const MODEL_TYPE_LABEL: Record<ModelType, string> = {
  text: '文本模型',
  image: '图片模型',
  video: '视频模型',
};

const STORAGE_KEY = 'vs_prompt_templates';
const MODEL_STORAGE_KEY = 'vs_agent_models';

// ─── 提示词模板工具函数 ─────────────────────────────────────

function loadAllTemplates(): Record<string, PromptTemplate[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllTemplates(data: Record<string, PromptTemplate[]>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getAgentTemplates(agentId: string): PromptTemplate[] {
  return loadAllTemplates()[agentId] ?? [];
}

function upsertTemplate(template: PromptTemplate): void {
  const all = loadAllTemplates();
  const list = all[template.agentId] ?? [];
  const idx = list.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    list[idx] = template;
  } else {
    list.push(template);
  }
  all[template.agentId] = list;
  saveAllTemplates(all);
}

function deleteTemplate(agentId: string, templateId: string): void {
  const all = loadAllTemplates();
  all[agentId] = (all[agentId] ?? []).filter((t) => t.id !== templateId);
  saveAllTemplates(all);
}

function setActiveTemplate(agentId: string, templateId: string): void {
  const all = loadAllTemplates();
  all[agentId] = (all[agentId] ?? []).map((t) => ({
    ...t,
    isActive: t.id === templateId,
  }));
  saveAllTemplates(all);
}

/** 获取指定 Agent 当前各类型模型的选择（返回 per-type map） */
function getAgentModelConfig(agentId: string): AgentModelConfig {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY);
    const data: Record<string, AgentModelConfig> = raw ? JSON.parse(raw) : {};
    return data[agentId] ?? {};
  } catch {
    return {};
  }
}

/** 保存指定 Agent 某类型的模型选择 */
function saveAgentModelType(agentId: string, type: ModelType, modelId: string): void {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY);
    const data: Record<string, AgentModelConfig> = raw ? JSON.parse(raw) : {};
    data[agentId] = { ...(data[agentId] ?? {}), [type]: modelId };
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储失败静默处理
  }
}

// ─── 子视图：Hub ──────────────────────────────────────────

const HubView: React.FC<{
  onNavigate: (view: AICreativeView, payload?: unknown) => void;
}> = ({ onNavigate }) => {
  const navigate = useNavigate();

  const cards = [
    {
      id: 'screenplay',
      title: 'A面视频剧本生成',
      desc: '从游戏信息到剧本，AI 批量生成广告脚本',
      icon: Sparkles,
      hoverBorder: 'hover:border-violet-500',
      hoverShadow: 'hover:shadow-violet-500/10',
      iconBg: 'bg-violet-500/10 group-hover:bg-violet-500',
      iconColor: 'text-violet-400',
      titleHover: 'group-hover:text-violet-400',
      bgIcon: 'text-violet-500/5',
      comingSoon: false,
      onClick: () => navigate('/aside'),
    },
    {
      id: 'director',
      title: '导演模式',
      desc: '逐节点人工介入，精准把控每个创作细节',
      icon: Film,
      hoverBorder: 'hover:border-blue-500',
      hoverShadow: 'hover:shadow-blue-500/10',
      iconBg: 'bg-blue-500/10 group-hover:bg-blue-500',
      iconColor: 'text-blue-400',
      titleHover: 'group-hover:text-blue-400',
      bgIcon: 'text-blue-500/5',
      comingSoon: false,
      onClick: () => navigate('/aside'),
    },
    {
      id: 'quick',
      title: '快速生成模式',
      desc: 'AI 全程自动化，跳过审核快速出素材',
      icon: Zap,
      hoverBorder: 'hover:border-emerald-500',
      hoverShadow: 'hover:shadow-emerald-500/10',
      iconBg: 'bg-emerald-500/10 group-hover:bg-emerald-500',
      iconColor: 'text-emerald-400',
      titleHover: 'group-hover:text-emerald-400',
      bgIcon: 'text-emerald-500/5',
      comingSoon: false,
      onClick: () => navigate('/aside'),
    },
    {
      id: 'bside',
      title: 'B面视频生产',
      desc: '录屏剪辑与 A 面素材合成',
      icon: Video,
      hoverBorder: 'hover:border-slate-600',
      hoverShadow: '',
      iconBg: 'bg-slate-700/50',
      iconColor: 'text-slate-500',
      titleHover: 'group-hover:text-slate-400',
      bgIcon: 'text-slate-600/5',
      comingSoon: true,
      onClick: undefined,
    },
    {
      id: 'prompts',
      title: '提示词定制',
      desc: '管理各 Agent 的创作指令，团队协作调优',
      icon: SlidersHorizontal,
      hoverBorder: 'hover:border-amber-500',
      hoverShadow: 'hover:shadow-amber-500/10',
      iconBg: 'bg-amber-500/10 group-hover:bg-amber-500',
      iconColor: 'text-amber-400',
      titleHover: 'group-hover:text-amber-400',
      bgIcon: 'text-amber-500/5',
      comingSoon: false,
      onClick: () => onNavigate('prompt-studio'),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
      {cards.map((card) => {
        const Icon = card.icon;
        const isDisabled = card.comingSoon;

        return (
          <button
            key={card.id}
            onClick={card.onClick}
            disabled={isDisabled}
            className={`group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all ${
              isDisabled
                ? 'opacity-50 cursor-not-allowed'
                : `cursor-pointer ${card.hoverBorder} hover:shadow-lg ${card.hoverShadow} hover:-translate-y-0.5`
            }`}
          >
            {/* 背景装饰图标 */}
            <div className={`absolute top-0 right-0 p-3 opacity-10 transition-opacity ${card.bgIcon}`}>
              <Icon className="w-16 h-16" />
            </div>

            {/* 开发中标签 */}
            {card.comingSoon && (
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-slate-700 rounded-full">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">开发中</span>
              </div>
            )}

            <div className="relative z-10 space-y-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${card.iconBg} ${card.iconColor} group-hover:text-white`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h2 className={`text-lg font-bold mb-1 text-white transition-colors ${card.titleHover}`}>
                  {card.title}
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── 子视图：PromptStudio Agent 列表 ──────────────────────

const PromptStudioView: React.FC<{
  onSelectAgent: (agent: AgentConfig) => void;
}> = ({ onSelectAgent }) => {
  const templateCounts = AGENTS.reduce<Record<string, number>>((acc, agent) => {
    acc[agent.id] = getAgentTemplates(agent.id).length;
    return acc;
  }, {});

  return (
    <div className="w-full max-w-2xl space-y-3">
      <p className="text-slate-400 text-sm mb-6">
        点击 Agent 查看并管理其提示词模板。每个 Agent 可以有多个模板，但同时只有一个生效。
      </p>
      {AGENTS.map((agent) => {
        const Icon = agent.icon;
        const count = templateCounts[agent.id];
        const templates = getAgentTemplates(agent.id);
        const active = templates.find((t) => t.isActive);

        return (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className="group w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-slate-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${agent.bgColor} ${agent.iconColor} group-hover:text-white`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-white">{agent.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-800 rounded-full text-xs text-slate-400">
                    {agent.role}
                  </span>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed mb-3">{agent.description}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {count > 0 ? (
                    <>
                      <span>{count} 个自定义模板</span>
                      {active && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Check className="w-3 h-3" />
                            生效中：{active.name}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span>使用内置提示词</span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-1" />
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ─── 内置模板卡片（只读，可展开查看完整内容）──────────────

const BuiltinTemplateCard: React.FC<{
  template: (typeof BUILTIN_PROMPT_TEMPLATES)[number];
  isActive: boolean;
}> = ({ template, isActive }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-300">{template.name}</span>
            <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400">只读</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">系统内置，不可删除或修改</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isActive && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-xs text-emerald-400">
              <Check className="w-3 h-3" />
              生效中
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-white transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-700"
          >
            {expanded ? '收起' : '查看内容'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* 可编辑层 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">可编辑层</span>
              <span className="text-xs text-slate-500 ml-1">— Agent 人设、创意指南、示例（可在自定义模板中调整）</span>
            </div>
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-800/60 rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed border border-amber-500/10">
              {template.editablePart}
            </pre>
          </div>

          {/* 锁定层 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-400">锁定层</span>
              <span className="text-xs text-slate-500 ml-1">— JSON 格式、图标列表（代码依赖，禁止修改）</span>
            </div>
            <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap bg-slate-800/30 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed border border-slate-700/30">
              {template.lockedPart}
            </pre>
          </div>

          {/* 动态提示词 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-semibold text-slate-400">动态提示词</span>
              <span className="text-xs text-slate-500 ml-1">— 变量由代码注入（{'{{gameName}}'} 等）</span>
            </div>
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-800/60 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed">
              {template.userPromptTemplate}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 自定义模板卡片（可展开查看内容）────────────────────────

const CustomTemplateCard: React.FC<{
  template: PromptTemplate;
  builtinLockedPart?: string;
  builtinUserPromptTemplate?: string;
  onSetActive: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ template: t, builtinLockedPart, builtinUserPromptTemplate, onSetActive, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* 卡片头部 */}
      <div className="flex items-center gap-2 p-4">
        <span className="text-sm font-semibold text-white flex-1 min-w-0 truncate">{t.name}</span>
        {t.isActive && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-xs text-emerald-400 flex-shrink-0">
            <Check className="w-3 h-3" />
            生效中
          </span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-white transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-700"
          >
            {expanded ? '收起' : '查看内容'}
          </button>
          {!t.isActive && (
            <button
              onClick={() => onSetActive(t.id)}
              title="设为生效"
              className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(t.id)}
            title="编辑"
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(t.id)}
            title="删除"
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* 可编辑层（用户自定义内容） */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">可编辑层</span>
              <span className="text-xs text-slate-500 ml-1">— 自定义的 Agent 人设、创意指南、示例</span>
            </div>
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-800/60 rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed border border-amber-500/10">
              {t.content}
            </pre>
          </div>

          {/* 锁定层（沿用内置模板，只读） */}
          {builtinLockedPart && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-400">锁定层</span>
                <span className="text-xs text-slate-500 ml-1">— JSON 格式、图标列表（代码依赖，禁止修改）</span>
              </div>
              <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap bg-slate-800/30 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed border border-slate-700/30">
                {builtinLockedPart}
              </pre>
            </div>
          )}

          {/* 动态提示词（沿用内置模板，只读） */}
          {builtinUserPromptTemplate && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-semibold text-slate-400">动态提示词</span>
                <span className="text-xs text-slate-500 ml-1">— 变量由代码注入（{'{{gameName}}'} 等）</span>
              </div>
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-800/60 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed">
                {builtinUserPromptTemplate}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 子视图：模板列表 ─────────────────────────────────────

const TemplatesView: React.FC<{
  agent: AgentConfig;
}> = ({ agent }) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>(() =>
    getAgentTemplates(agent.id)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [modelConfig, setModelConfig] = useState<AgentModelConfig>(() =>
    getAgentModelConfig(agent.id)
  );
  // 按类型缓存从 IPC 获取的模型列表
  const [modelsByType, setModelsByType] = useState<Partial<Record<ModelType, AIModel[]>>>({});

  // 加载该 Agent 所需的各类型模型列表
  useEffect(() => {
    agent.modelTypes.forEach(async (type) => {
      const result = await window.api.getAIModels(type);
      if (result.success && result.models) {
        setModelsByType((prev) => ({ ...prev, [type]: result.models }));
      }
    });
  }, [agent.id]);

  const refresh = () => setTemplates(getAgentTemplates(agent.id));

  const handleModelTypeChange = (type: ModelType, modelId: string) => {
    setModelConfig((prev) => ({ ...prev, [type]: modelId }));
    saveAgentModelType(agent.id, type, modelId);
  };

  const handleCreate = () => {
    if (!newName.trim() || !newContent.trim()) return;
    const t: PromptTemplate = {
      id: `${agent.id}-${Date.now()}`,
      agentId: agent.id,
      name: newName.trim(),
      content: newContent.trim(),
      isActive: templates.length === 0, // 第一个模板自动生效
      createdAt: new Date().toISOString(),
    };
    upsertTemplate(t);
    setIsCreating(false);
    setNewName('');
    setNewContent('');
    refresh();
  };

  const handleSaveEdit = (id: string) => {
    const t = templates.find((t) => t.id === id);
    if (!t || !editingName.trim() || !editingContent.trim()) return;
    upsertTemplate({ ...t, name: editingName.trim(), content: editingContent.trim() });
    setEditingId(null);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteTemplate(agent.id, id);
    refresh();
  };

  const handleSetActive = (id: string) => {
    setActiveTemplate(agent.id, id);
    refresh();
  };

  const Icon = agent.icon;

  // 找到该 Agent 的内置模板（来自共享常量）
  const builtinTemplate = BUILTIN_PROMPT_TEMPLATES.find((t) => t.agentId === agent.id);
  const hasActiveCustom = templates.some((t) => t.isActive);

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Agent 信息头部 */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${agent.bgColor} ${agent.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{agent.name}</div>
          <div className="text-xs text-slate-500">{agent.role}</div>
        </div>
      </div>

      {/* 模型选择 — 每种类型一个 Radix Select */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">使用模型</span>
          <span className="text-xs text-slate-500 ml-1">为此 Agent 指定独立的模型，覆盖系统全局配置</span>
        </div>

        {agent.modelTypes.map((type) => {
          const models = modelsByType[type] ?? [];
          const selectedId = modelConfig[type] ?? 'default';
          const selectedName = models.find((m) => m.id === selectedId)?.name ?? '默认模型（系统配置）';

          return (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-16 flex-shrink-0">{MODEL_TYPE_LABEL[type]}</span>

              <Select.Root
                value={selectedId}
                onValueChange={(val) => handleModelTypeChange(type, val)}
              >
                <Select.Trigger className="flex items-center justify-between gap-2 flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white hover:border-slate-500 focus:outline-none focus:border-violet-500 data-[placeholder]:text-slate-400 cursor-pointer transition-colors">
                  <Select.Value placeholder="选择模型">
                    {selectedName}
                  </Select.Value>
                  <Select.Icon>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </Select.Icon>
                </Select.Trigger>

                <Select.Portal>
                  <Select.Content
                    className="z-50 min-w-[280px] bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
                    position="popper"
                    sideOffset={4}
                  >
                    <Select.ScrollUpButton className="flex items-center justify-center py-1 text-slate-400">
                      <ChevronUp />
                    </Select.ScrollUpButton>

                    <Select.Viewport className="p-1">
                      {/* 默认选项 */}
                      <Select.Item
                        value="default"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-lg cursor-pointer hover:bg-slate-700 hover:text-white focus:bg-slate-700 focus:text-white focus:outline-none data-[highlighted]:bg-slate-700 data-[highlighted]:text-white"
                      >
                        <Select.ItemIndicator>
                          <Check className="w-4 h-4 text-violet-400" />
                        </Select.ItemIndicator>
                        <Select.ItemText>默认模型（系统配置）</Select.ItemText>
                      </Select.Item>

                      {models.length > 0 && (
                        <>
                          <div className="mx-2 my-1 border-t border-slate-700" />
                          {models.map((model) => (
                            <Select.Item
                              key={model.id}
                              value={model.id}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-lg cursor-pointer hover:bg-slate-700 hover:text-white focus:outline-none data-[highlighted]:bg-slate-700 data-[highlighted]:text-white"
                            >
                              <Select.ItemIndicator>
                                <Check className="w-4 h-4 text-violet-400" />
                              </Select.ItemIndicator>
                              <div className="flex-1 min-w-0">
                                <Select.ItemText>{model.name}</Select.ItemText>
                                <div className="text-xs text-slate-500">{model.provider}</div>
                              </div>
                            </Select.Item>
                          ))}
                        </>
                      )}

                      {models.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-500">暂无可用模型</div>
                      )}
                    </Select.Viewport>

                    <Select.ScrollDownButton className="flex items-center justify-center py-1 text-slate-400">
                      <ChevronDown />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          );
        })}
      </div>

      {/* 内置提示词（只读展示，带实际内容） */}
      {builtinTemplate ? (
        <BuiltinTemplateCard
          template={builtinTemplate}
          isActive={!hasActiveCustom}
        />
      ) : (
        <div className="flex items-start gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-slate-300 mb-0.5">内置提示词（只读）</div>
            <div className="text-xs text-slate-500 leading-relaxed">
              系统内置的默认提示词，不可编辑。若无自定义模板处于生效状态，Agent 将使用此提示词。
            </div>
          </div>
          <div className="ml-auto flex-shrink-0">
            {!hasActiveCustom && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-xs text-emerald-400">
                <Check className="w-3 h-3" />
                生效中
              </span>
            )}
          </div>
        </div>
      )}

      {/* 自定义模板列表 */}
      {templates.map((t) =>
        editingId === t.id ? (
          // 编辑状态（内联表单）
          <div key={t.id} className="bg-slate-900 border border-violet-500/30 rounded-xl p-4 space-y-3">
            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              placeholder="模板名称"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="提示词内容（可编辑层，替换内置的 Agent 人设和创意指南）"
              rows={8}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono resize-y"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => handleSaveEdit(t.id)}
                className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          // 展示状态（可展开卡片）
          <CustomTemplateCard
            key={t.id}
            template={t}
            builtinLockedPart={builtinTemplate?.lockedPart}
            builtinUserPromptTemplate={builtinTemplate?.userPromptTemplate}
            onSetActive={handleSetActive}
            onEdit={(id) => {
              const tpl = templates.find((x) => x.id === id);
              if (tpl) {
                setEditingId(id);
                setEditingName(tpl.name);
                setEditingContent(tpl.content);
              }
            }}
            onDelete={handleDelete}
          />
        )
      )}

      {/* 新建模板表单 */}
      {isCreating ? (
        <div className="bg-slate-900 border border-violet-500/30 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-white">新建模板</div>
          <p className="text-xs text-slate-500">
            自定义模板只需填写「可编辑层」内容（Agent 人设、创意指南、示例），锁定层（JSON 格式、图标列表）由系统自动追加。
          </p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="模板名称，如：游戏广告增强版"
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="在此粘贴或输入可编辑层提示词内容..."
            rows={8}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono resize-y"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setIsCreating(false);
                setNewName('');
                setNewContent('');
              }}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newContent.trim()}
              className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors cursor-pointer"
            >
              创建
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-white hover:border-slate-500 transition-colors text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          新建模板
        </button>
      )}
    </div>
  );
};

// ─── 主页面 ───────────────────────────────────────────────

const AICreativePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<AICreativeView>('hub');
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);

  const handleNavigate = (view: AICreativeView) => {
    setCurrentView(view);
  };

  const handleSelectAgent = (agent: AgentConfig) => {
    setSelectedAgent(agent);
    setCurrentView('prompt-templates');
  };

  const handleBack = () => {
    if (currentView === 'prompt-templates') {
      setCurrentView('prompt-studio');
      setSelectedAgent(null);
    } else if (currentView === 'prompt-studio') {
      setCurrentView('hub');
    } else {
      navigate('/');
    }
  };

  // 面包屑标题
  const titles: Record<AICreativeView, string> = {
    hub: 'AI 创意视频',
    'prompt-studio': '提示词定制',
    'prompt-templates': selectedAgent?.name ?? '',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* 顶部导航栏 */}
      <div className="flex items-center gap-3 px-8 py-6 border-b border-slate-800/60">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm">
            {currentView === 'hub' ? '返回首页' : currentView === 'prompt-studio' ? 'AI 创意视频' : '提示词定制'}
          </span>
        </button>

        <span className="text-slate-700">/</span>
        <h1 className="text-base font-semibold text-white">{titles[currentView]}</h1>
      </div>

      {/* 页面内容 */}
      <div className="flex-1 flex flex-col items-center px-8 py-12">
        {currentView === 'hub' && (
          <>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full mb-4">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-violet-400 font-medium">AI 驱动的创意视频生产</span>
              </div>
              <h2 className="text-3xl font-black text-white mb-3">AI 创意视频</h2>
              <p className="text-slate-400 text-base max-w-lg">
                从剧本创作到视频合成，全流程 AI 辅助生产工具
              </p>
            </div>
            <HubView onNavigate={handleNavigate} />
          </>
        )}

        {currentView === 'prompt-studio' && (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-white mb-3">提示词定制</h2>
              <p className="text-slate-400 text-sm max-w-lg">
                为每个 Agent 创建专属提示词模板，优化 AI 创作质量
              </p>
            </div>
            <PromptStudioView onSelectAgent={handleSelectAgent} />
          </>
        )}

        {currentView === 'prompt-templates' && selectedAgent && (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-white mb-3">提示词模板</h2>
              <p className="text-slate-400 text-sm max-w-lg">
                创建多个模板进行对比，设定一个为生效状态供 Agent 使用
              </p>
            </div>
            <TemplatesView agent={selectedAgent} />
          </>
        )}
      </div>
    </div>
  );
};

export default AICreativePage;
