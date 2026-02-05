import React, { useState } from 'react';
import { Layout, Maximize2, Zap, Grid3X3, Settings, Stamp, Monitor, Scan, FileText, Image as ImageIcon, Layers, Shrink } from 'lucide-react';

// 占位符组件 - 稍后实现
const PlaceholderMode: React.FC<{ onBack: () => void; title: string }> = ({ onBack, title }) => (
  <div className="min-h-screen bg-slate-950 text-white p-8">
    <button onClick={onBack} className="mb-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
      ← 返回首页
    </button>
    <h1 className="text-2xl font-bold">{title}</h1>
    <p className="text-slate-400 mt-4">功能开发中...</p>
  </div>
);

type View = 'home' | 'vertical' | 'horizontal' | 'resize' | 'imageMaterial' | 'admin' | 'fileNameExtractor' | 'coverFormat' | 'losslessGrid' | 'coverCompress';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');

  if (currentView === 'vertical') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="竖屏极速合成" />;
  }

  if (currentView === 'horizontal') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="横屏极速合成" />;
  }

  if (currentView === 'resize') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="智能改尺寸" />;
  }

  if (currentView === 'imageMaterial') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="图片素材处理工具" />;
  }

  if (currentView === 'fileNameExtractor') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="视频/图片文件名提取" />;
  }

  if (currentView === 'coverFormat') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="封面格式转换器" />;
  }

  if (currentView === 'coverCompress') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="封面压缩 (400K)" />;
  }

  if (currentView === 'losslessGrid') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="专业无损九宫格" />;
  }

  if (currentView === 'admin') {
    return <PlaceholderMode onBack={() => setCurrentView('home')} title="系统管理" />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 font-sans">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-400">
          VideoMaster Pro
        </h1>
        <p className="text-slate-400 text-lg font-medium">全能视频批处理工具箱</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl w-full">
        {/* 横屏合成入口 */}
        <button
          onClick={() => setCurrentView('horizontal')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-violet-500 hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Monitor className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition-colors text-violet-400">
              <Monitor className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-violet-400 transition-colors">横版极速合成</h2>
              <p className="text-slate-400 leading-relaxed">
                专为 1920x1080 横屏视频设计。支持 A 面拼接、随机封面、极速渲染。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-violet-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>

        {/* 竖屏合成入口 */}
        <button
          onClick={() => setCurrentView('vertical')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Zap className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors text-indigo-400">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-indigo-400 transition-colors">竖屏极速合成</h2>
              <p className="text-slate-400 leading-relaxed">
                专为竖屏视频制作设计。自动添加背景图、批量合成、极速渲染。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-indigo-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>

        {/* 改尺寸入口 */}
        <button
          onClick={() => setCurrentView('resize')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-rose-500 hover:shadow-2xl hover:shadow-rose-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Maximize2 className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors text-rose-400">
              <Maximize2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-rose-400 transition-colors">智能改尺寸</h2>
              <p className="text-slate-400 leading-relaxed">
                Siya模式 / 海外捕鱼 / 尺寸统一。智能模糊背景填充，保持画面比例不拉伸。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-rose-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>

        {/* 图片素材处理工具入口 */}
        <button
          onClick={() => setCurrentView('imageMaterial')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-amber-500 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors text-amber-400">
              <Layers className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-amber-400 transition-colors">图片素材处理工具</h2>
              <p className="text-slate-400 leading-relaxed">
                全能素材处理。批量加Logo，同时支持导出高清九宫格切片和单张预览图。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-amber-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>

        {/* 封面格式转换器入口 */}
        <button
          onClick={() => setCurrentView('coverFormat')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-fuchsia-500 hover:shadow-2xl hover:shadow-fuchsia-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <ImageIcon className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-fuchsia-500/10 rounded-2xl flex items-center justify-center group-hover:bg-fuchsia-500 group-hover:text-white transition-colors text-fuchsia-400">
              <ImageIcon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-fuchsia-400 transition-colors">封面格式转换器</h2>
              <p className="text-slate-400 leading-relaxed">
                自动检测画面比例。横版转1920x1080，竖版转1080x1920，方形转800x800，支持批量导出。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-fuchsia-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>

        {/* 封面压缩入口 */}
        <button
          onClick={() => setCurrentView('coverCompress')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Shrink className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-400">
              <Shrink className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-emerald-400 transition-colors">封面压缩 (400K)</h2>
              <p className="text-slate-400 leading-relaxed">
                智能压缩工具。自动调整图片质量与尺寸，将图片压缩至 ~380KB 以内，支持批量处理。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-emerald-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>

        {/* 视频/图片文件名提取入口 */}
        <button
          onClick={() => setCurrentView('fileNameExtractor')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-pink-500 hover:shadow-2xl hover:shadow-pink-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-pink-500/10 rounded-2xl flex items-center justify-center group-hover:bg-pink-500 group-hover:text-white transition-colors text-pink-400">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-pink-400 transition-colors">视频/图片文件名提取</h2>
              <p className="text-slate-400 leading-relaxed">
                批量提取视频或图片文件名。支持多种文件格式，一键生成列表，可直接复制到表格或导出改名脚本。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-pink-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </button>

        {/* 专业无损九宫格入口 */}
        <button
          onClick={() => setCurrentView('losslessGrid')}
          className="group relative overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-10 text-left transition-all hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-500/20 hover:-translate-y-1"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Grid3X3 className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-colors text-cyan-400">
              <Grid3X3 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white group-hover:text-cyan-400 transition-colors">专业无损九宫格</h2>
              <p className="text-slate-400 leading-relaxed">
                特殊用途工具。批量处理1:1原图，进行无损、无压缩九宫格切割，支持自定义导出位置。
              </p>
            </div>
            <div className="pt-4 flex items-center gap-2 text-sm font-bold text-cyan-400">
              进入模块 <span className="group-hover:translate-x-1 transition-transform">→</span>
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
