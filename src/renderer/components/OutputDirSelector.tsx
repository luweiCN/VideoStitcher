import React from 'react';
import { FolderOpen } from 'lucide-react';

interface OutputDirSelectorProps {
  /** 当前输出目录 */
  value: string;
  /** 目录变化回调 */
  onChange: (dir: string) => void;
  /** 是否显示完整路径 */
  showFullPath?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义按钮文字 */
  buttonText?: string;
  /** 是否紧凑模式 */
  compact?: boolean;
}

/**
 * 输出目录选择组件
 *
 * 用于各功能模块选择输出目录
 * - 显示当前选择的目录（文件夹名或完整路径）
 * - 点击按钮打开目录选择对话框
 * - 支持自定义主题色和样式
 */
const OutputDirSelector: React.FC<OutputDirSelectorProps> = ({
  value,
  onChange,
  showFullPath = false,
  className = '',
  disabled = false,
  buttonText,
  compact = false,
}) => {
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

  // 获取显示文本
  const getDisplayText = () => {
    if (!value) return '未选择';

    if (showFullPath) {
      return value;
    }

    // 只显示文件夹名
    const folderName = value.split(/[/\\]/).pop() || value;
    return `📂 ${folderName}`;
  };

  // 紧凑模式：一行显示
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs font-medium text-slate-300 truncate" title={value || '未选择'}>
          {getDisplayText()}
        </span>
        <button
          onClick={handleSelectDir}
          disabled={disabled}
          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[10px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          type="button"
        >
          <FolderOpen className="w-3 h-3 inline" />
          {buttonText || (value ? '更换' : '选择')}
        </button>
      </div>
    );
  }

  // 标准模式：卡片显示
  return (
    <div className={className}>
      <label className="text-xs font-medium text-slate-400 mb-2 block">导出位置</label>
      <button
        onClick={handleSelectDir}
        disabled={disabled}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
      >
        <FolderOpen className="w-4 h-4" />
        {buttonText || (value ? '更换位置' : '选择位置')}
      </button>
      {value && (
        <p className="text-[10px] text-slate-500 mt-1.5 truncate" title={value}>
          {showFullPath ? value : value}
        </p>
      )}
    </div>
  );
};

export default OutputDirSelector;
