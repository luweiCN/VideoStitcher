/**
 * 区域选择器组件
 * 使用 StepLayout 包裹，支持搜索、最近选择、热门/其他分组
 */

import { useState } from 'react';
import { useASideStore } from '@renderer/stores/asideStore';
import { StepLayout } from '../StepLayout';
import { RegionSearch } from './RegionSearch';
import { RecentRegions, saveRecentRegion } from './RecentRegions';
import { useRegionSearch } from '../../hooks/useRegionSearch';
import { REGIONS, getRegionGroups } from '@shared/constants/regions';
import type { Region } from '@shared/types/aside';

/**
 * 热门地区 ID 列表
 * 定义为热门的地区，包括全国通用和主要省市
 */
const HOT_REGION_IDS = new Set([
  'universal', // 全国通用
  'beijing', // 北京
  'shanghai', // 上海
  'guangdong', // 广东
  'zhejiang', // 浙江
  'jiangsu', // 江苏
  'sichuan', // 四川
  'shandong', // 山东
]);

/**
 * 判断地区是否为热门地区
 */
function isHotRegion(region: Region): boolean {
  return HOT_REGION_IDS.has(region.id);
}

/**
 * 区域选择器主组件
 */
export function RegionSelector() {
  const { selectRegion, goToNextStep, goToPrevStep } = useASideStore();
  const [searchQuery, setSearchQuery] = useState('');

  // 从常量获取所有地区
  const allRegions = REGIONS;

  // 使用搜索 Hook 过滤地区
  const filteredRegions = useRegionSearch(allRegions, searchQuery);

  // 分类：热门地区和其他地区
  const hotRegions = filteredRegions.filter(isHotRegion);
  const otherRegions = filteredRegions.filter(r => !isHotRegion(r));

  /**
   * 选择地区并自动进入下一步
   */
  const handleSelectRegion = (region: Region) => {
    console.log('[RegionSelector] 选择地区:', region.name);
    selectRegion(region.id);
    saveRecentRegion(region.id);
    goToNextStep();
  };

  return (
    <StepLayout
      title="选择目标区域"
      stepNumber={2}
      totalSteps={4}
      showLibrary={false}
      onPrev={goToPrevStep}
      onNext={goToNextStep}
    >
      <div className="h-full flex flex-col p-6">
        {/* 搜索框 - 居中显示 */}
        <div className="mb-6">
          <RegionSearch value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* 滚动区域 */}
        <div className="flex-1 overflow-y-auto">
          {/* 最近选择 - 仅在未搜索时显示 */}
          {!searchQuery && (
            <RecentRegions regions={allRegions} onSelect={handleSelectRegion} />
          )}

          {/* 热门地区 */}
          {hotRegions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm text-slate-400 mb-3">热门地区：</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {hotRegions.map(region => (
                  <button
                    key={region.id}
                    onClick={() => handleSelectRegion(region)}
                    className="
                      px-4 py-3 bg-slate-800 text-slate-100 rounded-lg
                      hover:bg-slate-700 transition-colors
                      flex items-center gap-2
                    "
                  >
                    <span>{region.emoji}</span>
                    <span>{region.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 其他地区 */}
          {otherRegions.length > 0 && (
            <div>
              <h3 className="text-sm text-slate-400 mb-3">其他地区：</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {otherRegions.map(region => (
                  <button
                    key={region.id}
                    onClick={() => handleSelectRegion(region)}
                    className="
                      px-4 py-3 bg-slate-800 text-slate-300 rounded-lg
                      hover:bg-slate-700 transition-colors
                      flex items-center gap-2
                    "
                  >
                    <span>{region.emoji}</span>
                    <span>{region.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 无搜索结果 */}
          {filteredRegions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p>没有找到匹配的地区</p>
              <p className="text-sm mt-2">尝试其他搜索词</p>
            </div>
          )}
        </div>
      </div>
    </StepLayout>
  );
}
