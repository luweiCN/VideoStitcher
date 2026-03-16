/**
 * 导演模式页面
 * 4 个 Agent 依次工作，人工确认
 */

import React, { useState } from 'react';
import { Film, Bot, User, Check, ArrowRight } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import { ChatPanel } from '../components/DirectorMode/ChatPanel';
import { CanvasPanel } from '../components/DirectorMode/CanvasPanel';

/**
 * Agent 定义
 */
const AGENTS = [
  { id: 'script', name: '脚本编写', icon: '📝', description: '根据创意方向编写脚本' },
  { id: 'storyboard', name: '分镜设计', icon: '🎬', description: '设计视频分镜和场景' },
  { id: 'visual', name: '视觉生成', icon: '🎨', description: '生成视觉素材' },
  { id: 'render', name: '视频渲染', icon: '🎥', description: '合成最终视频' },
];

/**
 * 导演模式页面组件
 */
export function DirectorMode() {
  const { currentProject, libraryScripts } = useASideStore();

  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [currentAgent, setCurrentAgent] = useState(0);
  const [isAgentWorking, setIsAgentWorking] = useState(false);
  const [agentOutputs, setAgentOutputs] = useState<string[]>([]);

  /**
   * 选择脚本
   */
  const handleSelectScript = (scriptId: string) => {
    setSelectedScript(scriptId);
    setCurrentAgent(0);
    setAgentOutputs([]);
  };

  /**
   * 开始 Agent 工作
   */
  const handleStartAgent = async () => {
    try {
      setIsAgentWorking(true);

      console.log('[DirectorMode] Agent 开始工作:', AGENTS[currentAgent].name);

      // TODO: 调用 Agent IPC
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 模拟 Agent 输出
      const output = `${AGENTS[currentAgent].name} 完成！输出内容...`;
      setAgentOutputs(prev => [...prev, output]);

      console.log('[DirectorMode] Agent 工作完成');
    } catch (error) {
      console.error('[DirectorMode] Agent 工作失败:', error);
      alert('Agent 工作失败，请重试');
    } finally {
      setIsAgentWorking(false);
    }
  };

  /**
   * 确认并进入下一步
   */
  const handleConfirm = () => {
    if (currentAgent < AGENTS.length - 1) {
      setCurrentAgent(currentAgent + 1);
    } else {
      alert('视频生成完成！');
    }
  };

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择一个项目</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100">
      {/* 头部 */}
      <header className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Film className="w-6 h-6 text-violet-400" />
          <h1 className="text-2xl font-bold">导演模式</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">4 个 Agent 依次协作，人工确认</p>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：脚本选择 */}
        <div className="w-80 border-r border-slate-800 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="font-semibold">选择脚本</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {libraryScripts.length === 0 ? (
              <div className="text-center text-slate-500 text-sm">
                <p>待产库为空</p>
                <p className="mt-1">请先生成脚本</p>
              </div>
            ) : (
              <div className="space-y-2">
                {libraryScripts.map((script, index) => (
                  <button
                    key={script.id}
                    onClick={() => handleSelectScript(script.id)}
                    className={`
                      w-full text-left p-3 rounded-lg border transition-all
                      ${
                        selectedScript === script.id
                          ? 'bg-violet-600/10 border-violet-600'
                          : 'bg-black/50 border-slate-800 hover:border-slate-700'
                      }
                    `}
                  >
                    <div className="text-xs text-slate-500 mb-1">#{index + 1}</div>
                    <div className="text-sm text-slate-300 line-clamp-2">{script.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 中间：Agent 工作区 */}
        <div className="flex-1 flex flex-col">
          {/* Agent 进度 */}
          <div className="px-6 py-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              {AGENTS.map((agent, index) => (
                <React.Fragment key={agent.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2
                        ${
                          index < currentAgent
                            ? 'bg-green-600/20 border-2 border-green-600'
                            : index === currentAgent
                            ? 'bg-violet-600/20 border-2 border-violet-600'
                            : 'bg-slate-800'
                        }
                      `}
                    >
                      {index < currentAgent ? <Check className="w-6 h-6 text-green-600" /> : agent.icon}
                    </div>
                    <div className="text-xs text-slate-400">{agent.name}</div>
                  </div>
                  {index < AGENTS.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Agent 详情 */}
          {selectedScript && (
            <div className="flex-1 flex">
              {/* 聊天面板 */}
              <div className="flex-1 border-r border-slate-800">
                <ChatPanel
                  agent={AGENTS[currentAgent]}
                  isWorking={isAgentWorking}
                  onStart={handleStartAgent}
                  onConfirm={handleConfirm}
                />
              </div>

              {/* 画布面板 */}
              <div className="w-96">
                <CanvasPanel output={agentOutputs[currentAgent]} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
