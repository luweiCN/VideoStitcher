import React from 'react';
import { ChevronRight, Check } from 'lucide-react';
import type { AgentConfig } from './types';
import { getAgentTemplates } from './storage';

const AgentStudioView: React.FC<{
  agents: AgentConfig[];
  onSelectAgent: (agent: AgentConfig) => void;
}> = ({ agents, onSelectAgent }) => {
  return (
    <div className="w-full max-w-2xl space-y-3">
      <p className="text-slate-400 text-sm mb-6">
        点击 Agent 进行配置。每个 Agent 可创建多个提示词模板，同时只有一个生效。
      </p>
      {agents.map((agent) => {
        const Icon = agent.icon;
        const templates = getAgentTemplates(agent.id);
        const count = templates.length;
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

export default AgentStudioView;
