import React, { useState } from 'react';
import { Check, Edit2, Trash2 } from 'lucide-react';
import type { PromptTemplate } from './types';
import PromptLayerBlock from './PromptLayerBlock';

interface CustomTemplateCardProps {
  template: PromptTemplate;
  /** 沿用的内置锁定层内容（可选，不传则不显示锁定层） */
  builtinLockedPart?: string;
  /** 沿用的内置动态提示词（可选） */
  builtinUserPromptTemplate?: string;
  onSetActive: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const CustomTemplateCard: React.FC<CustomTemplateCardProps> = ({
  template: t,
  builtinLockedPart,
  builtinUserPromptTemplate,
  onSetActive,
  onEdit,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4">
        <span className="text-sm font-semibold text-white flex-1 min-w-0 truncate">{t.name}</span>
        {t.isActive && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-xs text-emerald-400 flex-shrink-0">
            <Check className="w-3 h-3" />
            生效中
          </span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-white transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-700"
          >
            {expanded ? '收起' : '查看内容'}
          </button>
          {!t.isActive && (
            <button
              onClick={() => onSetActive(t.id)}
              title="设为生效"
              className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(t.id)}
            title="编辑"
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(t.id)}
            title="删除"
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-4">
          <PromptLayerBlock
            editableContent={t.content}
            editableHint="— 自定义的 Agent 人设、创意指南、示例"
            lockedContent={builtinLockedPart}
            dynamicTemplate={builtinUserPromptTemplate}
          />
        </div>
      )}
    </div>
  );
};

export default CustomTemplateCard;
