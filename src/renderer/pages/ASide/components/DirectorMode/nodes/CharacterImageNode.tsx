/**
 * 人物形象图片节点 - 双约束自适应比例（横图贴满宽，竖图封顶高）
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

      {/*
        双约束自适应：不用 w-full，改用 max-width:100% + max-height
        - 横图：max-width 先触发 → 贴满卡片宽度，高度等比
        - 竖图：max-height 先触发 → 封顶高度，宽度等比缩小居中
        外层 flex justify-center 确保竖图水平居中
      */}
      <div className="w-full rounded-xl overflow-hidden bg-slate-900 flex justify-center">
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt={data.name as string}
            style={{ display: 'block', maxWidth: '100%', maxHeight: 800 }}
            className="cursor-zoom-in"
            onClick={() => (data.onPreview as Function)?.({ type: 'image', src: data.imageUrl, title: data.name })}
          />
        ) : (
          <div className="h-48 flex items-center justify-center w-full">
            <UserCircle className="w-16 h-16 text-slate-700" />
          </div>
        )}
      </div>
    </div>
  );
}
