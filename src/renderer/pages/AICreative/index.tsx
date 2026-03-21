import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Film,
  Zap,
  Video,
  SlidersHorizontal,
  FileText,
  Palette,
  Lightbulb,
  Clock,
} from 'lucide-react';
import type { AgentConfig } from './promptStudio/types';
import PromptStudioView from './promptStudio';
import TemplatesView from './promptStudio/TemplatesView';

// ─── 视图类型 ──────────────────────────────────────────────

type AICreativeView = 'hub' | 'prompt-studio' | 'prompt-templates';

// ─── Agent 配置（含 modelTypes 声明） ─────────────────────

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

// ─── Hub 视图 ──────────────────────────────────────────────

const HubView: React.FC<{
  onNavigate: (view: AICreativeView) => void;
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
            <div className={`absolute top-0 right-0 p-3 opacity-10 transition-opacity ${card.bgIcon}`}>
              <Icon className="w-16 h-16" />
            </div>
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

// ─── 主页面 ───────────────────────────────────────────────

const AICreativePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<AICreativeView>('hub');
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);

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

  const titles: Record<AICreativeView, string> = {
    hub: 'AI 创意视频',
    'prompt-studio': '提示词定制',
    'prompt-templates': selectedAgent?.name ?? '',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <div className="flex items-center gap-3 px-8 py-6 border-b border-slate-800/60">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm">
            {currentView === 'hub'
              ? '返回首页'
              : currentView === 'prompt-studio'
                ? 'AI 创意视频'
                : '提示词定制'}
          </span>
        </button>
        <span className="text-slate-700">/</span>
        <h1 className="text-base font-semibold text-white">{titles[currentView]}</h1>
      </div>

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
            <HubView onNavigate={setCurrentView} />
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
            <PromptStudioView
              agents={AGENTS}
              onSelectAgent={(agent) => {
                setSelectedAgent(agent);
                setCurrentView('prompt-templates');
              }}
            />
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
