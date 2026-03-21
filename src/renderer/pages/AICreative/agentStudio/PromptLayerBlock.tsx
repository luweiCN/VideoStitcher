import React from 'react';
import { Lock, Unlock } from 'lucide-react';

interface PromptLayerBlockProps {
  /** 可编辑层内容（必填，用户可修改的部分） */
  editableContent: string;
  /** 可编辑层副标题说明 */
  editableHint?: string;
  /** 锁定层内容（可选，不传则不渲染锁定层） */
  lockedContent?: string;
  /** 动态提示词模板（可选，不传则不渲染） */
  dynamicTemplate?: string;
}

/**
 * 提示词三层结构展示组件
 *
 * 同时用于内置模板（三层完整数据）和自定义模板（可编辑层来自用户，
 * 锁定层/动态提示词沿用内置）的展开内容展示。
 */
const PromptLayerBlock: React.FC<PromptLayerBlockProps> = ({
  editableContent,
  editableHint = '— Agent 人设、创意指南、示例',
  lockedContent,
  dynamicTemplate,
}) => {
  return (
    <div className="space-y-4">
      {/* 可编辑层 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Unlock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-amber-400">可编辑层</span>
          <span className="text-xs text-slate-500 ml-1">{editableHint}</span>
        </div>
        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-800/60 rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed border border-amber-500/10">
          {editableContent}
        </pre>
      </div>

      {/* 锁定层 */}
      {lockedContent && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-400">锁定层</span>
            <span className="text-xs text-slate-500 ml-1">— JSON 格式、图标列表（代码依赖，禁止修改）</span>
          </div>
          <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap bg-slate-800/30 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed border border-slate-700/30">
            {lockedContent}
          </pre>
        </div>
      )}

      {/* 动态提示词 */}
      {dynamicTemplate && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-semibold text-slate-400">动态提示词</span>
            <span className="text-xs text-slate-500 ml-1">— 变量由代码注入（{'{{gameName}}'} 等）</span>
          </div>
          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-800/60 rounded-lg p-3 max-h-32 overflow-y-auto leading-relaxed">
            {dynamicTemplate}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PromptLayerBlock;
