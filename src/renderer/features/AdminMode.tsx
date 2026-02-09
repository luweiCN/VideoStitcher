import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  ArrowLeft,
  Info,
  Cpu,
  HardDrive,
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  FolderOpen,
  Save,
  Sliders,
  Gauge,
  Activity,
  Zap,
  Shield,
  Code,
  ExternalLink
} from 'lucide-react';

interface AdminModeProps {
  onBack: () => void;
  initialUpdateInfo?: UpdateInfo | null;
}

interface SystemInfo {
  version: string;
  isDevelopment: boolean;
  platform: string;
  arch: string;
  cpuCount: number;
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  ffmpegPath: string;
}

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

const AdminMode: React.FC<AdminModeProps> = ({ onBack, initialUpdateInfo }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [activeSection, setActiveSection] = useState<'system' | 'settings' | 'updates'>('system');

  // 全局配置状态
  const [globalSettings, setGlobalSettings] = useState<{
    defaultOutputDir: string;
    defaultConcurrency: number;
  }>({
    defaultOutputDir: '',
    defaultConcurrency: 3
  });
  const [systemDefaultDownloadDir, setSystemDefaultDownloadDir] = useState<string>('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // 检测是否为 macOS
  const isMacOS = navigator.platform.includes('Mac');
  const isWindows = navigator.platform.includes('Win');

  // 使用 ref 保存 isWindows 的值，避免闭包问题
  const isWindowsRef = useRef(isWindows);
  isWindowsRef.current = isWindows;

  // 保存 setUpdateStatus 的原始引用
  const setUpdateStatusRef = useRef(setUpdateStatus);
  setUpdateStatusRef.current = setUpdateStatus;

  // 页面加载动画
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    setPageLoaded(true);
  }, []);

  useEffect(() => {
    loadSystemInfo();

    // 如果有初始更新信息（从全局状态传来），直接设置状态
    if (initialUpdateInfo) {
      setUpdateInfo(initialUpdateInfo);
      setUpdateStatus('available');
    }

    // 加载全局配置
    loadGlobalSettings();
  }, [initialUpdateInfo]);

  const loadGlobalSettings = async () => {
    try {
      const result = await window.api.getGlobalSettings();

      // 获取系统默认下载目录
      let systemDownloadDir = '';
      try {
        systemDownloadDir = await window.api.getDefaultDownloadDir() || '';
      } catch (err) {
        console.error('获取默认下载目录失败:', err);
      }
      setSystemDefaultDownloadDir(systemDownloadDir);

      if (result) {
        // 如果未设置默认输出目录，使用系统默认下载目录
        let outputDir = result.defaultOutputDir || systemDownloadDir;
        setGlobalSettings({
          defaultOutputDir: outputDir,
          defaultConcurrency: result.defaultConcurrency || 3
        });
      }
    } catch (err) {
      console.error('加载全局配置失败:', err);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const appResult = await window.api.getAppVersion();

      // 获取真实的系统内存信息
      let totalMemory = 0;
      let usedMemory = 0;
      let freeMemory = 0;

      try {
        const memoryResult = await window.api.getSystemMemory();
        totalMemory = memoryResult.total;
        usedMemory = memoryResult.used;
        freeMemory = memoryResult.free;
      } catch (memoryErr) {
        console.error('获取系统内存失败，使用备用方案:', memoryErr);
        // 备用方案：使用浏览器 API
        totalMemory = (performance as any).memory?.jsHeapSizeLimit || 0;
        freeMemory = 0;
        usedMemory = 0;
      }

      setSystemInfo({
        ...appResult,
        platform: navigator.platform.includes('Win') ? 'Windows' :
                 navigator.platform.includes('Mac') ? 'macOS' :
                 navigator.platform.includes('Linux') ? 'Linux' : '未知',
        arch: 'x64',
        cpuCount: navigator.hardwareConcurrency || 4,
        totalMemory,
        usedMemory,
        freeMemory,
        ffmpegPath: '内置',
      });
    } catch (err) {
      console.error('Failed to load system info:', err);
    }
  };

  const handleCheckUpdates = async () => {
    setUpdateStatus('checking');
    setUpdateError('');

    try {
      // macOS 使用应用内更新
      const result = isMacOS 
        ? await window.api.macCheckForUpdates()
        : await window.api.checkForUpdates();

      if (result.success && result.hasUpdate && result.updateInfo) {
        setUpdateInfo(result.updateInfo);
        setUpdateStatus('available');
      } else if (result.success && !result.hasUpdate) {
        setUpdateStatus('not-available');
      } else {
        setUpdateStatus('not-available');
      }
    } catch (err: any) {
      setUpdateError(err.message || '检查更新失败');
      setUpdateStatus('error');
    }
  };

  const handleDownloadUpdate = async () => {
    setUpdateStatus('downloading');
    setUpdateError('');

    try {
      // macOS 使用应用内更新
      const result = isMacOS
        ? await window.api.macDownloadUpdate()
        : await window.api.downloadUpdate();

      if (result.error) {
        setUpdateError(result.error);
        setUpdateStatus('error');
      } else {
        // Windows 和 macOS 都会通过事件触发 downloaded 状态
        if (isWindows || isMacOS) {
          setTimeout(() => {
            setUpdateStatus('downloaded');
          }, 100);
        }
      }
    } catch (err: any) {
      setUpdateError(err.message || '下载更新失败');
      setUpdateStatus('error');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      // macOS 使用应用内更新
      if (isMacOS) {
        await window.api.macInstallUpdate();
      } else {
        await window.api.installUpdate();
      }
    } catch (err: any) {
      setUpdateError(err.message || '安装更新失败');
      setUpdateStatus('error');
    }
  };

  // macOS 用户跳转到 GitHub Releases 页面下载更新（保留作为备用）
  const handleGoToRelease = () => {
    const releaseUrl = 'https://github.com/luweiCN/VideoStitcher/releases/latest';
    window.api.openExternal(releaseUrl);
  };

  // 保存全局配置
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsSaved(false);

    try {
      const result = await window.api.setGlobalSettings(globalSettings);
      if (result.success) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      } else {
        alert(`保存失败: ${result.error}`);
      }
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 选择默认输出目录
  const handleSelectDefaultOutputDir = async () => {
    try {
      const dir = await window.api.pickOutDir();
      if (dir) {
        setGlobalSettings(prev => ({ ...prev, defaultOutputDir: dir }));
        setSettingsSaved(false);
      }
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  };

  // 监听更新进度
  useEffect(() => {
    const cleanupProgress = window.api.onUpdateDownloadProgress((data) => {
      setDownloadProgress(Math.round(data.percent));
    });

    const cleanupDownloaded = window.api.onUpdateDownloaded((data) => {
      setUpdateInfo(data);
      setUpdateStatus('downloaded');
    });

    const cleanupError = window.api.onUpdateError((data) => {
      setUpdateError(data.message);
      setUpdateStatus('error');
    });

    return () => {
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '未知';
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}年${month}月${day}日 ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0f] text-white overflow-hidden flex">
      {/* 动态背景 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* 左侧导航面板 */}
      <div className={`w-20 lg:w-64 border-r border-slate-800/50 bg-[#0a0a0f]/80 backdrop-blur-xl flex flex-col transition-all duration-500 ${pageLoaded ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
        {/* 标题 */}
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <span className="hidden lg:block font-bold text-lg">控制中心</span>
          </div>
        </div>

        {/* 导航项 */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveSection('system')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
              activeSection === 'system'
                ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-400 border border-purple-500/30'
                : 'hover:bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Cpu className="w-5 h-5" />
            <span className="hidden lg:block font-medium">系统概览</span>
          </button>

          <button
            onClick={() => setActiveSection('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
              activeSection === 'settings'
                ? 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 text-amber-400 border border-amber-500/30'
                : 'hover:bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Gauge className="w-5 h-5" />
            <span className="hidden lg:block font-medium">全局配置</span>
          </button>

          <button
            onClick={() => setActiveSection('updates')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
              activeSection === 'updates'
                ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-400 border border-emerald-500/30'
                : 'hover:bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Download className="w-5 h-5" />
            <span className="hidden lg:block font-medium">版本更新</span>
            {updateStatus === 'available' && (
              <span className="hidden lg:flex w-2 h-2 bg-emerald-400 rounded-full animate-pulse ml-auto" />
            )}
          </button>
        </nav>

        {/* 返回按钮 */}
        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden lg:block">返回首页</span>
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* 页面标题 */}
        <header className={`h-20 border-b border-slate-800/50 bg-[#0a0a0f]/50 backdrop-blur-sm flex items-center px-8 transition-all duration-700 delay-100 ${pageLoaded ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-1 h-12 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full transition-all duration-700 delay-200 ${pageLoaded ? 'h-12' : 'h-0'}`} />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {activeSection === 'system' && '系统概览'}
                {activeSection === 'settings' && '全局配置'}
                {activeSection === 'updates' && '版本更新'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {activeSection === 'system' && '查看系统信息和应用状态'}
                {activeSection === 'settings' && '配置默认工作参数'}
                {activeSection === 'updates' && '检查并安装应用更新'}
              </p>
            </div>
          </div>
        </header>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className={`max-w-5xl mx-auto transition-all duration-700 delay-300 ${pageLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            {activeSection === 'system' && (
              <div className="space-y-6">
                {/* 应用信息卡片 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-600/20">
                          <Code className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">VideoStitcher</h2>
                          <p className="text-sm text-slate-500 mt-0.5">全能视频批处理工具箱</p>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-xl">
                        <span className="text-sm font-medium text-purple-400">v{systemInfo?.version || '加载中...'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                        <div className="text-xs text-slate-500 mb-1">运行环境</div>
                        <div className="text-sm font-medium text-white">
                          {systemInfo?.isDevelopment ? '开发模式' : '生产模式'}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                        <div className="text-xs text-slate-500 mb-1">操作系统</div>
                        <div className="text-sm font-medium text-white">
                          {systemInfo?.platform === 'win32' ? 'Windows' :
                           systemInfo?.platform === 'darwin' ? 'macOS' :
                           systemInfo?.platform || '未知'}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                        <div className="text-xs text-slate-500 mb-1">架构</div>
                        <div className="text-sm font-medium text-white">
                          {systemInfo?.arch === 'x64' ? 'x64' :
                           systemInfo?.arch === 'arm64' ? 'ARM64' :
                           systemInfo?.arch || '未知'}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                        <div className="text-xs text-slate-500 mb-1">FFmpeg</div>
                        <div className="text-sm font-medium text-emerald-400">内置版本</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 系统性能卡片 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* CPU 信息 */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
                          <Activity className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">处理器</h3>
                          <p className="text-xs text-slate-500">CPU 信息</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center">
                              <Cpu className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">核心数量</div>
                              <div className="text-lg font-bold text-white">{systemInfo?.cpuCount || '-'} 核</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">推荐并发</div>
                            <div className="text-lg font-bold text-violet-400">
                              {systemInfo ? Math.max(1, systemInfo.cpuCount - 1) : '-'}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
                          <div className="flex items-center gap-2 text-sm text-violet-300">
                            <Zap className="w-4 h-4" />
                            <span>推荐并发数 = CPU 核心数 - 1（留 1 核给系统）</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 内存信息 */}
                  <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-600/5 to-rose-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-600/20">
                          <HardDrive className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">内存</h3>
                          <p className="text-xs text-slate-500">系统内存信息</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* 总内存 */}
                        <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                              <HardDrive className="w-5 h-5 text-pink-400" />
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">总内存</div>
                              <div className="text-lg font-bold text-white">
                                {systemInfo && systemInfo.totalMemory > 0
                                  ? (systemInfo.totalMemory / (1024 * 1024 * 1024)).toFixed(1)
                                  : '-'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">GB</div>
                          </div>
                        </div>

                        {/* 内存使用情况 */}
                        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs text-slate-500">内存使用</div>
                            <div className="text-sm font-medium text-pink-400">
                              {systemInfo && systemInfo.totalMemory > 0
                                ? ((systemInfo.usedMemory / systemInfo.totalMemory) * 100).toFixed(1)
                                : '-'}%
                            </div>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full transition-all"
                              style={{
                                width: systemInfo && systemInfo.totalMemory > 0
                                  ? `${(systemInfo.usedMemory / systemInfo.totalMemory) * 100}%`
                                  : '0%'
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-2 text-xs text-slate-500">
                            <span>已用 {systemInfo && systemInfo.usedMemory > 0 ? (systemInfo.usedMemory / (1024 * 1024 * 1024)).toFixed(1) : '-'} GB</span>
                            <span>可用 {systemInfo && systemInfo.freeMemory > 0 ? (systemInfo.freeMemory / (1024 * 1024 * 1024)).toFixed(1) : '-'} GB</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'settings' && (
              <div className="space-y-6">
                {/* 全局配置卡片 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-600/20">
                          <Settings className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">全局默认配置</h2>
                          <p className="text-sm text-slate-500 mt-0.5">各功能页面的默认工作参数</p>
                        </div>
                      </div>
                      <button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                          isSavingSettings
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : settingsSaved
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30'
                        }`}
                      >
                        {isSavingSettings ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            保存中...
                          </>
                        ) : settingsSaved ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            已保存
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            保存配置
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-8">
                      {/* 默认输出目录 */}
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <FolderOpen className="w-4 h-4 text-amber-400" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-white">默认导出位置</label>
                            <p className="text-xs text-slate-500">各功能页面将使用此位置作为默认输出目录</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1 p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                            {globalSettings.defaultOutputDir ? (
                              <>
                                <div className="text-sm text-slate-300 truncate mb-1" title={globalSettings.defaultOutputDir}>
                                  {globalSettings.defaultOutputDir}
                                </div>
                                <div className="text-xs text-slate-500">自定义默认目录</div>
                              </>
                            ) : systemDefaultDownloadDir ? (
                              <>
                                <div className="text-sm text-slate-300 truncate mb-1" title={systemDefaultDownloadDir}>
                                  {systemDefaultDownloadDir}
                                </div>
                                <div className="text-xs text-amber-400">系统默认下载文件夹</div>
                              </>
                            ) : (
                              <div className="text-sm text-slate-500">未检测到系统下载目录</div>
                            )}
                          </div>
                          <button
                            onClick={handleSelectDefaultOutputDir}
                            className="px-4 py-2.5 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border border-amber-500/30 rounded-lg text-amber-400 transition-all flex items-center gap-2"
                          >
                            <FolderOpen className="w-4 h-4" />
                            选择目录
                          </button>
                        </div>
                      </div>

                      {/* 默认线程数量 */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                              <Zap className="w-4 h-4 text-orange-400" />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-white">默认线程数量</label>
                              <p className="text-xs text-slate-500">各功能页面将使用此值作为默认并发数</p>
                            </div>
                          </div>
                          <div className="px-4 py-2 bg-gradient-to-r from-orange-600/20 to-amber-600/20 border border-orange-500/30 rounded-xl">
                            <span className="text-lg font-bold text-orange-400">{globalSettings.defaultConcurrency}</span>
                          </div>
                        </div>

                        <div className="p-6 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                          <input
                            type="range"
                            min="1"
                            max={Math.max(1, (systemInfo?.cpuCount || 4) - 1)}
                            value={globalSettings.defaultConcurrency}
                            onChange={(e) => {
                              setGlobalSettings(prev => ({ ...prev, defaultConcurrency: parseInt(e.target.value) }));
                              setSettingsSaved(false);
                            }}
                            className="w-full h-2 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-amber-600 [&::-webkit-slider-thumb]:to-orange-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-amber-600/30 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                          />
                          <div className="flex justify-between mt-3 text-xs text-slate-500">
                            <span>1 线程</span>
                            <span className="text-amber-400">推荐: {Math.max(1, Math.floor((systemInfo?.cpuCount || 4) / 2))}</span>
                            <span>{Math.max(1, (systemInfo?.cpuCount || 4) - 1)} 线程</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 配置说明卡片 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-cyan-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2">关于全局配置</h3>
                        <ul className="space-y-2 text-sm text-slate-400">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>全局配置会在应用启动时自动加载到各个功能页面</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>您仍然可以在每个功能页面中临时修改配置</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">•</span>
                            <span>默认线程数量建议设置为 CPU 核心数的一半</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'updates' && (
              <div className="space-y-6">
                {/* 版本更新卡片 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 to-teal-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-600/20">
                        <Download className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">版本更新</h2>
                        <p className="text-sm text-slate-500 mt-0.5">检查并安装最新版本</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* 状态显示 */}
                      <div className={`p-6 rounded-xl border flex items-center gap-4 transition-all duration-300 ${
                        updateStatus === 'idle' || updateStatus === 'error' ? 'bg-slate-950/50 border-slate-800/50' :
                        updateStatus === 'checking' || updateStatus === 'downloading' ? 'bg-blue-500/10 border-blue-500/30' :
                        updateStatus === 'available' ? 'bg-emerald-500/10 border-emerald-500/30' :
                        updateStatus === 'not-available' ? 'bg-teal-500/10 border-teal-500/30' :
                        updateStatus === 'downloaded' ? 'bg-green-500/10 border-green-500/30' :
                        'bg-slate-950/50 border-slate-800/50'
                      }`}>
                        {updateStatus === 'idle' && (
                          <>
                            <RefreshCw className="w-8 h-8 text-slate-500" />
                            <div className="flex-1">
                              <div className="font-medium text-slate-400">点击下方按钮检查更新</div>
                            </div>
                          </>
                        )}
                        {updateStatus === 'checking' && (
                          <>
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                            <div className="flex-1">
                              <div className="font-medium text-blue-400">正在检查更新...</div>
                            </div>
                          </>
                        )}
                        {updateStatus === 'available' && (
                          <>
                            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-emerald-400">发现新版本 {updateInfo?.version}</div>
                            </div>
                          </>
                        )}
                        {updateStatus === 'not-available' && (
                          <>
                            <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-teal-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-teal-400">已是最新版本 {systemInfo?.version}</div>
                            </div>
                          </>
                        )}
                        {updateStatus === 'downloading' && (
                          <>
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                            <div className="flex-1">
                              <div className="font-medium text-blue-400">正在下载更新...</div>
                              <div className="mt-2 w-full bg-slate-800 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${downloadProgress}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-lg font-bold text-blue-400">{downloadProgress}%</div>
                          </>
                        )}
                        {updateStatus === 'downloaded' && (
                          <>
                            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                              <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-green-400">更新已下载，准备安装</div>
                            </div>
                          </>
                        )}
                        {updateStatus === 'error' && (
                          <>
                            <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                              <XCircle className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-red-400">{updateError || '检查更新失败'}</div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* 更新信息 */}
                      {updateInfo && updateStatus !== 'not-available' && (
                        <div className="p-6 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                                <Info className="w-5 h-5 text-emerald-400" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">新版本</div>
                                <div className="font-medium text-white">{updateInfo.version}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                                <Download className="w-5 h-5 text-teal-400" />
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">发布日期</div>
                                <div className="font-medium text-white">{formatDate(updateInfo.releaseDate)}</div>
                              </div>
                            </div>
                          </div>
                          {updateInfo.releaseNotes && (
                            <div>
                              <div className="text-xs text-slate-500 mb-2">更新说明</div>
                              <div
                                className="text-sm text-slate-300 release-notes-html"
                                dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="flex gap-4">
                        {(updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error') && (
                          <button
                            onClick={handleCheckUpdates}
                            disabled={updateStatus === 'checking'}
                            className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`w-4 h-4 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                            检查更新
                          </button>
                        )}

                        {/* macOS & Windows: 显示"下载更新"按钮，应用内更新 */}
                        {updateStatus === 'available' && (isMacOS || isWindows) && (
                          <button
                            onClick={handleDownloadUpdate}
                            className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
                          >
                            <Download className="w-4 h-4" />
                            下载更新
                          </button>
                        )}

                        {(updateStatus === 'downloaded') && (isMacOS || isWindows) && (
                          <button
                            onClick={handleInstallUpdate}
                            className="flex-1 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 hover:shadow-green-600/30"
                          >
                            <CheckCircle className="w-4 h-4" />
                            立即重启并安装
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 当前版本信息 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                          <Code className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">当前版本</div>
                          <div className="text-lg font-bold text-white">{systemInfo?.version || '加载中...'}</div>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <span className="text-sm text-slate-400">
                          {systemInfo?.isDevelopment ? '开发模式' : '生产模式'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 页脚 */}
        <footer className={`p-6 border-t border-slate-800/50 text-center transition-all duration-700 delay-500 ${pageLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <p className="text-sm text-slate-600">© 2026 VideoStitcher · 全能视频批处理工具箱</p>
        </footer>
      </main>

      {/* 自定义滚动条样式 */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }

        .release-notes-html h1,
        .release-notes-html h2,
        .release-notes-html h3 {
          font-weight: 600;
          margin-top: 1em;
          margin-bottom: 0.5em;
          color: #e2e8f0;
        }
        .release-notes-html ul,
        .release-notes-html ol {
          margin-left: 1.5em;
          margin-bottom: 1em;
        }
        .release-notes-html li {
          margin-bottom: 0.25em;
        }
        .release-notes-html code {
          background: rgba(30, 41, 59, 0.5);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .release-notes-html a {
          color: #a78bfa;
          text-decoration: underline;
        }
        .release-notes-html a:hover {
          color: #c4b5fd;
        }
      `}</style>
    </div>
  );
};

export default AdminMode;
