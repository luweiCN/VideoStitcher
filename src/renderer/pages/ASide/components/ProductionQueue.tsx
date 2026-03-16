/**
 * 待产库管理组件
 */

import React from 'react';
import {
  ListOrdered,
  Clock,
  Trash2,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  AlertCircle,
} from 'lucide-react';
import type { QueueItem } from '../../pages/ASide/types';

interface ProductionQueueProps {
  items: QueueItem[];
  onRemove: (itemId: string) => void;
  onUpdatePriority: (itemId: string, priority: 'high' | 'normal' | 'low') => void;
  onStartProduction: () => void;
  onClearQueue: () => void;
}

export const ProductionQueue: React.FC<ProductionQueueProps> = ({
  items,
  onRemove,
  onUpdatePriority,
  onStartProduction,
  onClearQueue,
}) => {
  const pendingCount = items.filter((item) => item.task.status === 'pending').length;
  const processingCount = items.filter((item) => item.task.status === 'processing').length;
  const completedCount = items.filter((item) => item.task.status === 'completed').length;

  return (
    <div className="bg-black/50 border border-slate-800 rounded-xl p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-orange-600 rounded-lg flex items-center justify-center">
            <ListOrdered className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">待产库</h2>
            <p className="text-xs text-slate-400">
              {items.length} 个任务 · {pendingCount} 待处理 · {processingCount} 处理中 ·{' '}
              {completedCount} 已完成
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={onClearQueue}
              className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-medium rounded-lg hover:bg-slate-700 hover:text-slate-300 transition-colors"
            >
              清空待产库
            </button>
            <button
              onClick={onStartProduction}
              disabled={processingCount > 0}
              className={`
                flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all
                ${
                  processingCount === 0
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:shadow-lg hover:shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }
              `}
            >
              <Play className="w-3 h-3" />
              开始生产
            </button>
          </div>
        )}
      </div>

      {/* 列表 */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <ListOrdered className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-400">待产库为空</p>
          <p className="text-xs text-slate-500 mt-1">从脚本列表添加任务到待产库</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              onRemove={onRemove}
              onUpdatePriority={onUpdatePriority}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface QueueItemCardProps {
  item: QueueItem;
  onRemove: (itemId: string) => void;
  onUpdatePriority: (itemId: string, priority: 'high' | 'normal' | 'low') => void;
}

const QueueItemCard: React.FC<QueueItemCardProps> = ({
  item,
  onRemove,
  onUpdatePriority,
}) => {
  const getStatusBadge = () => {
    switch (item.task.status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded">
            <Clock className="w-3 h-3" />
            待处理
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded">
            <div className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            处理中 {item.task.progress}%
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded">
            完成
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded">
            <AlertCircle className="w-3 h-3" />
            失败
          </span>
        );
    }
  };

  const getPriorityIcon = () => {
    switch (item.priority) {
      case 'high':
        return <ArrowUp className="w-3 h-3 text-red-400" />;
      case 'low':
        return <ArrowDown className="w-3 h-3 text-slate-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getPriorityIcon()}
            <h4 className="font-medium text-white text-sm">{item.script.title}</h4>
            {getStatusBadge()}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{item.script.totalDuration} 秒</span>
            <span>·</span>
            <span>{item.task.config.resolution}</span>
            <span>·</span>
            <span>{item.task.config.aspectRatio}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 优先级控制 */}
          {item.task.status === 'pending' && (
            <div className="flex gap-1">
              <button
                onClick={() => onUpdatePriority(item.id, 'high')}
                className={`p-1.5 rounded transition-colors ${
                  item.priority === 'high'
                    ? 'bg-red-500/10 text-red-400'
                    : 'text-slate-600 hover:text-red-400 hover:bg-red-500/10'
                }`}
                title="高优先级"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onUpdatePriority(item.id, 'normal')}
                className={`p-1.5 rounded transition-colors ${
                  item.priority === 'normal'
                    ? 'bg-slate-700 text-slate-300'
                    : 'text-slate-600 hover:text-slate-300 hover:bg-slate-700'
                }`}
                title="普通优先级"
              >
                <div className="w-3 h-0.5 bg-current rounded" />
              </button>
              <button
                onClick={() => onUpdatePriority(item.id, 'low')}
                className={`p-1.5 rounded transition-colors ${
                  item.priority === 'low'
                    ? 'bg-slate-700 text-slate-400'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-slate-700'
                }`}
                title="低优先级"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 删除按钮 */}
          {item.task.status !== 'processing' && (
            <button
              onClick={() => onRemove(item.id)}
              className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="移除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 进度条 */}
      {item.task.status === 'processing' && (
        <div className="mt-3">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-orange-600 transition-all duration-300"
              style={{ width: `${item.task.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {item.task.status === 'failed' && item.task.error && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          {item.task.error}
        </div>
      )}
    </div>
  );
};

export default ProductionQueue;
