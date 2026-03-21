/**
 * AI 创意视频 - 设置落地页（二级目录）
 * 展示各设置模块入口
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Cpu, ChevronRight, Settings } from 'lucide-react';

interface SettingEntry {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  available: boolean;
}

const SETTINGS: SettingEntry[] = [
  {
    title: '地区设置',
    description: '管理创作地区库，编辑各地区文化档案，支持添加自定义地区',
    icon: <MapPin className="w-5 h-5" />,
    path: '/ai-creative/settings/regions',
    available: true,
  },
  {
    title: 'AI 供应商设置',
    description: '配置 AI 模型供应商、API Key 和各 Agent 默认模型',
    icon: <Cpu className="w-5 h-5" />,
    path: '/ai-creative/settings/ai-provider',
    available: false,
  },
];

const AICreativeSettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* 面包屑导航 */}
      <div className="flex items-center gap-3 px-8 py-6 border-b border-slate-800/60">
        <button
          onClick={() => navigate('/ai-creative')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm">AI 创意视频</span>
        </button>
        <span className="text-slate-700">/</span>
        <div className="flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-slate-400" />
          <h1 className="text-base font-semibold text-white">设置</h1>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 flex flex-col items-center px-8 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">设置</h2>
            <p className="text-slate-500 text-sm mt-1">管理 AI 创意视频的全局配置</p>
          </div>

          <div className="space-y-3">
            {SETTINGS.map(entry => (
              <button
                key={entry.path}
                onClick={() => entry.available && navigate(entry.path)}
                disabled={!entry.available}
                className={`
                  w-full flex items-center gap-4 p-5 rounded-xl border text-left transition-all
                  ${entry.available
                    ? 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 cursor-pointer'
                    : 'border-slate-800/40 opacity-40 cursor-not-allowed'
                  }
                `}
              >
                {/* 图标 */}
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                  ${entry.available ? 'bg-slate-800 text-slate-400' : 'bg-slate-800/50 text-slate-600'}
                `}>
                  {entry.icon}
                </div>

                {/* 文字 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-100 text-sm">{entry.title}</span>
                    {!entry.available && (
                      <span className="text-[10px] text-slate-600 border border-slate-800 px-1.5 py-0.5 rounded-full">
                        即将推出
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{entry.description}</p>
                </div>

                {entry.available && (
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICreativeSettingsPage;
