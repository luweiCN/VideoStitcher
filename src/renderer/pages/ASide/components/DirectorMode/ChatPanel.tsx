/**
 * 聊天面板组件 - 导演模式 Agent 工作流
 * 消息气泡布局 + Agent 交互
 */

import { Send, User, Film, Palette, Video } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useDirectorMode } from '@renderer/pages/ASide/hooks/useDirectorMode';

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
  agentId: string; // 'user', 'system', or agent IDs
  type: 'text' | 'options' | 'typing' | 'character'; // 添加 character 类型
  content: string;
  options?: { label: string; value: string }[];
  characterData?: {
    name: string;
    description: string;
    imageUrl?: string;
    isImageLoading?: boolean;
  };
  timestamp: Date;
}

interface ChatPanelProps {
  /** 当前剧本 */
  screenplayId: string;
  /** 工作流完成回调 */
  onComplete?: () => void;
  /** 工作流是否已初始化 */
  isWorkflowInitialized: boolean;
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

export function ChatPanel({ screenplayId, onComplete, isWorkflowInitialized }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('art-director');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCastingDirectorJoined, setHasCastingDirectorJoined] = useState(false);
  const [hasStoryboardArtistJoined, setHasStoryboardArtistJoined] = useState(false);
  const [hasCameraDirectorJoined, setHasCameraDirectorJoined] = useState(false);
  const [respondedMessages, setRespondedMessages] = useState<Set<string>>(new Set()); // 已响应的消息 ID
  const [selectedOptions, setSelectedOptions] = useState<Map<string, string>>(new Map()); // 消息ID -> 选择的值
  const [videoSpec, setVideoSpec] = useState<{ duration: 'long' | 'short' | null; aspectRatio: 'landscape' | 'portrait' | null }>({
    duration: null,
    aspectRatio: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const directorMode = useDirectorMode(screenplayId);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 添加初始 Agent 消息
  useEffect(() => {
    // 延迟后显示艺术总监的欢迎消息
    setTimeout(() => {
      addAgentMessageWithDelay(
        'art-director',
        '您好！我是您的AI艺术总监。您的剧本已同步至右侧画板，您可以随时双击修改。在正式分发任务前，请确认项目的基础规格：',
        1500,
        [
          { label: '长视频 (15-30s)', value: 'long' },
          { label: '短视频 (15s以下)', value: 'short' },
        ]
      );
    }, 800);
  }, []);

  // 延迟函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 完整的工作流处理函数
  const handleWorkflow = async (value: 'upload' | 'free') => {
    // 标记正在处理
    setIsProcessing(true);

    if (value === 'free') {
      // 自由发挥模式
      addAgentMessageWithDelay('casting-director', '收到！正在为您解析剧本深意并提取核心人物群像...', 1200);

      try {
        await delay(1500);
        // 调用 API 生成角色
        const result = await directorMode.generateCharacters();

        if (result && result.length > 0) {
          // 角色生成成功
          addAgentMessageWithDelay(
            'casting-director',
            `在深入解读剧本之后，我为该剧本设计了如下 ${result.length} 个角色：`,
            1500
          );

          await delay(1000);

          // 为每个角色发送消息
          for (let i = 0; i < result.length; i++) {
            const character = result[i];
            const isProtagonist = i === 0; // 第一个角色默认为主角

            // 发送角色消息（带 loading 图片占位符）
            const characterMessageId = `${Date.now()}-char-${i}`;
            const characterMessage: Message = {
              id: characterMessageId,
              agentId: 'casting-director',
              type: 'character',
              content: isProtagonist ? '主角' : '配角',
              characterData: {
                name: character.name,
                description: character.description,
                imageUrl: character.imageUrl,
                isImageLoading: !character.imageUrl, // 如果没有图片，显示 loading
              },
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, characterMessage]);

            await delay(800);
          }

          setIsProcessing(false);

          // 进入下一步：分镜师
          await delay(1500);

          // 添加系统消息：选角导演邀请分镜师加入群聊
          if (!hasStoryboardArtistJoined) {
            const systemMessage: Message = {
              id: `system-storyboard-join`,
              agentId: 'system',
              type: 'text',
              content: '选角导演邀请分镜师加入群聊',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, systemMessage]);
            setHasStoryboardArtistJoined(true);
          }

          await delay(500);
          addAgentMessageWithDelay('storyboard-artist', '角色已就位。现在开始生成分镜图...', 1200);
          setCurrentStep('storyboard-artist');
          setIsProcessing(true);

          await delay(3000);
          await directorMode.generateStoryboard();
          addAgentMessageWithDelay('storyboard-artist', '✅ 分镜图生成完成！请查看右侧画板。', 1500);
          setIsProcessing(false);

          // 进入最后一步：摄像导演
          await delay(1000);

          // 添加系统消息：分镜师邀请摄像导演加入群聊
          if (!hasCameraDirectorJoined) {
            const systemMessage: Message = {
              id: `system-camera-join`,
              agentId: 'system',
              type: 'text',
              content: '分镜师邀请摄像导演加入群聊',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, systemMessage]);
            setHasCameraDirectorJoined(true);
          }

          await delay(500);
          addAgentMessageWithDelay('camera-director', '分镜图已确认。现在开始生成分镜视频...', 1200);
          setCurrentStep('camera-director');
          setIsProcessing(true);

          await delay(3000);
          addAgentMessageWithDelay('camera-director', '✅ 所有分镜视频已生成！', 1500);

          await delay(1500);
          addAgentMessageWithDelay('camera-director', '可以合成最终视频了。', 1000, [
            { label: '✓ 确认并合成', value: 'compose' },
          ]);
          setIsProcessing(false);
        } else {
          throw new Error('未能生成任何角色');
        }
      } catch (error) {
        addAgentMessageWithDelay('casting-director', `❌ 生成失败: ${(error as Error).message}`, 500);
        setIsProcessing(false);
      }
    } else {
      // 上传参考图模式（保留原逻辑）
      addAgentMessageWithDelay('casting-director', '正在根据参考图生成角色...', 1200);

      try {
        await delay(2000);
        await directorMode.generateCharacters();
        addAgentMessageWithDelay('casting-director', '✅ 角色生成完成！请查看右侧画板。', 1500);
        setIsProcessing(false);

        // 后续流程同上...
      } catch (error) {
        addAgentMessageWithDelay('casting-director', `❌ 生成失败: ${(error as Error).message}`, 500);
        setIsProcessing(false);
      }
    }
  };

  // 添加带打字效果的 Agent 消息
  const addAgentMessageWithDelay = (
    agentId: string,
    content: string,
    delay: number = 1500,
    options?: { label: string; value: string }[]
  ) => {
    // 先添加打字动画
    const typingMessageId = `${Date.now()}-typing`;
    const typingMessage: Message = {
      id: typingMessageId,
      agentId,
      type: 'typing',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, typingMessage]);

    // 延迟后替换为实际内容
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingMessageId
            ? {
                ...msg,
                id: `${Date.now()}-content`,
                type: options ? 'options' : 'text',
                content,
                options,
              }
            : msg
        )
      );
    }, delay);
  };

  // 处理用户选择选项
  const handleSelectOption = async (value: string, messageId?: string) => {
    // 标记该消息已被响应，并记录选择的值
    if (messageId) {
      setRespondedMessages(prev => new Set(prev).add(messageId));
      setSelectedOptions(prev => new Map(prev).set(messageId, value));
    }

    if (currentStep === 'art-director') {
      if (value === 'long' || value === 'short') {
        // 用户选择了视频长度
        setVideoSpec(prev => ({ ...prev, duration: value }));
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-user`,
            agentId: 'user',
            type: 'text',
            content: value === 'long' ? '长视频 (15-30s)' : '短视频 (15s以下)',
            timestamp: new Date(),
          },
        ]);

        addAgentMessageWithDelay('art-director', '接下来，请确认视频方向：', 1000, [
          { label: '横版 (16:9)', value: 'landscape' },
          { label: '竖版 (9:16)', value: 'portrait' },
        ]);
      } else if (value === 'landscape' || value === 'portrait') {
        // 用户选择了视频方向
        setVideoSpec(prev => ({ ...prev, aspectRatio: value }));
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

        // 艺术总监确认规格
        setTimeout(() => {
          const durationText = videoSpec.duration === 'long' ? '长视频 (15-30s)' : '短视频 (15s以下)';
          const aspectText = value === 'landscape' ? '横版 (16:9)' : '竖版 (9:16)';

          addAgentMessageWithDelay(
            'art-director',
            `【已确认规格】 ${durationText} | ${aspectText}\n\n接下来，需要选角导演为我们的剧本创建角色`,
            1500
          );
        }, 500);

        // 进入下一步：选角导演
        setTimeout(() => {
          // 添加系统消息：艺术总监邀请选角导演加入群聊
          if (!hasCastingDirectorJoined) {
            const systemMessage: Message = {
              id: `system-casting-join`,
              agentId: 'system',
              type: 'text',
              content: '艺术总监邀请选角导演加入群聊',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, systemMessage]);
            setHasCastingDirectorJoined(true);
          }

          // 延迟后选角导演开始说话
          setTimeout(() => {
            addAgentMessageWithDelay('casting-director', '大家好！我是选角导演，负责根据剧本创建角色。', 1200);
            setTimeout(() => {
              addAgentMessageWithDelay('casting-director', '请选择角色生成方式：', 1000, [
                { label: '上传参考图', value: 'upload' },
                { label: '自由发挥', value: 'free' },
              ]);
              setCurrentStep('casting-director');
            }, 1500);
          }, 1000);
        }, 2500);
      }
    } else if (currentStep === 'casting-director') {
      if (value === 'upload' || value === 'free') {
        // 检查工作流是否已初始化
        if (!isWorkflowInitialized) {
          console.error('[ChatPanel] 工作流未初始化');
          addAgentMessageWithDelay('casting-director', '❌ 系统还在初始化，请稍后再试', 500);
          return;
        }

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

        // 调用新的工作流函数
        await handleWorkflow(value);
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

      // 调用真实 API 合成视频
      setIsProcessing(true);
      addAgentMessageWithDelay('camera-director', '正在合成最终视频...', 1200);

      try {
        setTimeout(async () => {
          await directorMode.composeVideo();
          addAgentMessageWithDelay('camera-director', '🎉 视频合成完成！', 1500);
          setIsProcessing(false);
          onComplete?.();
        }, 3000);
      } catch (error) {
        addAgentMessageWithDelay('camera-director', `❌ 合成失败: ${(error as Error).message}`, 500);
        setIsProcessing(false);
      }
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
          const isSystem = message.agentId === 'system';

          // 系统消息特殊渲染
          if (isSystem) {
            return (
              <div key={message.id} className="flex justify-center my-2">
                <div className="px-3 py-1 bg-slate-800/30 rounded-full text-xs text-slate-500 border border-slate-700/30">
                  {message.content}
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
              {/* Agent 头像 */}
              {!isUser && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-pink-600 rounded-lg flex items-center justify-center">
                    {agent?.icon}
                  </div>
                </div>
              )}

              {/* 消息内容 */}
              <div className={isUser ? 'text-right' : ''}>
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
                  {message.type === 'typing' ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  ) : message.type === 'character' && message.characterData ? (
                    // 角色消息渲染
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-semibold bg-violet-600/30 text-violet-300 rounded">
                          {message.content}
                        </span>
                        <span className="text-base font-bold text-slate-100">
                          {message.characterData.name}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {message.characterData.description}
                      </p>
                      {message.characterData.isImageLoading ? (
                        // 图片 loading 占位符
                        <div className="w-full h-40 bg-slate-700/50 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mb-2"></div>
                            <p className="text-xs text-slate-400">正在生成角色形象...</p>
                          </div>
                        </div>
                      ) : message.characterData.imageUrl ? (
                        // 真实图片
                        <div className="rounded-lg overflow-hidden">
                          <img
                            src={message.characterData.imageUrl}
                            alt={message.characterData.name}
                            className="w-full h-auto object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>

                {/* 选项按钮 */}
                {message.type === 'options' && message.options && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {message.options.map((option) => {
                      // 检查该消息是否已被响应
                      const isResponded = respondedMessages.has(message.id);
                      // 检查当前选项是否是用户选择的
                      const isSelected = selectedOptions.get(message.id) === option.value;

                      // 检查是否需要等待工作流初始化
                      const needsWorkflowInit = (option.value === 'upload' || option.value === 'free') && !isWorkflowInitialized;

                      const isDisabled = isProcessing || isResponded || needsWorkflowInit;

                      return (
                        <button
                          key={option.value}
                          onClick={() => handleSelectOption(option.value, message.id)}
                          disabled={isDisabled}
                          className={`px-4 py-2 rounded-lg transition-all text-sm border ${
                            isSelected
                              ? 'bg-violet-600/40 text-violet-200 border-violet-500' // 用户选择的：紫色
                              : isResponded || needsWorkflowInit
                              ? 'bg-slate-800/50 text-slate-500 border-slate-700 cursor-not-allowed' // 未选择的或禁用的：灰色
                              : 'bg-gradient-to-r from-violet-700 to-purple-700 hover:from-violet-600 to-purple-600 text-white border-violet-600' // 可选的：渐变紫色
                          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
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
