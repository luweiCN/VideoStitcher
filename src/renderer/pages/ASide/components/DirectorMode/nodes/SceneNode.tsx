/**
 * 场景设定节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Film } from 'lucide-react';

export function SceneNode({ data, selected }: NodeProps) {
  const locationLabel = data.location_type === 'indoor' ? '室内' : data.location_type === 'outdoor' ? '室外' : '';
  const timeLabel = ({ day: '白天', night: '夜晚', dusk: '黄昏', dawn: '清晨' } as Record<string, string>)[(data.time_of_day as string) ?? ''] ?? (data.time_of_day as string) ?? '';

  return (
    <div className={`p-5 rounded-2xl border shadow-xl bg-slate-800 transition-all ${
      selected
        ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.25)] scale-[1.02] border-orange-500'
        : 'border-slate-700 hover:shadow-orange-500/10'
    }`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-green-500 !border-2 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-green-500 !border-2 !border-slate-900" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Film size={14} className="text-green-500" />
          场景设定
        </h4>
        <span className="text-xs text-slate-600">
          {locationLabel}{timeLabel ? ` · ${timeLabel}` : ''}
        </span>
      </div>

      <div className="space-y-2">
        <h5 className="text-sm font-bold text-green-400">{data.name as string}</h5>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{data.environment as string}</p>
        {data.atmosphere && <p className="text-xs text-slate-500 italic">氛围：{data.atmosphere as string}</p>}
        {Array.isArray(data.props) && (data.props as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(data.props as string[]).slice(0, 4).map((prop, i) => (
              <span key={i} className="px-1.5 py-0.5 text-xs rounded bg-green-900/30 text-green-400 border border-green-800/40">
                {prop}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
