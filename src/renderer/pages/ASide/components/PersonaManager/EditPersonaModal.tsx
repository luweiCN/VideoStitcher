/**
 * 编辑编剧弹窗组件
 */

import { useState } from 'react';
import { X, Pencil, Tags } from 'lucide-react';
import type { Persona } from '@shared/types/aside';
import { useToastMessages } from '@renderer/components/Toast';

interface EditPersonaModalProps {
  /** 编剧数据 */
  persona: Persona;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (name: string, prompt: string, characteristics?: string[]) => void;
}

/**
 * 编辑编剧弹窗组件
 */
export function EditPersonaModal({ persona, onClose, onSave }: EditPersonaModalProps) {
  const [name, setName] = useState(persona.name);
  const [prompt, setPrompt] = useState(persona.prompt);
  const [characteristics, setCharacteristics] = useState<string[]>(
    persona.characteristics ?? []
  );
  const [isEditCharas, setIsEditCharas] = useState(false);
  const [editingCharasText, setEditingCharasText] = useState('');
  const toast = useToastMessages();

  /**
   * 处理表单提交
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) {
      toast.warning('请填写编剧人设和编剧设定');
      return;
    }
    onSave(name.trim(), prompt.trim(), characteristics);
  };

  /**
   * 保存特点标签编辑
   */
  const handleSaveCharas = () => {
    const tags = editingCharasText
      .split(/[,，、\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
    setCharacteristics(tags);
    setIsEditCharas(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div
        className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-[#0d0d12] border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 bg-[#0d0d12]">
          <h2 className="text-base font-semibold text-white tracking-wide">编辑编剧</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 名称 */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                编剧名称 <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：反转大师、幽默解构型"
                className="w-full px-3 py-2.5 rounded-lg text-base text-slate-100 placeholder-slate-600 bg-white/[0.03] border border-white/[0.06] outline-none focus:border-white/15 transition-all"
              />
            </div>

            {/* 编剧设定 */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                编剧设定 <span className="text-red-500 normal-case">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述这位编剧是谁、擅长什么、怎么写剧本..."
                rows={5}
                className="w-full px-3 py-2.5 rounded-lg text-base text-slate-100 placeholder-slate-600 bg-white/[0.03] border border-white/[0.06] outline-none focus:border-white/15 transition-all resize-none"
              />
            </div>

            {/* 特点标签 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-slate-500 tracking-wide uppercase">
                  特点标签
                </label>
                {!isEditCharas && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCharasText(characteristics.join('、'));
                      setIsEditCharas(true);
                    }}
                    className="flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    编辑
                  </button>
                )}
              </div>

              {isEditCharas ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingCharasText}
                    onChange={(e) => setEditingCharasText(e.target.value)}
                    placeholder="用逗号或换行分隔，如：反转、悬念、节奏快"
                    className="w-full px-3 py-2.5 rounded-lg text-base text-slate-100 placeholder-slate-600 bg-white/[0.03] border border-pink-500/30 outline-none focus:border-pink-400/50 transition-all"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditCharas(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCharas}
                      className="px-3 py-1.5 text-xs bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : characteristics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {characteristics.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full text-xs text-pink-300"
                    >
                      <Tags className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-600 italic">暂无特点标签</p>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-base text-slate-500 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 text-base text-white font-medium rounded-lg bg-pink-600 hover:bg-pink-500 transition-colors"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
