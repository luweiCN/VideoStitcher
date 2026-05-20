import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HashRouter, Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Layout, Maximize2, Zap, Grid3X3, Settings, Stamp, Monitor, Scan, FileText, Image as ImageIcon, Layers, Shrink, Link, Download, AlertCircle, Bell, ArrowRight, Play, Moon, Sun } from 'lucide-react';
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
import { TaskCenterProvider } from './contexts/TaskContext';
import { VideoMergeProvider } from './contexts/VideoMergeContext';
import { TaskCenterListPage, TaskCenterDashboard, HomeTaskIndicator, TaskDetailPage } from './components/TaskCenter';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

type HomeTheme = 'light' | 'dark';

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

// 首页组件
const HomePage: React.FC<{
  appVersion: string;
  updateAvailable: boolean;
  onNavigate: (path: string) => void;
}> = ({ appVersion, updateAvailable, onNavigate }) => {
  const [homeTheme, setHomeTheme] = useState<HomeTheme>(() => {
    const savedTheme = localStorage.getItem('home-theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });
  const isDarkTheme = homeTheme === 'dark';

  useEffect(() => {
    localStorage.setItem('home-theme', homeTheme);
  }, [homeTheme]);

  const features = [
    {
      title: '横竖屏极速合成',
      description: '横竖屏一体，图层管理，所有素材独立位置调整',
      path: '/videoMerge',
      icon: Layers,
      iconClass: 'text-violet-500 bg-violet-100/80 group-hover:bg-violet-500 group-hover:text-white group-hover:shadow-violet-500/20',
      hoverClass: 'hover:border-violet-200 hover:shadow-violet-100',
      darkIconClass: 'text-violet-300 bg-violet-500/15 group-hover:bg-violet-500 group-hover:text-white group-hover:shadow-violet-500/20',
      darkHoverClass: 'hover:border-violet-500/50 hover:shadow-violet-950/30',
    },
    {
      title: '智能改尺寸',
      description: 'Siya/海外抖音/尺寸统一，智能模糊背景填充',
      path: '/resize',
      icon: Maximize2,
      iconClass: 'text-rose-500 bg-rose-100/80 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-rose-500/20',
      hoverClass: 'hover:border-rose-200 hover:shadow-rose-100',
      darkIconClass: 'text-rose-300 bg-rose-500/15 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-rose-500/20',
      darkHoverClass: 'hover:border-rose-500/50 hover:shadow-rose-950/30',
    },
    {
      title: '图片素材处理',
      description: '批量加Logo，导出九宫格切片和预览图',
      path: '/imageMaterial',
      icon: Layers,
      iconClass: 'text-amber-500 bg-amber-100/80 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-amber-500/20',
      hoverClass: 'hover:border-amber-200 hover:shadow-amber-100',
      darkIconClass: 'text-amber-300 bg-amber-500/15 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-amber-500/20',
      darkHoverClass: 'hover:border-amber-500/50 hover:shadow-amber-950/30',
    },
    {
      title: '封面格式转换',
      description: '自动检测比例，横版转1920x1080，竖版转1080x1920',
      path: '/coverFormat',
      icon: ImageIcon,
      iconClass: 'text-fuchsia-500 bg-fuchsia-100/80 group-hover:bg-fuchsia-500 group-hover:text-white group-hover:shadow-fuchsia-500/20',
      hoverClass: 'hover:border-fuchsia-200 hover:shadow-fuchsia-100',
      darkIconClass: 'text-fuchsia-300 bg-fuchsia-500/15 group-hover:bg-fuchsia-500 group-hover:text-white group-hover:shadow-fuchsia-500/20',
      darkHoverClass: 'hover:border-fuchsia-500/50 hover:shadow-fuchsia-950/30',
    },
    {
      title: '封面压缩',
      description: '智能压缩，自动调整质量与尺寸至 ~380KB',
      path: '/coverCompress',
      icon: Shrink,
      iconClass: 'text-emerald-500 bg-emerald-100/80 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-emerald-500/20',
      hoverClass: 'hover:border-emerald-200 hover:shadow-emerald-100',
      darkIconClass: 'text-emerald-300 bg-emerald-500/15 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-emerald-500/20',
      darkHoverClass: 'hover:border-emerald-500/50 hover:shadow-emerald-950/30',
    },
    {
      title: '文件名提取',
      description: '批量提取视频/图片文件名，一键生成列表',
      path: '/fileNameExtractor',
      icon: FileText,
      iconClass: 'text-pink-500 bg-pink-100/80 group-hover:bg-pink-500 group-hover:text-white group-hover:shadow-pink-500/20',
      hoverClass: 'hover:border-pink-200 hover:shadow-pink-100',
      darkIconClass: 'text-pink-300 bg-pink-500/15 group-hover:bg-pink-500 group-hover:text-white group-hover:shadow-pink-500/20',
      darkHoverClass: 'hover:border-pink-500/50 hover:shadow-pink-950/30',
    },
    {
      title: '专业无损多宫格',
      description: '自定义横竖线条，自由裁切图片，无损无压缩',
      path: '/losslessGrid',
      icon: Grid3X3,
      iconClass: 'text-sky-500 bg-sky-100/80 group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-sky-500/20',
      hoverClass: 'hover:border-sky-200 hover:shadow-sky-100',
      darkIconClass: 'text-sky-300 bg-sky-500/15 group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-sky-500/20',
      darkHoverClass: 'hover:border-sky-500/50 hover:shadow-sky-950/30',
    },
    {
      title: 'A+B 前后拼接',
      description: 'A后+B前视频前后拼接，横竖版可选',
      path: '/videoStitcher',
      icon: Link,
      iconClass: 'text-purple-500 bg-purple-100/80 group-hover:bg-purple-500 group-hover:text-white group-hover:shadow-purple-500/20',
      hoverClass: 'hover:border-purple-200 hover:shadow-purple-100',
      darkIconClass: 'text-purple-300 bg-purple-500/15 group-hover:bg-purple-500 group-hover:text-white group-hover:shadow-purple-500/20',
      darkHoverClass: 'hover:border-purple-500/50 hover:shadow-purple-950/30',
    },
  ];

  return (
    <div className={`min-h-screen overflow-hidden flex flex-col font-sans relative pb-8 transition-colors duration-300 ${isDarkTheme ? 'bg-slate-950 text-white' : 'bg-[#f8fbff] text-slate-900'}`}>
      <div className={`absolute -left-16 top-28 h-16 w-80 -rotate-45 rounded-full blur-xl ${isDarkTheme ? 'bg-indigo-500/10' : 'bg-indigo-100/50'}`} />
      <div className={`absolute -right-12 top-32 h-20 w-96 rotate-45 rounded-full blur-xl ${isDarkTheme ? 'bg-fuchsia-500/10' : 'bg-fuchsia-100/50'}`} />
      <div className={`absolute -bottom-28 left-0 h-56 w-96 rounded-[45%] blur-sm ${isDarkTheme ? 'bg-violet-500/10' : 'bg-violet-100/60'}`} />
      <div className={`absolute -bottom-24 right-0 h-56 w-[28rem] rounded-[45%] blur-sm ${isDarkTheme ? 'bg-sky-500/10' : 'bg-sky-100/55'}`} />

      <header className="relative z-10 flex flex-col gap-4 px-5 pt-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <button
          onClick={() => onNavigate('/')}
          className="group flex items-center gap-3 border-0 bg-transparent p-0 cursor-pointer"
          aria-label="返回首页"
        >
          <div className={`relative h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-violet-500 shadow-lg ${isDarkTheme ? 'shadow-blue-950/40' : 'shadow-blue-200'}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" />
            </div>
          </div>
          <span className={`text-2xl font-black ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>VideoStitcher</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setHomeTheme(isDarkTheme ? 'light' : 'dark')}
            className={`group relative flex h-16 items-center gap-3 rounded-2xl border px-6 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
              isDarkTheme
                ? 'border-slate-700/70 bg-slate-900/80 shadow-[0_8px_24px_rgba(0,0,0,0.24)] hover:border-amber-400/50 hover:shadow-[0_16px_36px_rgba(251,191,36,0.08)]'
                : 'border-slate-200/80 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-indigo-200 hover:shadow-[0_16px_36px_rgba(99,102,241,0.14)]'
            }`}
            aria-label={isDarkTheme ? '切换到白天模式' : '切换到黑夜模式'}
          >
            {isDarkTheme ? (
              <Sun className="h-7 w-7 text-amber-300 transition-colors group-hover:text-amber-200" />
            ) : (
              <Moon className="h-7 w-7 text-indigo-500 transition-colors group-hover:text-violet-500" />
            )}
            <span className={`text-base font-semibold transition-colors ${isDarkTheme ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-950'}`}>
              {isDarkTheme ? '白天模式' : '黑夜模式'}
            </span>
          </button>

          <HomeTaskIndicator onClick={() => onNavigate('/taskCenter')} theme={homeTheme} />
          <button
            onClick={() => onNavigate('/admin')}
            className={`group relative flex h-16 items-center gap-3 rounded-2xl border px-7 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
              isDarkTheme
                ? 'border-slate-700/70 bg-slate-900/80 shadow-[0_8px_24px_rgba(0,0,0,0.24)] hover:border-indigo-400/50 hover:shadow-[0_16px_36px_rgba(99,102,241,0.12)]'
                : 'border-slate-200/80 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-indigo-200 hover:shadow-[0_16px_36px_rgba(99,102,241,0.14)]'
            }`}
          >
            <Settings className="h-7 w-7 text-indigo-500 transition-colors group-hover:text-violet-500" />
            <span className={`text-base font-semibold transition-colors ${isDarkTheme ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-950'}`}>
              系统管理
            </span>
            {updateAvailable && (
              <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-100 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-5 sm:px-8">
        <section className="mx-auto flex w-full max-w-7xl flex-col items-center pt-16 lg:pt-28">
          <div className="text-center">
            <h1 className="text-5xl font-black leading-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-violet-500 to-rose-500 sm:text-6xl">
              VideoStitcher
            </h1>
            <p className={`mt-5 text-xl font-medium ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>全能视频处理工具箱</p>
          </div>

          <div className="mt-16 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.path}
                  onClick={() => onNavigate(feature.path)}
                  className={`group relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl border p-7 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                    isDarkTheme
                      ? `border-slate-800 bg-slate-900/80 shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-slate-900 ${feature.darkHoverClass}`
                      : `border-slate-200/70 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.05)] hover:bg-white ${feature.hoverClass}`
                  }`}
                >
                  <div className={`flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg shadow-transparent transition-all duration-300 ${isDarkTheme ? feature.darkIconClass : feature.iconClass}`}>
                    <Icon className="h-9 w-9" />
                  </div>
                  <div className="mt-6">
                    <h2 className={`text-xl font-black transition-colors ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                      {feature.title}
                    </h2>
                    <p className={`mt-4 text-base font-medium leading-7 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                      {feature.description}
                    </p>
                  </div>
                  <ArrowRight className={`absolute bottom-7 right-7 h-5 w-5 transition-all duration-300 group-hover:translate-x-1 ${isDarkTheme ? 'text-slate-600 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-700'}`} />
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className={`relative z-10 mt-20 text-center text-sm font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>
        <span>{appVersion} · © 2026 VideoStitcher · 全能视频处理工具箱</span>
      </footer>
    </div>
  );
};

// 主应用组件（在 Router 内部）
const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // 检查是否在版本更新页面
  const isOnUpdatesTab = location.pathname === '/admin' && searchParams.get('tab') === 'updates';
  
  const [appVersion, setAppVersion] = useState<string>('加载中...');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingUpdateInfo, setPendingUpdateInfo] = useState<UpdateInfo | null>(null);

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
        setIsAuthorized(result.authorized);
        if (!result.authorized) {
          navigate('/unauthorized', { replace: true });
        }
      } catch (error) {
        console.error('授权检查失败:', error);
        setIsAuthorized(false);
        navigate('/unauthorized', { replace: true });
      } finally {
        setIsCheckingLicense(false);
      }
    };

    checkLicense();

    const cleanup = window.api.onLicenseStatusChanged((data) => {
      setIsAuthorized(data.authorized);
      if (!data.authorized) {
        navigate('/unauthorized', { replace: true });
      }
    });

    return cleanup;
  }, [navigate]);

  // 监听更新事件
  useEffect(() => {
    const cleanupAvailable = window.api.onUpdateAvailable((data) => {
      setUpdateAvailable(true);
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setUpdateInfo(info);

      // 不在版本更新页面时显示更新通知
      if (!isOnUpdatesTab) {
        const dismissedVersion = localStorage.getItem(`update-dismissed-${data.version}`);
        if (!dismissedVersion) {
          setPendingUpdateInfo(info);
          setShowUpdateNotification(true);
        }
      }
    });

    const cleanupDownloaded = window.api.onUpdateDownloaded((data) => {
      setUpdateAvailable(true);
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setUpdateInfo(info);

      // 不在版本更新页面时显示更新通知
      if (!isOnUpdatesTab) {
        const dismissedVersion = localStorage.getItem(`update-dismissed-${data.version}`);
        if (!dismissedVersion) {
          setPendingUpdateInfo(info);
          setShowUpdateNotification(true);
        }
      }
    });

    const cleanupError = window.api.onUpdateError(() => {});

    return () => {
      cleanupAvailable();
      cleanupDownloaded();
      cleanupError();
    };
  }, [isOnUpdatesTab]);

  const handleCloseNotification = () => {
    if (pendingUpdateInfo) {
      localStorage.setItem(`update-dismissed-${pendingUpdateInfo.version}`, 'true');
    }
    setShowUpdateNotification(false);
    setPendingUpdateInfo(null);
  };

  const handleGoToUpdate = () => {
    setShowUpdateNotification(false);
    setPendingUpdateInfo(null);
    navigate('/admin?tab=updates');
  };

  // 如果正在检查授权，显示加载状态
  if (isCheckingLicense) {
    return (
      <>
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
        {showUpdateNotification && pendingUpdateInfo && createPortal(
          <UpdateNotification
            updateInfo={pendingUpdateInfo}
            onClose={handleCloseNotification}
            onGoToUpdate={handleGoToUpdate}
          />,
          document.body
        )}
      </>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/unauthorized" element={<UnauthorizedMode />} />
        <Route path="/videoMerge" element={<VideoMergeMode />} />
        <Route path="/imageMaterial" element={<ImageMaterialMode />} />
        <Route path="/fileNameExtractor" element={<FileNameExtractorMode />} />
        <Route path="/coverFormat" element={<CoverFormatMode />} />
        <Route path="/coverCompress" element={<CoverCompressMode />} />
        <Route path="/losslessGrid" element={<LosslessGridMode />} />
        <Route path="/resize" element={<ResizeMode />} />
        <Route path="/videoStitcher" element={<VideoStitcherMode />} />
        <Route path="/admin" element={<AdminMode initialUpdateInfo={updateAvailable ? updateInfo : null} />} />
        <Route path="/taskCenter" element={<TaskCenterDashboard onViewAllTasks={() => navigate('/tasks')} onViewTaskDetail={(id) => navigate(`/task/${id}`)} />} />
        <Route path="/tasks" element={<TaskCenterListPage />} />
        <Route path="/task/:id" element={<TaskDetailPage />} />
        <Route path="/" element={
          <HomePage
            appVersion={appVersion}
            updateAvailable={updateAvailable}
            onNavigate={(path) => navigate(path)}
          />
        } />
      </Routes>

      {showUpdateNotification && pendingUpdateInfo && createPortal(
        <UpdateNotification
          updateInfo={pendingUpdateInfo}
          onClose={handleCloseNotification}
          onGoToUpdate={handleGoToUpdate}
        />,
        document.body
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <TaskCenterProvider>
      <VideoMergeProvider>
        <ToastProvider>
          <Tooltip.Provider>
            <HashRouter>
              <AppContent />
            </HashRouter>
          </Tooltip.Provider>
        </ToastProvider>
      </VideoMergeProvider>
    </TaskCenterProvider>
  );
};

export default App;
