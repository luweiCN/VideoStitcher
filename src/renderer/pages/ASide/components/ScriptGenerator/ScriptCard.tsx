/**
 * 脚本卡片组件
 * 显示单个脚本的信息和操作按钮
 */

import { Plus, Trash2, Edit3 } from 'lucide-react';
import type { Script } from '@shared/types/aside';

interface ScriptCardProps {
  /** 脚本数据 */
  script: Script;
  /** 序号 */
  index: number;
  /** 添加到待产库回调 */
  onAddToLibrary: () => void;
  /** 删除回调 */
  onDelete: () => void;
}

/**
 * 脚本卡片组件
 */
export function ScriptCard({ script, index, onAddToLibrary, onDelete }: ScriptCardProps) {
  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-4">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600/20 text-violet-400 rounded-lg flex items-center justify-center font-semibold">
            {index}
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-300">
              脚本 #{index}
            </h4>
            <p className="text-xs text-slate-500">
              {script.aiModel?.toUpperCase()} · {new Date(script.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAddToLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 text-violet-400 rounded-lg hover:bg-violet-600/30 transition-colors"
            title="添加到待产库"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">待产库</span>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 脚本内容 */}
      <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3 max-h-60 overflow-y-auto">
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{script.content}</p>
      </div>
    </div>
  );
}
