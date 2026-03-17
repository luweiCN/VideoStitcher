/**
 * A面视频生产主页面
 * 整合所有子组件，管理视图切换
 */

import React from 'react';
import { useASideStore } from '../../stores/asideStore';
import { ProjectLibrary } from './components/ProjectLibrary';
import { CreativeDirectionSelector } from './components/CreativeDirectionSelector';
import { RegionSelector } from './components/RegionSelector';
import { ScreenplayGenerator } from './components/ScreenplayGenerator';
import { DirectorMode } from './pages/DirectorMode';
import { ProductionQueue } from './components/ProductionQueue';

/**
 * A面主页面组件
 */
const ASidePage: React.FC = () => {
  const { currentView, currentProject } = useASideStore();

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100">
      {/* 顶部工具栏 */}
      {currentProject && currentView !== 'library' && (
        <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-black/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600/20 text-violet-400 rounded-lg flex items-center justify-center">
              🎬
            </div>
            <div>
              <h2 className="text-lg font-semibold">{currentProject.name}</h2>
              <p className="text-xs text-slate-500">{currentProject.gameType}</p>
            </div>
          </div>
          <ProductionQueue />
        </header>
      )}

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'library' && <ProjectLibrary />}
        {currentView === 'step1-direction' && <CreativeDirectionSelector />}
        {currentView === 'step2-region' && <RegionSelector />}
        {currentView === 'step3-scripts' && <ScreenplayGenerator />}
        {currentView === 'director-mode' && <DirectorMode />}
      </div>
    </div>
  );
};

export default ASidePage;
