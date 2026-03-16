/**
 * AI 对话面板 - 导演助手
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Users, Film, FileText } from 'lucide-react';
import type { Script, Message } from '../types';

interface ChatPanelProps {
  script: Script | null;
  messages: Message[];
  onGenerateCharacter: () => void;
  onGenerateStoryboard: () => void;
  onScriptChange: (script: Script | null) => void;
  isProcessing: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  script,
  messages,
  onGenerateCharacter,
  onGenerateStoryboard,
  onScriptChange,
  isProcessing,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!input.trim()) return;

    // TODO: 调用后端 AI
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    // 临时添加 AI 回复
    const aiMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '收到您的消息，正在处理中...',
      timestamp: new Date(),
    };

    setInput('');
  };

  // 加载剧本
  const handleLoadScript = async () => {
    // TODO: 打开文件选择对话框
    console.log('加载剧本...');
  };

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-bold text-white">导演助手</h2>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* 欢迎消息 */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-600/20 to-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-white font-medium mb-2">欢迎使用导演助手</h3>
            <p className="text-sm text-slate-400">
              上传剧本或输入创作需求，AI 将协助您完成视频创作
            </p>
          </div>
        )}

        {/* 消息列表 */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg ${
              msg.role === 'user'
                ? 'bg-violet-500/20 text-violet-200 ml-8'
                : 'bg-slate-800 text-slate-200 mr-8'
            }`}
          >
            <p className="text-sm">{msg.content}</p>
            <p className="text-xs text-slate-500 mt-1">
              {msg.timestamp.toLocaleTimeString()}
            </p>
          </div>
        ))}

        {/* 处理中提示 */}
        {isProcessing && (
          <div className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg mr-8">
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">AI 正在处理...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 操作按钮 */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        {/* 剧本操作 */}
        <button
          onClick={handleLoadScript}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm font-medium">加载剧本</span>
        </button>

        {/* AI 生成按钮 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onGenerateCharacter}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">生成角色</span>
          </button>
          <button
            onClick={onGenerateStoryboard}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Film className="w-4 h-4" />
            <span className="text-sm font-medium">生成分镜</span>
          </button>
        </div>
      </div>

      {/* 输入框 */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="与 AI 导演助手对话..."
            className="flex-1 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
