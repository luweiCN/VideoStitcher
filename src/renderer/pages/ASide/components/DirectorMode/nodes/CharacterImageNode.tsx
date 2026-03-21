/**
 * 人物形象图片节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle } from 'lucide-react';

export function CharacterImageNode({ data, selected }: NodeProps) {
  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-purple-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-purple-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <UserCircle size={14} className="text-purple-500" />
          人物形象
        </h4>
      </div>

      <div className="w-full h-56 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt={data.name as string}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => (data.onPreview as Function)?.({ type: 'image', src: data.imageUrl, title: data.name })}
          />
        ) : (
          <UserCircle className="w-16 h-16 text-slate-700" />
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400 text-center">{data.name as string}</div>
    </div>
  );
}
