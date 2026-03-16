/**
 * 待产库弹窗组件
 */

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Script } from '@shared/types/aside';
import { QueueItem } from './QueueItem';

interface QueueModalProps {
  /** 脚本列表 */
  scripts: Script[];
  /** 关闭回调 */
  onClose: () => void;
  /** 删除回调 */
  onDelete: (scriptId: string) => void;
  /** 清空回调 */
  onClearAll: () => void;
}

/**
 * 待产库弹窗组件
 */
export function QueueModal({ scripts, onClose, onDelete, onClearAll }: QueueModalProps) {
  const [orderedScripts, setOrderedScripts] = useState(scripts);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  /**
   * 拖拽开始
   */
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  /**
   * 拖拽悬停
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  /**
   * 拖拽放下
   */
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newScripts = [...orderedScripts];
    const [draggedScript] = newScripts.splice(draggedIndex, 1);
    newScripts.splice(dropIndex, 0, draggedScript);

    setOrderedScripts(newScripts);
    setDraggedIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] bg-neutral-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold">待产库</h2>
            <p className="text-sm text-slate-500 mt-1">拖拽脚本调整顺序</p>
          </div>
          <div className="flex items-center gap-2">
            {scripts.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">清空</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {orderedScripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-slate-500">待产库为空</p>
              <p className="text-sm text-slate-600 mt-1">从脚本生成器添加脚本</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orderedScripts.map((script, index) => (
                <QueueItem
                  key={script.id}
                  script={script}
                  index={index}
                  onDelete={() => onDelete(script.id)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
