import React, { useState, useEffect } from 'react';
import { X, Layout, Maximize2, Zap, Grid3X3, Settings, Stamp, Monitor, Scan, FileText, Image as ImageIcon, Layers, Shrink, Film, Download, AlertCircle, Bell } from 'lucide-react';
import VideoMergeMode from './features/VideoMergeMode';
import FileNameExtractorMode from './features/FileNameExtractorMode';
import CoverFormatMode from './features/CoverFormatMode';
import CoverCompressMode from './features/CoverCompressMode';
import LosslessGridMode from './features/LosslessGridMode';
import ImageMaterialMode from './features/ImageMaterialMode';
import ResizeMode from './features/ResizeMode';
import VideoStitcherMode from './features/VideoStitcherMode';
import AdminMode from './features/AdminMode';

type View = 'home' | 'videoMerge' | 'resize' | 'imageMaterial' | 'admin' | 'fileNameExtractor' | 'coverFormat' | 'losslessGrid' | 'coverCompress' | 'videoStitcher';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

// 全局更新通知弹窗组件
const UpdateNotification: React.FC<{
  updateInfo: UpdateInfo;
  onClose: () => void;
  onGoToUpdate: () => void;
}> = ({ updateInfo, onClose, onGoToUpdate }) => (
  <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-4 duration-300">
    <div className="bg-gradient-to-br from-indigo-900/95 to-violet-900/95 backdrop-blur-sm border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-500/20 p-5 max-w-md">
      <div className="flex items-start gap-4">
        {/* 图标 */}
        <div className="flex-shrink-0 w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
          <Bell className="w-6 h-6 text-indigo-400 animate-pulse" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white mb-1">发现新版本</h3>
          <p className="text-indigo-200 text-sm mb-2">
            版本 <span className="font-semibold text-white">{updateInfo.version}</span> 已发布
          </p>
          {updateInfo.releaseNotes && (
            <div
              className="text-slate-300 text-xs mb-3 max-h-10 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={onGoToUpdate}
              className="flex-1 px-3 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-400 transition-colors"
            >
              立即查看
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-700/50 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              稍后提醒
            </button>
          </div>
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [appVersion, setAppVersion] = useState<string>('加载中...');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingUpdateInfo, setPendingUpdateInfo] = useState<UpdateInfo | null>(null);

  // 获取应用版本
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const info = await window.api.getAppVersion();
        setAppVersion(`v${info.version}`);
      } catch {
        setAppVersion('v?.?.?');
      }
    };
    fetchVersion();
  }, []);

  // 监听更新事件
  useEffect(() => {
    const cleanupAvailable = window.api.onUpdateAvailable((data) => {
      setUpdateAvailable(true);
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setUpdateInfo(info);

      // 检查是否已关闭过此版本的弹窗
      const dismissedVersion = localStorage.getItem(`update-dismissed-${data.version}`);
      if (!dismissedVersion) {
        setPendingUpdateInfo(info);
        setShowUpdateNotification(true);
      }
    });

    const cleanupDownloaded = window.api.onUpdateDownloaded((data) => {
      setUpdateAvailable(true);
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setUpdateInfo(info);

      const dismissedVersion = localStorage.getItem(`update-dismissed-${data.version}`);
      if (!dismissedVersion) {
        setPendingUpdateInfo(info);
        setShowUpdateNotification(true);
      }
    });

    const cleanupError = window.api.onUpdateError(() => {
      // 静默处理错误
    });

    return () => {
      cleanupAvailable();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  // 关闭更新通知弹窗
  const handleCloseNotification = () => {
    if (pendingUpdateInfo) {
      localStorage.setItem(`update-dismissed-${pendingUpdateInfo.version}`, 'true');
    }
    setShowUpdateNotification(false);
    setPendingUpdateInfo(null);
  };

  // 跳转到系统管理页面并传递更新信息
  const handleGoToUpdate = () => {
    handleCloseNotification();
    setCurrentView('admin');
  };

  if (currentView === 'videoMerge') {
    return <VideoMergeMode onBack={() => setCurrentView('home')} />;
  }

  // 根据当前视图获取页面内容
  const getPageContent = () => {
    switch (currentView) {
      case 'videoMerge':
        return <VideoMergeMode onBack={() => setCurrentView('home')} />;
      case 'imageMaterial':
        return <ImageMaterialMode onBack={() => setCurrentView('home')} />;
      case 'fileNameExtractor':
        return <FileNameExtractorMode onBack={() => setCurrentView('home')} />;
      case 'coverFormat':
        return <CoverFormatMode onBack={() => setCurrentView('home')} />;
      case 'coverCompress':
        return <CoverCompressMode onBack={() => setCurrentView('home')} />;
      case 'losslessGrid':
        return <LosslessGridMode onBack={() => setCurrentView('home')} />;
      case 'resize':
        return <ResizeMode onBack={() => setCurrentView('home')} />;
      case 'videoStitcher':
        return <VideoStitcherMode onBack={() => setCurrentView('home')} />;
      case 'admin':
        return <AdminMode onBack={() => setCurrentView('home')} initialUpdateInfo={updateAvailable ? updateInfo : null} />;
      default:
        // 首页
        return (
          <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans relative">
            {/* 右上角固定设置按钮 */}
            <div className="fixed top-6 right-6 z-50">
              <button
                onClick={() => setCurrentView('admin')}
                className="group relative flex items-center gap-3 px-4 py-2.5 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-xl hover:border-purple-500/50 hover:bg-slate-800/80 transition-all duration-300 shadow-lg hover:shadow-purple-500/10"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center shadow-md shadow-purple-600/20 group-hover:shadow-purple-600/30 transition-all">
                  <Settings className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  系统管理
                </span>
                {/* 更新提醒徽章 */}
                {updateAvailable && (
                  <>
                    <span className="flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* 主内容区域 - 居中 */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
              <div className="text-center mb-16">
                <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-400">
                  VideoStitcher
                </h1>
                <p className="text-slate-400 text-lg font-medium mt-4">全能视频批处理工具箱</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-7xl">
              {/* 横竖屏极速合成入口 */}
              <button
                onClick={() => setCurrentView('videoMerge')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <Layers className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition-colors text-violet-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-violet-400 transition-colors">横竖屏极速合成</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      横竖屏一体，图层管理，所有素材独立位置调整
                    </p>
                  </div>
                </div>
              </button>

              {/* 改尺寸入口 */}
              <button
                onClick={() => setCurrentView('resize')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <Maximize2 className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors text-rose-400">
                    <Maximize2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-rose-400 transition-colors">智能改尺寸</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Siya/海外捕鱼/尺寸统一，智能模糊背景填充
                    </p>
                  </div>
                </div>
              </button>

              {/* 图片素材处理工具入口 */}
              <button
                onClick={() => setCurrentView('imageMaterial')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-amber-500 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <Layers className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors text-amber-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-amber-400 transition-colors">图片素材处理</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      批量加Logo，导出九宫格切片和预览图
                    </p>
                  </div>
                </div>
              </button>

              {/* 封面格式转换器入口 */}
              <button
                onClick={() => setCurrentView('coverFormat')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <ImageIcon className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-fuchsia-500/10 rounded-xl flex items-center justify-center group-hover:bg-fuchsia-500 group-hover:text-white transition-colors text-fuchsia-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-fuchsia-400 transition-colors">封面格式转换</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      自动检测比例，横版转1920x1080，竖版转1080x1920
                    </p>
                  </div>
                </div>
              </button>

              {/* 封面压缩入口 */}
              <button
                onClick={() => setCurrentView('coverCompress')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <Shrink className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-400">
                    <Shrink className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-emerald-400 transition-colors">封面压缩</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      智能压缩，自动调整质量与尺寸至 ~380KB
                    </p>
                  </div>
                </div>
              </button>

              {/* 视频/图片文件名提取入口 */}
              <button
                onClick={() => setCurrentView('fileNameExtractor')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-pink-500 hover:shadow-lg hover:shadow-pink-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <FileText className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-colors text-pink-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-pink-400 transition-colors">文件名提取</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      批量提取视频/图片文件名，一键生成列表
                    </p>
                  </div>
                </div>
              </button>

              {/* 专业无损九宫格入口 */}
              <button
                onClick={() => setCurrentView('losslessGrid')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-cyan-500 hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <Grid3X3 className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-colors text-cyan-400">
                    <Grid3X3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-cyan-400 transition-colors">专业无损九宫格</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      1:1原图，无损无压缩九宫格切割
                    </p>
                  </div>
                </div>
              </button>

              {/* A+B 前后拼接入口 */}
              <button
                onClick={() => setCurrentView('videoStitcher')}
                className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-pink-500 hover:shadow-lg hover:shadow-pink-500/10 hover:-translate-y-0.5"
              >
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                  <Film className="w-16 h-16" />
                </div>
                <div className="relative z-10 space-y-3">
                  <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-colors text-pink-400">
                    <Film className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold mb-1 text-white group-hover:text-pink-400 transition-colors">A+B 前后拼接</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      A面+B面视频前后拼接，横竖版可选
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <footer className="mt-16 text-slate-600 text-sm font-medium">
              <span>{appVersion} · © 2026 VideoStitcher · 全能视频批处理工具箱</span>
            </footer>
          </div>
        </div>
        );
    }
  };

  return (
    <>
      {getPageContent()}
      {/* 全局更新通知弹窗 */}
      {showUpdateNotification && pendingUpdateInfo && (
        <UpdateNotification
          updateInfo={pendingUpdateInfo}
          onClose={handleCloseNotification}
          onGoToUpdate={handleGoToUpdate}
        />
      )}
    </>
  );
};

export default App;
