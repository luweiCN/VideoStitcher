/**
 * 创意方向卡片组件
 * 显示单个创意方向的信息
 */

import { Trash2, Edit2 } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { CreativeDirection } from '@shared/types/aside';

interface DirectionCardProps {
  /** 创意方向数据 */
  direction: CreativeDirection;
  /** 是否选中 */
  isSelected?: boolean;
  /** 选择回调 */
  onSelect: () => void;
  /** 编辑回调 */
  onEdit?: () => void;
  /** 删除回调 */
  onDelete: () => void;
}

/**
 * 创意方向卡片组件
 */
export function DirectionCard({ direction, isSelected = false, onSelect, onEdit, onDelete }: DirectionCardProps) {
  /**
   * 获取图标组件
   */
  const getIcon = (iconName?: string) => {
    if (!iconName) return null;

    const IconComponent = (Icons as any)[iconName];
    if (!IconComponent) return null;

    return <IconComponent className="w-8 h-8 text-violet-400" />;
  };

  return (
    <div
      onClick={onSelect}
      className={`group border rounded-xl p-4 cursor-pointer transition-all min-w-[280px] ${
        isSelected
          ? 'bg-violet-600/20 border-violet-600 shadow-lg shadow-violet-600/20'
          : 'bg-black/50 border-slate-800 hover:border-violet-600 hover:bg-violet-600/5'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 flex items-center justify-center bg-violet-600/10 rounded-lg">
          {getIcon(direction.iconName) || (
            <div className="w-8 h-8 flex items-center justify-center text-violet-400 text-2xl">
              💡
            </div>
          )}
        </div>
        {!direction.isPreset && (
          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-1.5 text-slate-600 hover:text-violet-400 hover:bg-violet-400/10 rounded-lg transition-all"
                title="编辑"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-semibold text-slate-100">{direction.name}</h3>
        {direction.isPreset && (
          <span className="px-2 py-0.5 bg-violet-600/20 text-violet-400 text-xs rounded">
            预设
          </span>
        )}
      </div>

      {direction.description && (
        <p className="text-sm text-slate-400 line-clamp-2 overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {direction.description}
        </p>
      )}
    </div>
  );
}
