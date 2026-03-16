/**
 * 区域选择器组件
 * 显示区域分组列表，默认选中全国通用
 */

import { ArrowLeft } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import { getRegionGroups } from '@shared/constants/regions';
import type { Region } from '@shared/types/aside';
import { RegionGroup } from './RegionGroup';

/**
 * 区域选择器主组件
 */
export function RegionSelector() {
  const { currentProject, selectedDirection, selectedRegion, selectRegion, setCurrentView } = useASideStore();

  // 获取区域分组
  const regionGroups = getRegionGroups();

  /**
   * 选择区域（跳转到 Step 3）
   */
  const handleSelectRegion = (region: Region) => {
    selectRegion(region.id);
    setCurrentView('step3-scripts');
  };

  /**
   * 返回 Step 1
   */
  const handleBack = () => {
    setCurrentView('step1-direction');
  };

  if (!currentProject || !selectedDirection) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择创意方向</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* 头部 */}
      <header className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={handleBack}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Step 2: 选择区域</h1>
            <p className="text-sm text-slate-500 mt-1">
              项目：{currentProject.name} / 创意方向：{selectedDirection.name}
            </p>
          </div>
        </div>
      </header>

      {/* 区域列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {regionGroups.map(({ group, regions }) => (
            <RegionGroup
              key={group}
              group={group}
              regions={regions}
              selectedRegion={selectedRegion}
              onSelect={handleSelectRegion}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
