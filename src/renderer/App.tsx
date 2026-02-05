import React, { useState } from 'react';
import { Layout, Maximize2, Zap, Grid3X3, Settings, Stamp, Monitor, Scan, FileText, Image as ImageIcon, Layers, Shrink, Film } from 'lucide-react';
import HorizontalMode from './features/HorizontalMode';
import VerticalMode from './features/VerticalMode';
import FileNameExtractorMode from './features/FileNameExtractorMode';
import CoverFormatMode from './features/CoverFormatMode';
import CoverCompressMode from './features/CoverCompressMode';
import LosslessGridMode from './features/LosslessGridMode';
import ImageMaterialMode from './features/ImageMaterialMode';
import ResizeMode from './features/ResizeMode';
import VideoStitcherMode from './features/VideoStitcherMode';
import AdminMode from './features/AdminMode';

type View = 'home' | 'vertical' | 'horizontal' | 'resize' | 'imageMaterial' | 'admin' | 'fileNameExtractor' | 'coverFormat' | 'losslessGrid' | 'coverCompress' | 'videoStitcher';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');

  if (currentView === 'vertical') {
    return <VerticalMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'horizontal') {
    return <HorizontalMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'imageMaterial') {
    return <ImageMaterialMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'fileNameExtractor') {
    return <FileNameExtractorMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'coverFormat') {
    return <CoverFormatMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'coverCompress') {
    return <CoverCompressMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'losslessGrid') {
    return <LosslessGridMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'resize') {
    return <ResizeMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'videoStitcher') {
    return <VideoStitcherMode onBack={() => setCurrentView('home')} />;
  }

  if (currentView === 'admin') {
    return <AdminMode onBack={() => setCurrentView('home')} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 font-sans">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-400">
          VideoMaster Pro
        </h1>
        <p className="text-slate-400 text-lg font-medium">全能视频批处理工具箱</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl w-full">
        {/* 横屏合成入口 */}
        <button
          onClick={() => setCurrentView('horizontal')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-0.5"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
            <Monitor className="w-16 h-16" />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition-colors text-violet-400">
              <Monitor className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1 text-white group-hover:text-violet-400 transition-colors">横版极速合成</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                1920x1080 横屏视频，A 面拼接、随机封面、极速渲染
              </p>
            </div>
          </div>
        </button>

        {/* 竖屏合成入口 */}
        <button
          onClick={() => setCurrentView('vertical')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left transition-all hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-15 transition-opacity">
            <Zap className="w-16 h-16" />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors text-indigo-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1 text-white group-hover:text-indigo-400 transition-colors">竖屏极速合成</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                竖屏视频制作，自动背景图、批量合成、极速渲染
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

      <footer className="mt-20 text-slate-600 text-sm font-medium flex items-center gap-4">
        <span>v2.1.0 · Electron Desktop</span>
        <button
          onClick={() => setCurrentView('admin')}
          className="p-1 hover:text-indigo-400 transition-colors"
          title="系统管理"
        >
          <Settings className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};

export default App;
