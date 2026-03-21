/**
 * 区域选择器组件
 * 使用 StepLayout 包裹，支持搜索、最近选择、热门/地理分组
 */

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import { StepLayout } from '../StepLayout';
import { RecentRegions, saveRecentRegion } from './RecentRegions';
import { useRegionSearch } from '../../hooks/useRegionSearch';
import { REGIONS, getRegionGroups, type RegionOption } from '@shared/constants/regions';

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
 * 地理分组显示顺序
 * 按照用户习惯的顺序展示各地理分组
 */
const GROUP_ORDER = ['华东', '华南', '华北', '西北', '西南', '东北', '华中', '港澳台'];

/**
 * 判断地区是否为热门地区
 */
function isHotRegion(region: RegionOption): boolean {
  return HOT_REGION_IDS.has(region.id);
}

/**
 * 区域选择器主组件
 */
export function RegionSelector() {
  const { currentProject, selectRegion, goToNextStep, goToPrevStep } = useASideStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 从常量获取所有地区
  const allRegions = REGIONS;

  // 使用搜索 Hook 过滤地区
  const filteredRegions = useRegionSearch(allRegions, searchQuery);

  // 进入页面自动聚焦搜索框
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // 热门地区
  const hotRegions = filteredRegions.filter(isHotRegion);

  // 按地理分组过滤地区
  const regionGroups = getRegionGroups()
    .filter(g => GROUP_ORDER.includes(g.group))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
    .map(group => ({
      ...group,
      regions: group.regions.filter(r => filteredRegions.includes(r) && !isHotRegion(r)),
    }))
    .filter(group => group.regions.length > 0);

  /**
   * 选择地区（不自动进入下一步，不保存最近选择）
   */
  const handleSelectRegion = (region: RegionOption) => {
    console.log('[RegionSelector] 选择地区:', region.name);
    setSelectedRegionId(region.id);
    selectRegion(region.id);
  };

  /**
   * 点击下一步进入下一步，并保存最近选择
   */
  const handleNext = () => {
    if (selectedRegionId) {
      // 保存到最近选择
      const selectedRegion = allRegions.find(r => r.id === selectedRegionId);
      if (selectedRegion) {
        saveRecentRegion(selectedRegion.id);
      }
      goToNextStep();
    }
  };

  // 头部左侧内容：步骤信息
  const leftContent = (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">选择目标区域</h1>
      <p className="text-sm text-slate-500 mt-1">Step 2 / 4</p>
    </div>
  );

  // 头部右侧内容：搜索框
  const rightContent = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input
        ref={searchInputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="搜索地区..."
        className="
          w-64 pl-10 pr-4 py-2
          text-slate-100 placeholder-slate-500
          rounded-lg border border-slate-700
          focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500
          transition-all
        "
      />
    </div>
  );

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择一个项目</p>
      </div>
    );
  }

  return (
    <StepLayout
      stepNumber={2}
      totalSteps={4}
      showLibrary={false}
      onPrev={goToPrevStep}
      onNext={selectedRegionId ? handleNext : undefined}
      leftContent={leftContent}
      rightContent={rightContent}
    >
      <div className="h-full overflow-y-auto flex justify-center px-6 pt-6 pb-24">
        <div className="w-full max-w-4xl">
          {/* 最近选择 - 仅在未搜索时显示 */}
          {!searchQuery && (
            <RecentRegions regions={allRegions} onSelect={handleSelectRegion} />
          )}

          {/* 热门地区 */}
          {hotRegions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm text-slate-400 mb-3 font-medium">热门地区</h3>
              <div className="flex flex-wrap gap-3">
                {hotRegions.map(region => (
                  <button
                    key={region.id}
                    onClick={() => handleSelectRegion(region)}
                    className={`
                      w-24 h-24 rounded-lg border transition-all
                      flex flex-col items-center justify-center gap-2
                      text-sm
                      ${selectedRegionId === region.id
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600'
                      }
                    `}
                  >
                    <span className="text-3xl">{region.emoji}</span>
                    <span className={selectedRegionId === region.id ? 'text-violet-300' : 'text-slate-100'}>
                      {region.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 地理分组 */}
          {regionGroups.map(({ group, regions }) => (
            <div key={group} className="mb-6">
              <h3 className="text-sm text-slate-400 mb-3 font-medium">{group}</h3>
              <div className="flex flex-wrap gap-3">
                {regions.map(region => (
                  <button
                    key={region.id}
                    onClick={() => handleSelectRegion(region)}
                    className={`
                      w-24 h-24 rounded-lg border transition-all
                      flex flex-col items-center justify-center gap-2
                      text-sm
                      ${selectedRegionId === region.id
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-slate-700/50 hover:bg-slate-800/50 hover:border-slate-600'
                      }
                    `}
                  >
                    <span className="text-3xl">{region.emoji}</span>
                    <span className={selectedRegionId === region.id ? 'text-violet-300' : 'text-slate-300'}>
                      {region.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* 无搜索结果 */}
          {filteredRegions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p>没有找到匹配的地区</p>
              <p className="text-sm mt-2">尝试其他搜索词</p>
            </div>
          )}

          {/* 底部留白 */}
          <div className="h-24" />
        </div>
      </div>
    </StepLayout>
  );
}
