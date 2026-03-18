import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  ExternalLink,
  Database,
  Trash2,
  AlertTriangle,
  Archive,
  RotateCcw,
  FileText
} from 'lucide-react';
import ConcurrencySelector from '@/components/ConcurrencySelector';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useToastMessages } from '@renderer/components/Toast';

interface AdminModeProps {
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

const AdminMode: React.FC<AdminModeProps> = ({
  initialUpdateInfo,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToastMessages();
  
  // 从 URL 读取当前标签
  const tabParam = searchParams.get('tab') as 'system' | 'settings' | 'updates' | 'database' | null;
  const activeSection: 'system' | 'settings' | 'updates' | 'database' = 
    (tabParam === 'settings' || tabParam === 'updates' || tabParam === 'database') ? tabParam : 'system';
  
  // 切换标签时更新 URL
  const setActiveSection = useCallback((section: 'system' | 'settings' | 'updates' | 'database') => {
    if (section === 'system') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: section }, { replace: true });
    }
  }, [setSearchParams]);
  
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);

  // 使用全局配置 hook 管理状态
  const {
    globalSettings,
    setGlobalSettings,
    isSaving: isSavingSettings,
    hasChanges,
    saveSettings: saveGlobalSettings
  } = useGlobalSettings();

  // 系统默认下载目录（用于显示）
  const [systemDefaultDownloadDir, setSystemDefaultDownloadDir] = useState<string>('');

  // 数据库管理状态
  const [dbStats, setDbStats] = useState<{
    fileSize: number;
    taskCount: number;
    logCount: number;
    outputCount: number;
    oldestTask: number | null;
    newestTask: number | null;
  } | null>(null);
  const [dbLogSize, setDbLogSize] = useState<number>(0);
  const [dbIntegrity, setDbIntegrity] = useState<{ healthy: boolean; errors: string[] } | null>(null);
  const [dbBackups, setDbBackups] = useState<Array<{ name: string; path: string; size: number; time: number }>>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbRepairing, setDbRepairing] = useState(false);
  const [dbRepairResult, setDbRepairResult] = useState<{ success: boolean; needReset?: boolean; error?: string; details?: string[] } | null>(null);
  const [cleanupDays, setCleanupDays] = useState(7);

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

    // 如果有初始更新信息，设置状态
    if (initialUpdateInfo) {
      setUpdateInfo(initialUpdateInfo);
      setUpdateStatus('available');

      // macOS：初始化后端的 updateInfo，避免点击下载时出现"未找到更新信息"
      if (isMacOS) {
        window.api.macSetUpdateInfo(initialUpdateInfo);
      }
    }
  }, [initialUpdateInfo]);

  // 监听更新检查事件
  useEffect(() => {
    const cleanup = window.api.onUpdateChecking(() => {
      console.log('[AdminMode] 收到 update-checking 事件');
      if (activeSection === 'updates') {
        setUpdateStatus('checking');
      }
    });
    return cleanup;
  }, [activeSection]);

  // 获取系统默认下载目录（用于显示）
  useEffect(() => {
    const fetchSystemDefaultDir = async () => {
      try {
        const systemDownloadDir = await window.api.getDefaultDownloadDir() || '';
        setSystemDefaultDownloadDir(systemDownloadDir);
      } catch (err) {
        console.error('获取默认下载目录失败:', err);
      }
    };
    fetchSystemDefaultDir();
  }, []);

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
    console.log('%c[AdminMode] 📥 handleDownloadUpdate() 被调用', 'background: #3b82f6; color: white; padding: 2px 5px; border-radius: 3px;');
    console.log('[AdminMode] 当前平台:', { isMacOS, isWindows, platform: navigator.platform });

    setUpdateStatus('downloading');
    setUpdateError('');

    try {
      // macOS 使用应用内更新
      console.log('[AdminMode] 开始调用下载 API...');
      const result = isMacOS
        ? await window.api.macDownloadUpdate()
        : await window.api.downloadUpdate();

      console.log('[AdminMode] 下载 API 返回结果:', result);

      if (result.error) {
        console.error('[AdminMode] 下载返回错误:', result.error);
        setUpdateError(result.error);
        setUpdateStatus('error');
      } else {
        console.log('[AdminMode] 下载成功，等待 update-downloaded 事件...');
        // Windows 和 macOS 都会通过事件触发 downloaded 状态
        if (isWindows || isMacOS) {
          setTimeout(() => {
            console.log('[AdminMode] setTimeout 触发，设置状态为 downloaded');
            setUpdateStatus('downloaded');
          }, 100);
        }
      }
    } catch (err: any) {
      console.error('[AdminMode] 下载异常:', err);
      setUpdateError(err.message || '下载更新失败');
      setUpdateStatus('error');
    }
  };

  const handleInstallUpdate = async () => {
    console.log('%c[AdminMode] 🔧 handleInstallUpdate() 被调用', 'background: #f59e0b; color: white; padding: 2px 5px; border-radius: 3px;');
    console.log('[AdminMode] 当前平台:', { isMacOS, isWindows, platform: navigator.platform });

    try {
      // macOS 使用应用内更新
      if (isMacOS) {
        console.log('[AdminMode] 调用 macInstallUpdate()...');
        const result = await window.api.macInstallUpdate();
        console.log('[AdminMode] macInstallUpdate() 返回结果:', result);
        if (result.error) {
          console.error('[AdminMode] 安装返回错误:', result.error);
          setUpdateError(result.error);
          setUpdateStatus('error');
        } else {
          console.log('[AdminMode] 安装成功，应用应该即将退出');
        }
      } else {
        console.log('[AdminMode] 调用 Windows 安装...');
        await window.api.installUpdate();
      }
    } catch (err: any) {
      console.error('[AdminMode] 安装异常:', err);
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
    await saveGlobalSettings();
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

  // 数据库管理：加载数据库统计
  const loadDbStats = async () => {
    setDbLoading(true);
    try {
      const [stats, logSize] = await Promise.all([
        window.api.getDbStats(),
        window.api.getDbLogSize(),
      ]);
      setDbStats(stats);
      setDbLogSize(logSize);
    } catch (err) {
      console.error('加载数据库统计失败:', err);
    } finally {
      setDbLoading(false);
    }
  };

  // 数据库管理：加载备份列表
  const loadDbBackups = async () => {
    try {
      const backups = await window.api.listDbBackups();
      setDbBackups(backups);
    } catch (err) {
      console.error('加载备份列表失败:', err);
    }
  };

  // 数据库管理：检查完整性
  const handleCheckIntegrity = async () => {
    setDbLoading(true);
    try {
      const result = await window.api.checkDbIntegrity();
      setDbIntegrity(result);
    } catch (err) {
      setDbIntegrity({ healthy: false, errors: [(err as Error).message] });
    } finally {
      setDbLoading(false);
    }
  };

  // 数据库管理：修复数据库
  const handleRepairDb = async () => {
    setDbRepairing(true);
    setDbRepairResult(null);
    try {
      const result = await window.api.repairDb();
      setDbRepairResult(result);
      if (result.success) {
        await loadDbStats();
      }
    } catch (err) {
      setDbRepairResult({ success: false, error: (err as Error).message });
    } finally {
      setDbRepairing(false);
    }
  };

  // 数据库管理：重置数据库
  const handleResetDb = async () => {
    const result = await window.api.resetDb();
    if (result.success) {
      setDbRepairResult(null);
      await loadDbStats();
    }
  };

  // 数据库管理：清除日志
  const handleClearLogs = async () => {
    if (!confirm('确定要清除所有任务日志吗？此操作不可恢复。')) return;
    setDbLoading(true);
    try {
      const result = await window.api.clearDbLogs();
      if (result.success) {
        await loadDbStats();
        toast.success(`已清除 ${result.deletedCount} 条日志`);
      } else {
        toast.error('清除失败: ' + result.error);
      }
    } catch (err) {
      toast.error('清除失败: ' + (err as Error).message);
    } finally {
      setDbLoading(false);
    }
  };

  // 数据库管理：清理旧任务
  const handleCleanupOldTasks = async () => {
    if (!confirm(`确定要清理 ${cleanupDays} 天前的已完成/失败/取消的任务吗？此操作不可恢复。`)) return;
    setDbLoading(true);
    try {
      const result = await window.api.cleanupOldTasks(cleanupDays);
      if (result.success) {
        await loadDbStats();
        toast.success(`已清理 ${result.deletedCount} 个任务`);
      } else {
        toast.error('清理失败: ' + result.error);
      }
    } catch (err) {
      toast.error('清理失败: ' + (err as Error).message);
    } finally {
      setDbLoading(false);
    }
  };

  // 数据库管理：创建备份
  const handleCreateBackup = async () => {
    setDbLoading(true);
    try {
      const result = await window.api.createDbBackup('manual');
      if (result.success) {
        await loadDbBackups();
        toast.success('备份成功', result.path);
      } else {
        toast.error('备份失败: ' + result.error);
      }
    } catch (err) {
      toast.error('备份失败: ' + (err as Error).message);
    } finally {
      setDbLoading(false);
    }
  };

  // 数据库管理：恢复备份
  const handleRestoreBackup = async (backupPath: string) => {
    if (!confirm('确定要恢复此备份吗？当前数据将被覆盖。')) return;
    setDbLoading(true);
    try {
      const result = await window.api.restoreDbBackup(backupPath);
      if (result.success) {
        await loadDbStats();
        toast.success('恢复成功');
      } else {
        toast.error('恢复失败: ' + result.error);
      }
    } catch (err) {
      toast.error('恢复失败: ' + (err as Error).message);
    } finally {
      setDbLoading(false);
    }
  };

  // 数据库管理：删除备份
  const handleDeleteBackup = async (backupPath: string) => {
    if (!confirm('确定要删除此备份吗？')) return;
    try {
      const result = await window.api.deleteDbBackup(backupPath);
      if (result.success) {
        await loadDbBackups();
      } else {
        toast.error('删除失败: ' + result.error);
      }
    } catch (err) {
      toast.error('删除失败: ' + (err as Error).message);
    }
  };

  // 数据库管理：切换到数据库标签时加载数据
  useEffect(() => {
    if (activeSection === 'database') {
      loadDbStats();
      loadDbBackups();
    }
  }, [activeSection]);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  // 格式化时间戳
  const formatTimestamp = (ts: number | null): string => {
    if (!ts) return '无';
    const date = new Date(ts);
    return date.toLocaleString('zh-CN');
  };

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

  /**
   * 清理更新日志 HTML
   * 移除 commit hash 链接，例如: (<a ...>94282b6</a>)
   */
  const cleanReleaseNotes = (html: string): string => {
    // 移除包含 commit hash 的 <a> 标签
    // 匹配模式: (<a class="commit-link" ...><tt>hash</tt></a>)
    return html.replace(/\s*\(\<a\s+class="commit-link"[^>]*\>\<tt\>[0-9a-f]+\<\/tt\>\<\/a\>\)/gi, '');
  };

  return (
    <div className="h-screen bg-black text-white overflow-hidden flex">
      {/* 动态背景 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* 左侧导航面板 */}
      <div className={`w-20 lg:w-64 border-r border-slate-800/50 bg-black/80 backdrop-blur-xl flex flex-col transition-all duration-500 ${pageLoaded ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
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
            onClick={() => setActiveSection('database')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
              activeSection === 'database'
                ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30'
                : 'hover:bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Database className="w-5 h-5" />
            <span className="hidden lg:block font-medium">数据库管理</span>
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
            onClick={() => navigate('/')}
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
        <header className={`h-20 border-b border-slate-800/50 bg-black/50 backdrop-blur-sm flex items-center justify-between px-8 transition-all duration-700 delay-100 ${pageLoaded ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-1 h-12 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full transition-all duration-700 delay-200 ${pageLoaded ? 'h-12' : 'h-0'}`} />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {activeSection === 'system' && '系统概览'}
                {activeSection === 'settings' && '全局配置'}
                {activeSection === 'updates' && '版本更新'}
                {activeSection === 'database' && '数据库管理'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {activeSection === 'system' && '查看系统信息和应用状态'}
                {activeSection === 'settings' && '配置默认工作参数'}
                {activeSection === 'updates' && '检查并安装应用更新'}
                {activeSection === 'database' && '数据库维护与备份管理'}
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
                              {systemInfo ? Math.max(1, Math.floor(systemInfo.cpuCount / 2)) : '-'}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
                          <div className="flex items-center gap-2 text-sm text-violet-300">
                            <Zap className="w-4 h-4" />
                            <span>推荐并发数 = CPU 核心数的一半（平衡性能与系统响应）</span>
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
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-600/20">
                        <Settings className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">全局默认配置</h2>
                        <p className="text-sm text-slate-500 mt-0.5">各功能页面的默认工作参数</p>
                      </div>
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
                                <div className="text-sm text-slate-300 truncate" title={globalSettings.defaultOutputDir}>
                                  {globalSettings.defaultOutputDir}
                                </div>
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
                            onClick={async () => {
                              try {
                                const dir = await window.api.pickOutDir(globalSettings.defaultOutputDir);
                                if (dir) {
                                  setGlobalSettings(prev => ({ ...prev, defaultOutputDir: dir }));
                                }
                              } catch (err) {
                                console.error('选择目录失败:', err);
                              }
                            }}
                            className="px-4 py-2.5 bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 border border-amber-500/30 rounded-lg text-amber-400 transition-all flex items-center gap-2"
                          >
                            <FolderOpen className="w-4 h-4" />
                            选择目录
                          </button>
                        </div>
                      </div>

                      {/* 默认线程数量 */}
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <Zap className="w-4 h-4 text-amber-400" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-white">默认线程数量</label>
                            <p className="text-xs text-slate-500">各功能页面将使用此值作为默认并发数</p>
                          </div>
                        </div>

                        {/* 并发选择器 */}
                        <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-6">
                          <ConcurrencySelector
                            value={globalSettings.defaultConcurrency}
                            onChange={(value) => setGlobalSettings(prev => ({ ...prev, defaultConcurrency: value }))}
                            themeColor="amber"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 保存按钮 */}
                    <div className="flex justify-end items-center gap-3 pt-6 border-t border-slate-800/50 mt-6">
                      {/* 未保存提示 */}
                      {hasChanges && (
                        <span className="text-amber-400 text-sm flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                          有未保存修改
                        </span>
                      )}
                      <button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 ${
                          isSavingSettings
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : hasChanges
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isSavingSettings ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            保存中...
                          </>
                        ) : hasChanges ? (
                          <>
                            <Save className="w-4 h-4" />
                            保存配置
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            已保存
                          </>
                        )}
                      </button>
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

                {/* 日志管理卡片 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-600/5 to-zinc-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-slate-600 to-zinc-600 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-600/20">
                        <FileText className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">日志管理</h2>
                        <p className="text-sm text-slate-500 mt-0.5">查看应用运行日志，排查问题</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={async () => {
                          try {
                            await window.api.openLogDirectory?.();
                          } catch (err) {
                            console.error('打开日志目录失败:', err);
                          }
                        }}
                        className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4" />
                        打开日志目录
                      </button>
                      <p className="text-xs text-slate-500">
                        日志文件位于应用数据目录，单文件最大 5MB，自动清理 7 天前的日志
                      </p>
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
                            <button
                              onClick={handleCheckUpdates}
                              disabled={false}
                              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className="w-4 h-4" />
                              检查更新
                            </button>
                          </>
                        )}
                        {updateStatus === 'checking' && (
                          <>
                            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                            <div className="flex-1">
                              <div className="font-medium text-blue-400">正在检查更新...</div>
                            </div>
                            <button
                              disabled
                              className="px-5 py-2.5 bg-slate-700 text-slate-400 rounded-lg font-medium transition-all flex items-center gap-2 opacity-50 cursor-not-allowed"
                            >
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              检查更新
                            </button>
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
                            {isMacOS || isWindows ? (
                              <button
                                onClick={handleDownloadUpdate}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30"
                              >
                                <Download className="w-4 h-4" />
                                下载更新
                              </button>
                            ) : null}
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
                            <button
                              onClick={handleCheckUpdates}
                              disabled={false}
                              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className="w-4 h-4" />
                              检查更新
                            </button>
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
                            {isMacOS || isWindows ? (
                              <button
                                onClick={handleInstallUpdate}
                                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-green-600/20 hover:shadow-green-600/30"
                              >
                                <CheckCircle className="w-4 h-4" />
                                立即重启并安装
                              </button>
                            ) : null}
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
                            <button
                              onClick={handleCheckUpdates}
                              disabled={false}
                              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className="w-4 h-4" />
                              检查更新
                            </button>
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
                                dangerouslySetInnerHTML={{ __html: cleanReleaseNotes(updateInfo.releaseNotes) }}
                              />
                            </div>
                          )}
                        </div>
                      )}
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

            {activeSection === 'database' && (
              <div className="space-y-6">
                {/* 数据库状态卡片 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-600/20">
                        <Database className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">数据库状态</h2>
                        <p className="text-sm text-slate-500 mt-0.5">任务数据存储与日志管理</p>
                      </div>
                      <button
                        onClick={loadDbStats}
                        disabled={dbLoading}
                        className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${dbLoading ? 'animate-spin' : ''}`} />
                        刷新
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-xs text-slate-500 mb-1">数据库大小</div>
                        <div className="text-2xl font-bold text-white">
                          {dbStats ? formatFileSize(dbStats.fileSize) : '加载中...'}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-xs text-slate-500 mb-1">任务数量</div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {dbStats?.taskCount ?? '...'}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-xs text-slate-500 mb-1">日志数量</div>
                        <div className="text-2xl font-bold text-amber-400">
                          {dbStats?.logCount ?? '...'}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-xs text-slate-500 mb-1">日志大小</div>
                        <div className="text-2xl font-bold text-purple-400">
                          {formatFileSize(dbLogSize)}
                        </div>
                      </div>
                    </div>

                    {dbStats?.oldestTask && (
                      <div className="mt-4 p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">
                            最早任务: {formatTimestamp(dbStats.oldestTask)}
                          </span>
                          <span className="text-slate-500">
                            最新任务: {formatTimestamp(dbStats.newestTask)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 完整性检查与修复 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-teal-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Shield className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">完整性检查与修复</h3>
                        <p className="text-sm text-slate-500">检测数据库异常并尝试修复</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* 检查按钮和状态 */}
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleCheckIntegrity}
                          disabled={dbLoading}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg flex items-center gap-2 transition-all"
                        >
                          <Shield className="w-4 h-4" />
                          检查完整性
                        </button>
                        
                        {dbIntegrity && (
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                            dbIntegrity.healthy 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {dbIntegrity.healthy ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                数据库健康
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-4 h-4" />
                                发现异常
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 异常详情 */}
                      {dbIntegrity && !dbIntegrity.healthy && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                          <div className="text-sm text-red-400 mb-2">检测到以下问题：</div>
                          <ul className="text-sm text-red-300 space-y-1">
                            {dbIntegrity.errors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 修复按钮 */}
                      {dbIntegrity && !dbIntegrity.healthy && (
                        <div className="flex items-center gap-4">
                          <button
                            onClick={handleRepairDb}
                            disabled={dbRepairing}
                            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg flex items-center gap-2 transition-all"
                          >
                            {dbRepairing ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                修复中...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                尝试修复
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* 修复结果 */}
                      {dbRepairResult && (
                        <div className={`p-4 rounded-xl ${
                          dbRepairResult.success 
                            ? 'bg-emerald-500/10 border border-emerald-500/30' 
                            : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                          <div className={`text-sm font-medium mb-2 ${
                            dbRepairResult.success ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {dbRepairResult.success ? '修复成功' : '修复失败'}
                          </div>
                          {dbRepairResult.details && dbRepairResult.details.length > 0 && (
                            <ul className="text-sm text-slate-400 space-y-1 mb-2">
                              {dbRepairResult.details.map((detail, i) => (
                                <li key={i}>• {detail}</li>
                              ))}
                            </ul>
                          )}
                          {dbRepairResult.error && (
                            <div className="text-sm text-red-400">{dbRepairResult.error}</div>
                          )}
                          {dbRepairResult.needReset && (
                            <button
                              onClick={handleResetDb}
                              className="mt-3 px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white rounded-lg flex items-center gap-2 transition-all"
                            >
                              <RotateCcw className="w-4 h-4" />
                              重置数据库
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 日志管理 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Trash2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">日志管理</h3>
                        <p className="text-sm text-slate-500">清除任务日志释放空间</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className="text-sm text-slate-400">
                          当前日志占用 <span className="text-amber-400 font-bold">{formatFileSize(dbLogSize)}</span>，
                          共 <span className="text-amber-400 font-bold">{dbStats?.logCount ?? 0}</span> 条记录
                        </div>
                      </div>
                      <button
                        onClick={handleClearLogs}
                        disabled={dbLoading || (dbStats?.logCount ?? 0) === 0}
                        className="px-4 py-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        清除所有日志
                      </button>
                    </div>
                  </div>
                </div>

                {/* 任务清理 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Trash2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">任务清理</h3>
                        <p className="text-sm text-slate-500">清理已完成的旧任务释放空间</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                          <div className="text-sm text-slate-400 mb-3">
                            当前共 <span className="text-purple-400 font-bold">{dbStats?.taskCount ?? 0}</span> 个任务
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">清理</span>
                            <select
                              value={cleanupDays}
                              onChange={(e) => setCleanupDays(Number(e.target.value))}
                              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                            >
                              <option value={1}>1 天前</option>
                              <option value={3}>3 天前</option>
                              <option value={7}>7 天前</option>
                              <option value={14}>14 天前</option>
                              <option value={30}>30 天前</option>
                            </select>
                            <span className="text-sm text-slate-500">的已完成任务</span>
                          </div>
                        </div>
                        <button
                          onClick={handleCleanupOldTasks}
                          disabled={dbLoading || (dbStats?.taskCount ?? 0) === 0}
                          className="px-4 py-2 bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                          清理任务
                        </button>
                      </div>
                      <div className="p-3 bg-slate-950/30 border border-slate-800/30 rounded-lg">
                        <p className="text-xs text-slate-500">
                          仅清理「已完成」「失败」「已取消」状态的任务，待执行和运行中的任务不会被清理
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 备份管理 */}
                <div className="group relative overflow-hidden rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-cyan-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                          <Archive className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">备份管理</h3>
                          <p className="text-sm text-slate-500">创建、恢复和删除数据库备份</p>
                        </div>
                      </div>
                      <button
                        onClick={handleCreateBackup}
                        disabled={dbLoading}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg flex items-center gap-2 transition-all"
                      >
                        <Archive className="w-4 h-4" />
                        创建备份
                      </button>
                    </div>

                    {dbBackups.length > 0 ? (
                      <div className="space-y-2">
                        {dbBackups.map((backup) => (
                          <div
                            key={backup.path}
                            className="flex items-center justify-between p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <Archive className="w-5 h-5 text-blue-400" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">{backup.name}</div>
                                <div className="text-xs text-slate-500">
                                  {formatFileSize(backup.size)} · {formatTimestamp(backup.time)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRestoreBackup(backup.path)}
                                disabled={dbLoading}
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-sm transition-colors"
                              >
                                恢复
                              </button>
                              <button
                                onClick={() => handleDeleteBackup(backup.path)}
                                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500">
                        <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>暂无备份</p>
                        <p className="text-sm mt-1">点击"创建备份"按钮创建第一个备份</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 危险操作 */}
                <div className="group relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/30 to-slate-900/30 backdrop-blur-sm">
                  <div className="relative p-8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                        <AlertTriangle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-red-400">危险操作</h3>
                        <p className="text-sm text-slate-500">以下操作不可逆，请谨慎使用</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">重置数据库</div>
                        <div className="text-xs text-slate-400 mt-1">
                          删除所有任务数据和日志，恢复到初始状态
                        </div>
                      </div>
                      <button
                        onClick={handleResetDb}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg flex items-center gap-2 transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                        重置
                      </button>
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
