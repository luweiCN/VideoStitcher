/**
 * A面视频生产主页面
 * 整合所有子组件，管理视图切换
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useASideStore } from '../../stores/asideStore';
import { ProjectLibrary } from './components/ProjectLibrary';
import { CreativeDirectionSelector } from './components/CreativeDirectionSelector';
import { RegionSelector } from './components/RegionSelector';
import { ScreenplayGenerator } from './components/ScreenplayGenerator';
import { QuickCompose } from './components/QuickCompose';
import { DirectorMode } from './components/DirectorMode';
import { ProductionQueue } from './components/ProductionQueue';
import { SettingsPage } from './components/Settings';
import { RegionSettingsPage } from './components/Settings/RegionSettingsPage';

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
    } else if (currentView === 'settings-regions') {
      setCurrentView('settings');
    } else if (currentView === 'settings') {
      setCurrentView('library');
    } else {
      goToPrevStep();
    }
  };

  const handleBackFromDirectorMode = () => {
    setCurrentView('step3-scripts');
  };

  /** 是否为设置相关视图 */
  const isSettingsView = currentView === 'settings' || currentView === 'settings-regions';

  return (
    <div className="h-screen flex flex-col bg-black text-slate-100">
      {/* 顶部工具栏 */}
      {(currentProject && currentView !== 'library') || isSettingsView ? (
        <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-black/50">
          <div className="flex items-center gap-3">
            {/* 返回按钮 - 仅 Step1 和设置视图显示，其余步骤由 StepLayout 自带上一步按钮 */}
            {(currentView === 'step1-direction' || isSettingsView) && (
              <>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">返回</span>
                </button>
                <div className="h-5 w-px bg-slate-700" />
              </>
            )}
            {isSettingsView ? (
              <>
                <div className="w-8 h-8 bg-slate-700/50 text-slate-400 rounded-lg flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {currentView === 'settings-regions' ? '地区设置' : '设置'}
                  </h2>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 bg-violet-600/20 text-violet-400 rounded-lg flex items-center justify-center">
                  🎬
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{currentProject?.name}</h2>
                  <p className="text-xs text-slate-500">{currentProject?.gameType}</p>
                </div>
              </>
            )}
          </div>
          {/* 只有步骤3-4和导演模式才显示待产库 */}
          {(currentView === 'step3-scripts' || currentView === 'director-mode') && <ProductionQueue />}
        </header>
      ) : null}

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {currentView === 'library' && (
          <ProjectLibrary />
        )}
        {currentView === 'step1-direction' && <CreativeDirectionSelector />}
        {currentView === 'step2-region' && <RegionSelector />}
        {currentView === 'step3-scripts' && <ScreenplayGenerator />}
        {currentView === 'quick-compose' && <QuickCompose />}
        {currentView === 'director-mode' && (
          <DirectorMode screenplayId={selectedScreenplay?.id || ''} />
        )}
        {currentView === 'settings' && (
          <SettingsPage onNavigate={(view) => setCurrentView(view as any)} />
        )}
        {currentView === 'settings-regions' && <RegionSettingsPage />}
      </div>
    </div>
  );
};

export default ASidePage;
