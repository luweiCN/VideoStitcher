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
  | 'art-director-creating'  // 艺术总监创作中
  | 'art-director-confirm'   // 艺术总监等待确认
  | 'casting-director'   // 选角导演
  | 'casting-director-generating'  // 选角导演生成中
  | 'casting-director-confirm'     // 选角导演等待确认
  | 'storyboard-artist'  // 分镜师
  | 'storyboard-artist-generating' // 分镜师生成中
  | 'storyboard-artist-confirm'    // 分镜师等待确认
  | 'camera-director'   // 摄像导演
  | 'camera-director-generating'   // 摄像导演生成中
  | 'camera-director-confirm'      // 摄像导演等待确认
  | 'completed';         // 工作流完成

// 消息类型
interface Message {
  id: string;
  agentId: string; // 'user', 'system', or agent IDs
  type: 'text' | 'options' | 'typing' | 'character' | 'character-image'; // character-image 用于带图片的角色形象
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
  const confirmedCharactersRef = useRef<Set<string>>(new Set()); // 已确认的角色 ID
  const confirmedCharacterLocksRef = useRef<Set<string>>(new Set()); // 防止角色重复确认
  const storyboardTransitionTriggeredRef = useRef(false); // 防止重复进入分镜流程
  const finalComposeInFlightRef = useRef(false); // 防止最终拼接重复触发
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const directorMode = useDirectorMode(screenplayId);

  // 剧本切换时重置会话状态
  useEffect(() => {
    setMessages([]);
    setCurrentStep('art-director');
    setInputValue('');
    setIsProcessing(false);
    setHasCastingDirectorJoined(false);
    setHasStoryboardArtistJoined(false);
    setHasCameraDirectorJoined(false);
    setRespondedMessages(new Set());
    setSelectedOptions(new Map());
    setVideoSpec({ duration: null, aspectRatio: null });

    confirmedCharacterLocksRef.current = new Set();
    confirmedCharactersRef.current = new Set();
    storyboardTransitionTriggeredRef.current = false;
    finalComposeInFlightRef.current = false;
  }, [screenplayId]);

  // 添加初始 Agent 消息
  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
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

    return () => {
      clearTimeout(welcomeTimer);
    };
  }, [screenplayId]);

  // 延迟函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 完整的工作流处理函数
  const handleWorkflow = async (value: 'upload' | 'free') => {
    // 标记正在处理
    setIsProcessing(true);

    if (value === 'free') {
      // ===== 艺术总监创作角色和场景 =====
      addAgentMessageWithDelay('art-director', '收到！开始为您创作角色和场景...', 1200);

      try {
        await delay(1500);
        // 调用 API 生成角色（艺术总监 Agent）
        const characters = await directorMode.generateCharacters();

        if (characters && characters.length > 0) {
          // 角色创作成功，发送详细的文本描述
          const characterDescriptions = characters.map((c, i) => {
            const lines = [
              `**角色 ${i + 1}：${c.name}**`,
              '',
              c.description.split('\n').map(line => `  ${line}`).join('\n'),
            ];
            return lines.join('\n');
          }).join('\n\n');

          addAgentMessageWithDelay(
            'art-director',
            `我为本剧本设计了如下的角色和场景：\n\n${characterDescriptions}\n\n接下来请选角导演为角色生成形象图片。`,
            1500
          );

          setIsProcessing(false);
          setCurrentStep('casting-director');

          // ===== 系统消息：等待用户操作 =====
          await delay(1000);

          const systemMessage: Message = {
            id: `system-await-casting`,
            agentId: 'system',
            type: 'text',
            content: '艺术总监邀请选角导演加入群聊',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, systemMessage]);
        } else {
          throw new Error('未能生成任何角色');
        }
      } catch (error) {
        addAgentMessageWithDelay('art-director', `❌ 创作失败: ${(error as Error).message}`, 500);
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

  // 添加 Agent 消息（无延迟，直接添加）
  const addAgentMessage = (
    agentId: string,
    content: string,
    options?: { label: string; value: string }[]
  ) => {
    const message: Message = {
      id: `${Date.now()}-${agentId}`,
      agentId,
      type: options ? 'options' : 'text',
      content,
      options,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
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
        const userMessage: Message = {
          id: `user-aspect-${Date.now()}`,
          agentId: 'user',
          type: 'text',
          content: `已选择：${value === 'landscape' ? '横版 (16:9)' : '竖版 (9:16)'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        // 艺术总监确认规格并开始创作
        const durationText = videoSpec.duration === 'long' ? '长视频 (15-30s)' : '短视频 (15s以下)';
        const ratioText = value === 'landscape' ? '横 (16:9)' : '竖 (9:16)';

        addAgentMessageWithDelay(
          'art-director',
          `【已确认规格】${durationText} | ${ratioText} 接下来我将根据您的剧本为您设计人物角色和场景`,
          1200
        );

        // 等待消息显示完成后再延迟1秒，然后进入创作状态
        setTimeout(async () => {
          // 延迟1秒
          await delay(1000);

          // 进入创作状态
          setCurrentStep('art-director-creating');
          setIsProcessing(true);

          // 发送 typing 消息
          const typingMessage: Message = {
            id: `typing-${Date.now()}`,
            agentId: 'art-director',
            type: 'typing',
            content: '正在创作角色和场景...',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, typingMessage]);

          // 调用后台 API 创作角色
          setTimeout(async () => {
            try {
              await delay(2000);
              const characters = await directorMode.generateCharacters();

            // 移除 typing 消息
            setMessages((prev) => prev.filter(m => m.type !== 'typing'));

            if (characters && characters.length > 0) {
              const characterNames = characters.map(c => c.name).join('、');

              addAgentMessage(
                'art-director',
                `创作完成！我为您创作了以下角色：\n\n${characters.map((c, i) =>
                  `${i + 1}. ${c.name}（${c.description.split('\n')[0]}）`
                ).join('\n')}\n\n场景设定基于您的剧本，您看是否需要修改`,
                [
                  { label: '重新生成', value: 'regenerate' },
                  { label: '无需修改', value: 'confirm' },
                ]
              );

              setIsProcessing(false);
              setCurrentStep('art-director-confirm');
            }
          } catch (error) {
            addAgentMessage('art-director', `创作失败：${(error as Error).message}`);
            setIsProcessing(false);
          }
        }, 2000);
      });
      }
    } else if (currentStep === 'art-director-confirm') {
      if (value === 'regenerate') {
        // 重新生成角色
        addAgentMessage('user', '请重新生成角色');

        setCurrentStep('art-director-creating');
        setIsProcessing(true);

        // 发送 typing 消息
        const typingMessage: Message = {
          id: `typing-regenerate-${Date.now()}`,
          agentId: 'art-director',
          type: 'typing',
          content: '正在重新创作角色和场景...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, typingMessage]);

        setTimeout(async () => {
          try {
            await delay(2000);
            const result = await directorMode.generateCharacters();

            // 移除 typing 消息
            setMessages((prev) => prev.filter(m => m.type !== 'typing'));

            if (result && result.length > 0) {
              addAgentMessageWithDelay(
                'art-director',
                `重新创作完成！我为您创作了以下角色：\n\n${result.map((c, i) =>
                  `${i + 1}. ${c.name}（${c.description.split('\n')[0]}）`
                ).join('\n')}\n\n场景设定基于您的剧本，您看是否需要修改`,
                1500,
                [
                  { label: '重新生成', value: 'regenerate' },
                  { label: '无需修改', value: 'confirm' },
                ]
              );

              setIsProcessing(false);
            }
          } catch (error) {
            addAgentMessage('art-director', `重新创作失败：${(error as Error).message}`);
            setIsProcessing(false);
          }
        }, 2000);
      } else if (value === 'confirm') {
        // 用户确认角色，邀请选角导演
        addAgentMessage('user', '无需修改，确认角色和场景');

        addAgentMessageWithDelay(
          'art-director',
          '好的，角色和场景已经确定。接下来需要选角导演为我们的剧本挑选演员。',
          1500
        );

        // 系统消息：邀请选角导演
        setTimeout(() => {
          const systemMessage: Message = {
            id: `system-invite-casting`,
            agentId: 'system',
            type: 'text',
            content: '系统消息：艺术总监邀请选角导演加入群聊',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, systemMessage]);

          // 选角导演自我介绍
          setTimeout(() => {
            addAgentMessage(
              'casting-director',
              '大家好！我是选角导演，负责为我们的剧本挑选演员。对于演员的形象，请问您这边有需要我参考的方向还是让我自由发挥呢？',
              [
                { label: '上传参考图', value: 'upload' },
                { label: '自由发挥', value: 'free' },
              ]
            );
            setCurrentStep('casting-director');
          }, 800);
        }, 1000);
      }
    } else if (currentStep === 'casting-director') {
      if (value === 'upload' || value === 'free') {
        // 检查工作流是否已初始化
        if (!isWorkflowInitialized) {
          console.error('[ChatPanel] 工作流未初始化');
          addAgentMessageWithDelay('casting-director', '❌ 系统还在初始化，请稍后再试', 500);
          return;
        }

        const userMessage: Message = {
          id: `user-casting-${Date.now()}`,
          agentId: 'user',
          type: 'text',
          content: value === 'upload' ? '我将上传参考图' : '自由发挥',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);

        if (value === 'upload') {
          addAgentMessage('casting-director', '请上传您的参考图...');
          // TODO: 实现上传参考图功能
        } else {
          // 自由发挥模式：开始生成角色形象
          addAgentMessageWithDelay(
            'casting-director',
            '收到！开始为您创作角色形象...',
            1200
          );

          setCurrentStep('casting-director-generating');
          setIsProcessing(true);

          // 获取角色列表
          const characters = directorMode.characters;

          // 逐个生成人物形象
          for (let i = 0; i < characters.length; i++) {
            const character = characters[i];

            // 发送 typing 消息
            const typingMessage: Message = {
              id: `typing-char-${i}`,
              agentId: 'casting-director',
              type: 'typing',
              content: `正在为 ${character.name} 生成形象（正、侧、后三视图）...`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, typingMessage]);

            try {
              // 调用 API 生成形象
              const result = await window.api.asideGenerateCharacterImage({
                screenplayId,
                characterId: character.id,
                useReference: false,
              });

              // 移除 typing 消息
              setMessages((prev) => prev.filter(m => m.id !== `typing-char-${i}`));

              if (result.success && result.imageUrl) {
                // 更新画板角色卡片
                directorMode.updateCharacterImage(character.id, result.imageUrl);

                // 发送人物形象消息
                const characterMessage: Message = {
                  id: `char-img-${i}`,
                  agentId: 'casting-director',
                  type: 'character-image',
                  content: `这是我找到的${i === 0 ? '主演' : '演员'} ${character.name}（正、侧、后三视图），您看怎么样`,
                  characterData: {
                    name: character.name,
                    description: character.description,
                    imageUrl: result.imageUrl,
                    isImageLoading: false,
                  },
                  options: [
                    { label: '重新生成', value: `regenerate-${i}` },
                    { label: '确认', value: `confirm-${i}` },
                  ],
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, characterMessage]);
              }
            } catch (error) {
              addAgentMessage('casting-director', `生成 ${character.name} 的形象失败：${(error as Error).message}`);
            }

            await delay(1000);
          }

          setIsProcessing(false);
          setCurrentStep('casting-director-confirm');
        }
      }
    } else if (currentStep === 'casting-director-confirm') {
      // 处理角色形象确认
      if (value.startsWith('regenerate-')) {
        const index = parseInt(value.split('-')[1]);
        const character = directorMode.characters[index];

        addAgentMessage('user', `请重新生成 ${character.name} 的形象`);

        // 重新生成该角色形象
        setIsProcessing(true);

        const typingMessage: Message = {
          id: `typing-regenerate-${index}`,
          agentId: 'casting-director',
          type: 'typing',
          content: `正在重新为 ${character.name} 生成形象...`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, typingMessage]);

        setTimeout(async () => {
          try {
            const result = await window.api.asideGenerateCharacterImage({
              screenplayId,
              characterId: character.id,
              useReference: false,
            });

            // 移除 typing 消息
            setMessages((prev) => prev.filter(m => m.id !== `typing-regenerate-${index}`));

            if (result.success && result.imageUrl) {
              // 更新画板角色卡片
              directorMode.updateCharacterImage(character.id, result.imageUrl);

              const characterMessage: Message = {
                id: `char-img-regen-${index}`,
                agentId: 'casting-director',
                type: 'character-image',
                content: `这是我重新找到的 ${character.name}，您看怎么样`,
                characterData: {
                  name: character.name,
                  description: character.description,
                  imageUrl: result.imageUrl,
                  isImageLoading: false,
                },
                options: [
                  { label: '重新生成', value: `regenerate-${index}` },
                  { label: '确认', value: `confirm-${index}` },
                ],
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, characterMessage]);
            }

            setIsProcessing(false);
          } catch (error) {
            addAgentMessage('casting-director', `重新生成失败：${(error as Error).message}`);
            setIsProcessing(false);
          }
        }, 2000);
      } else if (value.startsWith('confirm-')) {
        const index = parseInt(value.split('-')[1]);
        const character = directorMode.characters[index];

        if (confirmedCharacterLocksRef.current.has(character.id)) {
          return;
        }

        confirmedCharacterLocksRef.current.add(character.id);
        confirmedCharactersRef.current.add(character.id);
        addAgentMessage('user', `确认 ${character.name} 的形象`);

        // 检查是否全部确认
        if (confirmedCharacterLocksRef.current.size === directorMode.characters.length) {
          if (storyboardTransitionTriggeredRef.current) {
            return;
          }
          storyboardTransitionTriggeredRef.current = true;

          addAgentMessageWithDelay(
            'casting-director',
            '太好了！所有演员形象已确认。接下来需要分镜师为我们绘制分镜。',
            1500
          );

          // 系统消息：邀请分镜师
          setTimeout(() => {
            const systemMessage: Message = {
              id: `system-invite-storyboard`,
              agentId: 'system',
              type: 'text',
              content: '系统消息：艺术总监邀请分镜师加入群聊',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, systemMessage]);

            // 分镜师自我介绍
            setTimeout(() => {
              addAgentMessageWithDelay(
                'storyboard-artist',
                '大家好！我是这个项目的分镜师。我看到了项目的剧本、人物和场景设定了，接下来我开始进行分镜绘制。',
                1200
              );

              setCurrentStep('storyboard-artist-generating');
              setIsProcessing(true);

              // 发送 typing 消息
              const typingMessage: Message = {
                id: `typing-storyboard`,
                agentId: 'storyboard-artist',
                type: 'typing',
                content: '正在绘制 5x5 分镜图...',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, typingMessage]);

              // 调用 API 生成分镜
              setTimeout(async () => {
                try {
                  await directorMode.generateStoryboard();

                  // 移除 typing 消息
                  setMessages((prev) => prev.filter(m => m.id !== 'typing-storyboard'));

                  addAgentMessage(
                    'storyboard-artist',
                    '这是我为我们项目绘制的分镜图（5x5），请审核',
                    [
                      { label: '重新生成', value: 'regenerate-storyboard' },
                      { label: '确认', value: 'confirm-storyboard' },
                    ]
                  );

                  setIsProcessing(false);
                  setCurrentStep('storyboard-artist-confirm');
                } catch (error) {
                  addAgentMessage('storyboard-artist', `分镜生成失败：${(error as Error).message}`);
                  setIsProcessing(false);
                }
              }, 3000);
            }, 800);
          }, 1000);
        }
      }
    } else if (currentStep === 'storyboard-artist-confirm') {
      if (value === 'regenerate-storyboard') {
        addAgentMessage('user', '请重新生成分镜图');

        setIsProcessing(true);

        const typingMessage: Message = {
          id: `typing-regen-storyboard`,
          agentId: 'storyboard-artist',
          type: 'typing',
          content: '正在重新绘制分镜图...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, typingMessage]);

        setTimeout(async () => {
          try {
            await directorMode.generateStoryboard();

            setMessages((prev) => prev.filter(m => m.id !== 'typing-regen-storyboard'));

            addAgentMessage(
              'storyboard-artist',
              '这是我重新绘制的分镜图（5x5），请审核',
              [
                { label: '重新生成', value: 'regenerate-storyboard' },
                { label: '确认', value: 'confirm-storyboard' },
              ]
            );

            setIsProcessing(false);
          } catch (error) {
            addAgentMessage('storyboard-artist', `重新生成失败：${(error as Error).message}`);
            setIsProcessing(false);
          }
        }, 3000);
      } else if (value === 'confirm-storyboard') {
        addAgentMessage('user', '确认分镜图');

        addAgentMessageWithDelay(
          'storyboard-artist',
          '分镜图已确认。接下来需要摄像导演进行拍摄。',
          1500
        );

        // 系统消息：邀请摄像导演
        setTimeout(() => {
          const systemMessage: Message = {
            id: `system-invite-camera`,
            agentId: 'system',
            type: 'text',
            content: '系统消息：艺术总监要求摄像导演加入群聊',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, systemMessage]);

          // 摄像导演自我介绍
          setTimeout(() => {
            addAgentMessageWithDelay(
              'camera-director',
              '大家好！我是这个项目的摄像导演。我现在去片场进行拍摄。',
              1200
            );

            setCurrentStep('camera-director-generating');
            setIsProcessing(true);

            // 发送 typing 消息
            const typingMessage: Message = {
              id: `typing-camera`,
              agentId: 'camera-director',
              type: 'typing',
              content: '正在拍摄视频...',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, typingMessage]);

            // 调用 API 生成视频
            setTimeout(async () => {
              try {
                await directorMode.composeVideo();

                // 移除 typing 消息
                setMessages((prev) => prev.filter(m => m.id !== 'typing-camera'));

                addAgentMessage(
                  'camera-director',
                  '拍摄完成！我生成了以下视频片段，请审核：',
                  [
                    { label: '重新生成', value: 'regenerate-video' },
                    { label: '确认', value: 'confirm-video' },
                  ]
                );

                setIsProcessing(false);
                setCurrentStep('camera-director-confirm');
              } catch (error) {
                addAgentMessage('camera-director', `拍摄失败：${(error as Error).message}`);
                setIsProcessing(false);
              }
            }, 3000);
          }, 800);
        }, 1000);
      }
    } else if (currentStep === 'camera-director-confirm') {
      if (value === 'regenerate-video') {
        addAgentMessage('user', '请重新生成视频');

        setIsProcessing(true);

        const typingMessage: Message = {
          id: `typing-regen-video`,
          agentId: 'camera-director',
          type: 'typing',
          content: '正在重新拍摄视频...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, typingMessage]);

        setTimeout(async () => {
          try {
            await directorMode.composeVideo();

            setMessages((prev) => prev.filter(m => m.id !== 'typing-regen-video'));

            addAgentMessage(
              'camera-director',
              '拍摄完成！我重新生成了以下视频片段，请审核：',
              [
                { label: '重新生成', value: 'regenerate-video' },
                { label: '确认', value: 'confirm-video' },
              ]
            );

            setIsProcessing(false);
          } catch (error) {
            addAgentMessage('camera-director', `重新生成失败：${(error as Error).message}`);
            setIsProcessing(false);
          }
        }, 3000);
      } else if (value === 'confirm-video') {
        if (finalComposeInFlightRef.current) {
          return;
        }
        finalComposeInFlightRef.current = true;

        addAgentMessage('user', '确认视频');

        setIsProcessing(true);

        // 拼接视频
        addAgentMessageWithDelay(
          'camera-director',
          '正在拼接视频...',
          1200
        );

        setTimeout(async () => {
          try {
            // 调用拼接 API
            const result = await window.api.asideComposeVideo(screenplayId);

            if (result.success) {
              addAgentMessageWithDelay(
                'camera-director',
                '✅ 视频拼接完成！已保存到本地。',
                1500
              );

              setIsProcessing(false);

              // 艺术总监总结祝贺
              setTimeout(() => {
                addAgentMessageWithDelay(
                  'art-director',
                  '🎉 恭喜！项目成功完成！感谢整个团队的协作！\n\n✨ 剧本创作：完成\n✨ 角色设计：完成\n✨ 演员形象：完成\n✨ 分镜绘制：完成\n✨ 视频拍摄：完成\n\n期待您的下一个作品！',
                  2000
                );

                setCurrentStep('completed');

                // 触发完成回调
                onComplete?.();
              }, 1500);
            } else {
              addAgentMessage('camera-director', `视频拼接失败：${result.error || '未知错误'}`);
              setIsProcessing(false);
            }
          } catch (error) {
            addAgentMessage('camera-director', `视频拼接失败：${(error as Error).message}`);
            setIsProcessing(false);
          } finally {
            finalComposeInFlightRef.current = false;
          }
        }, 2000);
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
                {(message.type === 'options' || message.type === 'character-image') && message.options && (
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
