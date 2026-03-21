/**
 * ChatPanel - 导演模式群聊面板
 *
 * 架构：命令式消息 API（sendSeq / addMsg）驱动消息队列
 * - sendSeq：每条消息前自动插入打字指示器，顺序渐出
 * - addMsg：立即添加（无 typing）
 * - 工作流事件监听与 API 调用均在组件内部驱动
 * - 无底部输入框，无自动滚动
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, User } from 'lucide-react';
import { useDirectorMode } from '@renderer/pages/ASide/hooks/useDirectorMode';

// ── 常量 ─────────────────────────────────────────────────────

const TYPING_MS = 1400; // 每条打字指示器持续时长

const AGENT_CFG = {
  'art-director':      { name: '艺术总监',  emoji: '🎨', color: 'from-violet-600 to-purple-600' },
  'casting-director':  { name: '选角导演',  emoji: '🎭', color: 'from-orange-500 to-amber-500' },
  'storyboard-artist': { name: '分镜师',    emoji: '✏️',  color: 'from-sky-600 to-blue-600' },
  'camera-director':   { name: '摄像导演',  emoji: '📽️',  color: 'from-emerald-600 to-teal-600' },
} as const;

// ── 类型 ─────────────────────────────────────────────────────

type Sender = 'system' | 'user' | keyof typeof AGENT_CFG;

interface ChatOption { label: string; value: string }

interface ChatMsg {
  id: string;
  sender: Sender;
  kind: 'text' | 'options' | 'typing' | 'upload';
  text?: string;
  options?: ChatOption[];
  accept?: string;
  onUpload?: (file: File) => void;
}

// ── 工作流状态机 ──────────────────────────────────────────────

type Step =
  | 'art-director'           // 等待用户选视频时长
  | 'art-director-ratio'     // 等待用户选宽高比
  | 'art-director-creating'  // 生成角色中
  | 'art-director-confirm'   // 等待用户确认角色
  | 'casting-director'       // 等待用户选参考方式
  | 'casting-director-gen'   // 生成角色形象中
  | 'casting-director-confirm' // 等待确认角色形象
  | 'storyboard-gen'         // 生成分镜中
  | 'storyboard-confirm'     // 等待确认分镜
  | 'camera-gen'             // 生成视频中
  | 'camera-confirm'         // 等待确认视频
  | 'completed';

// ── 工具 ─────────────────────────────────────────────────────

let _n = 0;
const genId = () => `m${Date.now()}_${++_n}`;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── 子组件：打字动画 ──────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-[5px] h-5 px-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-[6px] h-[6px] rounded-full bg-slate-500 animate-bounce"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}

// ── 子组件：单条消息气泡 ──────────────────────────────────────

function Bubble({
  msg,
  onOptionClick,
  respondedIds,
  selectedValues,
}: {
  msg: ChatMsg;
  onOptionClick: (msgId: string, value: string) => void;
  respondedIds: Set<string>;
  selectedValues: Map<string, string>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isResponded = respondedIds.has(msg.id);

  // ── 系统消息 ──────────────────────────────────────────
  if (msg.sender === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="px-3 py-1 text-[11px] text-slate-500 bg-slate-800/50 rounded-full border border-slate-700/40 select-none">
          {msg.text}
        </span>
      </div>
    );
  }

  // ── 用户消息（右对齐，镜像 Agent 布局） ───────────────
  if (msg.sender === 'user') {
    return (
      <div className="flex flex-row-reverse items-start gap-2.5 mb-4">
        {/* 头像（右侧） */}
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-md">
          <User size={16} className="text-slate-200" />
        </div>
        <div className="flex flex-col items-end flex-1 min-w-0">
          {/* 名称标签（与 Agent 对称） */}
          <div className="text-[11px] text-slate-500 mb-1 mr-0.5">您</div>
          {/* 气泡 */}
          <div className="bg-orange-700/25 border border-orange-600/30 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[90%]">
            <p className="text-sm text-slate-100 leading-relaxed">{msg.text}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Agent 消息（左对齐 + 头像） ───────────────────────
  const cfg = AGENT_CFG[msg.sender as keyof typeof AGENT_CFG];
  if (!cfg) return null;

  return (
    <div className="flex items-start gap-2.5 mb-4">
      {/* 头像 */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center text-sm shadow-md`}
      >
        {cfg.emoji}
      </div>

      <div className="flex-1 min-w-0">
        {/* Agent 名 */}
        <div className="text-[11px] text-slate-500 mb-1 ml-0.5">{cfg.name}</div>

        {/* 气泡 */}
        <div className="inline-block bg-slate-800/75 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[90%]">
          {msg.kind === 'typing' && <TypingDots />}

          {msg.text && msg.kind !== 'typing' && (
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
          )}

          {msg.kind === 'upload' && (
            <div className={msg.text ? 'mt-2.5' : ''}>
              <input
                ref={fileRef}
                type="file"
                accept={msg.accept}
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) msg.onUpload?.(file);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-700/70 hover:bg-slate-700 border border-slate-600/60 text-slate-300 rounded-lg transition-all"
              >
                <Upload size={12} />
                选择文件
              </button>
            </div>
          )}
        </div>

        {/* 选项按钮 */}
        {msg.kind === 'options' && msg.options && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.options.map(opt => {
              const isSelected = selectedValues.get(msg.id) === opt.value;
              return (
                <button
                  key={opt.value}
                  disabled={isResponded}
                  onClick={() => !isResponded && onOptionClick(msg.id, opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-orange-600/30 border-orange-500/50 text-orange-200 cursor-default'
                      : isResponded
                      ? 'bg-slate-800/40 border-slate-700/40 text-slate-600 cursor-not-allowed'
                      : 'bg-orange-600/15 hover:bg-orange-600/30 border-orange-500/30 hover:border-orange-500/55 text-orange-300 cursor-pointer'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────

interface ChatPanelProps {
  screenplayId: string;
  onComplete?: () => void;
  isWorkflowInitialized: boolean;
  directorMode: ReturnType<typeof useDirectorMode>;
}

export function ChatPanel({ screenplayId, onComplete, isWorkflowInitialized, directorMode }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [selectedValues, setSelectedValues] = useState<Map<string, string>>(new Map());

  // 工作流状态
  const stepRef = useRef<Step>('art-director');
  const isProcessingRef = useRef(false);
  const videoSpecRef = useRef<{ duration: 'long' | 'short' | null; aspectRatio: 'landscape' | 'portrait' | null }>({ duration: null, aspectRatio: null });
  const confirmedCharsRef = useRef<Set<string>>(new Set());
  const charLockRef = useRef<Set<string>>(new Set());
  const storyboardStartedRef = useRef(false);
  const finalComposeRef = useRef(false);

  // ── 内部消息 API ──────────────────────────────────────

  /** 立即添加消息（不显示 typing） */
  const addMsg = useCallback((params: Omit<ChatMsg, 'id'>): string => {
    const id = genId();
    setMessages(prev => [...prev, { ...params, id }]);
    return id;
  }, []);

  /** 添加用户气泡 */
  const addUser = useCallback((text: string) => {
    addMsg({ sender: 'user', kind: 'text', text });
  }, [addMsg]);

  /** 系统消息（居中胶囊） */
  const addSystem = useCallback((text: string) => {
    addMsg({ sender: 'system', kind: 'text', text });
  }, [addMsg]);

  /**
   * 按顺序发送多条 Agent 消息：
   * 每条消息前先显示打字指示器，delay 后替换为真实内容
   * 两条消息之间有短暂停顿，给人"人类打字"的真实感
   */
  const sendSeq = useCallback(async (
    sender: Sender,
    items: Array<Omit<ChatMsg, 'id' | 'sender'>>,
    opts?: { delay?: number }
  ): Promise<void> => {
    const delay = opts?.delay ?? TYPING_MS;
    for (let i = 0; i < items.length; i++) {
      // 显示打字指示器
      const typId = genId();
      setMessages(prev => [...prev, { id: typId, sender, kind: 'typing' }]);
      await sleep(delay);
      // 将打字指示器原地替换为真实消息（保持位置稳定）
      const msgId = genId();
      setMessages(prev =>
        prev.map(m => m.id === typId ? { ...items[i], id: msgId, sender } as ChatMsg : m)
      );
      if (i < items.length - 1) {
        await sleep(350); // 消息间短暂停顿
      }
    }
  }, []);

  /** 移除消息（用于清除残留 typing） */
  const removeByKind = useCallback((kind: ChatMsg['kind'], sender?: Sender) => {
    setMessages(prev => prev.filter(m => {
      if (m.kind !== kind) return true;
      if (sender && m.sender !== sender) return true;
      return false;
    }));
  }, []);

  const removeById = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── 选项点击处理 ──────────────────────────────────────

  const markResponded = (msgId: string, value: string) => {
    setRespondedIds(prev => new Set(prev).add(msgId));
    setSelectedValues(prev => new Map(prev).set(msgId, value));
  };

  const handleOptionClick = async (msgId: string, value: string) => {
    if (isProcessingRef.current) return;
    markResponded(msgId, value);
    await handleWorkflowAction(value);
  };

  // ── 工作流动作处理（统一入口） ────────────────────────

  const handleWorkflowAction = async (value: string) => {
    const step = stepRef.current;

    // ── 艺术总监：选视频时长 ──────────────────────────
    if (step === 'art-director' && (value === 'long' || value === 'short')) {
      videoSpecRef.current.duration = value;
      addUser(value === 'long' ? '长视频 (15-30s)' : '短视频 (15s以下)');
      stepRef.current = 'art-director-ratio';

      await sendSeq('art-director', [{
        kind: 'options',
        text: '接下来，请确认视频方向：',
        options: [
          { label: '横版 (16:9)', value: 'landscape' },
          { label: '竖版 (9:16)', value: 'portrait' },
        ],
      }]);
      return;
    }

    // ── 艺术总监：选宽高比 ────────────────────────────
    if (step === 'art-director-ratio' && (value === 'landscape' || value === 'portrait')) {
      videoSpecRef.current.aspectRatio = value;
      const dur = videoSpecRef.current.duration === 'long' ? '长视频 (15-30s)' : '短视频 (15s以下)';
      const ratio = value === 'landscape' ? '横版 (16:9)' : '竖版 (9:16)';
      addUser(`已选择：${ratio}`);
      stepRef.current = 'art-director-creating';
      isProcessingRef.current = true;

      await sendSeq('art-director', [
        { kind: 'text', text: `【已确认规格】${dur} | ${ratio}\n接下来我将根据您的剧本设计人物角色和场景…` },
      ]);

      // 显示 typing，然后调用 API
      const typId = addMsg({ sender: 'art-director', kind: 'typing' });
      try {
        await sleep(1000);
        await directorMode.generateCharacters();
        // 结果由 onWorkflowCharacters 事件处理，这里只清理 typing
        removeById(typId);
        stepRef.current = 'art-director-confirm';
        isProcessingRef.current = false;
      } catch (err) {
        removeById(typId);
        await sendSeq('art-director', [{ kind: 'text', text: `❌ 创作失败：${(err as Error).message}` }]);
        isProcessingRef.current = false;
      }
      return;
    }

    // ── 艺术总监：确认/重新生成角色 ──────────────────
    if (step === 'art-director-confirm') {
      if (value === 'confirm') {
        addUser('无需修改，确认角色和场景');
        stepRef.current = 'casting-director';
        isProcessingRef.current = false;

        await sendSeq('art-director', [
          { kind: 'text', text: '好的，角色和场景已确定！接下来由选角导演为剧本挑选演员形象。' },
        ]);
        addSystem('艺术总监邀请选角导演加入群聊');
        await sendSeq('casting-director', [
          {
            kind: 'options',
            text: '大家好！我是选角导演。对于演员形象，您有想参考的方向，还是让我自由发挥？',
            options: [
              { label: '上传参考图', value: 'upload-ref' },
              { label: '自由发挥', value: 'free' },
            ],
          },
        ]);
      } else if (value === 'regenerate') {
        addUser('请重新生成角色');
        isProcessingRef.current = true;

        const typId = addMsg({ sender: 'art-director', kind: 'typing' });
        try {
          await sleep(1000);
          await directorMode.generateCharacters();
          removeById(typId);
          // 结果由事件驱动，这里保持在 confirm 步骤
          isProcessingRef.current = false;
        } catch (err) {
          removeById(typId);
          await sendSeq('art-director', [{ kind: 'text', text: `❌ 重新创作失败：${(err as Error).message}` }]);
          isProcessingRef.current = false;
        }
      }
      return;
    }

    // ── 选角导演：选参考方式 ──────────────────────────
    if (step === 'casting-director') {
      if (!isWorkflowInitialized) {
        await sendSeq('casting-director', [{ kind: 'text', text: '⏳ 系统初始化中，请稍候…' }]);
        return;
      }

      if (value === 'upload-ref') {
        addUser('我将上传参考图');
        // 显示上传消息
        addMsg({
          sender: 'casting-director',
          kind: 'upload',
          text: '好的，请上传您的参考图：',
          accept: 'image/*',
          onUpload: async (file) => {
            console.log('[ChatPanel] 上传参考图:', file.name);
            // TODO: 实现上传逻辑
            await sendSeq('casting-director', [{ kind: 'text', text: `已收到参考图：${file.name}` }]);
          },
        });
      } else if (value === 'free') {
        addUser('自由发挥');
        stepRef.current = 'casting-director-gen';
        isProcessingRef.current = true;

        const chars = directorMode.characters;
        const typId = addMsg({ sender: 'casting-director', kind: 'typing' });

        try {
          const result = await window.api.asideGenerateCharacterImage({
            screenplayId,
            characterId: chars[0]?.id,
            useReference: false,
          });

          removeById(typId);

          if (result.success && result.imageUrl) {
            // 更新所有角色画板卡片
            chars.forEach(c => directorMode.updateCharacterImage(c.id, result.imageUrl!));

            stepRef.current = 'casting-director-confirm';
            isProcessingRef.current = false;

            await sendSeq('casting-director', [
              {
                kind: 'options',
                text: `角色形象已生成（所有角色合并在一张图中，保证风格一致）。请查看右侧画板，效果满意吗？`,
                options: chars.flatMap((c, idx) => [
                  { label: `重生成 ${c.name}`, value: `regen-char-${idx}` },
                  { label: `确认 ${c.name}`, value: `confirm-char-${idx}` },
                ]),
              },
            ]);
          } else {
            throw new Error('未返回图片 URL');
          }
        } catch (err) {
          removeById(typId);
          await sendSeq('casting-director', [{ kind: 'text', text: `❌ 生成角色形象失败：${(err as Error).message}` }]);
          isProcessingRef.current = false;
        }
      }
      return;
    }

    // ── 选角导演：确认/重生成角色形象 ────────────────
    if (step === 'casting-director-confirm') {
      if (value.startsWith('regen-char-')) {
        const idx = parseInt(value.replace('regen-char-', ''));
        const char = directorMode.characters[idx];
        if (!char) return;

        addUser(`请重新生成 ${char.name} 的形象`);
        isProcessingRef.current = true;

        const typId = addMsg({ sender: 'casting-director', kind: 'typing' });
        try {
          const result = await window.api.asideGenerateCharacterImage({
            screenplayId,
            characterId: char.id,
            useReference: false,
          });
          removeById(typId);
          if (result.success && result.imageUrl) {
            directorMode.updateCharacterImage(char.id, result.imageUrl);
            await sendSeq('casting-director', [{
              kind: 'options',
              text: `${char.name} 的形象已重新生成，请查看右侧画板。`,
              options: [
                { label: `重生成 ${char.name}`, value: `regen-char-${idx}` },
                { label: `确认 ${char.name}`, value: `confirm-char-${idx}` },
              ],
            }]);
          }
          isProcessingRef.current = false;
        } catch (err) {
          removeById(typId);
          await sendSeq('casting-director', [{ kind: 'text', text: `❌ 重生成失败：${(err as Error).message}` }]);
          isProcessingRef.current = false;
        }
      } else if (value.startsWith('confirm-char-')) {
        const idx = parseInt(value.replace('confirm-char-', ''));
        const char = directorMode.characters[idx];
        if (!char || charLockRef.current.has(char.id)) return;

        charLockRef.current.add(char.id);
        confirmedCharsRef.current.add(char.id);
        addUser(`确认 ${char.name} 的形象`);

        // 全部确认后，邀请分镜师
        if (charLockRef.current.size >= directorMode.characters.length) {
          if (storyboardStartedRef.current) return;
          storyboardStartedRef.current = true;

          await sendSeq('casting-director', [
            { kind: 'text', text: '太好了！所有演员形象已确认，接下来由分镜师绘制分镜图。' },
          ]);
          addSystem('艺术总监邀请分镜师加入群聊');

          stepRef.current = 'storyboard-gen';
          isProcessingRef.current = true;

          const typId = addMsg({ sender: 'storyboard-artist', kind: 'typing' });
          try {
            // 先自我介绍（替换 typing），再开始生成
            await sleep(TYPING_MS);
            setMessages(prev => prev.map(m => m.id === typId
              ? { id: genId(), sender: 'storyboard-artist', kind: 'text', text: '大家好！我是这个项目的分镜师。我已了解剧本、人物和场景，马上开始分镜绘制…' } as ChatMsg
              : m
            ));

            await sleep(400);
            const typId2 = addMsg({ sender: 'storyboard-artist', kind: 'typing' });
            await directorMode.generateStoryboard();
            removeById(typId2);

            stepRef.current = 'storyboard-confirm';
            isProcessingRef.current = false;

            await sendSeq('storyboard-artist', [{
              kind: 'options',
              text: '分镜图（5×5）已绘制完成，请查看右侧画板，效果满意吗？',
              options: [
                { label: '重新生成', value: 'regen-storyboard' },
                { label: '确认', value: 'confirm-storyboard' },
              ],
            }]);
          } catch (err) {
            removeById(typId);
            await sendSeq('storyboard-artist', [{ kind: 'text', text: `❌ 分镜生成失败：${(err as Error).message}` }]);
            isProcessingRef.current = false;
          }
        }
      }
      return;
    }

    // ── 分镜师：确认/重生成分镜 ──────────────────────
    if (step === 'storyboard-confirm') {
      if (value === 'regen-storyboard') {
        addUser('请重新生成分镜图');
        isProcessingRef.current = true;

        const typId = addMsg({ sender: 'storyboard-artist', kind: 'typing' });
        try {
          await directorMode.generateStoryboard();
          removeById(typId);
          await sendSeq('storyboard-artist', [{
            kind: 'options',
            text: '分镜图已重新绘制，请查看右侧画板，效果满意吗？',
            options: [
              { label: '重新生成', value: 'regen-storyboard' },
              { label: '确认', value: 'confirm-storyboard' },
            ],
          }]);
          isProcessingRef.current = false;
        } catch (err) {
          removeById(typId);
          await sendSeq('storyboard-artist', [{ kind: 'text', text: `❌ 重新生成失败：${(err as Error).message}` }]);
          isProcessingRef.current = false;
        }
      } else if (value === 'confirm-storyboard') {
        addUser('确认分镜图');

        await sendSeq('storyboard-artist', [
          { kind: 'text', text: '分镜图已确认！接下来由摄像导演进行实际拍摄。' },
        ]);
        addSystem('艺术总监要求摄像导演加入群聊');

        stepRef.current = 'camera-gen';
        isProcessingRef.current = true;

        const typId = addMsg({ sender: 'camera-director', kind: 'typing' });
        try {
          await sleep(TYPING_MS);
          setMessages(prev => prev.map(m => m.id === typId
            ? { id: genId(), sender: 'camera-director', kind: 'text', text: '大家好！我是这个项目的摄像导演。我现在去片场开始拍摄…' } as ChatMsg
            : m
          ));

          await sleep(400);
          const typId2 = addMsg({ sender: 'camera-director', kind: 'typing' });
          await directorMode.composeVideo();
          removeById(typId2);

          stepRef.current = 'camera-confirm';
          isProcessingRef.current = false;

          await sendSeq('camera-director', [{
            kind: 'options',
            text: '拍摄完成！视频片段已生成，请查看右侧画板，效果满意吗？',
            options: [
              { label: '重新生成', value: 'regen-video' },
              { label: '确认', value: 'confirm-video' },
            ],
          }]);
        } catch (err) {
          removeById(typId);
          await sendSeq('camera-director', [{ kind: 'text', text: `❌ 拍摄失败：${(err as Error).message}` }]);
          isProcessingRef.current = false;
        }
      }
      return;
    }

    // ── 摄像导演：确认/重生成视频 ────────────────────
    if (step === 'camera-confirm') {
      if (value === 'regen-video') {
        addUser('请重新生成视频');
        isProcessingRef.current = true;

        const typId = addMsg({ sender: 'camera-director', kind: 'typing' });
        try {
          await directorMode.composeVideo();
          removeById(typId);
          await sendSeq('camera-director', [{
            kind: 'options',
            text: '视频已重新生成，请查看右侧画板。',
            options: [
              { label: '重新生成', value: 'regen-video' },
              { label: '确认', value: 'confirm-video' },
            ],
          }]);
          isProcessingRef.current = false;
        } catch (err) {
          removeById(typId);
          await sendSeq('camera-director', [{ kind: 'text', text: `❌ 重新生成失败：${(err as Error).message}` }]);
          isProcessingRef.current = false;
        }
      } else if (value === 'confirm-video') {
        if (finalComposeRef.current) return;
        finalComposeRef.current = true;

        addUser('确认视频，开始拼接');
        isProcessingRef.current = true;

        const typId = addMsg({ sender: 'camera-director', kind: 'typing' });
        try {
          const result = await window.api.asideComposeVideo(screenplayId);
          removeById(typId);

          if (result.success) {
            await sendSeq('camera-director', [
              { kind: 'text', text: '✅ 视频拼接完成，已保存到本地！' },
            ]);
            await sleep(1200);
            await sendSeq('art-director', [
              { kind: 'text', text: '🎉 恭喜！整个制作流程圆满完成！\n\n✨ 剧本创作 → 完成\n✨ 角色设计 → 完成\n✨ 演员形象 → 完成\n✨ 分镜绘制 → 完成\n✨ 视频拍摄 → 完成\n\n期待您的下一个作品！' },
            ]);
            stepRef.current = 'completed';
            onComplete?.();
          } else {
            throw new Error(result.error || '未知错误');
          }
        } catch (err) {
          removeById(typId);
          await sendSeq('camera-director', [{ kind: 'text', text: `❌ 视频拼接失败：${(err as Error).message}` }]);
          finalComposeRef.current = false;
        } finally {
          isProcessingRef.current = false;
        }
      }
      return;
    }
  };

  // ── 工作流事件监听 ────────────────────────────────────

  useEffect(() => {
    // 角色生成完成
    const unsub1 = window.api.onWorkflowCharacters((data: any) => {
      if (data.screenplayId !== screenplayId) return;
      removeByKind('typing', 'art-director');
      directorMode.updateCharacters(data.characters);

      const hasScenes = data.scene_breakdowns?.length > 0;
      const msgText = hasScenes
        ? '✨ 人物和场景已生成，请查看右侧画板。如需修改请告诉我！'
        : '✨ 人物已生成，请查看右侧画板。如需修改请告诉我！';

      const id = addMsg({
        sender: 'art-director',
        kind: 'options',
        text: msgText,
        options: [
          { label: '重新生成', value: 'regenerate' },
          { label: '无需修改', value: 'confirm' },
        ],
      });
      stepRef.current = 'art-director-confirm';
    });

    // 分镜生成完成
    const unsub2 = window.api.onWorkflowStoryboard((data: any) => {
      if (data.screenplayId !== screenplayId) return;
      removeByKind('typing', 'storyboard-artist');
      directorMode.updateStoryboard(data.storyboard);
    });

    // 视频生成完成
    const unsub3 = window.api.onWorkflowVideo((data: any) => {
      if (data.screenplayId !== screenplayId) return;
      removeByKind('typing', 'camera-director');
      if (directorMode.addVideo && data.videoUrl) {
        directorMode.addVideo({
          id: `video-${Date.now()}`,
          url: data.videoUrl,
          localPath: data.localVideoPath,
          duration: data.totalDuration,
          description: '生成的视频',
        });
      }
    });

    // 进度事件（可选：服务端主动推 typing 时同步）
    const unsub4 = window.api.onWorkflowProgress((data: any) => {
      if (data.screenplayId !== screenplayId) return;
      // 进度事件在新版由各步骤自行管理 typing，此处仅记录日志
      console.log('[ChatPanel] 工作流进度:', data);
    });

    // 错误
    const unsub5 = window.api.onWorkflowError((data: any) => {
      if (data.screenplayId !== screenplayId) return;
      removeByKind('typing');
      addMsg({ sender: 'art-director', kind: 'text', text: `❌ 工作流错误：${data.error}` });
      isProcessingRef.current = false;
    });

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [screenplayId]);

  // ── 剧本切换时重置 ────────────────────────────────────

  useEffect(() => {
    setMessages([]);
    setRespondedIds(new Set());
    setSelectedValues(new Map());
    stepRef.current = 'art-director';
    isProcessingRef.current = false;
    videoSpecRef.current = { duration: null, aspectRatio: null };
    confirmedCharsRef.current = new Set();
    charLockRef.current = new Set();
    storyboardStartedRef.current = false;
    finalComposeRef.current = false;
  }, [screenplayId]);

  // ── 欢迎消息（剧本加载后） ────────────────────────────

  useEffect(() => {
    const timer = setTimeout(async () => {
      await sendSeq('art-director', [{
        kind: 'options',
        text: '您好！我是您的 AI 艺术总监。您的剧本已同步至右侧画板，您可以随时查看。\n\n在正式分配任务前，请先确认视频时长规格：',
        options: [
          { label: '长视频 (15-30s)', value: 'long' },
          { label: '短视频 (15s以下)', value: 'short' },
        ],
      }]);
    }, 800);
    return () => clearTimeout(timer);
  }, [screenplayId]);

  // ── 渲染 ──────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-slate-900/60">
      {/* 头部：群组信息 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-800/40">
        <div className="flex -space-x-1.5">
          {Object.values(AGENT_CFG).map(cfg => (
            <div
              key={cfg.name}
              className={`w-6 h-6 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center text-[10px] ring-2 ring-slate-900`}
              title={cfg.name}
            >
              {cfg.emoji}
            </div>
          ))}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-200">导演团队</div>
          <div className="text-[11px] text-slate-500">{messages.length} 条消息</div>
        </div>
      </div>

      {/* 消息列表（不自动滚动） */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <span className="text-4xl mb-3 select-none">🎬</span>
            <span className="text-sm">导演团队正在集合…</span>
          </div>
        )}
        {messages.map(msg => (
          <Bubble
            key={msg.id}
            msg={msg}
            onOptionClick={handleOptionClick}
            respondedIds={respondedIds}
            selectedValues={selectedValues}
          />
        ))}
      </div>
    </div>
  );
}
