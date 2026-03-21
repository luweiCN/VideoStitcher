/**
 * 人物形象图片节点 - 加载后按真实宽高比动态调整卡片宽度
 * 横图 → NODE_WIDTH*3 (960px)，竖图/方图 → NODE_WIDTH*2 (640px)
 */
import { useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { UserCircle } from 'lucide-react';

// 与 index.tsx 的 NODE_WIDTH=320 对应
const WIDE = 320 * 3;   // 960px 横图
const NORMAL = 320 * 2; // 640px 竖图/方图

export function CharacterImageNode({ data, selected }: NodeProps) {
  const hasResized = useRef(false);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (hasResized.current) return;
    hasResized.current = true;
    const img = e.currentTarget;
    const width = img.naturalWidth > img.naturalHeight ? WIDE : NORMAL;
    (data.onResize as Function)?.(width);
  };

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

      <div className="w-full rounded-xl overflow-hidden bg-slate-900 flex justify-center">
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt={data.name as string}
            style={{ display: 'block', maxWidth: '100%', maxHeight: 800 }}
            className="cursor-zoom-in"
            onLoad={handleLoad}
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
