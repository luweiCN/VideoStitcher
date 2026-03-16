/**
 * 编辑人设弹窗组件
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Persona } from '@shared/types/aside';

interface EditPersonaModalProps {
  /** 人设数据 */
  persona: Persona;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (name: string, prompt: string) => void;
}

/**
 * 编辑人设弹窗组件
 */
export function EditPersonaModal({ persona, onClose, onSave }: EditPersonaModalProps) {
  const [name, setName] = useState(persona.name);
  const [prompt, setPrompt] = useState(persona.prompt);

  /**
   * 处理表单提交
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) {
      alert('请填写人设名称和提示词');
      return;
    }
    onSave(name.trim(), prompt.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-slate-800 rounded-xl shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-semibold">编辑人设</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 名称 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              人设名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：幽默风趣型"
              className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700"
              autoFocus
            />
          </div>

          {/* 提示词 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              提示词 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：说话风趣幽默，善于用夸张的表达方式"
              rows={4}
              className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700 resize-none"
            />
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
