/**
 * 剧本编辑器组件
 */

import { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { Screenplay } from '@shared/types/aside';
import { useToastMessages } from '@renderer/components/Toast';

interface ScriptEditorProps {
  /** 剧本数据 */
  screenplay: Screenplay;
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (content: string) => void;
}

/**
 * 剧本编辑器组件
 */
export function ScriptEditor({ screenplay, onClose, onSave }: ScriptEditorProps) {
  const [content, setContent] = useState(screenplay.content);
  const toast = useToastMessages();

  /**
   * 处理保存
   */
  const handleSave = () => {
    if (!content.trim()) {
      toast.warning('剧本内容不能为空');
      return;
    }
    onSave(content.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl h-[80vh] bg-neutral-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-semibold">编辑剧本</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 编辑器 */}
        <div className="flex-1 p-6 overflow-hidden">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在此输入剧本内容..."
            className="w-full h-full px-4 py-3 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700 resize-none"
          />
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>保存</span>
          </button>
        </div>
      </div>
    </div>
  );
}
