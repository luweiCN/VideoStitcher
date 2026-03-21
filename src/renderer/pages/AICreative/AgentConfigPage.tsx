import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AgentConfigView from './agentStudio/TemplatesView';
import AGENTS from './agentStudio/agents';

const AgentConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();

  const agent = AGENTS.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">未找到 Agent</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <div className="flex items-center gap-3 px-8 py-6 border-b border-slate-800/60">
        <button
          onClick={() => navigate('/ai-creative/agent-studio')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm">Agent 定制</span>
        </button>
        <span className="text-slate-700">/</span>
        <h1 className="text-base font-semibold text-white">{agent.name}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center px-8 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black text-white mb-3">Agent 配置</h2>
          <p className="text-slate-400 text-sm max-w-lg">
            配置模型与提示词模板，设定一个模板为生效状态供 Agent 使用
          </p>
        </div>
        <AgentConfigView agent={agent} />
      </div>
    </div>
  );
};

export default AgentConfigPage;
