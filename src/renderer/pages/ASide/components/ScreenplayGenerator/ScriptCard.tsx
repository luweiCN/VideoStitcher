/**
 * 剧本卡片组件
 * 显示单个剧本的信息和操作按钮
 */

import { Plus, Trash2, Edit3, Check } from 'lucide-react';
import type { Screenplay } from '@shared/types/aside';

interface ScriptCardProps {
  /** 剧本数据 */
  screenplay: Screenplay;
  /** 序号 */
  index: number;
  /** 是否已添加到待产库 */
  isAdded?: boolean;
  /** 添加到待产库回调 */
  onAddToLibrary: () => void;
  /** 删除回调 */
  onDelete: () => void;
}

/**
 * 剧本卡片组件
 */
export function ScriptCard({ screenplay, index, isAdded = false, onAddToLibrary, onDelete }: ScriptCardProps) {
  return (
    <div className={`bg-black/50 border rounded-xl p-4 transition-all ${isAdded ? 'border-green-600/50 opacity-60' : 'border-slate-800'}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold ${isAdded ? 'bg-green-600/20 text-green-400' : 'bg-violet-600/20 text-violet-400'}`}>
            {isAdded ? <Check className="w-5 h-5" /> : index}
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-300">
              剧本 #{index}
            </h4>
            <p className="text-xs text-slate-500">
              {screenplay.aiModel?.toUpperCase()} · {new Date(screenplay.createdAt).toLocaleString('zh-CN')}
              {isAdded && <span className="text-green-400 ml-2">· 已添加</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAddToLibrary}
            disabled={isAdded}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              isAdded
                ? 'bg-green-600/20 text-green-400 cursor-not-allowed'
                : 'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30'
            }`}
            title={isAdded ? '已添加到待产库' : '添加到待产库'}
          >
            {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="text-sm">{isAdded ? '已添加' : '待产库'}</span>
          </button>
          <button
            onClick={onDelete}
            disabled={isAdded}
            className={`p-1.5 rounded-lg transition-all ${
              isAdded
                ? 'text-slate-700 cursor-not-allowed'
                : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10'
            }`}
            title={isAdded ? '已添加无法删除' : '删除'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 剧本内容 */}
      <div className="bg-black/30 border border-slate-700/50 rounded-lg p-3 max-h-60 overflow-y-auto">
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{screenplay.content}</p>
      </div>
    </div>
  );
}
