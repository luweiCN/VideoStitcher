/**
 * 剧本编辑弹窗
 * 支持结构化字段编辑，保存后同步入库
 */

import { useState, useCallback } from 'react';
import { X, Save, FileText, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';

interface ScreenplayEditModalProps {
  /** 剧本 ID（用于入库） */
  screenplayId: string;
  /** 当前剧本内容（JSON 字符串或带代码块的字符串） */
  content: string;
  /** 关闭弹窗 */
  onClose: () => void;
  /** 保存成功回调，传入新的内容字符串 */
  onSaved: (newContent: string) => void;
}

/** 从字符串中提取 JSON 内容（支持 ```json 代码块） */
function extractJSON(raw: string): string {
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlock) return jsonBlock[1].trim();
  const codeBlock = raw.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1].trim();
  return raw.trim();
}

/** 可折叠的段落容器 */
function Section({
  title,
  icon,
  color,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: string;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border ${color} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-base leading-none">{icon}</span>
        <span className="text-sm font-semibold text-slate-200 flex-1">{title}</span>
        {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-white/10">{children}</div>}
    </div>
  );
}

/** 文本域字段 */
function Field({
  label,
  value,
  onChange,
  rows = 2,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5 pt-3">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm text-slate-200 bg-slate-900/70 border border-slate-700 rounded-lg
          focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30
          resize-none placeholder:text-slate-600"
      />
    </div>
  );
}

export function ScreenplayEditModal({ screenplayId, content, onClose, onSaved }: ScreenplayEditModalProps) {
  // 解析 JSON，失败时退回纯文本模式
  const parsed = (() => {
    try {
      return JSON.parse(extractJSON(content));
    } catch {
      return null;
    }
  })();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // 结构化字段 state
  const [title, setTitle] = useState<string>(parsed?.script_title ?? '');
  const [hook3sVisual, setHook3sVisual] = useState<string>(parsed?.hook_3s?.visual ?? '');
  const [hook3sDialogue, setHook3sDialogue] = useState<string>(parsed?.hook_3s?.dialogue ?? '');
  const [twistVisual, setTwistVisual] = useState<string>(parsed?.absurd_twist?.visual ?? '');
  const [twistDialogue, setTwistDialogue] = useState<string>(parsed?.absurd_twist?.dialogue ?? '');
  const [bsideVisual, setBsideVisual] = useState<string>(parsed?.bside_transition?.visual ?? '');
  const [bsideDialogue, setBsideDialogue] = useState<string>(parsed?.bside_transition?.dialogue ?? '');
  const [fullScript, setFullScript] = useState<string>(parsed?.full_script_for_art_director ?? '');

  // 纯文本模式（JSON 解析失败时）
  const [rawText, setRawText] = useState<string>(content);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError('');

    let newContent: string;

    if (parsed) {
      // 结构化模式：合并编辑后字段，重新序列化
      const updated = {
        ...parsed,
        script_title: title,
        hook_3s: { ...parsed.hook_3s, visual: hook3sVisual, dialogue: hook3sDialogue },
        absurd_twist: { ...parsed.absurd_twist, visual: twistVisual, dialogue: twistDialogue },
        bside_transition: { ...parsed.bside_transition, visual: bsideVisual, dialogue: bsideDialogue },
        full_script_for_art_director: fullScript,
      };
      newContent = JSON.stringify(updated, null, 2);
    } else {
      // 纯文本模式
      newContent = rawText;
    }

    try {
      const result = await window.api.asideUpdateScreenplayContent(screenplayId, newContent);
      if (!result.success) {
        setSaveError(result.error ?? '保存失败');
        return;
      }
      onSaved(newContent);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? '保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [screenplayId, parsed, title, hook3sVisual, hook3sDialogue, twistVisual, twistDialogue,
      bsideVisual, bsideDialogue, fullScript, rawText, onSaved, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <FileText size={18} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">编辑剧本</h2>
              <p className="text-xs text-slate-500">修改后将自动保存到数据库</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {parsed ? (
            <>
              {/* 标题 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles size={12} className="text-violet-400" /> 剧本标题
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入剧本标题..."
                  className="w-full px-3 py-2 text-sm font-medium text-slate-200 bg-slate-800 border border-slate-700 rounded-lg
                    focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                />
              </div>

              {/* 黄金3秒钩子 */}
              <Section title="黄金3秒钩子" icon="⚡" color="border-amber-700/40 bg-amber-900/10">
                <Field label="🎬 画面" value={hook3sVisual} onChange={setHook3sVisual} rows={2} placeholder="开场画面描述..." />
                <Field label="💬 台词" value={hook3sDialogue} onChange={setHook3sDialogue} rows={2} placeholder="开场台词..." />
              </Section>

              {/* 无厘头反转 */}
              <Section title="无厘头反转" icon="😂" color="border-purple-700/40 bg-purple-900/10">
                <Field label="🎬 画面" value={twistVisual} onChange={setTwistVisual} rows={2} placeholder="反转画面描述..." />
                <Field label="💬 台词" value={twistDialogue} onChange={setTwistDialogue} rows={2} placeholder="反转台词..." />
              </Section>

              {/* B面衔接 */}
              <Section title="B面衔接" icon="🎮" color="border-green-700/40 bg-green-900/10">
                <Field label="🎬 画面" value={bsideVisual} onChange={setBsideVisual} rows={2} placeholder="衔接画面描述..." />
                <Field label="💬 台词" value={bsideDialogue} onChange={setBsideDialogue} rows={2} placeholder="衔接台词..." />
              </Section>

              {/* 完整剧本 */}
              <Section title="完整剧本（供艺术总监）" icon="📄" color="border-slate-700/60 bg-slate-800/30" defaultOpen={false}>
                <Field label="" value={fullScript} onChange={setFullScript} rows={8} placeholder="完整剧本内容..." />
              </Section>

              {/* 只读元信息 */}
              {(parsed.creative_direction_name || parsed.region_style) && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {parsed.creative_direction_name && (
                    <span className="text-xs px-2 py-0.5 rounded bg-violet-600/15 text-violet-400">
                      {parsed.creative_direction_name}
                    </span>
                  )}
                  {parsed.region_style && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-600/15 text-blue-400">
                      {parsed.region_style}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            // 纯文本模式（JSON 解析失败时）
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">剧本内容</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={16}
                className="w-full px-3 py-2 text-sm text-slate-200 bg-slate-900/70 border border-slate-700 rounded-lg
                  focus:outline-none focus:border-orange-500 resize-none font-mono"
              />
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          {saveError ? (
            <p className="text-xs text-red-400">{saveError}</p>
          ) : (
            <p className="text-xs text-slate-600">修改将直接覆盖数据库中的剧本内容</p>
          )}
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-500
                disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              <Save size={14} />
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
