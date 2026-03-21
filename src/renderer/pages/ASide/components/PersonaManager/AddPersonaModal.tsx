/**
 * 添加编剧弹窗组件
 *
 * 支持两种生成模式：
 * 1. 一键生成：AI 根据项目信息自动生成编剧名称和完整 prompt
 * 2. 按名称生成：用户输入编剧名称，AI 沿用名称并补全 prompt
 */

import { useState } from 'react';
import {
  X, Sparkles, Loader2, Plus, Pencil, Tags
} from 'lucide-react';
import { useToastMessages } from '@renderer/components/Toast';
import type { Persona } from '@shared/types/aside';

interface AddPersonaModalProps {
  /** 项目 ID */
  projectId: string;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 添加回调 */
  onAdd: (name: string, prompt: string, characteristics?: string[]) => void;
  /** 初始数据（编辑模式） */
  initialData?: Pick<Persona, 'name' | 'prompt' | 'characteristics'>;
  /** 是否为编辑模式 */
  isEdit?: boolean;
}

export function AddPersonaModal({ projectId, onClose, onAdd, initialData, isEdit }: AddPersonaModalProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [prompt, setPrompt] = useState(initialData?.prompt ?? '');
  const [characteristics, setCharacteristics] = useState<string[]>(
    initialData?.characteristics ?? []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [isEditCharas, setIsEditCharas] = useState(false);
  const [editingCharasText, setEditingCharasText] = useState('');
  const toast = useToastMessages();

  /**
   * 处理 AI 生成
   * 逻辑：名称输入框有内容 → 按名称生成；无内容 → 通用生成
   */
  const handleAIGenerate = async () => {
    if (!projectId) {
      toast.warning('项目 ID 缺失，请先选择一个项目');
      return;
    }
    setIsGenerating(true);
    try {
      const userWriterName = name.trim() || undefined;
      const result = await window.api.asidePreviewPersona(projectId, userWriterName);

      if (result.success && result.persona) {
        setName(result.persona.name);
        setPrompt(result.persona.prompt);
        setCharacteristics(result.persona.characteristics ?? []);
        setHighlight(true);
        setTimeout(() => setHighlight(false), 1200);
      } else {
        toast.error(result.error || 'AI 生成失败，请重试');
      }
    } catch {
      toast.error('AI 生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) {
      toast.warning('请填写编剧人设和编剧设定');
      return;
    }
    onAdd(name.trim(), prompt.trim(), characteristics);
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
          <h2 className="text-base font-semibold text-white tracking-wide">
            {isEdit ? '编辑编剧' : '添加编剧'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">

          {/* AI 生成区 —— 仅添加模式显示 */}
          {!isEdit && (
            <>
              <div className="relative p-px rounded-xl bg-gradient-to-br from-pink-500/40 via-transparent to-violet-500/30">
                <div className="rounded-[11px] bg-[#0d0d12] p-4">
                  {/* 标题行 */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/15 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-pink-300 leading-none">AI 生成编剧</p>
                      <p className="text-base text-slate-500 mt-0.5 leading-none">
                        根据项目信息生成专属编剧人设
                      </p>
                    </div>
                  </div>

                  {/* 提示文字 */}
                  <p className="text-base text-slate-500 mb-2.5">
                    {name.trim()
                      ? '检测到已输入名称，将「按名称生成」模式补全完整 prompt'
                      : '点击生成，AI 将自动推断编剧风格和特点'}
                  </p>

                  {/* 生成按钮 */}
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="group w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-pink-500/25 bg-pink-500/8 text-pink-300 text-base font-medium hover:bg-pink-500/15 hover:border-pink-400/40 hover:text-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 group-hover:animate-pulse" />
                        <span>{name.trim() ? '按名称生成' : '一键生成'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 分割线 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.05]" />
                <span className="text-base text-slate-600">或手动填写</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
            </>
          )}

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 名称 */}
            <div>
              <label className="block text-base font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                编剧名称 <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：反转大师、幽默解构型"
                className={`w-full px-3 py-2.5 rounded-lg text-base text-slate-100 placeholder-slate-600 bg-white/[0.03] border outline-none transition-all ${
                  highlight
                    ? 'border-pink-500/60 bg-pink-500/5'
                    : 'border-white/[0.06] focus:border-white/15'
                }`}
              />
            </div>

            {/* 编剧设定 */}
            <div>
              <label className="block text-base font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                编剧设定 <span className="text-red-500 normal-case">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述这位编剧是谁、擅长什么、怎么写剧本..."
                rows={5}
                className={`w-full px-3 py-2.5 rounded-lg text-base text-slate-100 placeholder-slate-600 bg-white/[0.03] border outline-none transition-all resize-none ${
                  highlight
                    ? 'border-pink-500/60 bg-pink-500/5'
                    : 'border-white/[0.06] focus:border-white/15'
                }`}
              />
            </div>

            {/* 特点标签 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-base font-medium text-slate-500 tracking-wide uppercase">
                  特点标签
                </label>
                {!isEditCharas && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCharasText(characteristics.join('、'));
                      setIsEditCharas(true);
                    }}
                    className="flex items-center gap-1 text-base text-pink-400 hover:text-pink-300 transition-colors"
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
                      className="px-3 py-1.5 text-base text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:border-slate-500 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCharas}
                      className="px-3 py-1.5 text-base bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-500/10 border border-pink-500/20 rounded-full text-base text-pink-300"
                    >
                      <Tags className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-base text-slate-600 italic">暂无特点标签</p>
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
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-base text-white font-medium rounded-lg bg-pink-600 hover:bg-pink-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isEdit ? '保存' : '添加'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
