/**
 * 区域分组组件
 * 显示单个区域分组的区域列表
 */

import type { RegionOption } from '@shared/constants/regions';

interface RegionGroupProps {
  /** 分组名称 */
  group: string;
  /** 区域列表 */
  regions: RegionOption[];
  /** 当前选中的区域 ID */
  selectedRegion: string;
  /** 选择回调 */
  onSelect: (region: RegionOption) => void;
}

/**
 * 区域分组组件
 */
export function RegionGroup({ group, regions, selectedRegion, onSelect }: RegionGroupProps) {  return (
    <div>
      <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">
        {group}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {regions.map(region => (
          <button
            key={region.id}
            onClick={() => onSelect(region)}
            className={`
              flex items-center gap-2 px-4 py-3 rounded-lg border transition-all
              ${
                selectedRegion === region.id
                  ? 'bg-gradient-to-r from-pink-600 to-violet-600 border-transparent text-white'
                  : 'bg-black/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
              }
            `}
          >
            <span className="text-xl">{region.emoji}</span>
            <span className="font-medium">{region.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
