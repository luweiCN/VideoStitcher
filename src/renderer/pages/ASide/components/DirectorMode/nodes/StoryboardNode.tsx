/**
 * 分镜矩阵节点（宽 640px）
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Film } from 'lucide-react';

export function StoryboardNode({ data, selected }: NodeProps) {
  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      {/* 宽度由父级传入 style.width=640 控制，节点内部不设 w-* */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Film size={14} className="text-blue-500" />
          {(data.label as string) ?? '分镜矩阵'}
        </h4>
      </div>

      <div className="w-full rounded-xl overflow-hidden bg-slate-900">
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt="分镜图"
            className="w-full h-auto object-contain cursor-zoom-in"
            style={{ maxHeight: 400 }}
            onClick={() => (data.onPreview as Function)?.({ type: 'image', src: data.imageUrl, title: data.label ?? '分镜矩阵' })}
          />
        ) : (
          <div className="h-32 flex items-center justify-center">
            <Film className="w-12 h-12 text-slate-700" />
          </div>
        )}
      </div>
    </div>
  );
}
