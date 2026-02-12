import React, { useState } from 'react';
import { Copy, Folder, FolderOpen, ExternalLink, HardDrive } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from './Button/Button';

interface OutputDirSelectorProps {
  value: string;
  onChange: (dir: string) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  themeColor?: string;
}

/**
 * 输出目录选择组件
 *
 * 框架结构与 ConcurrencySelector 保持一致
 */
const OutputDirSelector: React.FC<OutputDirSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  label = '导出位置',
  themeColor = 'cyan',
}) => {
  const [copied, setCopied] = useState(false);

  const handleSelectDir = async () => {
    try {
      const dir = await window.api.pickOutDir(value);
      if (dir) onChange(dir);
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // 获取路径图标
  const getPathIcon = () => {
    if (!value) return Folder;
    const normalized = value.toLowerCase();
    if (normalized.includes('/users/') || normalized.includes('\\users\\')) return ExternalLink;
    if (normalized.includes('/volume/') || normalized.includes(':\\')) return HardDrive;
    return Folder;
  };

  // 获取最后一层文件夹名称
  const getLastFolderName = () => {
    if (!value) return '未选择';
    const parts = value.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  };

  // 获取目录层级数
  const getDepth = () => {
    if (!value) return 0;
    return value.replace(/\\/g, '/').split('/').filter(Boolean).length;
  };

  const PathIcon = getPathIcon();
  const depth = getDepth();

  return (
    <div className={className}>
      {/* 标签栏 - 与 ConcurrencySelector 一致 */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <FolderOpen className="w-3 h-3" />
          {label}
        </label>
        {/* 复制状态徽章 */}
        {value && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
            copied
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-slate-900/50 text-slate-600 border-slate-700/50'
          }`}>
            {copied ? '已复制' : `${depth} 层`}
          </span>
        )}
      </div>

      {/* 内容容器 - 与 ConcurrencySelector 一致 */}
      <div className="bg-black/50 rounded-xl px-3 py-3 border border-slate-800">
        {/* 主要内容 */}
        <div className="flex items-center gap-3">
          {/* 图标 */}
          <div className={`
            w-9 h-9 rounded-lg flex items-center justify-center shrink-0
            ${value ? 'bg-slate-900/50' : 'bg-slate-900/30'}
          `}>
            <PathIcon className={`w-4 h-4 ${value ? 'text-slate-400' : 'text-slate-600'}`} />
          </div>

          {/* 文件夹名称 */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${value ? 'text-slate-200' : 'text-slate-600'}`}>
              {getLastFolderName()}
            </p>
          </div>

          {/* 操作按钮组 */}
          {value && (
            <div className="flex gap-1">
              {/* 复制按钮 */}
              <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={handleCopy}
                      className={`
                        p-2 rounded-lg shrink-0
                        transition-all duration-200
                        ${copied
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-900/50 text-slate-600 hover:text-slate-400 hover:bg-slate-800/50'
                        }
                      `}
                      type="button"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      sideOffset={4}
                      className="z-50"
                    >
                      <div className="px-2 py-1 bg-black/95 border border-slate-700/50 rounded text-[10px] text-slate-400">
                        {copied ? '已复制到剪贴板' : '复制路径'}
                      </div>
                      <Tooltip.Arrow className="fill-slate-950/95" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>

              {/* 打开按钮 */}
              <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => {
                        window.api.openPath(value);
                      }}
                      className="p-2 rounded-lg shrink-0 bg-slate-900/50 text-slate-600 hover:text-slate-400 hover:bg-slate-800/50 transition-all duration-200"
                      type="button"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="top"
                      sideOffset={4}
                      className="z-50"
                    >
                      <div className="px-2 py-1 bg-black/95 border border-slate-700/50 rounded text-[10px] text-slate-400">
                        在文件管理器中打开
                      </div>
                      <Tooltip.Arrow className="fill-slate-950/95" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
          )}
        </div>

        {/* 选择按钮 - 使用 Button 组件 */}
        <Button
          onClick={handleSelectDir}
          disabled={disabled}
          variant="secondary"
          size="md"
          fullWidth
          themeColor={themeColor as any}
          leftIcon={<FolderOpen className="w-4 h-4" />}
        >
          {value ? '更改目录' : '选择目录'}
        </Button>
      </div>

      {/* 完整路径说明 - 超长换行 */}
      {value && (
        <p className="text-[9px] text-slate-600 mt-2 flex items-start gap-1 leading-relaxed">
          <FolderOpen className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="break-all font-mono">{value}</span>
        </p>
      )}
    </div>
  );
};

export default OutputDirSelector;
