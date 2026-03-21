/**
 * 视频输出节点 - 自适应视频真实宽高比，不裁切
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

export function VideoNode({ data, selected }: NodeProps) {
  const src = data.localPath ? `file://${data.localPath as string}` : data.url as string | undefined;

  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-red-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Play size={14} className="text-red-500" />
          视频输出
        </h4>
      </div>

      {/* 自适应高度：video 用 h-auto 保持真实宽高比，absolute 遮罩随之伸展 */}
      <div
        className="w-full rounded-xl overflow-hidden bg-slate-900 relative group cursor-pointer"
        onClick={() => src && (data.onPreview as Function)?.({ type: 'video', src, title: data.label })}
      >
        {src ? (
          <>
            <video src={src} className="w-full h-auto block" preload="metadata" muted />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-10 h-10 text-white drop-shadow-lg" fill="white" />
            </div>
          </>
        ) : (
          <div className="h-40 flex items-center justify-center">
            <Play className="w-12 h-12 text-slate-700" />
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-slate-400">
        {data.label as string} {data.duration ? `(${data.duration as string})` : ''}
      </div>
    </div>
  );
}
