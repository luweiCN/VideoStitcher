import React, { useState } from 'react';
import { FolderOpen, Copy, Folder, Home, HardDrive } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

// 主题色配置
const themeColors = {
  cyan: { primary: 'cyan', glow: 'rgba(6,182,212,0.5)', bg: 'rgba(6,182,212,0.1)' },
  pink: { primary: 'pink', glow: 'rgba(236,72,153,0.5)', bg: 'rgba(236,72,153,0.1)' },
  violet: { primary: 'violet', glow: 'rgba(139,92,246,0.5)', bg: 'rgba(139,92,246,0.1)' },
  rose: { primary: 'rose', glow: 'rgba(244,63,94,0.5)', bg: 'rgba(244,63,94,0.1)' },
  amber: { primary: 'amber', glow: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.1)' },
  emerald: { primary: 'emerald', glow: 'rgba(16,185,129,0.5)', bg: 'rgba(16,185,129,0.1)' },
  fuchsia: { primary: 'fuchsia', glow: 'rgba(217,70,239,0.5)', bg: 'rgba(217,70,239,0.1)' },
  slate: { primary: 'slate', glow: 'rgba(100,116,139,0.5)', bg: 'rgba(100,116,139,0.1)' },
} as const;

interface OutputDirSelectorProps {
  /** 当前输出目录 */
  value: string;
  /** 目录变化回调 */
  onChange: (dir: string) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 标签文字 */
  label?: string;
  /** 主题色（Tailwind 颜色类名） */
  themeColor?: string;
}

/**
 * 输出目录选择组件 - 现代玻璃态风格
 *
 * 统一的目录选择器，支持完整路径显示和快捷复制
 * - 玻璃态背景和微妙的边框光晕
 * - 智能路径省略显示
 * - 悬浮显示完整路径和复制按钮
 * - 平滑的动画过渡效果
 */
const OutputDirSelector: React.FC<OutputDirSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  label = '导出位置',
  themeColor = 'cyan',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const theme = themeColors[themeColor as keyof typeof themeColors] || themeColors.cyan;

  const handleSelectDir = async () => {
    try {
      const dir = await window.api.pickOutDir(value);
      if (dir) {
        onChange(dir);
      }
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  };

  // 获取路径图标（基于路径分析）
  const getPathIcon = (path: string) => {
    if (!path) return Folder;
    const normalized = path.toLowerCase();
    if (normalized.includes('/users/') || normalized.includes('\\users\\')) return Home;
    if (normalized.includes('/volume/') || normalized.includes(':\\')) return HardDrive;
    return Folder;
  };

  // 获取路径最后一部分（文件名/文件夹名）
  const getLastPathPart = (path: string) => {
    if (!path) return '';
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || '';
  };

  // 获取简短路径显示
  const getDisplayPath = () => {
    if (!value) return '未选择输出目录';
    const parts = value.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length <= 2) return value;

    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first}/.../${last}`;
  };

  // 复制路径到剪贴板
  const handleCopyPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const PathIcon = getPathIcon(value);

  return (
    <div className={className}>
      {/* 标签 */}
      {label && (
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
          <FolderOpen className="w-3 h-3" />
          {label}
        </label>
      )}

      {/* 主选择按钮 */}
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleSelectDir}
              disabled={disabled}
              onMouseEnter={() => !disabled && setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={`
                group relative w-full
                transition-all duration-300
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              type="button"
            >
              {/* 背景层 */}
              <div className={`
                absolute inset-0 rounded-xl
                bg-gradient-to-br from-slate-900/80 to-slate-950/80
                backdrop-blur-md
                border transition-all duration-300
                ${isHovered && !disabled
                  ? `border-${theme.primary}-500/50 shadow-[0_0_20px_-5px_${theme.glow}]`
                  : 'border-slate-800'
                }
              `} />

              {/* 内容层 */}
              <div className="relative flex items-center gap-3 px-4 py-3">
                {/* 图标容器 */}
                <div className={`
                  flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
                  transition-all duration-300
                  ${isHovered && !disabled
                    ? `bg-${theme.primary}-500/20 scale-110`
                    : 'bg-slate-800/50'
                  }
                `}>
                  <PathIcon className={`
                    w-5 h-5 transition-colors duration-300
                    ${isHovered && !disabled ? `text-${theme.primary}-400` : 'text-slate-400'}
                  `} />
                </div>

                {/* 路径信息区域 */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    {/* 主路径文本 */}
                    <p className={`
                      text-sm font-mono tracking-tight transition-all duration-300 truncate
                      ${isHovered && !disabled ? `text-${theme.primary}-300` : 'text-slate-300'}
                    `}>
                      {getDisplayedValue()}
                    </p>

                    {/* 选中指示点 */}
                    {value && (
                      <span className={`
                        flex-shrink-0 w-1.5 h-1.5 rounded-full transition-all duration-300
                        ${isHovered && !disabled ? `bg-${theme.primary}-400 scale-125` : 'bg-slate-600'}
                      `} />
                    )}
                  </div>
                </div>

                {/* 右侧操作区 */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {/* 快捷键提示 */}
                  <span className={`
                    text-[10px] font-medium px-2 py-1 rounded-md transition-all duration-300
                    ${isHovered && !disabled
                      ? `bg-${theme.primary}-500/20 text-${theme.primary}-400`
                      : 'bg-slate-800/30 text-slate-600'
                    }
                  `}>
                    {value ? '更改' : '选择'}
                  </span>
                </div>
              </div>

              {/* 扫描线动画效果 */}
              {isHovered && !disabled && (
                <div className={`
                  absolute inset-0 rounded-xl overflow-hidden
                  border border-${theme.primary}-500/30 pointer-events-none
                `}>
                  <div className={`
                    absolute inset-0 bg-gradient-to-r from-${theme.primary}-500/0 via-${theme.primary}-500/10 to-${theme.primary}-500/0
                    opacity-100 animate-pulse
                  `} />
                </div>
              )}
            </button>
          </Tooltip.Trigger>

          {/* Tooltip 内容 */}
          {value && (
            <Tooltip.Portal>
              <Tooltip.Content
                sideOffset={12}
                align="start"
                className="z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Tooltip 背景 */}
                <div className={`
                  relative px-4 py-3 min-w-[320px] max-w-[480px]
                  rounded-xl backdrop-blur-xl
                  bg-slate-950/95
                  border-2 border-${theme.primary}-500/30
                  shadow-[0_8px_32px_-8px_${theme.glow}]
                `}>
                  <div className="flex items-start gap-3">
                    {/* 图标 */}
                    <div className={`
                      flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center
                      bg-${theme.primary}-500/20
                    `}>
                      <FolderOpen className={`w-4 h-4 text-${theme.primary}-400`} />
                    </div>

                    {/* 路径内容 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500 mb-1 font-medium">完整路径</p>
                      <p className="text-xs font-mono text-slate-200 break-all leading-relaxed">
                        {value}
                      </p>
                    </div>

                    {/* 复制按钮 */}
                    <button
                      onClick={handleCopyPath}
                      className={`
                        flex-shrink-0 w-8 h-8 rounded-lg
                        flex items-center justify-center
                        transition-all duration-200
                        ${copied
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                        }
                      `}
                      type="button"
                    >
                      {copied ? (
                        <span className="text-sm font-bold leading-none">✓</span>
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 箭头 */}
                <Tooltip.Arrow className="fill-slate-950/95" />
              </Tooltip.Content>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>

      {/* 空值提示 */}
      {!value && !isHovered && (
        <p className="text-[9px] text-slate-600 mt-2 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-slate-700 animate-pulse" />
          点击按钮选择输出位置
        </p>
      )}
    </div>
  );

  // 内部辅助函数：获取显示值
  function getDisplayedValue() {
    return getDisplayPath();
  }
};

export default OutputDirSelector;
