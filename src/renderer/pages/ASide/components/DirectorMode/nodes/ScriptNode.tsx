/**
 * 剧本节点 - React Flow 自定义节点
 * 点击铅笔图标触发外部弹窗编辑（通过 data.onEdit 回调），不再内联转换形态
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText, Pencil } from 'lucide-react';
import { ScreenplayCard } from '../../ScreenplayGenerator/ScreenplayCard';

export function ScriptNode({ data, selected }: NodeProps) {
  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-orange-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} className="text-blue-500" />
          剧本
        </h4>
        <button
          onClick={() => (data.onEdit as Function)?.()}
          className="text-slate-400 hover:text-orange-500 transition-colors p-1"
          title="编辑剧本"
        >
          <Pencil size={14} />
        </button>
      </div>

      <div className="min-h-[60px]">
        <ScreenplayCard content={(data.text as string) ?? ''} showFull />
      </div>
    </div>
  );
}
