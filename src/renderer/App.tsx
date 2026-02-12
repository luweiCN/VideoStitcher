import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Layout, Maximize2, Zap, Grid3X3, Settings, Stamp, Monitor, Scan, FileText, Image as ImageIcon, Layers, Shrink, Link, Download, AlertCircle, Bell } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ToastProvider } from './components/Toast';
import VideoMergeMode from './features/VideoMergeMode';
import FileNameExtractorMode from './features/FileNameExtractorMode';
import CoverFormatMode from './features/CoverFormatMode';
import CoverCompressMode from './features/CoverCompressMode';
import LosslessGridMode from './features/LosslessGridMode';
import ImageMaterialMode from './features/ImageMaterialMode';
import ResizeMode from './features/ResizeMode';
import VideoStitcherMode from './features/VideoStitcherMode';
import AdminMode from './features/AdminMode';
import UnauthorizedMode from './features/UnauthorizedMode';

type View = 'home' | 'videoMerge' | 'resize' | 'imageMaterial' | 'admin' | 'fileNameExtractor' | 'coverFormat' | 'losslessGrid' | 'coverCompress' | 'videoStitcher' | 'unauthorized';

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
}> = ({ updateInfo, onClose, onGoToUpdate }) => {
  return (
    <div className="fixed top-4 right-4 z-[99999]">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 max-w-md shadow-2xl border border-indigo-400/30">
        <div className="flex items-start gap-4">
          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white mb-1">发现新版本</h3>
            <p className="text-sm text-indigo-100 mb-3">
              版本 <span className="font-semibold text-white">{updateInfo.version}</span> 已发布，点击查看更新详情
            </p>
            <div className="flex gap-2">
              <button
                onClick={onGoToUpdate}
                className="flex-1 px-3 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors cursor-pointer border-0"
              >
                立即查看
              </button>
              <button
                onClick={onClose}
                className="px-3 py-2 bg-slate-700/50 text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors cursor-pointer border-0"
              >
                不再提醒
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const [appVersion, setAppVersion] = useState<string>('加载中...');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingUpdateInfo, setPendingUpdateInfo] = useState<UpdateInfo | null>(null);
  const [hasAttemptedNotification, setHasAttemptedNotification] = useState(false);
  // 通用跳转状态：null 表示不跳转，'system' | 'settings' | 'updates' 表示跳转到对应标签
  const [gotoAdminSection, setGotoAdminSection] = useState<'system' | 'settings' | 'updates' | null>(null);

  // 授权状态
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);

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

  // 检查授权状态
  useEffect(() => {
    const checkLicense = async () => {
      try {
        const result = await window.api.checkLicense();
        console.log('授权检查结果:', result);
        setIsAuthorized(result.authorized);

        // 如果未授权，切换到未授权页面
        if (!result.authorized) {
          setCurrentView('unauthorized');
        }
      } catch (error) {
        console.error('授权检查失败:', error);
        setIsAuthorized(false);
        setCurrentView('unauthorized');
      } finally {
        setIsCheckingLicense(false);
      }
    };

    checkLicense();

    // 监听授权状态变更
    const cleanup = window.api.onLicenseStatusChanged((data) => {
      console.log('授权状态变更:', data);
      setIsAuthorized(data.authorized);
      if (!data.authorized) {
        setCurrentView('unauthorized');
      }
    });

    return cleanup;
  }, []);

  // 监听更新事件
  useEffect(() => {
    const cleanupAvailable = window.api.onUpdateAvailable((data) => {
      console.log('[App] 收到 update-available 事件:', data);
      setUpdateAvailable(true);
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setUpdateInfo(info);
      setHasAttemptedNotification(false); // 重置标志，准备显示弹窗

      // 只有不在设置页面时才立即显示弹窗
      if (currentView !== 'admin') {
        // 检查是否已关闭过此版本的弹窗
        const dismissedVersion = localStorage.getItem(`update-dismissed-${data.version}`);
        console.log('[App] dismissedVersion:', dismissedVersion);
        if (!dismissedVersion) {
          console.log('[App] 显示全局更新通知弹窗');
          setPendingUpdateInfo(info);
          setShowUpdateNotification(true);
          setHasAttemptedNotification(true);
        } else {
          console.log('[App] 此版本通知已被关闭，跳过显示');
        }
      } else {
        console.log('[App] 在设置页面，等待 AdminMode 组件决定是否显示弹窗');
      }
    });

    const cleanupDownloaded = window.api.onUpdateDownloaded((data) => {
      setUpdateAvailable(true);
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setUpdateInfo(info);

      // 如果已经在版本更新页面，不显示全局tip
      if (currentView === 'admin') {
        return;
      }

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
  }, [currentView]);

  // 关闭更新通知弹窗（点击"不再提醒"）
  const handleCloseNotification = () => {
    if (pendingUpdateInfo) {
      localStorage.setItem(`update-dismissed-${pendingUpdateInfo.version}`, 'true');
    }
    setShowUpdateNotification(false);
    setPendingUpdateInfo(null);
  };

  // 关闭通知弹窗（点击"立即查看"）
  const handleCloseNotificationForView = () => {
    // 不添加 dismiss key，只关闭弹窗
    setShowUpdateNotification(false);
    setPendingUpdateInfo(null);
  };

  // 跳转到系统管理页面（通用方法）
  const handleGoToAdmin = (section?: 'system' | 'settings' | 'updates') => {
    setCurrentView('admin');
    if (section) {
      setGotoAdminSection(section);
    }
  };

  // 跳转到系统管理页面并传递更新信息
  const handleGoToUpdate = () => {
    handleCloseNotificationForView(); // 不添加 dismiss key
    handleGoToAdmin();
  };

  // 跳转到系统管理页面的版本更新标签
  const handleGoToUpdateDirectly = () => {
    handleCloseNotificationForView();
    handleGoToAdmin('updates');
  };

  // 从未授权页面返回（授权成功后）
  // 不再需要，授权成功后会自动刷新页面

  // 如果正在检查授权，显示加载状态（静默，不显示文字）
  if (isCheckingLicense) {
    return (
      <>
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
        {/* 全局更新通知弹窗 - 使用 Portal 确保在最外层渲染 */}
        {showUpdateNotification && pendingUpdateInfo && createPortal(
          <UpdateNotification
            updateInfo={pendingUpdateInfo}
            onClose={handleCloseNotification}
            onGoToUpdate={handleGoToUpdateDirectly}
          />,
          document.body
        )}
      </>
    );
  }

  // 根据当前视图获取页面内容
  const getPageContent = () => {
    switch (currentView) {
      case 'unauthorized':
        return <UnauthorizedMode />;
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
        return (
          <AdminMode
            onBack={() => setCurrentView('home')}
            initialUpdateInfo={updateAvailable ? updateInfo : null}
            gotoSection={gotoAdminSection}
            onSectionHandled={() => setGotoAdminSection(null)}
            onUpdateSectionChange={(isUpdatesSection) => {
              // 如果不在版本更新标签，且有更新可用，且还没有尝试过显示弹窗
              if (!isUpdatesSection && updateAvailable && updateInfo && !hasAttemptedNotification) {
                const dismissedVersion = localStorage.getItem(`update-dismissed-${updateInfo.version}`);
                if (!dismissedVersion) {
                  console.log('[App] 在设置页面的其他标签，显示更新通知弹窗');
                  setPendingUpdateInfo(updateInfo);
                  setShowUpdateNotification(true);
                  setHasAttemptedNotification(true);
                }
              }
            }}
          />
        );
      default:
        return (
          <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans relative pb-6">
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
                {updateAvailable && (
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse ml-auto" />
                )}
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
              <div className="text-center mb-16">
                <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-400">
                  VideoStitcher
                </h1>
                <p className="text-slate-400 text-lg font-medium mt-4">全能视频批处理工具箱</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-7xl">
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

                <button
                  onClick={() => setCurrentView('videoStitcher')}
                  className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-pink-500 hover:shadow-lg hover:shadow-pink-500/10 hover:-translate-y-0.5"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
                    <Link className="w-16 h-16" />
                  </div>
                  <div className="relative z-10 space-y-3">
                    <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-colors text-pink-400">
                      <Link className="w-6 h-6" />
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
            </div>

            <footer className="mt-16 text-slate-600 text-sm font-medium text-center">
              <span>{appVersion} · © 2026 VideoStitcher · 全能视频批处理工具箱</span>
            </footer>
          </div>
        );
      }
    };

  return (
    <ToastProvider>
      <Tooltip.Provider>
        {getPageContent()}
        {showUpdateNotification && pendingUpdateInfo && createPortal(
          <UpdateNotification
            updateInfo={pendingUpdateInfo}
            onClose={handleCloseNotification}
            onGoToUpdate={handleGoToUpdateDirectly}
          />,
          document.body
        )}
      </Tooltip.Provider>
    </ToastProvider>
  );
};

export default App;
