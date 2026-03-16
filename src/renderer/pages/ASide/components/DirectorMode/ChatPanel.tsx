/**
 * 聊天面板组件
 * 与 Agent 交互的聊天界面
 */

import { Send } from 'lucide-react';
import { useState } from 'react';

interface ChatPanelProps {
  /** Agent 信息 */
  agent: { id: string; name: string; icon: string; description: string };
  /** 是否正在工作 */
  isWorking: boolean;
  /** 开始回调 */
  onStart: () => void;
  /** 确认回调 */
  onConfirm: () => void;
}

/**
 * 聊天面板组件
 */
export function ChatPanel({ agent, isWorking, onStart, onConfirm }: ChatPanelProps) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');

  /**
   * 发送消息
   */
  const handleSend = () => {
    if (!input.trim()) return;

    setMessages(prev => [
      ...prev,
      { role: 'user', content: input.trim() },
    ]);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* Agent 信息 */}
      <div className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-violet-600/20 rounded-lg flex items-center justify-center text-2xl">
            {agent.icon}
          </div>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-xs text-slate-500">{agent.description}</p>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">{agent.icon}</div>
            <p className="text-slate-500 mb-4">准备好开始 {agent.name}</p>
            <button
              onClick={onStart}
              disabled={isWorking}
              className={`
                px-6 py-3 rounded-lg transition-all
                ${
                  isWorking
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-pink-600 to-violet-600 text-white hover:opacity-90'
                }
              `}
            >
              {isWorking ? '工作中...' : '开始工作'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[70%] px-4 py-2 rounded-lg
                    ${
                      message.role === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }
                  `}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div className="px-6 py-4 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入指令或反馈..."
            className="flex-1 px-4 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700"
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
