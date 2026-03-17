/**
 * 待产库弹窗组件
 */

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Screenplay } from '@shared/types/aside';
import { QueueItem } from './QueueItem';

interface QueueModalProps {
  /** 剧本列表 */
  screenplays: Screenplay[];
  /** 关闭回调 */
  onClose: () => void;
  /** 删除回调 */
  onDelete: (screenplayId: string) => void;
  /** 清空回调 */
  onClearAll: () => void;
}

/**
 * 待产库弹窗组件
 */
export function QueueModal({ screenplays, onClose, onDelete, onClearAll }: QueueModalProps) {
  const [orderedScreenplays, setOrderedScreenplays] = useState(screenplays);
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

    const newScreenplays = [...orderedScreenplays];
    const [draggedScreenplay] = newScreenplays.splice(draggedIndex, 1);
    newScreenplays.splice(dropIndex, 0, draggedScreenplay);

    setOrderedScreenplays(newScreenplays);
    setDraggedIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] bg-neutral-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold">待产库</h2>
            <p className="text-sm text-slate-500 mt-1">拖拽剧本调整顺序</p>
          </div>
          <div className="flex items-center gap-2">
            {screenplays.length > 0 && (
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
          {orderedScreenplays.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <p className="text-slate-500">待产库为空</p>
              <p className="text-sm text-slate-600 mt-1">从剧本生成器添加剧本</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orderedScreenplays.map((screenplay, index) => (
                <QueueItem
                  key={screenplay.id}
                  screenplay={screenplay}
                  index={index}
                  onDelete={() => onDelete(screenplay.id)}
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
