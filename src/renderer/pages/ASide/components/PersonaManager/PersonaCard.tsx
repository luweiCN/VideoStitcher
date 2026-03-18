/**
 * 人设卡片组件
 * 显示单个人设的信息
 */

import * as Tooltip from '@radix-ui/react-tooltip';
import { Check, Edit2, Trash2 } from 'lucide-react';
import type { Persona } from '@shared/types/aside';

interface PersonaCardProps {
  /** 人设数据 */
  persona: Persona;
  /** 是否选中 */
  isSelected: boolean;
  /** 选择回调 */
  onSelect: () => void;
  /** 编辑回调 */
  onEdit: () => void;
  /** 删除回调 */
  onDelete: () => void;
}

/**
 * 人设卡片组件
 */
export function PersonaCard({ persona, isSelected, onSelect, onEdit, onDelete }: PersonaCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        group relative bg-black/50 border rounded-xl p-4 cursor-pointer transition-all
        ${
          isSelected
            ? 'border-violet-600 bg-violet-600/10'
            : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
        }
      `}
    >
      {/* 选中标记 */}
      {isSelected && (
        <div className="absolute top-3 left-3 w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* 操作按钮 */}
      {!persona.isPreset && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1.5 text-slate-600 hover:text-violet-400 hover:bg-violet-400/10 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="px-3 py-1.5 bg-slate-800 text-slate-100 text-xs rounded-lg shadow-xl border border-slate-700 z-50"
                  sideOffset={5}
                >
                  编辑人设
                  <Tooltip.Arrow className="fill-slate-800" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>

          <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="px-3 py-1.5 bg-slate-800 text-slate-100 text-xs rounded-lg shadow-xl border border-slate-700 z-50"
                  sideOffset={5}
                >
                  删除人设
                  <Tooltip.Arrow className="fill-slate-800" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      )}

      {/* 人设信息 */}
      <div className="mb-3">
        <div className="w-10 h-10 mb-3 bg-violet-600/20 rounded-lg flex items-center justify-center">
          <span className="text-2xl">🎭</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-100 mb-2">{persona.name}</h3>
        <p className="text-sm text-slate-400 line-clamp-3">{persona.prompt}</p>
      </div>

      {/* 预设标记 */}
      {persona.isPreset && (
        <div className="inline-block px-2 py-1 bg-violet-600/20 text-violet-400 text-xs rounded">
          预设
        </div>
      )}
    </div>
  );
}
