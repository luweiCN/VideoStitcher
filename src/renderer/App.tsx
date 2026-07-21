import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HashRouter, Navigate, Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Maximize2, Grid3X3, Settings, FileText, Image as ImageIcon, Layers, Captions, Mic2, AudioLines, ArrowRight, Play, Moon, Sun, Palette, Shuffle } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ToastProvider, useToastMessages } from './components/Toast';
import VideoMergeMode from './features/VideoMergeMode';
import FileNameExtractorMode from './features/FileNameExtractorMode';
import CoverToolboxMode from './features/CoverToolboxMode';
import CoverFormatMode from './features/CoverFormatMode';
import CoverCompressMode from './features/CoverCompressMode';
import LosslessGridMode from './features/LosslessGridMode';
import ImageMaterialMode from './features/ImageMaterialMode';
import ImageMaterialWorkshopMode from './features/ImageMaterialWorkshopMode';
import ResizeMode from './features/ResizeMode';
import SubtitleExtractorMode from './features/SubtitleExtractorMode';
import TextToSpeechMode from './features/TextToSpeechMode';
import SoundEffectNamingMode from '@/features/SoundEffectNamingMode';
import VideoDedupMode from './features/VideoDedupMode';
import AdminMode from './features/AdminMode';
import { mergeAvailableUpdate, type AvailableUpdateState, type UpdateInfo } from './features/updateState';
import UnauthorizedMode from './features/UnauthorizedMode';
import SkinStoreMode from './features/SkinStoreMode';
import { TaskCenterProvider } from './contexts/TaskContext';
import { VideoMergeProvider } from './contexts/VideoMergeContext';
import { TaskCenterListPage, TaskCenterDashboard, HomeTaskIndicator, TaskDetailPage } from './components/TaskCenter';
import { DEFAULT_HOME_SKIN_ID, HOME_SKIN_STORAGE_KEY, type HomeSkinId, isHomeSkinId } from './constants/homeSkins';

type HomeTheme = 'light' | 'dark';

const homeIcons = {
  videoMerge: new URL('./assets/home-icons/video-merge.png', import.meta.url).href,
  resize: new URL('./assets/home-icons/resize.png', import.meta.url).href,
  imageMaterial: new URL('./assets/home-icons/image-material.png', import.meta.url).href,
  coverToolbox: new URL('./assets/home-icons/cover-toolbox.png', import.meta.url).href,
  fileNameExtractor: new URL('./assets/home-icons/file-name-extractor.png', import.meta.url).href,
  losslessGrid: new URL('./assets/home-icons/lossless-grid.png', import.meta.url).href,
  subtitleExtractor: new URL('./assets/home-icons/subtitle-extractor.png', import.meta.url).href,
  textToSpeech: new URL('./assets/home-icons/tts.png', import.meta.url).href,
};

const getSavedHomeSkin = (): HomeSkinId => {
  const savedSkin = localStorage.getItem(HOME_SKIN_STORAGE_KEY);
  return isHomeSkinId(savedSkin) ? savedSkin : DEFAULT_HOME_SKIN_ID;
};

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
  const [homeSkin, setHomeSkin] = useState<HomeSkinId>(() => getSavedHomeSkin());
  const isDarkTheme = homeTheme === 'dark';

  useEffect(() => {
    if (homeSkin === 'metal-brass') {
      localStorage.setItem('home-theme', 'dark');
      if (homeTheme !== 'dark') {
        setHomeTheme('dark');
      }
      return;
    }

    localStorage.setItem('home-theme', homeTheme);
  }, [homeSkin, homeTheme]);

  useEffect(() => {
    const handleSkinChanged = () => {
      const savedSkin = getSavedHomeSkin();
      setHomeSkin(savedSkin);
      if (savedSkin === 'metal-brass') {
        localStorage.setItem('home-theme', 'dark');
        setHomeTheme('dark');
      }
    };

    window.addEventListener('home-skin-changed', handleSkinChanged);
    window.addEventListener('storage', handleSkinChanged);

    return () => {
      window.removeEventListener('home-skin-changed', handleSkinChanged);
      window.removeEventListener('storage', handleSkinChanged);
    };
  }, []);

  const features = [
    {
      title: '横竖屏极速合成',
      description: '横竖屏一体，图层管理，所有素材独立位置调整',
      path: '/videoMerge',
      icon: Layers,
      image: homeIcons.videoMerge,
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
      image: homeIcons.resize,
      tileClass: 'from-amber-400 via-orange-500 to-orange-600',
      iconClass: 'text-rose-500 bg-rose-100/80 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-rose-500/20',
      hoverClass: 'hover:border-rose-200 hover:shadow-rose-100',
      darkIconClass: 'text-rose-300 bg-rose-500/15 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-rose-500/20',
      darkHoverClass: 'hover:border-rose-500/50 hover:shadow-rose-950/30',
    },
    {
      title: '视频降重处理',
      description: '批量生成视频变体，用于降低素材重复度',
      path: '/videoDedup',
      icon: Shuffle,
      image: '',
      tileClass: 'from-rose-500 via-pink-600 to-fuchsia-700',
      iconClass: 'text-rose-500 bg-rose-100/80 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-rose-500/20',
      hoverClass: 'hover:border-rose-200 hover:shadow-rose-100',
      darkIconClass: 'text-rose-300 bg-rose-500/15 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-rose-500/20',
      darkHoverClass: 'hover:border-rose-500/50 hover:shadow-rose-950/30',
    },
    {
      title: '图片素材处理',
      description: '批量加Logo，导出九宫格切片和预览图',
      path: '/imageWorkshop',
      icon: Layers,
      image: homeIcons.imageMaterial,
      tileClass: 'from-lime-500 via-green-600 to-emerald-700',
      iconClass: 'text-amber-500 bg-amber-100/80 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-amber-500/20',
      hoverClass: 'hover:border-amber-200 hover:shadow-amber-100',
      darkIconClass: 'text-amber-300 bg-amber-500/15 group-hover:bg-amber-500 group-hover:text-white group-hover:shadow-amber-500/20',
      darkHoverClass: 'hover:border-amber-500/50 hover:shadow-amber-950/30',
    },
    {
      title: '封面工具箱',
      description: '集合格式转换与压缩优化，统一处理封面图片',
      path: '/imageWorkshop?mode=cover',
      icon: ImageIcon,
      image: homeIcons.coverToolbox,
      tileClass: 'from-violet-500 via-purple-600 to-purple-800',
      iconClass: 'text-fuchsia-500 bg-fuchsia-100/80 group-hover:bg-fuchsia-500 group-hover:text-white group-hover:shadow-fuchsia-500/20',
      hoverClass: 'hover:border-fuchsia-200 hover:shadow-fuchsia-100',
      darkIconClass: 'text-fuchsia-300 bg-fuchsia-500/15 group-hover:bg-fuchsia-500 group-hover:text-white group-hover:shadow-fuchsia-500/20',
      darkHoverClass: 'hover:border-fuchsia-500/50 hover:shadow-fuchsia-950/30',
    },
    {
      title: '文件名提取',
      description: '批量提取视频/图片文件名，一键生成列表',
      path: '/fileNameExtractor',
      icon: FileText,
      image: homeIcons.fileNameExtractor,
      tileClass: 'from-rose-400 via-pink-500 to-rose-700',
      iconClass: 'text-pink-500 bg-pink-100/80 group-hover:bg-pink-500 group-hover:text-white group-hover:shadow-pink-500/20',
      hoverClass: 'hover:border-pink-200 hover:shadow-pink-100',
      darkIconClass: 'text-pink-300 bg-pink-500/15 group-hover:bg-pink-500 group-hover:text-white group-hover:shadow-pink-500/20',
      darkHoverClass: 'hover:border-pink-500/50 hover:shadow-pink-950/30',
    },
    {
      title: '专业无损多宫格',
      description: '自定义横竖线条，自由裁切图片，无损无压缩',
      path: '/imageWorkshop?mode=lossless',
      icon: Grid3X3,
      image: homeIcons.losslessGrid,
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
      image: homeIcons.subtitleExtractor,
      tileClass: 'from-cyan-500 via-blue-600 to-indigo-700',
      iconClass: 'text-cyan-500 bg-cyan-100/80 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-cyan-500/20',
      hoverClass: 'hover:border-cyan-200 hover:shadow-cyan-100',
      darkIconClass: 'text-cyan-300 bg-cyan-500/15 group-hover:bg-cyan-500 group-hover:text-white group-hover:shadow-cyan-500/20',
      darkHoverClass: 'hover:border-cyan-500/50 hover:shadow-cyan-950/30',
    },
    {
      title: 'AI文本配音',
      description: '三档本地TTS模型，按电脑配置自行下载',
      path: '/textToSpeech',
      icon: Mic2,
      image: homeIcons.textToSpeech,
      tileClass: 'from-indigo-500 via-blue-600 to-cyan-700',
      iconClass: 'text-blue-500 bg-blue-100/80 group-hover:bg-blue-500 group-hover:text-white group-hover:shadow-blue-500/20',
      hoverClass: 'hover:border-blue-200 hover:shadow-blue-100',
      darkIconClass: 'text-blue-300 bg-blue-500/15 group-hover:bg-blue-500 group-hover:text-white group-hover:shadow-blue-500/20',
      darkHoverClass: 'hover:border-blue-500/50 hover:shadow-blue-950/30',
    },
    {
      title: '音效命名工具',
      description: '批量识别短音效台词，校对后直接重命名文件',
      path: '/soundEffectNaming',
      icon: AudioLines,
      image: '',
      tileClass: 'from-emerald-500 via-teal-600 to-cyan-700',
      iconClass: 'text-emerald-500 bg-emerald-100/80 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-emerald-500/20',
      hoverClass: 'hover:border-emerald-200 hover:shadow-emerald-100',
      darkIconClass: 'text-emerald-300 bg-emerald-500/15 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-emerald-500/20',
      darkHoverClass: 'hover:border-emerald-500/50 hover:shadow-emerald-950/30',
    },
  ];

  // 首页只展示统一入口，旧路径仍由路由保留兼容。
  const visibleFeatures = features.filter(
    (feature) => !feature.path.startsWith('/imageWorkshop') || feature.path === '/imageWorkshop',
  );
  const getFeatureTitle = (feature: (typeof features)[number]) =>
    feature.path.startsWith('/imageWorkshop') ? '图片素材工坊' : feature.title;
  const getFeatureDescription = (feature: (typeof features)[number]) =>
    feature.path.startsWith('/imageWorkshop')
      ? '标准素材生产与专业无损切片，按模式独立处理'
      : feature.description;

  if (homeSkin === 'metal-brass') {
    return (
      <div className={`home-metal min-h-screen overflow-hidden flex flex-col font-sans relative pb-8 transition-colors duration-300 ${isDarkTheme ? 'home-lumia-dark text-white' : 'home-lumia-surface text-slate-900'}`}>
        <header className="relative z-10 flex flex-col gap-4 px-5 pt-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <button
            onClick={() => onNavigate('/')}
            className="group flex items-center gap-3 border-0 bg-transparent p-0 cursor-pointer"
            aria-label="返回首页"
            type="button"
          >
            <div className={`relative h-11 w-11 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-violet-500 shadow-lg ${isDarkTheme ? 'shadow-blue-950/40' : 'shadow-blue-200'}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" />
              </div>
            </div>
            <span className={`text-2xl font-black ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>VideoStitcher</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <HomeTaskIndicator onClick={() => onNavigate('/taskCenter')} theme={homeTheme} />
            <button
              onClick={() => onNavigate('/skinStore')}
              className={`group relative flex h-14 items-center gap-3 rounded-md border px-7 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
                isDarkTheme
                  ? 'border-slate-700/70 bg-slate-900/80 shadow-[0_8px_24px_rgba(0,0,0,0.24)] hover:border-amber-400/50 hover:shadow-[0_16px_36px_rgba(251,191,36,0.10)]'
                  : 'border-white/40 bg-slate-200/40 shadow-[0_8px_20px_rgba(15,23,42,0.22)] hover:border-white/70 hover:bg-slate-100/50'
              }`}
              type="button"
            >
              <Palette className="h-7 w-7 text-amber-500 transition-colors group-hover:text-amber-300" />
              <span className={`text-base font-semibold transition-colors ${isDarkTheme ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-950'}`}>
                皮肤商店
              </span>
            </button>
            <button
              onClick={() => onNavigate('/admin')}
              className={`group relative flex h-14 items-center gap-3 rounded-md border px-7 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 ${
                isDarkTheme
                  ? 'border-slate-700/70 bg-slate-900/80 shadow-[0_8px_24px_rgba(0,0,0,0.24)] hover:border-indigo-400/50 hover:shadow-[0_16px_36px_rgba(99,102,241,0.12)]'
                  : 'border-white/40 bg-slate-200/40 shadow-[0_8px_20px_rgba(15,23,42,0.22)] hover:border-white/70 hover:bg-slate-100/50'
              }`}
              type="button"
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
              {visibleFeatures.map((feature) => {
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
                    type="button"
                  >
                    <span className="absolute right-5 top-5 h-5 w-5 rounded-full border-2 border-white/80 bg-transparent transition-all duration-300 group-hover:border-emerald-200 group-hover:bg-emerald-400 group-hover:shadow-[0_0_16px_rgba(74,222,128,0.95)]" />
                    <div className="flex h-28 w-28 items-center justify-center">
                      {feature.image ? (
                        <img
                          src={feature.image}
                          alt=""
                          className="h-28 w-28 rounded-[28px] object-cover shadow-[0_18px_36px_rgba(15,23,42,0.28)] ring-1 ring-white/40"
                          draggable={false}
                        />
                      ) : (
                        <Icon className="h-20 w-20 text-white drop-shadow-sm" strokeWidth={2.2} />
                      )}
                    </div>
                    <div className="mt-auto">
                      <h2 className="text-3xl font-black leading-tight text-white drop-shadow-sm">
                        {getFeatureTitle(feature)}
                      </h2>
                      <p className="mt-4 text-xl font-medium leading-8 text-white/86">
                        {getFeatureDescription(feature)}
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
  }

  const navButtonClass = `group relative flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
    isDarkTheme
      ? 'border-[#3B3B3B] bg-[#2A2A2A] text-[#D1D1D1] hover:border-[#4A4A4A] hover:bg-[#333333] hover:text-[#F2F2F2]'
      : 'border-[#E7E5DF] bg-white text-[#444444] shadow-[0_6px_18px_rgba(34,34,34,0.05)] hover:border-[#DDD8CF] hover:bg-[#F3F3EF] hover:shadow-[0_12px_26px_rgba(34,34,34,0.08)]'
  }`;

  return (
    <div className={`home-airbnb min-h-screen overflow-hidden flex flex-col font-sans relative transition-colors duration-300 ${
      isDarkTheme ? 'home-dark bg-[#181818] text-[#F2F2F2]' : 'home-light bg-[#F8F8F5] text-[#222222]'
    }`}>
      <div className={`pointer-events-none absolute inset-0 ${
        isDarkTheme
          ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%)]'
          : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0)_34%)]'
      }`} />

      <header className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <button
          onClick={() => onNavigate('/')}
          className="group flex items-center gap-3 border-0 bg-transparent p-0 cursor-pointer"
          aria-label="返回首页"
        >
          <div className="relative h-11 w-11 rounded-lg bg-[#FF385C] shadow-[0_12px_28px_rgba(255,56,92,0.28)]">
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" />
            </div>
          </div>
          <span className="text-xl font-black tracking-tight">VideoStitcher</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setHomeTheme(isDarkTheme ? 'light' : 'dark')}
            className={navButtonClass}
            aria-label={isDarkTheme ? '切换到白天模式' : '切换到黑夜模式'}
          >
            {isDarkTheme ? (
              <Sun className="h-4 w-4 text-amber-300" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
            <span>
              {isDarkTheme ? '白天模式' : '黑夜模式'}
            </span>
          </button>

          <HomeTaskIndicator onClick={() => onNavigate('/taskCenter')} theme={homeTheme} />
          <button
            onClick={() => onNavigate('/skinStore')}
            className={navButtonClass}
            type="button"
          >
            <Palette className="h-4 w-4 text-[#FF385C]" />
            <span>皮肤商店</span>
          </button>
          <button
            onClick={() => onNavigate('/admin')}
            className={navButtonClass}
            type="button"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>系统管理</span>
            {updateAvailable && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF385C] ring-4 ring-[#FF385C]/10 animate-pulse" />
            )}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-5 pb-10 sm:px-8">
        <section className="mx-auto flex w-full max-w-[1180px] flex-col pt-14 lg:pt-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className={`text-sm font-semibold ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
              VideoStitcher Workspace
            </p>
            <h1 className="mt-5 text-5xl font-black leading-[1.04] tracking-tight sm:text-6xl lg:text-[72px]">
              <span className="block">干净地完成每一次</span>
              <span className="block text-[#FF385C]">视频批处理</span>
            </h1>
            <p className={`mx-auto mt-6 max-w-2xl text-base leading-7 ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
              合成、封面、素材、台词识别，集中在一个轻量工作台里。
            </p>
          </div>

          <div className="mt-16 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">工具</h2>
              <p className={`mt-2 text-sm ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>选择一个入口开始处理</p>
            </div>
            <div className="hidden sm:flex">
                <button
                  onClick={() => onNavigate('/videoMerge')}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[#FF385C] px-4 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#e93252]"
                  type="button"
                >
                  开始合成
                  <ArrowRight className="h-4 w-4" />
                </button>
            </div>
          </div>

          <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.path}
                  data-testid={`home-feature-${feature.path.replace(/^\//, '')}`}
                  onClick={() => onNavigate(feature.path)}
                  className={`group relative flex min-h-[164px] flex-col rounded-lg border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                    isDarkTheme
                      ? 'border-[#353535] bg-[#242424] hover:border-[#4A4A4A] hover:bg-[#2A2A2A]'
                      : 'border-[#E7E5DF] bg-white shadow-[0_8px_24px_rgba(34,34,34,0.04)] hover:border-[#DDD8CF] hover:shadow-[0_16px_36px_rgba(34,34,34,0.07)]'
                  }`}
                  type="button"
                >
                  {feature.image ? (
                    <div className={`h-16 w-16 overflow-hidden rounded-2xl shadow-[0_12px_24px_rgba(34,34,34,0.10)] ring-1 ${
                      isDarkTheme ? 'ring-white/10' : 'ring-black/5'
                    }`}>
                      <img
                        src={feature.image}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF385C]/10 text-[#FF385C] transition-all group-hover:bg-[#FF385C] group-hover:text-white">
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                  )}
                  <div className="mt-6">
                    <h2 className="text-base font-black leading-tight">
                      {getFeatureTitle(feature)}
                    </h2>
                    <p className={`mt-2 line-clamp-2 text-sm font-medium leading-6 ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>
                      {getFeatureDescription(feature)}
                    </p>
                  </div>
                  <ArrowRight className="absolute bottom-5 right-5 h-4 w-4 text-slate-300 opacity-0 transition-all group-hover:translate-x-1 group-hover:text-[#FF385C] group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className={`relative z-10 pb-8 text-center text-sm font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>
        <span>{appVersion} · © 2026 VideoStitcher · 全能视频处理工具箱</span>
      </footer>
    </div>
  );
};

// 主应用组件（在 Router 内部）
const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastMessages();
  const [searchParams] = useSearchParams();
  const currentAdminTab = searchParams.get('tab');
  
  // 检查是否在版本更新页面
  const isOnUpdatesTab = location.pathname === '/admin' && currentAdminTab === 'updates';
  
  const [appVersion, setAppVersion] = useState<string>('加载中...');
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdateState | null>(null);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingUpdateInfo, setPendingUpdateInfo] = useState<UpdateInfo | null>(null);
  const updateAvailable = availableUpdate !== null;

  // 授权状态
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);

  const handleUnauthorized = useCallback(async (status?: {
    reason?: string;
    needsOnlineVerification?: boolean;
    entitlementExpired?: boolean;
  }) => {
    try {
      const queue = await window.api.getQueueStatus();
      if (queue.running > 0) {
        const title = status?.needsOnlineVerification
          ? '需要联网验证'
          : status?.entitlementExpired
            ? '套餐已到期'
            : '当前没有可用套餐';
        const message = status?.needsOnlineVerification
          ? '当前任务会继续完成，但不会再启动下一项。联网验证通过后会自动恢复队列。'
          : '当前任务会继续完成，但不会再启动下一项。获得可用套餐后可恢复队列。';
        toast.warning(
          message,
          title,
          8000,
        );
        navigate('/taskCenter', { replace: true });
        return;
      }
    } catch {
      // 无法读取队列时按未授权流程处理。
    }
    navigate('/unauthorized', { replace: true });
  }, [navigate, toast]);

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
    const canOpenWithoutAccess = location.pathname === '/unauthorized'
      || location.pathname === '/license'
      || location.pathname === '/taskCenter'
      || location.pathname === '/tasks'
      || location.pathname.startsWith('/task/')
      || (location.pathname === '/admin' && (currentAdminTab === 'license' || currentAdminTab === 'updates'));
    const checkLicense = async () => {
      try {
        const result = await window.api.checkLicense();
        setIsAuthorized(result.authorized);
        if (!result.authorized && !canOpenWithoutAccess) {
          await handleUnauthorized(result);
        }
      } catch (error) {
        console.error('授权检查失败:', error);
        setIsAuthorized(false);
        if (!canOpenWithoutAccess) await handleUnauthorized();
      } finally {
        setIsCheckingLicense(false);
      }
    };

    if (location.pathname === '/unauthorized') {
      setIsCheckingLicense(false);
    } else {
      void checkLicense();
    }

    const cleanup = window.api.onLicenseStatusChanged((data) => {
      setIsAuthorized(data.authorized);
      if (!data.authorized && !canOpenWithoutAccess) {
        void handleUnauthorized(data);
      }
    });

    return cleanup;
  }, [currentAdminTab, handleUnauthorized, location.pathname]);

  // 监听更新事件
  useEffect(() => {
    const cleanupAvailable = window.api.onUpdateAvailable((data) => {
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setAvailableUpdate((current) => mergeAvailableUpdate(current, { status: 'available', info }));

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
      const info = { version: data.version, releaseDate: data.releaseDate, releaseNotes: data.releaseNotes };
      setAvailableUpdate((current) => mergeAvailableUpdate(current, { status: 'downloaded', info }));

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
        <Route path="/license" element={<Navigate to="/admin?tab=license" replace />} />
        <Route path="/videoMerge" element={<VideoMergeMode />} />
        <Route path="/videoDedup" element={<VideoDedupMode />} />
        <Route path="/imageWorkshop" element={<ImageMaterialWorkshopMode />} />
        <Route path="/imageMaterial" element={<ImageMaterialMode />} />
        <Route path="/fileNameExtractor" element={<FileNameExtractorMode />} />
        <Route path="/coverToolbox" element={<CoverToolboxMode />} />
        <Route path="/coverFormat" element={<CoverFormatMode />} />
        <Route path="/coverCompress" element={<CoverCompressMode />} />
        <Route path="/losslessGrid" element={<LosslessGridMode />} />
        <Route path="/resize" element={<ResizeMode />} />
        <Route path="/subtitleExtractor" element={<SubtitleExtractorMode />} />
        <Route path="/textToSpeech" element={<TextToSpeechMode />} />
        <Route path="/soundEffectNaming" element={<SoundEffectNamingMode />} />
        <Route path="/skinStore" element={<SkinStoreMode />} />
        <Route path="/admin" element={<AdminMode initialUpdateState={availableUpdate} />} />
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
