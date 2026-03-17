/**
 * 最近选择的地区组件
 * 显示最近 10 次选择的地区，使用 localStorage 存储
 */

import { Clock } from 'lucide-react';
import type { Region } from '@shared/types/aside';

/**
 * RecentRegions 组件 Props
 */
interface RecentRegionsProps {
  regions: Region[];
  onSelect: (region: Region) => void;
}

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
 * @param regionId - 地区 ID
 */
export function saveRecentRegion(regionId: string): void {
  const recent = getRecentRegions();
  const filtered = recent.filter(id => id !== regionId);
  const updated = [regionId, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * 最近选择地区组件
 * 显示为标签列表，按选择时间排序
 */
export function RecentRegions({ regions, onSelect }: RecentRegionsProps) {
  const recentIds = getRecentRegions();
  const recentRegions = regions.filter(r => recentIds.includes(r.id));

  // 没有最近选择时不显示
  if (recentRegions.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
        <Clock className="w-4 h-4" />
        <span>最近选择：</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentRegions.map(region => (
          <button
            key={region.id}
            onClick={() => onSelect(region)}
            className="
              px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg
              hover:bg-slate-700 transition-colors text-sm
            "
          >
            {region.name}
          </button>
        ))}
      </div>
    </div>
  );
}
