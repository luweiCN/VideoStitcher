import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Copy, CheckCircle, X } from 'lucide-react';

interface UnauthorizedModeProps {
  onBack?: () => void;
}

/**
 * 未授权模式页面
 * 显示机器 ID、授权状态，提供重新检查授权功能
 */
const UnauthorizedMode: React.FC<UnauthorizedModeProps> = ({ onBack }) => {
  const [machineId, setMachineId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [licenseStatus, setLicenseStatus] = useState<{
    authorized: boolean;
    reason?: string;
    offline?: boolean;
    developmentMode?: boolean;
  }>({
    authorized: false
  });

  // 获取机器 ID
  useEffect(() => {
    const fetchMachineId = async () => {
      try {
        const result = await window.api.getMachineId();
        if (result.success && result.machineId) {
          setMachineId(result.machineId);
        }
      } catch (error) {
        console.error('获取机器 ID 失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMachineId();
  }, []);

  // 检查授权状态
  const checkLicenseStatus = async () => {
    setChecking(true);
    try {
      const result = await window.api.checkLicense({ forceRefresh: true });
      setLicenseStatus({
        authorized: result.authorized,
        reason: result.reason,
        offline: result.offline,
        developmentMode: result.developmentMode
      });

      // 如果授权成功，跳转到首页
      if (result.authorized && onBack) {
        onBack();
      }
    } catch (error) {
      console.error('检查授权失败:', error);
    } finally {
      setChecking(false);
    }
  };

  // 复制机器 ID
  const copyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8">
      {/* 返回按钮 */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-6 left-6 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* 主内容 */}
      <div className="max-w-md w-full">
        {/* 图标 */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-12 h-12 text-rose-500" />
          </div>
        </div>

        {/* 标题 */}
        <h1 className="text-3xl font-bold text-center mb-2">
          授权验证失败
        </h1>
        <p className="text-slate-400 text-center mb-8">
          {licenseStatus.reason || '当前机器未在授权列表中'}
        </p>

        {/* 机器 ID 卡片 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-400">机器 ID</span>
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <button
                onClick={copyMachineId}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          <div className="bg-slate-950 rounded-lg px-4 py-3 font-mono text-sm text-slate-300 break-all">
            {loading ? '加载中...' : machineId || '获取失败'}
          </div>
          {copied && (
            <p className="text-xs text-emerald-500 mt-2">已复制到剪贴板</p>
          )}
        </div>

        {/* 说明文字 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 mb-6">
          <p className="text-sm text-slate-300 leading-relaxed">
            请将上述机器 ID 发送给管理员，获取授权后点击下方按钮重新检查。
          </p>
        </div>

        {/* 重新检查按钮 */}
        <button
          onClick={checkLicenseStatus}
          disabled={checking}
          className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium rounded-xl hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>检查中...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>重新检查授权</span>
            </>
          )}
        </button>

        {/* 状态信息 */}
        {licenseStatus.offline && (
          <div className="mt-4 text-center text-sm text-amber-500">
            ⚠️ 当前处于离线模式，使用缓存的授权信息
          </div>
        )}

        {/* 版本信息 */}
        <div className="mt-8 text-center text-xs text-slate-600">
          VideoStitcher 授权系统 v1.0
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedMode;
