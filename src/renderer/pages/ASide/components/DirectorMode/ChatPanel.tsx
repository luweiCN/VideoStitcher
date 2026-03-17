/**
 * 聊天面板组件 - 导演模式 Agent 工作流
 * 綈息气泡布局 + Agent 交互
 */

import { Send, User, Film, Palette, Video, from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// Agent 类型定义
interface Agent {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

// 工作流步骤
type WorkflowStep =
  | 'art-director'      // 艺术总监
  | 'casting-director'   // 选角导演
  | 'storyboard-artist'  // 分镜师
  | 'camera-director';   // 摄像导演

// 消息类型
interface Message {
  id: string;
  agentId: string;
  type: 'text' | 'options';
  content: string;
  options?: { label: string; value: string }[];
  timestamp: Date;
}

interface ChatPanelProps {
  /** 当前剧本 */
  screenplayId: string;
  /** 工作流完成回调 */
  onComplete?: () => void;
}

// Agent 配置
const AGENTS: Agent[] = [
  {
    id: 'art-director',
    name: '艺术总监',
    icon: <Film className="w-5 h-5" />,
    description: '确认视频长度和方向',
  },
  {
    id: 'casting-director',
    name: '选角导演',
    icon: <User className="w-5 h-5" />,
    description: '根据剧本生成角色',
  },
  {
    id: 'storyboard-artist',
    name: '分镜师',
    icon: <Palette className="w-5 h-5" />,
    description: '生成关键帧分镜图',
  },
  {
    id: 'camera-director',
    name: '摄像导演',
    icon: <Video className="w-5 h-5" />,
    description: '生成分镜视频',
  },
];

export function ChatPanel({ screenplayId, onComplete }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('art-director');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 添加初始 Agent 消息
  useEffect(() => {
    addAgentMessage('art-director', '欢迎来到导演模式！我会引导你完成视频创作。');
    addAgentMessage('art-director', '首先，请确认视频的长度：', [
      { label: '长视频 (1-3分钟)', value: 'long' },
      { label: '短视频 (15-60秒)', value: 'short' },
    ]);
  }, []);

  // 添加 Agent 消息
  const addAgentMessage = (
    agentId: string,
    content: string,
    options?: { label: string; value: string }[]
  ) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random()}`,
      agentId,
      type: options ? 'options' : 'text',
      content,
      options,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  // 处理用户选择选项
  const handleSelectOption = async (value: string) => {
    if (currentStep === 'art-director') {
      if (value === 'long' || value === 'short') {
        // 用户选择了视频长度
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-user`,
            agentId: 'user',
            type: 'text',
            content: value === 'long' ? '长视频 (1-3分钟)' : '短视频 (15-60秒)',
            timestamp: new Date(),
          },
        ]);

        addAgentMessage('art-director', '接下来，请确认视频方向：', [
          { label: '横版 (16:9)', value: 'landscape' },
          { label: '竖版 (9:16)', value: 'portrait' },
        ]);
      } else if (value === 'landscape' || value === 'portrait') {
        // 用户选择了视频方向
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-user`,
            agentId: 'user',
            type: 'text',
            content: value === 'landscape' ? '横版 (16:9)' : '竖版 (9:16)',
            timestamp: new Date(),
          },
        ]);

        // 进入下一步：选角导演
        setTimeout(() => {
          addAgentMessage('casting-director', '收到！现在开始选角工作。请选择：');
          addAgentMessage('casting-director', '你想如何生成角色？', [
            { label: '上传参考图', value: 'upload' },
            { label: '自由发挥', value: 'free' },
          ]);
          setCurrentStep('casting-director');
        }, 1000);
      }
    } else if (currentStep === 'casting-director') {
      if (value === 'upload' || value === 'free') {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-user`,
            agentId: 'user',
            type: 'text',
            content: value === 'upload' ? '上传参考图' : '自由发挥',
            timestamp: new Date(),
          },
        ]);
        setIsProcessing(true);
        setTimeout(() => {
          addAgentMessage(
            'casting-director',
            value === 'upload' ? '正在根据参考图生成角色...' : '正在根据剧本自由创作角色...'
          );
          setTimeout(() => {
            addAgentMessage('casting-director', '✅ 角色生成完成！请查看右侧画板。');
            setIsProcessing(false);
            // 进入下一步：分镜师
            setTimeout(() => {
              addAgentMessage('storyboard-artist', '角色已就位。现在开始生成分镜图...');
              setCurrentStep('storyboard-artist');
              setIsProcessing(true);
              setTimeout(() => {
                addAgentMessage('storyboard-artist', '✅ 分镜图生成完成！请查看右侧画板。');
                setIsProcessing(false);
                // 进入最后一步：摄像导演
                setTimeout(() => {
                  addAgentMessage('camera-director', '分镜图已确认。现在开始生成分镜视频...');
                  setCurrentStep('camera-director');
                  setIsProcessing(true);
                  setTimeout(() => {
                    addAgentMessage('camera-director', '✅ 所有分镜视频已生成！');
                    addAgentMessage('camera-director', '可以合成最终视频了。', [
                      { label: '✓ 确认并合成', value: 'compose' },
                    ]);
                    setIsProcessing(false);
                  }, 3000);
                }, 1000);
              }, 3000);
            }, 1000);
          }, 2000);
        }, 1000);
      }
    } else if (currentStep === 'camera-director' && value === 'compose') {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-user`,
          agentId: 'user',
          type: 'text',
          content: '确认并合成',
          timestamp: new Date(),
        },
      ]);
      setIsProcessing(true);
      addAgentMessage('camera-director', '正在合成最终视频...');
      setTimeout(() => {
        addAgentMessage('camera-director', '🎉 视频合成完成！');
        setIsProcessing(false);
        onComplete?.();
      }, 3000);
    }
  };

  // 处理文本输入（保留但不使用）
  const handleSend = () => {
    if (!inputValue.trim()) return;
    setInputValue('');
  };

  // 获取当前 Agent
  const currentAgent = AGENTS.find((a) => a.id === currentStep);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 to-black text-slate-100">
      {/* 顶部 Agent 信息栏 */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-pink-600 rounded-lg flex items-center justify-center">
            {currentAgent?.icon}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{currentAgent?.name}</h3>
            <p className="text-xs text-slate-500">{currentAgent?.description}</p>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => {
          const agent = AGENTS.find((a) => a.id === message.agentId);
          const isUser = message.agentId === 'user';

          return (
            <div key={message.id} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
              {/* Agent 头像 */}
              {!isUser && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-pink-600 rounded-lg flex items-center justify-center">
                    {agent?.icon}
                  </div>
                </div>
              )}

              {/* 消息内容 */}
              <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
                {!isUser && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-400">{agent?.name}</span>
                    <span className="text-xs text-slate-600">• {agent?.description}</span>
                  </div>
                )}
                <div
                  className={`inline-block px-4 py-3 rounded-xl ${
                    isUser
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800 text-slate-100 border border-slate-700'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>

                {/* 选项按钮 */}
                {message.type === 'options' && message.options && (
                  <div className="mt-3 space-y-2">
                    {message.options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleSelectOption(option.value)}
                        disabled={isProcessing}
                        className="w-full text-left px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 to-slate-500 rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed border border-slate-600"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 用户头像 */}
              {isUser && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框（保留但不使用） */}
      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入指令或反馈..."
            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-600"
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
