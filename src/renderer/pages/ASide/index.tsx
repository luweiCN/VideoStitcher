/**
 * A面视频生产主页面
 * 整合所有子组件，管理视图切换
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useASideStore } from '../../stores/asideStore';
import { ProjectLibrary } from './components/ProjectLibrary';
import { CreativeDirectionSelector } from './components/CreativeDirectionSelector';
import { RegionSelector } from './components/RegionSelector';
import { ScreenplayGenerator } from './components/ScreenplayGenerator';
import { QuickCompose } from './components/QuickCompose';
import { DirectorMode } from './components/DirectorMode';
import { ProductionQueue } from './components/ProductionQueue';

/**
 * A面主页面组件
 */
const ASidePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentView, currentProject, selectedScreenplay, setCurrentView, goToPrevStep } = useASideStore();

  /**
   * 返回上一步或项目库
   */
  const handleBack = () => {
    if (currentView === 'director-mode') {
      setCurrentView('step3-scripts');
    } else if (currentView === 'step1-direction') {
      setCurrentView('library');
    } else {
      goToPrevStep();
    }
  };

  const handleBackFromDirectorMode = () => {
    setCurrentView('step3-scripts');
  };

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100">
      {/* 顶部工具栏 */}
      {currentProject && currentView !== 'library' && (
        <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-black/50">
          <div className="flex items-center gap-3">
            {/* 返回按钮 - 所有步骤都显示 */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </button>
            <div className="h-5 w-px bg-slate-700" />
            <div className="w-8 h-8 bg-violet-600/20 text-violet-400 rounded-lg flex items-center justify-center">
              🎬
            </div>
            <div>
              <h2 className="text-lg font-semibold">{currentProject.name}</h2>
              <p className="text-xs text-slate-500">{currentProject.gameType}</p>
            </div>
          </div>
          {/* 只有步骤3-4和导演模式才显示待产库 */}
          {(currentView === 'step3-scripts' || currentView === 'director-mode') && <ProductionQueue />}
        </header>
      )}

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'library' && <ProjectLibrary />}
        {currentView === 'step1-direction' && <CreativeDirectionSelector />}
        {currentView === 'step2-region' && <RegionSelector />}
        {currentView === 'step3-scripts' && <ScreenplayGenerator />}
        {currentView === 'quick-compose' && <QuickCompose />}
        {currentView === 'director-mode' && (
          <DirectorMode screenplayId={selectedScreenplay?.id || ''} />
        )}
      </div>
    </div>
  );
};

export default ASidePage;
