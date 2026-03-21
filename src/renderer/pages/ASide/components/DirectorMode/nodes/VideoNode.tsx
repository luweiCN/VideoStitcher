/**
 * 视频输出节点 - 加载后按真实宽高比动态调整卡片宽度
 * 横向视频 → NODE_WIDTH*3 (960px)，竖向/方形 → NODE_WIDTH*2 (640px)
 */
import { useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';

const WIDE = 320 * 3;   // 960px 横向视频
const NORMAL = 320 * 2; // 640px 竖向/方形视频

export function VideoNode({ data, selected }: NodeProps) {
  const src = data.localPath ? `file://${data.localPath as string}` : data.url as string | undefined;
  const hasResized = useRef(false);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (hasResized.current) return;
    hasResized.current = true;
    const v = e.currentTarget;
    if (!v.videoWidth || !v.videoHeight) return;
    const width = v.videoWidth > v.videoHeight ? WIDE : NORMAL;
    (data.onResize as Function)?.(width);
  };

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

      <div
        className="w-full rounded-xl overflow-hidden bg-slate-900 relative group cursor-pointer"
        onClick={() => src && (data.onPreview as Function)?.({ type: 'video', src, title: data.label })}
      >
        {src ? (
          <>
            <video
              src={src}
              className="w-full h-auto block"
              preload="metadata"
              muted
              onLoadedMetadata={handleLoadedMetadata}
            />
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
