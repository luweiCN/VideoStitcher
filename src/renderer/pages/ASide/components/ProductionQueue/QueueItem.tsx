/**
 * 待产库项组件
 * 显示单个待产剧本的信息
 */

import { GripVertical, Trash2 } from 'lucide-react';
import type { Screenplay } from '@shared/types/aside';
import { ScreenplayCard } from '../ScreenplayGenerator/ScreenplayCard';

interface QueueItemProps {
  /** 剧本数据 */
  screenplay: Screenplay;
  /** 序号 */
  index: number;
  /** 删除回调 */
  onDelete: () => void;
  /** 拖拽开始回调 */
  onDragStart: (e: React.DragEvent, index: number) => void;
  /** 拖拽悬停回调 */
  onDragOver: (e: React.DragEvent) => void;
  /** 拖拽放下回调 */
  onDrop: (e: React.DragEvent, index: number) => void;
}

/**
 * 待产库项组件
 */
export function QueueItem({ screenplay, index, onDelete, onDragStart, onDragOver, onDrop }: QueueItemProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className="bg-black/50 border border-slate-800 rounded-lg p-3 cursor-move hover:border-slate-700 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* 拖拽手柄 */}
        <div className="mt-1 text-slate-600 cursor-move">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* 序号 */}
        <div className="w-6 h-6 bg-violet-600/20 text-violet-400 rounded text-center text-xs font-semibold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <ScreenplayCard content={screenplay.content} createdAt={screenplay.createdAt} showFull />
        </div>

        {/* 删除按钮 */}
        <button
          onClick={onDelete}
          className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-all flex-shrink-0"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
