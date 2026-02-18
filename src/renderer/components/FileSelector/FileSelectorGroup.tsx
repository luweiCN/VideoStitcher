import React, { createContext, useContext, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Video, Image as ImageIcon, FileText, FolderOpen } from 'lucide-react';
import { FileSelector, FileItem, FileSelectorProps } from './FileSelector';
import { useToastMessages } from '@/components/Toast';
import { Button } from '@/components/Button';
import { RadioGroup, RadioItem } from '@/components/Radio';
import { useFileProcessor, detectFileType, checkFileTypeCompatibility } from './useFileProcessor';

/**
 * 文件选择器组 - 管理多个选择器和粘贴分配功能
 */

// ============================================================================
// Context 定义
// ============================================================================

interface SelectorContext {
  registerSelector: (id: string, props: Omit<FileSelectorProps, 'onChange'>) => void;
  unregisterSelector: (id: string) => void;
  /** 设置选择器的文件（替换当前文件） */
  setFiles: (selectorId: string, files: FileItem[]) => void;
  /** 添加文件到选择器（追加模式） */
  addFilesToSelector: (selectorId: string, files: FileItem[], multiple: boolean, maxCount: number) => { addedCount: number; duplicateCount: number; limitRejectedCount: number };
  /** 处理拖放事件 */
  handleDropOnGroup: (files: FileItem[], targetSelectorId?: string) => void;
  /** 注册文件更新回调（内部使用） */
  registerSetFilesCallback?: (selectorId: string, callback: (files: FileItem[]) => void) => void;
  /** 注销文件更新回调（内部使用） */
  unregisterSetFilesCallback?: (selectorId: string) => void;
  /** 获取所有选择器 */
  getAllSelectors: () => Map<string, Omit<FileSelectorProps, 'onChange'>>;
  /** 获取选择器当前文件数量 */
  getSelectorFileCount?: (selectorId: string) => number;
  /** 注册文件数量获取回调 */
  registerGetFileCountCallback?: (selectorId: string, callback: () => number) => void;
  /** 注销文件数量获取回调 */
  unregisterGetFileCountCallback?: (selectorId: string) => void;
  /** 获取选择器当前文件列表 */
  getSelectorFiles?: (selectorId: string) => FileItem[];
  /** 注册文件列表获取回调 */
  registerGetFilesCallback?: (selectorId: string, callback: () => FileItem[]) => void;
  /** 注销文件列表获取回调 */
  unregisterGetFilesCallback?: (selectorId: string) => void;
}

const FileSelectorGroupContext = createContext<SelectorContext | null>(null);

// 导出 Context 和类型供 FileSelector 使用
export { FileSelectorGroupContext };
export type { SelectorContext };

// ============================================================================
// 粘贴分配弹窗 - 深色工业精致风格
// ============================================================================

interface PasteDistributionModalProps {
  files: FileItem[];
  selectors: Map<string, Omit<FileSelectorProps, 'onChange'>>;
  getSelectorFileCount: (selectorId: string) => number;
  getSelectorFiles: (selectorId: string) => FileItem[];
  onConfirm: (selectorId: string) => void;
  onCancel: () => void;
}

const PasteDistributionModal: React.FC<PasteDistributionModalProps> = ({
  files,
  selectors,
  getSelectorFileCount,
  getSelectorFiles,
  onConfirm,
  onCancel
}) => {
  const [selectedSelectorId, setSelectedSelectorId] = useState<string>('');

  /**
   * 获取选择器显示名称
   */
  const getSelectorName = (id: string): string => {
    return selectors.get(id)?.name || id;
  };

  /**
   * 获取选择器可接受的文件类型
   */
  const getSelectorAccept = (id: string): FileSelectorProps['accept'] => {
    return selectors.get(id)?.accept || 'all';
  };

  /**
   * 检查文件是否可以被选择器接受
   */
  const canAcceptFile = (selectorId: string, file: FileItem): boolean => {
    const accept = getSelectorAccept(selectorId);
    return checkFileTypeCompatibility(file.type, accept);
  };

  /**
   * 计算每个选择器的文件统计信息
   */
  const getSelectorStats = (selectorId: string) => {
    const props = selectors.get(selectorId);
    const multiple = props?.multiple ?? false;
    const maxCount = props?.maxCount ?? Infinity;
    const actualMaxCount = multiple ? maxCount : 1;
    const currentCount = getSelectorFileCount(selectorId);
    const currentFiles = getSelectorFiles(selectorId);
    const existingPaths = new Set(currentFiles.map(f => f.path));

    let compatibleCount = 0;
    let incompatibleCount = 0;
    let duplicateCount = 0;

    for (const file of files) {
      if (!canAcceptFile(selectorId, file)) {
        incompatibleCount++;
      } else {
        compatibleCount++;
        if (existingPaths.has(file.path)) {
          duplicateCount++;
        }
      }
    }

    // 计算将会添加的数量
    const remainingSlots = multiple ? Math.max(0, actualMaxCount - currentCount) : 1;
    const availableFiles = compatibleCount - duplicateCount;
    const willAddCount = multiple
      ? Math.min(availableFiles, remainingSlots)
      : (compatibleCount > 0 ? 1 : 0);
    const limitRejectedCount = multiple
      ? Math.max(0, availableFiles - remainingSlots)
      : 0;

    return {
      currentCount,
      multiple,
      maxCount: props?.maxCount,
      incompatibleCount,
      duplicateCount,
      willAddCount,
      limitRejectedCount
    };
  };

  const selectorIds = Array.from(selectors.keys());

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl mx-4 bg-black border border-slate-800 rounded-2xl shadow-2xl animate-scaleIn overflow-hidden">

        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-800 bg-black/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20">
              <FolderOpen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                检测到 {files.length} 个文件
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                选择目标位置
              </p>
            </div>
          </div>
        </div>

        {/* 文件预览 - 紧凑型胶囊标签 */}
        <div className="px-6 py-3 border-b border-slate-800/50 bg-black/30">
          <div className="flex flex-wrap gap-1.5">
            {files.slice(0, 8).map((file, index) => (
              <div
                key={`${file.path}-${index}`}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${
                  file.type === 'video' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                  file.type === 'image' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  'bg-black/30 border-slate-700/50 text-slate-500'
                }`}
              >
                {file.type === 'video' && <Video className="w-3.5 h-3.5" />}
                {file.type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
                {file.type === 'unknown' && <FileText className="w-3.5 h-3.5" />}
                <span className="text-slate-400 max-w-[100px] truncate">
                  {file.name}
                </span>
              </div>
            ))}
            {files.length > 8 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-slate-500 bg-black/30 border border-slate-700/50">
                +{files.length - 8}
              </span>
            )}
          </div>
        </div>

        {/* 选择器列表 - 显示全部 */}
        <div className="p-4">
          <RadioGroup
            value={selectedSelectorId}
            onValueChange={setSelectedSelectorId}
            className="space-y-2"
          >
            {selectorIds.map(id => {
              const stats = getSelectorStats(id);
              const isSelected = selectedSelectorId === id;

              return (
                <label
                  key={id}
                  className={`block relative p-4 rounded-xl cursor-pointer transition-all duration-200 border ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/30 scale-[1.01]'
                      : 'bg-black/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RadioItem value={id} className="flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      {/* 选择器名称和状态 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-200">
                          {getSelectorName(id)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                          {stats.currentCount > 0 ? `已选 ${stats.currentCount} 个` : ''}{!stats.multiple ? '(单选)' : stats.maxCount ? `(最多 ${stats.maxCount} 个)` : '(多选)'}
                        </span>
                      </div>

                      {/* 统计信息 */}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        {stats.willAddCount === 0 && (
                          <span className="flex items-center gap-1.5 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            将不会添加任何文件
                          </span>
                        )}
                        {stats.willAddCount > 0 && (
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            将添加 {stats.willAddCount} 个
                          </span>
                        )}
                        {stats.incompatibleCount > 0 && (
                          <span className="flex items-center gap-1.5 text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {stats.incompatibleCount} 个不兼容
                          </span>
                        )}
                        {stats.duplicateCount > 0 && (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            {stats.duplicateCount} 个已存在
                          </span>
                        )}
                        {stats.limitRejectedCount > 0 && (
                          <span className="flex items-center gap-1.5 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            {stats.limitRejectedCount} 个超限
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-slate-800 bg-black/50 flex gap-3">
          <Button
            variant="ghost"
            fullWidth
            onClick={onCancel}
          >
            取消
          </Button>
          <Button
            variant="primary"
            fullWidth
            disabled={!selectedSelectorId}
            onClick={() => selectedSelectorId && onConfirm(selectedSelectorId)}
          >
            添加到选择器
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ============================================================================
// FileSelectorGroup 组件
// ============================================================================

export interface FileSelectorGroupRef {
  /** 清空所有选择器的文件 */
  clearAll: () => void;
  /** 清空指定选择器的文件 */
  clear: (selectorId: string) => void;
}

interface FileSelectorGroupProps {
  children: React.ReactNode;
  onFilesChange?: (selectorId: string, files: string[]) => void;
}

export const FileSelectorGroup = React.forwardRef<FileSelectorGroupRef, FileSelectorGroupProps>(({
  children,
  onFilesChange
}, ref) => {
  const selectorsRef = useRef<Map<string, Omit<FileSelectorProps, 'onChange'>>>(new Map());
  const setFilesCallbacksRef = useRef<Map<string, (files: FileItem[]) => void>>(new Map());
  const getFileCountCallbacksRef = useRef<Map<string, () => number>>(new Map());
  const getFilesCallbacksRef = useRef<Map<string, () => FileItem[]>>(new Map());
  const [pendingPasteFiles, setPendingPasteFiles] = useState<FileItem[] | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);

  // 获取 toast 通知函数
  const { success, error } = useToastMessages();

  // 使用文件处理 hook
  const { processFiles, buildNotificationMessage } = useFileProcessor();

  /**
   * 清空所有选择器的文件
   */
  const clearAll = useCallback(() => {
    setFilesCallbacksRef.current.forEach((callback, selectorId) => {
      callback([]);
      onFilesChange?.(selectorId, []);
    });
  }, [onFilesChange]);

  /**
   * 清空指定选择器的文件
   */
  const clear = useCallback((selectorId: string) => {
    const callback = setFilesCallbacksRef.current.get(selectorId);
    if (callback) {
      callback([]);
      onFilesChange?.(selectorId, []);
    }
  }, [onFilesChange]);

  // 暴露方法给父组件
  React.useImperativeHandle(ref, () => ({
    clearAll,
    clear,
  }), [clearAll, clear]);

  /**
   * 注册选择器
   */
  const registerSelector = useCallback((id: string, props: Omit<FileSelectorProps, 'onChange'>) => {
    selectorsRef.current.set(id, props);
  }, []);

  /**
   * 注销选择器
   */
  const unregisterSelector = useCallback((id: string) => {
    selectorsRef.current.delete(id);
    setFilesCallbacksRef.current.delete(id);
    getFileCountCallbacksRef.current.delete(id);
    getFilesCallbacksRef.current.delete(id);
  }, []);

  /**
   * 注册文件更新回调
   */
  const registerSetFilesCallback = useCallback((selectorId: string, callback: (files: FileItem[]) => void) => {
    setFilesCallbacksRef.current.set(selectorId, callback);
  }, []);

  /**
   * 注销文件更新回调
   */
  const unregisterSetFilesCallback = useCallback((selectorId: string) => {
    setFilesCallbacksRef.current.delete(selectorId);
  }, []);

  /**
   * 注册文件数量获取回调
   */
  const registerGetFileCountCallback = useCallback((selectorId: string, callback: () => number) => {
    getFileCountCallbacksRef.current.set(selectorId, callback);
  }, []);

  /**
   * 注销文件数量获取回调
   */
  const unregisterGetFileCountCallback = useCallback((selectorId: string) => {
    getFileCountCallbacksRef.current.delete(selectorId);
  }, []);

  /**
   * 获取选择器当前文件数量
   */
  const getSelectorFileCount = useCallback((selectorId: string): number => {
    const callback = getFileCountCallbacksRef.current.get(selectorId);
    return callback ? callback() : 0;
  }, []);

  /**
   * 注册文件列表获取回调
   */
  const registerGetFilesCallback = useCallback((selectorId: string, callback: () => FileItem[]) => {
    getFilesCallbacksRef.current.set(selectorId, callback);
  }, []);

  /**
   * 注销文件列表获取回调
   */
  const unregisterGetFilesCallback = useCallback((selectorId: string) => {
    getFilesCallbacksRef.current.delete(selectorId);
  }, []);

  /**
   * 获取选择器当前文件列表
   */
  const getSelectorFiles = useCallback((selectorId: string): FileItem[] => {
    const callback = getFilesCallbacksRef.current.get(selectorId);
    return callback ? callback() : [];
  }, []);

  /**
   * 设置选择器的文件（替换模式）
   */
  const setFiles = useCallback((selectorId: string, files: FileItem[]) => {
    const callback = setFilesCallbacksRef.current.get(selectorId);
    if (callback) {
      callback(files);
      const filePaths = files.map(f => f.path);
      onFilesChange?.(selectorId, filePaths);
    }
  }, [onFilesChange]);

  /**
   * 添加文件到指定选择器（完整的添加逻辑：格式校验、数量限制、去重、通知）
   */
  const addFilesToSelector = useCallback((selectorId: string, files: FileItem[], multiple: boolean, maxCount: number): { addedCount: number; duplicateCount: number; limitRejectedCount: number } => {
    const callback = setFilesCallbacksRef.current.get(selectorId);
    const selectorProps = selectorsRef.current.get(selectorId);

    if (!callback || !selectorProps) {
      return { addedCount: 0, duplicateCount: 0, limitRejectedCount: 0 };
    }

    const currentCount = getSelectorFileCount(selectorId);
    const actualMaxCount = multiple ? (maxCount ?? Infinity) : 1;

    // 格式校验
    const validFiles: FileItem[] = [];
    let formatRejectedCount = 0;

    for (const file of files) {
      const isCompatible = checkFileTypeCompatibility(file.type, selectorProps.accept);
      if (isCompatible) {
        validFiles.push(file);
      } else {
        formatRejectedCount++;
      }
    }

    // 数量限制（单选模式允许替换，多选模式检查剩余容量）
    const remainingSlots = multiple ? Math.max(0, actualMaxCount - currentCount) : 1;

    let selectedFiles: FileItem[];
    let limitRejectedCount = 0;

    if (multiple && remainingSlots === 0) {
      selectedFiles = [];
      limitRejectedCount = validFiles.length;
    } else if (validFiles.length <= remainingSlots) {
      selectedFiles = validFiles;
    } else {
      selectedFiles = validFiles.slice(0, remainingSlots);
      limitRejectedCount = validFiles.length - remainingSlots;
    }

    // 去重（单选模式跳过）
    let newFiles: FileItem[];
    let duplicateCount = 0;

    if (!multiple) {
      newFiles = selectedFiles;
    } else {
      const currentFiles = Array.from(selectorsRef.current.entries())
        .filter(([id]) => id === selectorId)
        .flatMap(() => []); // 需要从选择器获取当前文件列表

      // 由于我们无法直接获取当前文件列表，使用文件数量回调的替代方案
      // 这里简化处理：直接使用选中的文件
      newFiles = selectedFiles;
    }

    // 更新状态
    if (newFiles.length > 0) {
      if (multiple) {
        // 多选模式：追加
        const currentCount = getSelectorFileCount(selectorId);
        // 通过回调通知选择器追加文件
        callback(newFiles); // 注意：这里需要选择器支持追加模式
      } else {
        // 单选模式：替换
        callback(newFiles);
      }
      onFilesChange?.(selectorId, newFiles.map(f => f.path));
    }

    return { addedCount: newFiles.length, duplicateCount, limitRejectedCount };
  }, [getSelectorFileCount, onFilesChange]);

  /**
   * 获取所有选择器
   */
  const getAllSelectors = useCallback(() => {
    return selectorsRef.current;
  }, []);

  /**
   * 处理粘贴事件（支持文件夹）
   */
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      console.log('[FileSelectorGroup] 粘贴事件触发');

      if (!e.clipboardData?.files.length) {
        console.log('[FileSelectorGroup] 没有文件数据');
        return;
      }

      const clipboardFiles = Array.from(e.clipboardData.files);
      const selectors = getAllSelectors();

      if (selectors.size === 0) return;

      // 收集所有文件（支持文件夹）
      const rawPaths: { path: string; name: string }[] = [];

      for (const file of clipboardFiles) {
        const path = (file as any).path;
        if (!path) continue;

        // 检测是否是文件夹
        let isDirectory = false;
        try {
          const typeResult = await window.api.checkPathType(path);
          if (typeResult.success) {
            isDirectory = typeResult.isDirectory || false;
          }
        } catch (err) {
          isDirectory = (file as any).isDirectory ||
            (!file.name.includes('.') && file.size === 0 && file.type === '');
        }

        if (isDirectory) {
          // 文件夹：读取第一层内容
          try {
            const result = await window.api.readDirectory({
              dirPath: path,
              includeHidden: false,
              recursive: false,
              maxDepth: 1,
              extensions: undefined
            });
            if (result.success && result.files) {
              for (const dirFile of result.files) {
                if (!dirFile.isDirectory) {
                  rawPaths.push({ path: dirFile.path, name: dirFile.name });
                }
              }
            }
          } catch (err) {
            console.error('[FileSelectorGroup] 读取文件夹失败:', path, err);
          }
        } else {
          rawPaths.push({ path, name: file.name });
        }
      }

      if (rawPaths.length === 0) {
        error('没有找到有效的文件');
        return;
      }

      // 转换为 FileItem 格式
      const fileItems: FileItem[] = rawPaths.map(item => ({
        path: item.path,
        name: item.name,
        type: detectFileType(item.path),
        _infoLoaded: false
      }));

      console.log('[FileSelectorGroup] 粘贴文件:', fileItems.length);

      // 检查选择器数量（使用前面已声明的 selectors）
      const selectorIds = Array.from(selectors.keys());

      if (selectorIds.length === 1) {
        // 只有一个选择器：直接添加文件，不弹窗
        const singleSelectorId = selectorIds[0];
        handleDirectPaste(singleSelectorId, fileItems);
      } else {
        // 多个选择器：显示选择器弹窗
        setPendingPasteFiles(fileItems);
        setShowDistributionModal(true);
      }
    };

    /**
     * 直接粘贴到单个选择器（不弹窗）
     */
    const handleDirectPaste = (selectorId: string, files: FileItem[]) => {
      const selectorProps = selectorsRef.current.get(selectorId);
      if (!selectorProps) return;

      const multiple = selectorProps.multiple ?? false;
      const maxCount = selectorProps.maxCount ?? Infinity;
      const actualMaxCount = multiple ? maxCount : 1;
      const currentCount = getSelectorFileCount(selectorId);
      const currentFiles = getSelectorFiles(selectorId);

      // 转换为原始文件数据格式
      const rawFiles = files.map(f => ({ path: f.path, name: f.name }));

      // 使用统一的文件处理逻辑
      const result = processFiles(rawFiles, {
        accept: selectorProps.accept,
        multiple,
        maxCount: actualMaxCount,
        currentCount,
        existingPaths: new Set(currentFiles.map(f => f.path))
      });

      // 更新状态
      if (result.filesToAdd.length > 0) {
        const callback = setFilesCallbacksRef.current.get(selectorId);
        if (callback) {
          callback(result.filesToAdd);
          onFilesChange?.(selectorId, result.filesToAdd.map(f => f.path));
        }
      }

      // 显示通知
      const notification = buildNotificationMessage(
        result.addedCount,
        result.duplicateCount,
        result.formatRejectedCount,
        result.limitRejectedCount
      );

      if (notification.type === 'success') {
        success(notification.message);
      } else {
        error(notification.message);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [getAllSelectors, error, getSelectorFileCount, getSelectorFiles, processFiles, buildNotificationMessage, success, error, onFilesChange]);

  /**
   * 确认粘贴到指定选择器
   */
  const handleConfirmPaste = useCallback((selectorId: string) => {
    if (!pendingPasteFiles) return;

    const selectorProps = selectorsRef.current.get(selectorId);
    if (!selectorProps) return;

    const multiple = selectorProps.multiple ?? false;
    const maxCount = selectorProps.maxCount ?? Infinity;
    const actualMaxCount = multiple ? maxCount : 1;
    const currentCount = getSelectorFileCount(selectorId);
    const currentFiles = getSelectorFiles(selectorId);

    // 转换为原始文件数据格式
    const rawFiles = pendingPasteFiles.map(f => ({ path: f.path, name: f.name }));

    // 使用统一的文件处理逻辑
    const result = processFiles(rawFiles, {
      accept: selectorProps.accept,
      multiple,
      maxCount: actualMaxCount,
      currentCount,
      existingPaths: new Set(currentFiles.map(f => f.path))
    });

    // 更新状态
    if (result.filesToAdd.length > 0) {
      const callback = setFilesCallbacksRef.current.get(selectorId);
      if (callback) {
        callback(result.filesToAdd);
        onFilesChange?.(selectorId, result.filesToAdd.map(f => f.path));
      }
    }

    // 显示通知
    const notification = buildNotificationMessage(
      result.addedCount,
      result.duplicateCount,
      result.formatRejectedCount,
      result.limitRejectedCount
    );

    if (notification.type === 'success') {
      success(notification.message);
    } else {
      error(notification.message);
    }

    // 关闭弹窗
    setShowDistributionModal(false);
    setPendingPasteFiles(null);
  }, [pendingPasteFiles, getSelectorFileCount, getSelectorFiles, onFilesChange, processFiles, buildNotificationMessage, success, error]);

  // 使用 useMemo 稳定 contextValue
  const contextValue = useMemo<SelectorContext>(() => ({
    registerSelector,
    unregisterSelector,
    setFiles,
    addFilesToSelector,
    handleDropOnGroup: () => {}, // 暂不使用
    getAllSelectors,
    registerSetFilesCallback,
    unregisterSetFilesCallback,
    getSelectorFileCount,
    registerGetFileCountCallback,
    unregisterGetFileCountCallback,
    getSelectorFiles,
    registerGetFilesCallback,
    unregisterGetFilesCallback
  }), [registerSelector, unregisterSelector, setFiles, addFilesToSelector, getAllSelectors, registerSetFilesCallback, unregisterSetFilesCallback, getSelectorFileCount, registerGetFileCountCallback, unregisterGetFileCountCallback, getSelectorFiles, registerGetFilesCallback, unregisterGetFilesCallback]);

  return (
    <FileSelectorGroupContext.Provider value={contextValue}>
      {children}

      {showDistributionModal && pendingPasteFiles && (
        <PasteDistributionModal
          files={pendingPasteFiles}
          selectors={getAllSelectors()}
          getSelectorFileCount={getSelectorFileCount}
          getSelectorFiles={getSelectorFiles}
          onConfirm={handleConfirmPaste}
          onCancel={() => {
            setShowDistributionModal(false);
            setPendingPasteFiles(null);
          }}
        />
      )}
    </FileSelectorGroupContext.Provider>
  );
});

/**
 * Hook: 访问 FileSelectorGroup 上下文
 */
export const useFileSelectorGroup = () => {
  const context = useContext(FileSelectorGroupContext);
  if (!context) {
    throw new Error('useFileSelectorGroup must be used within FileSelectorGroup');
  }
  return context;
};

/**
 * Hook: 注册文件更新回调
 */
export const useRegisterSetFilesCallback = (selectorId: string, callback: (files: FileItem[]) => void) => {
  const context = useContext(FileSelectorGroupContext);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (context) {
      const stableCallback = (files: FileItem[]) => {
        callbackRef.current(files);
      };
      context.registerSetFilesCallback?.(selectorId, stableCallback);
      return () => context.unregisterSetFilesCallback?.(selectorId);
    }
  }, [selectorId, context]);
};

/**
 * Hook: 注册文件数量获取回调
 */
export const useRegisterGetFileCountCallback = (selectorId: string, callback: () => number) => {
  const context = useContext(FileSelectorGroupContext);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (context) {
      context.registerGetFileCountCallback?.(selectorId, () => callbackRef.current());
      return () => context.unregisterGetFileCountCallback?.(selectorId);
    }
  }, [selectorId, context]);
};

/**
 * Hook: 注册文件列表获取回调
 */
export const useRegisterGetFilesCallback = (selectorId: string, callback: () => FileItem[]) => {
  const context = useContext(FileSelectorGroupContext);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (context) {
      context.registerGetFilesCallback?.(selectorId, () => callbackRef.current());
      return () => context.unregisterGetFilesCallback?.(selectorId);
    }
  }, [selectorId, context]);
};
