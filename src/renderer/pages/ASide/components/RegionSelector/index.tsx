/**
 * 区域选择器组件（Step 2）
 * 数据库驱动，支持搜索、最近选择、层级分组展示
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Region } from '@shared/types/aside';
import { StepLayout } from '../StepLayout';
import { RecentRegions, saveRecentRegion } from './RecentRegions';
import { useRegionSearch } from '../../hooks/useRegionSearch';

/**
 * 区域选择器主组件
 */
export function RegionSelector() {
  const { currentProject, selectRegion, goToNextStep, goToPrevStep } = useASideStore();
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 从数据库加载地区列表
  useEffect(() => {
    const load = async () => {
      try {
        const result = await window.api.regionGetAll();
        if (result.success && result.regions) {
          setRegions(result.regions.filter((r: Region) => r.isActive));
        }
      } catch (err) {
        console.error('[RegionSelector] 加载地区失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // 进入页面自动聚焦搜索框
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // 可选中的地区（level 2 及以下，即非根节点）
  const selectableRegions = useMemo(
    () => regions.filter(r => r.level >= 2),
    [regions],
  );

  // 搜索过滤
  const filteredRegions = useRegionSearch(selectableRegions, searchQuery);

  // 按父级分组（L1 作为分组头）
  const groupedRegions = useMemo(() => {
    const l1Regions = regions.filter(r => r.level === 1);
    return l1Regions
      .map(l1 => ({
        header: l1,
        items: filteredRegions.filter(r => r.parentId === l1.id),
      }))
      .filter(g => g.items.length > 0);
  }, [regions, filteredRegions]);

  // 无父级的 level 2 条目（孤立节点，直接展示）
  const orphanItems = useMemo(() => {
    const l1Ids = new Set(regions.filter(r => r.level === 1).map(r => r.id));
    return filteredRegions.filter(r => !r.parentId || !l1Ids.has(r.parentId));
  }, [regions, filteredRegions]);

  /**
   * 选择地区
   */
  const handleSelect = (region: Region) => {
    console.log('[RegionSelector] 选择地区:', region.name);
    setSelectedRegionId(region.id);
    selectRegion(region.id);
  };

  /**
   * 下一步并保存最近选择
   */
  const handleNext = () => {
    if (selectedRegionId) {
      saveRecentRegion(selectedRegionId);
      goToNextStep();
    }
  };

  const leftContent = (
    <div>
      <h1 className="text-xl font-semibold text-slate-100 tracking-tight">选择目标地区</h1>
      <p className="text-xs text-slate-600 mt-0.5 tracking-widest uppercase">Step 2 · 4</p>
    </div>
  );

  const rightContent = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
      <input
        ref={searchInputRef}
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="搜索地区…"
        className="
          w-56 pl-9 pr-4 py-2 text-sm
          bg-slate-900/80 text-slate-200 placeholder-slate-600
          rounded-lg border border-slate-800
          focus:outline-none focus:border-slate-600
          transition-colors
        "
      />
    </div>
  );

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-600 text-sm">
        请先选择一个项目
      </div>
    );
  }

  return (
    <StepLayout
      title="选择目标地区"
      stepNumber={2}
      totalSteps={4}
      showLibrary={false}
      onPrev={goToPrevStep}
      onNext={selectedRegionId ? handleNext : undefined}
      leftContent={leftContent}
      rightContent={rightContent}
    >
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 pt-8 pb-28">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-sm text-slate-600 tracking-wide">加载中…</div>
            </div>
          ) : (
            <>
              {/* 最近选择 */}
              {!searchQuery && (
                <RecentRegions
                  regions={selectableRegions}
                  selectedId={selectedRegionId}
                  onSelect={handleSelect}
                />
              )}

              {/* 分组列表 */}
              {groupedRegions.map(({ header, items }) => (
                <RegionGroup
                  key={header.id}
                  label={header.name}
                  regions={items}
                  selectedId={selectedRegionId}
                  onSelect={handleSelect}
                />
              ))}

              {/* 孤立节点 */}
              {orphanItems.length > 0 && (
                <RegionGroup
                  label="其他"
                  regions={orphanItems}
                  selectedId={selectedRegionId}
                  onSelect={handleSelect}
                />
              )}

              {/* 无搜索结果 */}
              {filteredRegions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-slate-600">
                  <MapPin className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm">没有找到匹配的地区</p>
                  <p className="text-xs mt-1 text-slate-700">尝试拼音或其他关键词</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </StepLayout>
  );
}

/**
 * 地区分组渲染组件
 */
function RegionGroup({
  label,
  regions,
  selectedId,
  onSelect,
}: {
  label: string;
  regions: Region[];
  selectedId: string | null;
  onSelect: (region: Region) => void;
}) {
  if (regions.length === 0) return null;

  return (
    <div className="mb-8">
      {/* 分组标签 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] text-slate-600 uppercase tracking-widest font-medium">
          {label}
        </span>
        <div className="flex-1 h-px bg-slate-900" />
      </div>

      {/* 地区胶囊 */}
      <div className="flex flex-wrap gap-2">
        {regions.map(region => {
          const isSelected = selectedId === region.id;
          return (
            <button
              key={region.id}
              onClick={() => onSelect(region)}
              className={`
                px-4 py-2 rounded-full text-sm border transition-all duration-150
                ${isSelected
                  ? 'border-violet-500 bg-violet-500/10 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900/80 hover:text-slate-200'
                }
              `}
            >
              {region.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
