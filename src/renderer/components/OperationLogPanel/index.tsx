import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Copy, Download, Trash2,
} from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import type {
  OperationLogPanelProps,
  LogSelection,
  LogStyleConfig,
  LogSelectionState,
} from './types';
import { THEME_COLOR_MAP } from './types';
import { LogEntry } from './LogEntry';
import { LogFooter } from './LogFooter';

/**
 * 操作日志面板组件 - 使用虚拟列表渲染
 */
export const OperationLogPanel: React.FC<OperationLogPanelProps> = ({
  logs,
  addLog,
  clearLogs,
  copyLogs,
  downloadLogs,
  logsContainerRef,
  logsEndRef,

  // 自动滚动相关
  autoScrollEnabled,
  setAutoScrollEnabled,
  autoScrollPaused,
  resumeAutoScroll,
  scrollToBottom: hookScrollToBottom,
  scrollToTop: hookScrollToTop,
  onUserInteractStart,

  width,
  height,
  minHeight,
  themeColor = 'cyan',
  className = '',
  titleComponent,
}) => {
  const theme: LogStyleConfig = THEME_COLOR_MAP[themeColor];

  // Virtuoso 引用
  const virtuosoRef = useRef<any>(null);
  const virtuosoContainerRef = useRef<HTMLDivElement>(null);

  // 选择状态
  const [selection, setSelection] = useState<LogSelection>({
    startIndex: null,
    endIndex: null,
    selectedIndexes: new Set(),
  });

  // 展开状态
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  // 检测是否可滚动（实际测量容器）
  const [isScrollable, setIsScrollable] = useState(false);

  // 实际测量容器是否可滚动
  const checkScrollable = useCallback(() => {
    const container = virtuosoContainerRef.current;
    if (!container) {
      setIsScrollable(false);
      return;
    }
    // 比较滚动高度和客户端高度
    const scrollable = container.scrollHeight > container.clientHeight;
    setIsScrollable(scrollable);
  }, []);

  // 监听容器尺寸和内容变化，更新可滚动状态
  useEffect(() => {
    checkScrollable();

    // 使用 ResizeObserver 监听容器尺寸变化
    const container = virtuosoContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      checkScrollable();
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [checkScrollable, logs.length]);

  // 滚动到底部（使用 Virtuoso API，平滑滚动）
  const scrollToBottom = useCallback(() => {
    if (logs.length === 0) return;
    virtuosoRef.current?.scrollToIndex({
      index: logs.length - 1,
      behavior: 'smooth',
    });
  }, [logs.length]);

  // 滚动到顶部（使用 Virtuoso API，平滑滚动）
  const scrollToTop = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: 0,
      behavior: 'smooth',
    });
  }, []);

  // 自动滚动到底部（当有新日志且启用自动滚动且未暂停时）
  useEffect(() => {
    if (!autoScrollEnabled || autoScrollPaused) {
      return;
    }

    // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
    const rafId = requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => cancelAnimationFrame(rafId);
  }, [logs, autoScrollEnabled, autoScrollPaused, scrollToBottom]);

  // 获取每条日志的选中状态
  const getSelectionState = useCallback((index: number): LogSelectionState => {
    if (selection.startIndex === null) return 'none';

    // 只有1条时显示为起点
    if (selection.selectedIndexes.size === 1 && selection.startIndex === index) return 'start';

    // 已选择的范围
    if (selection.selectedIndexes.has(index)) return 'in-range';

    // 可选择
    return 'available';
  }, [selection]);

  // 点击日志条目
  const handleLogClick = useCallback((index: number) => {
    const isSelected = selection.selectedIndexes.has(index);
    const count = selection.selectedIndexes.size;

    // 选择日志时暂停自动滚动
    if (autoScrollEnabled) {
      onUserInteractStart();
    }

    // 取消选中
    if (isSelected) {
      const newSelected = new Set(selection.selectedIndexes);
      newSelected.delete(index);
      const arr = Array.from(newSelected).sort((a, b) => a - b);
      if (arr.length === 0) {
        setSelection({
          startIndex: null,
          endIndex: null,
          selectedIndexes: new Set(),
        });
      } else {
        setSelection({
          startIndex: arr[0],
          endIndex: arr[arr.length - 1],
          selectedIndexes: new Set(arr),
        });
      }
      return;
    }

    // 添加选中
    if (count === 0) {
      // 空列表 → 设为起点
      setSelection({
        startIndex: index,
        endIndex: null,
        selectedIndexes: new Set([index]),
      });
    } else if (count === 1) {
      // 只有1条 → 选择连续范围
      const existing = Array.from(selection.selectedIndexes)[0];
      const start = Math.min(existing, index);
      const end = Math.max(existing, index);
      const newSelected = new Set<number>();
      for (let i = start; i <= end; i++) {
        newSelected.add(i);
      }
      setSelection({
        startIndex: start,
        endIndex: end,
        selectedIndexes: newSelected,
      });
    } else {
      // 大于1条 → 普通多选模式（离散添加）
      const arr = Array.from(selection.selectedIndexes).sort((a, b) => a - b);
      setSelection({
        startIndex: arr[0],
        endIndex: index,
        selectedIndexes: new Set([...arr, index]),
      });
    }
  }, [selection, autoScrollEnabled, onUserInteractStart]);

  // 确认复制范围
  const handleConfirmRange = useCallback(async () => {
    const { startIndex, endIndex } = selection;
    if (startIndex === null || endIndex === null) return;

    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    await copyLogs(start, end);
    setSelection({
      startIndex: null,
      endIndex: null,
      selectedIndexes: new Set(),
    });
  }, [selection, copyLogs]);

  // 复制单条
  const handleCopySingle = useCallback((index: number) => async () => {
    await copyLogs(index, index);
  }, [copyLogs]);

  // 切换展开状态
  const handleToggleExpand = useCallback((index: number) => {
    // 展开日志时暂停自动滚动
    if (autoScrollEnabled) {
      onUserInteractStart();
    }

    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, [autoScrollEnabled, onUserInteractStart]);

  // 复制全部
  const handleCopyAll = useCallback(async () => {
    await copyLogs();
  }, [copyLogs]);

  // 容器样式
  const containerStyle = {
    width: width || '100%',
    height: height || '100%',
    minHeight: minHeight || 200,
    minWidth: 250,
  };

  return (
    <div
      className={`flex flex-col bg-black/50 border border-slate-800 rounded-xl overflow-hidden ${className}`}
      style={containerStyle}
    >
      {/* 头部 */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 shrink-0 whitespace-nowrap">
        {/* 自定义标题或默认标题 */}
        {titleComponent || (
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            处理日志
            {logs.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${theme.primaryBg} ${theme.primaryColor}`}>
                {logs.length}
              </span>
            )}
          </h3>
        )}

        {/* 选择状态操作 */}
        {selection.startIndex !== null && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">
              {selection.endIndex === null
                ? `起点: #${selection.startIndex + 1} · 点击选择范围`
                : `已选 ${selection.selectedIndexes.size} 条`}
            </span>
            {selection.endIndex !== null && (
              <>
                <button
                  onClick={() => setSelection({ startIndex: null, endIndex: null, selectedIndexes: new Set() })}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] rounded transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmRange}
                  className="px-2 py-1 bg-pink-500 hover:bg-pink-400 text-white text-[10px] font-medium rounded transition-colors cursor-pointer"
                >
                  复制
                </button>
              </>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        {selection.startIndex === null && (
          <div className="flex items-center gap-1">
            {logs.length > 0 && (
              <>
                <button
                  onClick={handleCopyAll}
                  className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  title="复制全部"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={downloadLogs}
                  className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  title="下载日志"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={clearLogs}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="清空日志"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 日志内容区 - 使用虚拟列表 */}
      {logs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-600">
          <span className="text-xs">暂无日志</span>
        </div>
      ) : (
        <Virtuoso
          ref={virtuosoRef}
          scrollerRef={(ref) => {
            virtuosoContainerRef.current = ref as HTMLDivElement;
            // 同时更新外部的 logsContainerRef（如果需要）
            if (logsContainerRef) {
              (logsContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = ref as HTMLDivElement;
            }
          }}
          style={{ height: '100%' }}
          className="flex-1 custom-scrollbar"
          data={logs}
          // 预估每条日志高度
          defaultItemHeight={40}
          // 渲染每个日志条目
          itemContent={(index, log) => (
            <div className="px-1 py-px">
              <LogEntry
                log={log}
                selectionState={getSelectionState(index)}
                isExpanded={expandedLogs.has(index)}
                onClick={() => handleLogClick(index)}
                onToggleExpand={() => handleToggleExpand(index)}
                onCopySingle={handleCopySingle(index)}
              />
            </div>
          )}
          // 初始滚动到底部
          initialTopMostItemIndex={logs.length > 0 ? logs.length - 1 : 0}
        />
      )}

      {/* Footer - 只在可滚动时显示 */}
      <LogFooter
        autoScrollEnabled={autoScrollEnabled}
        setAutoScrollEnabled={setAutoScrollEnabled}
        autoScrollPaused={autoScrollPaused}
        resumeAutoScroll={resumeAutoScroll}
        scrollToBottom={scrollToBottom}
        scrollToTop={scrollToTop}
        isScrollable={isScrollable}
        themeColor={themeColor}
      />
    </div>
  );
};

export default OperationLogPanel;
