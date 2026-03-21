/**
 * 剧本节点 - React Flow 自定义节点
 */
import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText, Pencil, Check, X } from 'lucide-react';
import { ScreenplayCard } from '../../ScreenplayGenerator/ScreenplayCard';

export function ScriptNode({ data, selected }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

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
        {!isEditing && (
          <button
            onClick={() => { setIsEditing(true); setEditText((data.text as string) ?? ''); }}
            className="text-slate-400 hover:text-orange-500 transition-colors p-1"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full p-3 text-sm font-medium rounded-xl border bg-slate-900 border-slate-600 text-white focus:border-orange-500 outline-none resize-none"
            rows={4}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-slate-500 hover:text-slate-300 px-3 py-1.5 flex items-center gap-1">
              <X size={14} /> 取消
            </button>
            <button
              onClick={() => { (data.onUpdate as Function)?.({ text: editText }); setIsEditing(false); }}
              className="text-xs font-bold bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 shadow-md flex items-center gap-1"
            >
              <Check size={14} /> 保存
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-[60px]">
          <ScreenplayCard content={(data.text as string) ?? ''} showFull />
        </div>
      )}
    </div>
  );
}
