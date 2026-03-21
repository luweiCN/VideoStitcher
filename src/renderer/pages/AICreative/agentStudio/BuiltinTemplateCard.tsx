import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { BUILTIN_PROMPT_TEMPLATES } from '@shared/constants/promptTemplates';
import PromptLayerBlock from './PromptLayerBlock';

type BuiltinTemplate = (typeof BUILTIN_PROMPT_TEMPLATES)[number];

interface BuiltinTemplateCardProps {
  template: BuiltinTemplate;
  isActive: boolean;
  onSetActive: () => void;
}

const BuiltinTemplateCard: React.FC<BuiltinTemplateCardProps> = ({
  template,
  isActive,
  onSetActive,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Lock className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-300">{template.name}</span>
            <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400">只读</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">系统内置，不可删除或修改</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isActive ? (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-xs text-emerald-400">
              <Check className="w-3 h-3" />
              生效中
            </span>
          ) : (
            <button
              onClick={onSetActive}
              title="设为生效"
              className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-500 hover:text-white transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-700"
          >
            {expanded ? '收起' : '查看内容'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-4">
          <PromptLayerBlock
            editableContent={template.editablePart}
            editableHint="— Agent 人设、创意指南、示例（可在自定义模板中调整）"
            lockedContent={template.lockedPart}
            dynamicTemplate={template.userPromptTemplate}
          />
        </div>
      )}
    </div>
  );
};

export default BuiltinTemplateCard;
