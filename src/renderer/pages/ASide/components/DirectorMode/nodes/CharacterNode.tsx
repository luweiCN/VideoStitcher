/**
 * 人物设定节点
 */
import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle, RefreshCcw, Pencil, Check, X } from 'lucide-react';

export function CharacterNode({ data, selected }: NodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-orange-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-orange-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <UserCircle size={14} className="text-orange-500" />
          {data.name as string}
        </h4>
        <div className="flex items-center gap-1">
          <button
            onClick={() => (data.onRegenerate as Function)?.()}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
            title="重新生图"
          >
            <RefreshCcw size={12} className={data.isGeneratingImage ? 'animate-spin text-orange-500' : ''} />
          </button>
          {!isEditing && (
            <button
              onClick={() => { setIsEditing(true); setEditName((data.name as string) ?? ''); setEditDesc((data.description as string) ?? ''); }}
              className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-orange-400"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="角色名称"
            className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none" />
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="角色描述" rows={3}
            className="w-full p-2 text-sm rounded-lg border bg-slate-900 border-slate-600 text-white outline-none resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-white"><X size={14} /></button>
            <button onClick={() => { (data.onUpdate as Function)?.({ name: editName, description: editDesc }); setIsEditing(false); }}
              className="p-1 text-orange-500 hover:text-orange-400"><Check size={14} /></button>
          </div>
        </div>
      ) : (
        <>
          <h5 className="text-sm font-bold mb-2">{data.charName as string}</h5>
          <p className="text-xs text-slate-400 whitespace-pre-wrap">{data.description as string}</p>
        </>
      )}
    </div>
  );
}
