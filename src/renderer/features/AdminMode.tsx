import React, { useState, useEffect } from 'react';
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
  RefreshCw
} from 'lucide-react';

interface AdminModeProps {
  onBack: () => void;
}

interface SystemInfo {
  version: string;
  isDevelopment: boolean;
  platform: string;
  arch: string;
  cpuCount: number;
  totalMemory: number;
  ffmpegPath: string;
}

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

const AdminMode: React.FC<AdminModeProps> = ({ onBack }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    loadSystemInfo();
  }, []);

  const loadSystemInfo = async () => {
    try {
      const result = await window.api.getAppVersion();
      setSystemInfo({
        ...result,
        platform: navigator.platform.includes('Win') ? 'Windows' :
                 navigator.platform.includes('Mac') ? 'macOS' :
                 navigator.platform.includes('Linux') ? 'Linux' : '未知',
        arch: 'x64', // 浏览器环境无法准确获取架构
        cpuCount: navigator.hardwareConcurrency || 4,
        totalMemory: (performance as any).memory?.jsHeapSizeLimit || 0,
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
      const result = await window.api.checkForUpdates();
      if (result.success && result.updateInfo) {
        setUpdateInfo(result.updateInfo);
        setUpdateStatus('available');
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
      await window.api.downloadUpdate();
    } catch (err: any) {
      setUpdateError(err.message || '下载更新失败');
      setUpdateStatus('error');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.api.installUpdate();
    } catch (err: any) {
      setUpdateError(err.message || '安装更新失败');
      setUpdateStatus('error');
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

  const formatMemory = (bytes: number) => {
    if (!bytes) return '未知';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>
        <h1 className="text-2xl font-bold text-indigo-400">系统管理</h1>
        <div className="w-20"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* 关于应用 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold">关于应用</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">应用名称</span>
              <span className="text-white">VideoMaster Pro</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">当前版本</span>
              <span className="text-white">{systemInfo?.version || '加载中...'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">运行环境</span>
              <span className="text-white">
                {systemInfo?.isDevelopment ? '开发模式' : '生产模式'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">FFmpeg</span>
              <span className="text-white">{systemInfo?.ffmpegPath || '未知'}</span>
            </div>
          </div>
        </div>

        {/* 系统信息 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">系统信息</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">操作系统</span>
              <span className="text-white">
                {systemInfo?.platform === 'win32' ? 'Windows' :
                 systemInfo?.platform === 'darwin' ? 'macOS' :
                 systemInfo?.platform || '未知'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">架构</span>
              <span className="text-white">
                {systemInfo?.arch === 'x64' ? 'x64' :
                 systemInfo?.arch === 'arm64' ? 'ARM64' :
                 systemInfo?.arch || '未知'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">CPU 核心数</span>
              <span className="text-white">{systemInfo?.cpuCount || '未知'} 核</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">推荐并发数</span>
              <span className="text-emerald-400 font-medium">
                {systemInfo ? Math.max(1, systemInfo.cpuCount - 1) : '-'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            💡 推荐并发数 = CPU 核心数 - 1（留 1 核给系统）
          </p>
        </div>

        {/* 自动更新 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-xl font-bold">自动更新</h2>
          </div>

          <div className="space-y-4">
            {/* 状态显示 */}
            <div className="flex items-center gap-3 p-4 bg-slate-800 rounded-xl">
              {updateStatus === 'idle' && (
                <>
                  <RefreshCw className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-400">点击下方按钮检查更新</span>
                </>
              )}
              {updateStatus === 'checking' && (
                <>
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <span className="text-blue-400">正在检查更新...</span>
                </>
              )}
              {updateStatus === 'available' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">发现新版本 {updateInfo?.version}</span>
                </>
              )}
              {updateStatus === 'not-available' && (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400">已是最新版本</span>
                </>
              )}
              {updateStatus === 'downloading' && (
                <>
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <span className="text-blue-400">正在下载更新... {downloadProgress}%</span>
                </>
              )}
              {updateStatus === 'downloaded' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">更新已下载，准备安装</span>
                </>
              )}
              {updateStatus === 'error' && (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">{updateError}</span>
                </>
              )}
            </div>

            {/* 更新信息 */}
            {updateInfo && updateStatus !== 'not-available' && (
              <div className="p-4 bg-slate-800 rounded-xl text-sm">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <span className="text-slate-400">新版本：</span>
                    <span className="text-white ml-2">{updateInfo.version}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">发布日期：</span>
                    <span className="text-white ml-2">{updateInfo.releaseDate}</span>
                  </div>
                </div>
                {updateInfo.releaseNotes && (
                  <div>
                    <span className="text-slate-400">更新说明：</span>
                    <p className="text-white mt-1">{updateInfo.releaseNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              {updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error' ? (
                <button
                  onClick={handleCheckUpdates}
                  disabled={updateStatus === 'checking'}
                  className="flex items-center gap-2 px-6 py-3 bg-violet-500/20 text-violet-400 rounded-xl hover:bg-violet-500/30 transition-colors font-medium disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                  检查更新
                </button>
              ) : null}

              {updateStatus === 'available' && (
                <button
                  onClick={handleDownloadUpdate}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" />
                  下载更新
                </button>
              )}

              {updateStatus === 'downloaded' && (
                <button
                  onClick={handleInstallUpdate}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500/20 text-green-400 rounded-xl hover:bg-green-500/30 transition-colors font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  立即重启并安装
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 页脚 */}
      <div className="mt-8 text-center text-slate-600 text-sm">
        <p>© 2026 VideoMaster Pro · 全能视频批处理工具箱</p>
      </div>
    </div>
  );
};

export default AdminMode;
