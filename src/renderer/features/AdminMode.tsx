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

  // 检测是否为 macOS
  const isMacOS = navigator.platform.includes('Mac');
  const isWindows = navigator.platform.includes('Win');

  // 使用 ref 保存 isWindows 的值，避免闭包问题
  const isWindowsRef = useRef(isWindows);
  isWindowsRef.current = isWindows;

  // 保存 setUpdateStatus 的原始引用
  const setUpdateStatusRef = useRef(setUpdateStatus);
  setUpdateStatusRef.current = setUpdateStatus;

  // 调试日志 - 平台检测
  console.log('[AdminMode] ========== 平台检测 ==========');
  console.log('[AdminMode] navigator.platform:', navigator.platform);
  console.log('[AdminMode] isMacOS:', isMacOS);
  console.log('[AdminMode] isWindows:', isWindows);
  console.log('[AdminMode] 当前 updateStatus:', updateStatus);

  useEffect(() => {
    loadSystemInfo();

    // 如果有初始更新信息（从全局状态传来），直接设置状态
    if (initialUpdateInfo) {
      setUpdateInfo(initialUpdateInfo);
      setUpdateStatus('available');
    }
  }, [initialUpdateInfo]);

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
      if (result.success && result.hasUpdate && result.updateInfo) {
        // 有新版本可用
        setUpdateInfo(result.updateInfo);
        setUpdateStatus('available');
      } else if (result.success && !result.hasUpdate) {
        // 已是最新版本
        setUpdateStatus('not-available');
      } else {
        // 请求失败或其他情况
        setUpdateStatus('not-available');
      }
    } catch (err: any) {
      setUpdateError(err.message || '检查更新失败');
      setUpdateStatus('error');
    }
  };

  const handleDownloadUpdate = async () => {
    console.log('[AdminMode] ========== 点击下载更新 ==========');
    console.log('[AdminMode] 点击时状态:', { updateStatus, isWindows, isMacOS });
    console.log('[AdminMode] 当前更新信息:', updateInfo);

    setUpdateStatus('downloading');
    setUpdateError('');
    console.log('[AdminMode] 状态已设置为 downloading');

    try {
      console.log('[AdminMode] 调用 window.api.downloadUpdate()');
      const result = await window.api.downloadUpdate();
      console.log('[AdminMode] ========== downloadUpdate 返回 ==========');
      console.log('[AdminMode] 返回结果:', result);
      console.log('[AdminMode] 返回后 updateStatus:', updateStatus);

      if (result.error) {
        console.error('[AdminMode] 下载失败:', result.error);
        setUpdateError(result.error);
        setUpdateStatus('error');
      } else {
        // Windows: 下载成功后设置为 downloaded（使用 setTimeout 确保在所有其他状态更新之后）
        if (isWindows) {
          console.log('[AdminMode] Windows 下载成功，延迟设置状态为 downloaded');
          setTimeout(() => {
            console.log('[AdminMode] ========== 延迟设置状态 ==========');
            console.log('[AdminMode] 当前状态:', updateStatus);
            console.log('[AdminMode] 强制设置为 downloaded');
            setUpdateStatus('downloaded');
          }, 100);
        }
      }
    } catch (err: any) {
      console.error('[AdminMode] downloadUpdate 异常:', err);
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

  // 打开 GitHub Releases 页面（用于 macOS 手动更新）
  const openReleasePage = async () => {
    await window.api.openExternal('https://github.com/luweiCN/VideoStitcher/releases/latest');
  };

  // 监听更新进度
  useEffect(() => {
    const cleanupProgress = window.api.onUpdateDownloadProgress((data) => {
      setDownloadProgress(Math.round(data.percent));
    });

    const cleanupDownloaded = window.api.onUpdateDownloaded((data) => {
      console.log('[AdminMode] ========== onUpdateDownloaded 触发 ==========');
      console.log('[AdminMode] 接收到的数据:', data);
      console.log('[AdminMode] 设置前状态:', updateStatus);
      setUpdateInfo(data);
      setUpdateStatus('downloaded');
      console.log('[AdminMode] 状态已设置为 downloaded');
    });

    const cleanupError = window.api.onUpdateError((data) => {
      console.error('[AdminMode] 更新错误:', data);
      setUpdateError(data.message);
      setUpdateStatus('error');
    });

    return () => {
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  // 调试：监控按钮显示条件
  useEffect(() => {
    console.log('[AdminMode] ========== updateStatus 变化 ==========');
    console.log('[AdminMode] updateStatus:', updateStatus);
    console.log('[AdminMode] isWindows:', isWindows);
    console.log('[AdminMode] 按钮显示条件检查:');
    console.log('  - updateStatus === "downloaded":', updateStatus === 'downloaded');
    console.log('  - isWindows:', isWindows);
    console.log('  - 应该显示安装按钮:', updateStatus === 'downloaded' && isWindows);
  }, [updateStatus, isWindows]);

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
              <span className="text-white">VideoStitcher</span>
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

        {/* 版本更新 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-xl font-bold">版本更新</h2>
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
                    <p className="text-white mt-1 whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
                  </div>
                )}
                {isMacOS && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-amber-400 text-xs">
                      💡 macOS 用户：请点击下方按钮前往下载页面，手动下载新版本 DMG 文件进行更新。
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3">
              {(() => {
                console.log('[AdminMode 渲染] ========== 按钮区域渲染 ==========');
                console.log('[AdminMode] updateStatus:', updateStatus);
                console.log('[AdminMode] isWindows:', isWindows);
                console.log('[AdminMode] isMacOS:', isMacOS);
                const showCheck = updateStatus === 'idle' || updateStatus === 'not-available' || updateStatus === 'error';
                const showDownload = updateStatus === 'available' && isWindows;
                const showInstall = updateStatus === 'downloaded' && isWindows;
                console.log('[AdminMode] 应显示的按钮:');
                console.log('  - 检查更新:', showCheck);
                console.log('  - 下载更新 (Windows):', showDownload);
                console.log('  - 立即安装 (Windows):', showInstall);
                return null;
              })()}

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

              {/* macOS: 显示前往下载按钮 */}
              {updateStatus === 'available' && isMacOS && (
                <button
                  onClick={openReleasePage}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  前往下载页面
                </button>
              )}

              {/* Windows: 显示下载更新按钮 */}
              {updateStatus === 'available' && isWindows && (
                <button
                  onClick={handleDownloadUpdate}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" />
                  下载更新
                </button>
              )}

              {/* 仅 Windows: 显示重启并安装按钮 */}
              {updateStatus === 'downloaded' && isWindows && (() => {
                console.log('[AdminMode 渲染] ========== 渲染安装按钮 ==========');
                console.log('[AdminMode] 条件满足，应该显示安装按钮');
                return true;
              })() && (
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
        <p>© 2026 VideoStitcher · 全能视频批处理工具箱</p>
      </div>
    </div>
  );
};

export default AdminMode;
