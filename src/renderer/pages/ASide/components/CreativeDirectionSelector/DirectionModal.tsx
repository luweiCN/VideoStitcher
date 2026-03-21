/**
 * 创意方向弹窗（添加/编辑通用）
 * 添加模式：显示 AI 生成区域
 * 编辑模式：隐藏 AI 生成区域
 */

import { useState } from 'react';
import {
  X, Sparkles, Loader2, Plus,
  Laugh, Ghost, BookOpen, Mic2, Zap, Trophy, Heart,
  Drama, Film, Flame, Target, Brain, Eye, Crown, Sparkles as SparklesIcon,
} from 'lucide-react';
import { useToastMessages } from '@renderer/components/Toast';

interface DirectionModalProps {
  projectId: string;
  onClose: () => void;
  onSave: (name: string, description?: string, iconName?: string) => void;
  /** 编辑模式：传入初始数据 */
  initialData?: {
    name: string;
    description?: string;
    iconName?: string;
  };
  /** 是否为编辑模式 */
  isEdit?: boolean;
}

// 图标选项列表（与系统提示词保持一致）
const ICON_OPTIONS = [
  { name: 'Laugh', label: '搞笑', icon: Laugh, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  { name: 'Ghost', label: '悬疑', icon: Ghost, color: 'text-slate-400', bg: 'bg-slate-500/15' },
  { name: 'Sparkles', label: '创意', icon: SparklesIcon, color: 'text-violet-400', bg: 'bg-violet-500/15' },
  { name: 'BookOpen', label: '教学', icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  { name: 'Mic2', label: '解说', icon: Mic2, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  { name: 'Zap', label: '爽感', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  { name: 'Trophy', label: '竞技', icon: Trophy, color: 'text-orange-400', bg: 'bg-orange-500/15' },
  { name: 'Heart', label: '情感', icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/15' },
  { name: 'Drama', label: '戏剧', icon: Drama, color: 'text-pink-400', bg: 'bg-pink-500/15' },
  { name: 'Film', label: '剧情', icon: Film, color: 'text-indigo-400', bg: 'bg-indigo-500/15' },
  { name: 'Flame', label: '激情', icon: Flame, color: 'text-red-400', bg: 'bg-red-500/15' },
  { name: 'Target', label: '策略', icon: Target, color: 'text-teal-400', bg: 'bg-teal-500/15' },
  { name: 'Brain', label: '脑洞', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/15' },
  { name: 'Eye', label: '悬念', icon: Eye, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  { name: 'Crown', label: '逆袭', icon: Crown, color: 'text-amber-300', bg: 'bg-amber-400/15' },
];

export function DirectionModal({ projectId, onClose, onSave, initialData, isEdit }: DirectionModalProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [iconName, setIconName] = useState(initialData?.iconName ?? 'Sparkles');
  const [isGenerating, setIsGenerating] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const toast = useToastMessages();

  // 点击遮罩关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await window.api.asidePreviewCreativeDirection(projectId);
      if (result.success && result.direction) {
        setName(result.direction.name);
        setDescription(result.direction.description || '');
        if (result.direction.iconName) {
          setIconName(result.direction.iconName);
        }
        // 短暂高亮填充的字段
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning('请输入创意方向名称');
      return;
    }
    onSave(name.trim(), description.trim() || undefined, iconName);
  };

  const selectedIcon = ICON_OPTIONS.find((o) => o.name === iconName) || ICON_OPTIONS[2];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-[#0d0d12] border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/60">

        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 bg-[#0d0d12]">
          <h2 className="text-sm font-semibold text-white tracking-wide">{isEdit ? '编辑创意方向' : '添加创意方向'}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">

          {/* AI 生成区 —— 渐变边框卡（仅添加模式显示） */}
          {!isEdit && (
            <>
              <div className="relative p-px rounded-xl bg-gradient-to-br from-violet-500/40 via-transparent to-fuchsia-500/30">
                <div className="rounded-[11px] bg-[#0d0d12] p-4">
                  {/* 标题行 */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-violet-300 leading-none">AI 生成</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-none">根据项目信息自动生成专属创意风格</p>
                    </div>
                  </div>

                  {/* 生成按钮 */}
                  <button
                    type="button"
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="group w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-violet-500/25 bg-violet-500/8 text-violet-300 text-sm font-medium hover:bg-violet-500/15 hover:border-violet-400/40 hover:text-violet-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 group-hover:animate-pulse" />
                        <span>生成创意方向</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 分割线 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.05]" />
                <span className="text-[11px] text-slate-600">或手动填写</span>
                <div className="flex-1 h-px bg-white/[0.05]" />
              </div>
            </>
          )}

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 名称 */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                名称 <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：情感共鸣型"
                autoFocus
                className={`w-full px-3 py-2.5 rounded-lg text-sm text-slate-100 placeholder-slate-600 bg-white/[0.03] border outline-none transition-all ${
                  highlight
                    ? 'border-violet-500/60 bg-violet-500/5'
                    : 'border-white/[0.06] focus:border-white/15'
                }`}
              />
            </div>

            {/* 图标选择 */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-2 tracking-wide uppercase">
                图标 <span className="text-slate-700 normal-case font-normal">（当前：{selectedIcon.label}）</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ICON_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = iconName === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => setIconName(option.name)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                        isSelected
                          ? `border-white/20 ${option.bg}`
                          : 'border-white/[0.04] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                      }`}
                      title={option.label}
                    >
                      <Icon className={`w-4 h-4 ${option.color}`} />
                      <span className="text-[10px] text-slate-500 leading-none">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 描述 */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1.5 tracking-wide uppercase">
                描述 <span className="text-slate-700 normal-case font-normal">（可选）</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：通过情感化的表达方式引起观众共鸣"
                rows={4}
                className={`w-full px-3 py-2.5 rounded-lg text-sm text-slate-100 placeholder-slate-600 bg-white/[0.03] border outline-none transition-all resize-none ${
                  highlight
                    ? 'border-violet-500/60 bg-violet-500/5'
                    : 'border-white/[0.06] focus:border-white/15'
                }`}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm text-slate-500 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-white font-medium rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
