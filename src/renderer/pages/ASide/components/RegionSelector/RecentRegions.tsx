/**
 * 最近选择的地区组件
 * 显示最近 10 次选择的地区，使用 localStorage 存储
 */

import { Clock } from 'lucide-react';

/** localStorage 存储键名 */
const STORAGE_KEY = 'aside-recent-regions';

/** 最大最近选择数量 */
const MAX_RECENT = 10;

/**
 * 获取最近选择的地区 ID 列表
 */
export function getRecentRegions(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * 保存最近选择的地区
 */
export function saveRecentRegion(regionId: string): void {
  const recent = getRecentRegions();
  const filtered = recent.filter(id => id !== regionId);
  const updated = [regionId, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * 最近选择地区组件 Props（泛型，支持 RegionOption 和 Region）
 */
interface RecentRegionsProps<T extends { id: string; name: string }> {
  regions: T[];
  selectedId: string | null;
  onSelect: (region: T) => void;
}

/**
 * 最近选择地区组件
 * 显示为文字胶囊标签列表，按选择时间排序（最新的在最前面）
 */
export function RecentRegions<T extends { id: string; name: string }>({
  regions,
  selectedId,
  onSelect,
}: RecentRegionsProps<T>) {
  const recentIds = getRecentRegions();

  const recentRegions = recentIds
    .map(id => regions.find(r => r.id === id))
    .filter((r): r is T => r !== undefined);

  if (recentRegions.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2.5">
        <Clock className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-xs text-slate-600 uppercase tracking-widest font-medium">最近选择</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentRegions.map(region => (
          <button
            key={region.id}
            onClick={() => onSelect(region)}
            className={`
              px-3 py-1.5 rounded-full text-sm border transition-all
              ${selectedId === region.id
                ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                : 'border-slate-700/60 bg-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }
            `}
          >
            {region.name}
          </button>
        ))}
      </div>
    </div>
  );
}
