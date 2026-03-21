import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import AgentStudioView from './agentStudio';
import AGENTS from './agentStudio/agents';

const AgentStudioPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <div className="flex items-center gap-3 px-8 py-6 border-b border-slate-800/60">
        <button
          onClick={() => navigate('/ai-creative')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm">AI 创意视频</span>
        </button>
        <span className="text-slate-700">/</span>
        <h1 className="text-base font-semibold text-white">Agent 定制</h1>
      </div>

      <div className="flex-1 flex flex-col items-center px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-4">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">管理各 Agent 的模型与提示词</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Agent 定制</h2>
          <p className="text-slate-400 text-sm max-w-lg">为每个 Agent 配置模型与提示词，优化 AI 创作质量</p>
        </div>
        <AgentStudioView
          agents={AGENTS}
          onSelectAgent={(agent) => navigate(`/ai-creative/agent-studio/${agent.id}`)}
        />
      </div>
    </div>
  );
};

export default AgentStudioPage;
