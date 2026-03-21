/**
 * 设置落地页
 * 展示各设置模块入口卡片
 */

import { MapPin, Cpu, ChevronRight } from 'lucide-react';

interface SettingsCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  view: string;
  available: boolean;
}

const SETTINGS_CARDS: SettingsCard[] = [
  {
    title: '地区设置',
    description: '管理创作地区库，编辑文化档案，支持添加自定义地区',
    icon: <MapPin className="w-6 h-6" />,
    view: 'settings-regions',
    available: true,
  },
  {
    title: 'AI 供应商设置',
    description: '配置 AI 模型供应商、API Key 和默认模型',
    icon: <Cpu className="w-6 h-6" />,
    view: 'settings-ai',
    available: false,
  },
];

interface SettingsPageProps {
  onNavigate: (view: string) => void;
}

/**
 * 设置落地页组件
 */
export function SettingsPage({ onNavigate }: SettingsPageProps) {
  return (
    <div className="h-full overflow-y-auto bg-black p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">设置</h1>
          <p className="text-slate-500 text-sm mt-1">管理应用全局配置</p>
        </div>

        <div className="space-y-3">
          {SETTINGS_CARDS.map((card) => (
            <button
              key={card.view}
              onClick={() => card.available && onNavigate(card.view)}
              disabled={!card.available}
              className={`
                w-full flex items-center gap-4 p-5 rounded-xl border text-left transition-all
                ${card.available
                  ? 'border-slate-800 hover:border-slate-600 hover:bg-slate-900/50 cursor-pointer'
                  : 'border-slate-800/50 opacity-50 cursor-not-allowed'}
              `}
            >
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                ${card.available ? 'bg-violet-600/20 text-violet-400' : 'bg-slate-800 text-slate-600'}
              `}>
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">{card.title}</span>
                  {!card.available && (
                    <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">即将推出</span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{card.description}</p>
              </div>
              {card.available && (
                <ChevronRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
