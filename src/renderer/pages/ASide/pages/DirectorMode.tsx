/**
 * 导演模式页面
 * 4 个 Agent 依次工作，人工确认
 */

import React, { useState } from 'react';
import { Film, Bot, User, Check, ArrowRight } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import { ChatPanel } from '../components/DirectorMode/ChatPanel';
import { CanvasPanel } from '../components/DirectorMode/CanvasPanel';
import { useToastMessages } from '@renderer/components/Toast';

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
  const toast = useToastMessages();

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

      // 获取选中的脚本内容
      const script = libraryScripts.find(s => s.id === selectedScript);
      if (!script) {
        throw new Error('未找到选中的脚本');
      }

      // 第一次启动工作流
      if (currentAgent === 0 && agentOutputs.length === 0) {
        console.log('[DirectorMode] 启动工作流');

        const result = await window.api.aiStartWorkflow(script.content, {
          executionMode: 'director',
          videoSpec: {
            duration: 'short',
            aspectRatio: '16:9',
          },
          projectId: currentProject!.id,
        });

        if (!result.success || !result.state) {
          throw new Error(result.error || '启动工作流失败');
        }

        // 初始化导演模式工作流状态（用于后续的角色生成分镜等操作）
        const initResult = await window.api.asideInitDirectorWorkflow({
          screenplayId: script.id,
          scriptContent: script.content,
          videoSpec: {
            duration: 'short',
            aspectRatio: '16:9',
          },
        });

        if (!initResult.success) {
          console.error('[DirectorMode] 初始化导演模式工作流失败:', initResult.error);
        }

        console.log('[DirectorMode] 工作流步骤完成:', result.state?.currentStep);

        // 更新 Agent 输出
        const stepOutput = result.state?.step1_script?.content || '脚本优化完成';
        setAgentOutputs(prev => [...prev, stepOutput]);
      } else {
        // 恢复工作流（后续步骤）
        console.log('[DirectorMode] 恢复工作流，当前步骤:', currentAgent + 1);

        // 这里需要从 store 或 state 中获取当前工作流状态
        // 简化处理：重新启动工作流并执行到当前步骤
        const result = await window.api.aiStartWorkflow(script.content, {
          executionMode: 'fast', // 内部步骤使用快速模式
          videoSpec: {
            duration: 'short',
            aspectRatio: '16:9',
          },
          projectId: currentProject!.id,
        });

        if (!result.success) {
          throw new Error(result.error || '恢复工作流失败');
        }

        // 根据当前 Agent 获取对应的输出
        const outputs = [
          result.state?.step1_script?.content || '脚本优化完成',
          result.state?.step2_characters?.map(c => c.name).join(', ') || '角色生成完成',
          result.state?.step3_storyboard?.map(f => f.description).join('\n') || '分镜设计完成',
          result.state?.step4_video?.videoUrl || '视频生成完成',
        ];

        setAgentOutputs(prev => [...prev, outputs[currentAgent]]);
      }

      console.log('[DirectorMode] Agent 工作完成');
    } catch (error) {
      console.error('[DirectorMode] Agent 工作失败:', error);
      toast.error(`Agent 工作失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
      toast.success('视频生成完成！');
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
