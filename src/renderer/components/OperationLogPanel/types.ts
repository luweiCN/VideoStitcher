import type { LogEntry } from '../../hooks/useOperationLogs';

/**
 * 日志条目选中状态
 */
export type LogSelectionState = 'none' | 'start' | 'in-range' | 'available';

/**
 * 日志条目选择状态
 */
export interface LogSelection {
  /** 起点索引 */
  startIndex: number | null;
  /** 终点索引 */
  endIndex: number | null;
  /** 已选择的索引集合 */
  selectedIndexes: Set<number>;
}

/**
 * 日志面板样式变体
 */
export type LogVariant = 'default' | 'compact' | 'detailed';

/**
 * 日志面板主题颜色
 */
export type LogThemeColor = 'pink' | 'violet' | 'indigo' | 'cyan' | 'emerald' | 'gray';

/**
 * 日志面板样式配置
 */
export interface LogStyleConfig {
  /** 主色调 */
  primaryColor: string;
  /** 主色背景 */
  primaryBg: string;
  /** 主色边框 */
  primaryBorder: string;
}

/**
 * 主题颜色映射表
 */
export const THEME_COLOR_MAP: Record<LogThemeColor, LogStyleConfig> = {
  pink: {
    primaryColor: 'text-pink-400',
    primaryBg: 'bg-pink-500/10',
    primaryBorder: 'border-pink-500/20',
  },
  violet: {
    primaryColor: 'text-violet-400',
    primaryBg: 'bg-violet-500/10',
    primaryBorder: 'border-violet-500/20',
  },
  indigo: {
    primaryColor: 'text-indigo-400',
    primaryBg: 'bg-indigo-500/10',
    primaryBorder: 'border-indigo-500/20',
  },
  cyan: {
    primaryColor: 'text-cyan-400',
    primaryBg: 'bg-cyan-500/10',
    primaryBorder: 'border-cyan-500/20',
  },
  emerald: {
    primaryColor: 'text-emerald-400',
    primaryBg: 'bg-emerald-500/10',
    primaryBorder: 'border-emerald-500/20',
  },
  gray: {
    primaryColor: 'text-gray-400',
    primaryBg: 'bg-gray-500/10',
    primaryBorder: 'border-gray-500/20',
  },
};

/**
 * 日志条目渲染属性
 */
export interface LogEntryProps {
  /** 日志数据 */
  log: LogEntry;
  /** 选中状态 */
  selectionState: LogSelectionState;
  /** 是否展开 */
  isExpanded: boolean;
  /** 是否可以展开（可选，如果不提供则自动测量） */
  canExpand?: boolean;
  /** 点击回调 */
  onClick: () => void;
  /** 切换展开回调 */
  onToggleExpand: () => void;
  /** 复制单条回调 */
  onCopySingle: () => void;
}

/**
 * 日志面板主组件属性
 */
export interface OperationLogPanelProps {
  /** 日志列表 */
  logs: LogEntry[];
  /** 添加日志回调 */
  addLog: (message: string, type?: LogEntry['type']) => void;
  /** 清空日志回调 */
  clearLogs: () => void;
  /** 复制日志回调 */
  copyLogs: (startIdx?: number, endIdx?: number) => Promise<boolean>;
  /** 下载日志回调 */
  downloadLogs: () => void;
  /** 日志容器 ref */
  logsContainerRef: React.RefObject<HTMLDivElement>;
  /** 日志结束标记 ref */
  logsEndRef: React.RefObject<HTMLDivElement>;

  // 自动滚动相关
  /** 是否启用自动滚动 */
  autoScrollEnabled: boolean;
  /** 设置自动滚动开关 */
  setAutoScrollEnabled: (enabled: boolean) => void;
  /** 是否暂停自动滚动 */
  autoScrollPaused: boolean;
  /** 恢复自动滚动 */
  resumeAutoScroll: () => void;
  /** 滚动到底部 */
  scrollToBottom: () => void;
  /** 滚动到顶部 */
  scrollToTop: () => void;
  /** 用户开始交互（暂停自动滚动） */
  onUserInteractStart: () => void;

  /** 可选：固定宽度 */
  width?: string;
  /** 可选：最小宽度 */
  minWidth?: number;
  /** 可选：固定高度 */
  height?: string;
  /** 可选：最小高度 */
  minHeight?: number;
  /** 样式变体 */
  variant?: LogVariant;
  /** 主题颜色 */
  themeColor?: LogThemeColor;
  /** 额外类名 */
  className?: string;
}
