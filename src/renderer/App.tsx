import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HashRouter, Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Layout, Maximize2, Zap, Grid3X3, Settings, Stamp, Monitor, Scan, FileText, Image as ImageIcon, Layers, Shrink, Captions, Download, AlertCircle, Bell, ArrowRight, Play, Moon, Sun } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ToastProvider } from './components/Toast';
import VideoMergeMode from './features/VideoMergeMode';
import FileNameExtractorMode from './features/FileNameExtractorMode';
import CoverFormatMode from './features/CoverFormatMode';
import CoverCompressMode from './features/CoverCompressMode';
import LosslessGridMode from './features/LosslessGridMode';
import ImageMaterialMode from './features/ImageMaterialMode';
import ResizeMode from './features/ResizeMode';
import SubtitleExtractorMode from './features/SubtitleExtractorMode';
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
      tileClass: 'from-sky-500 via-blue-600 to-blue-700',
      iconClass: 'text-violet-500 bg-violet-100/80 group-hover:bg-violet-500 group-hover:text-white group-hover:shadow-violet-500/20',
      hoverClass: 'hover:border-violet-200 hover:shadow-violet-100',
      darkIconClass: 'text-violet-300 bg-violet-500/15 group-hover:bg-violet-500 group-hover:text-white group-hover:shadow-violet-500/20',
      darkHoverClass: 'hover:border-violet-500/50 hover:shadow-violet-950/30',
    },
    {
      title: '海外素材制作',
      description: '当前支持：Google模式、Meta模式、统一横屏、统一竖屏',
      path: '/resize',
      icon: Maximize2,
      tileClass: 'from-amber-400 via-orange-500 to-orange-600',
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
      tileClass: 'from-lime-500 via-green-600 to-emerald-700',
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
      tileClass: 'from-violet-500 via-purple-600 to-purple-800',
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
      tileClass: 'from-cyan-500 via-teal-600 to-teal-800',
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
      tileClass: 'from-rose-400 via-pink-500 to-rose-700',
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
      tileClass: 'from-sky-500 via-blue-600 to-blue-800',
      iconClass: 'text-sky-500 bg-sky-100/80 group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-sky-500/20',
      hoverClass: 'hover:border-sky-200 hover:shadow-sky-100',
      darkIconClass: 'text-sky-300 bg-sky-500/15 group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-sky-500/20',
      darkHoverClass: 'hover:border-sky-500/50 hover:shadow-sky-950/30',
    },
    {
      title: '视频台词识别',
      description: '按需下载模型，批量识别短视频台词文案',
      path: '/subtitleExtractor',
      icon: Captions,
      tileClass: 'from-cyan-500 via-blue-600 to-indigo-700',
      iconClass: 'text-cyan-500 bg-cyan-100/80 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-cyan-500/20',
      hoverClass: 'hover:border-cyan-200 hover:shadow-cyan-100',
      darkIconClass: 'text-cyan-300 bg-cyan-500/15 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-cyan-500/20',
      darkHoverClass: 'hover:border-cyan-500/50 hover:shadow-cyan-950/30',
    },
  ];

  return (
    <div className={`home-metal min-h-screen overflow-hidden flex flex-col font-sans relative pb-8 transition-colors duration-300 ${isDarkTheme ? 'home-lumia-dark text-white' : 'home-lumia-surface text-slate-900'}`}>

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
            className={`group relative flex h-14 items-center gap-3 rounded-md border px-6 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
              isDarkTheme
                ? 'border-slate-700/70 bg-slate-900/80 shadow-[0_8px_24px_rgba(0,0,0,0.24)] hover:border-amber-400/50 hover:shadow-[0_16px_36px_rgba(251,191,36,0.08)]'
                : 'border-white/40 bg-slate-200/40 shadow-[0_8px_20px_rgba(15,23,42,0.22)] hover:border-white/70 hover:bg-slate-100/50'
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
            className={`group relative flex h-14 items-center gap-3 rounded-md border px-7 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
              isDarkTheme
                ? 'border-slate-700/70 bg-slate-900/80 shadow-[0_8px_24px_rgba(0,0,0,0.24)] hover:border-indigo-400/50 hover:shadow-[0_16px_36px_rgba(99,102,241,0.12)]'
                : 'border-white/40 bg-slate-200/40 shadow-[0_8px_20px_rgba(15,23,42,0.22)] hover:border-white/70 hover:bg-slate-100/50'
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
        <section className="mx-auto flex w-full max-w-[1540px] flex-col pt-16 lg:pt-24">
          <div className="text-left">
            <h1 className={`text-5xl font-black leading-tight sm:text-7xl ${isDarkTheme ? 'text-slate-100' : 'text-neutral-700'}`}>
              VideoStitcher
            </h1>
            <p className={`mt-5 text-2xl font-medium ${isDarkTheme ? 'text-slate-400' : 'text-neutral-500'}`}>全能视频批处理工具箱</p>
          </div>

          <div className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.path}
                  onClick={() => onNavigate(feature.path)}
                  className={`home-lumia-tile group relative flex min-h-[310px] flex-col overflow-hidden rounded-[2px] border border-white/20 bg-gradient-to-br p-8 text-left text-white shadow-[0_5px_10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_18px_28px_rgba(15,23,42,0.42)] ${feature.tileClass} ${
                    isDarkTheme
                      ? 'brightness-90'
                      : ''
                  }`}
                >
                  <span className="absolute right-5 top-5 h-5 w-5 rounded-full border-2 border-white/80 bg-transparent transition-all duration-300 group-hover:border-emerald-200 group-hover:bg-emerald-400 group-hover:shadow-[0_0_16px_rgba(74,222,128,0.95)]" />
                  <div className="flex h-24 w-24 items-center justify-center text-white drop-shadow-sm">
                    <Icon className="h-20 w-20" strokeWidth={2.2} />
                  </div>
                  <div className="mt-auto">
                    <h2 className="text-3xl font-black leading-tight text-white drop-shadow-sm">
                      {feature.title}
                    </h2>
                    <p className="mt-4 text-xl font-medium leading-8 text-white/86">
                      {feature.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className={`relative z-10 mt-20 text-center text-sm font-medium ${isDarkTheme ? 'text-slate-500' : 'text-neutral-500'}`}>
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
        <Route path="/subtitleExtractor" element={<SubtitleExtractorMode />} />
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
