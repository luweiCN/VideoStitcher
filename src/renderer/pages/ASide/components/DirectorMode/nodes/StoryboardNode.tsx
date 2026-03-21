/**
 * 分镜矩阵节点 - 双约束自适应比例（横图贴满宽，竖图封顶高）
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
      {/* 宽度由父级 style.width 控制，节点内部不设 w-* */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Film size={14} className="text-blue-500" />
          {(data.label as string) ?? '分镜矩阵'}
        </h4>
      </div>

      {/*
        双约束自适应：max-width:100% 横图贴满，max-height 竖图封顶
        分镜通常为横向多列，设 maxHeight:1200 给更多垂直空间
      */}
      <div className="w-full rounded-xl overflow-hidden bg-slate-900 flex justify-center">
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt="分镜图"
            style={{ display: 'block', maxWidth: '100%', maxHeight: 1200 }}
            className="cursor-zoom-in"
            onClick={() => (data.onPreview as Function)?.({ type: 'image', src: data.imageUrl, title: data.label ?? '分镜矩阵' })}
          />
        ) : (
          <div className="h-32 flex items-center justify-center w-full">
            <Film className="w-12 h-12 text-slate-700" />
          </div>
        )}
      </div>
    </div>
  );
}
