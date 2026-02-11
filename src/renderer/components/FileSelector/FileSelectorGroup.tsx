import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import { X, Video, Image as ImageIcon, FileText } from 'lucide-react';
import { FileSelector, FileItem, FileSelectorProps } from './FileSelector';

/**
 * 文件选择器组 - 管理多个选择器和粘贴分配功能
 */

// ============================================================================
// Context 定义
// ============================================================================

interface SelectorContext {
  registerSelector: (id: string, props: Omit<FileSelectorProps, 'onChange'>) => void;
  unregisterSelector: (id: string) => void;
  addFilesToSelector: (selectorId: string, files: FileItem[]) => void;
  getAllSelectors: () => Map<string, Omit<FileSelectorProps, 'onChange'>>;
}

const FileSelectorGroupContext = createContext<SelectorContext | null>(null);

// ============================================================================
// 粘贴分配弹窗
// ============================================================================

interface Paste {
  files: FileItem[];
  timestamp: number;
}

interface PasteDistributionModalProps {
  paste: Paste;
  selectors: Map<string, Omit<FileSelectorProps, 'onChange'>>;
  onConfirm: (distribution: Map<string, FileItem[]>) => void;
  onCancel: () => void;
}

const PasteDistributionModal: React.FC<PasteDistributionModalProps> = ({
  paste,
  selectors,
  onConfirm,
  onCancel
}) => {
  const [step, setStep] = useState<'select' | 'distribute'>('select');
  const [defaultSelectorId, setDefaultSelectorId] = useState<string>('');
  const [distribution, setDistribution] = useState<Map<string, FileItem[]>>(new Map());
  const [draggedFile, setDraggedFile] = useState<FileItem | null>(null);
  const [draggedFromSelector, setDraggedFromSelector] = useState<string | null>(null);

  // 初始化：将所有文件分配到默认选择器
  useEffect(() => {
    if (defaultSelectorId && step === 'select') {
      const newDistribution = new Map<string, FileItem[]>();
      selectors.forEach((props, id) => {
        newDistribution.set(id, []);
      });
      newDistribution.set(defaultSelectorId, [...paste.files]);
      setDistribution(newDistribution);
    }
  }, [defaultSelectorId, paste.files, selectors, step]);

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

    if (accept === 'all') return true;

    const fileType = file.type;

    if (accept === 'video') return fileType === 'video';
    if (accept === 'image') return fileType === 'image';
    if (Array.isArray(accept)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      return accept.includes(ext);
    }

    return true;
  };

  /**
   * 过滤出可以接受指定文件的选择器
   */
  const getCompatibleSelectors = (file: FileItem): string[] => {
    const compatible: string[] = [];
    selectors.forEach((_, id) => {
      if (canAcceptFile(id, file)) {
        compatible.push(id);
      }
    });
    return compatible;
  };

  /**
   * 处理文件拖拽开始
   */
  const handleDragStart = (file: FileItem, fromSelector: string) => {
    setDraggedFile(file);
    setDraggedFromSelector(fromSelector);
  };

  /**
   * 处理文件拖拽结束
   */
  const handleDragEnd = () => {
    setDraggedFile(null);
    setDraggedFromSelector(null);
  };

  /**
   * 处理文件放置到选择器
   */
  const handleDropOnSelector = (toSelector: string) => {
    if (!draggedFile || !draggedFromSelector) return;

    // 检查目标选择器是否可以接受该文件
    if (!canAcceptFile(toSelector, draggedFile)) {
      return; // 不接受该文件类型
    }

    setDistribution(prev => {
      const newDistribution = new Map(prev);

      // 从源选择器移除
      const fromFiles = newDistribution.get(draggedFromSelector) || [];
      newDistribution.set(
        draggedFromSelector,
        fromFiles.filter(f => f.path !== draggedFile.path)
      );

      // 添加到目标选择器
      const toFiles = newDistribution.get(toSelector) || [];
      newDistribution.set(toSelector, [...toFiles, draggedFile]);

      return newDistribution;
    });

    handleDragEnd();
  };

  /**
   * 步骤1：选择默认目标选择器
   */
  const renderStep1 = () => {
    // 获取兼容的选择器
    const compatibleSelectors = paste.files.length > 0
      ? getCompatibleSelectors(paste.files[0])
      : Array.from(selectors.keys());

    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-2">
          检测到 {paste.files.length} 个文件
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          请选择要将文件添加到哪个选择器：
        </p>

        <div className="space-y-2 mb-6">
          {compatibleSelectors.map(selectorId => (
            <label
              key={selectorId}
              className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                defaultSelectorId === selectorId
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="defaultSelector"
                checked={defaultSelectorId === selectorId}
                onChange={() => setDefaultSelectorId(selectorId)}
                className="w-4 h-4 text-cyan-500 bg-slate-800 border-slate-600 focus:ring-cyan-500 focus:ring-offset-slate-900"
              />
              <span className="ml-3 text-slate-300">
                {getSelectorName(selectorId)}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-all"
          >
            取消
          </button>
          <button
            onClick={() => setStep('distribute')}
            disabled={!defaultSelectorId}
            className="flex-1 py-2.5 px-4 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed transition-all font-medium"
          >
            添加
          </button>
          <button
            onClick={() => setStep('distribute')}
            disabled={!defaultSelectorId}
            className="flex-1 py-2.5 px-4 rounded-lg border border-cyan-600 text-cyan-400 hover:bg-cyan-600/10 disabled:border-slate-700 disabled:text-slate-600 disabled:cursor-not-allowed transition-all font-medium"
          >
            添加并调整分配
          </button>
        </div>
      </div>
    );
  };

  /**
   * 步骤2：调整文件分配
   */
  const renderStep2 = () => {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">
              分配文件到选择器
            </h3>
            <p className="text-sm text-slate-400">
              拖拽文件可调整分配
            </p>
          </div>
          <button
            onClick={() => setStep('select')}
            className="text-slate-500 hover:text-slate-400 transition-colors"
          >
            返回
          </button>
        </div>

        {/* 选择器区域 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {Array.from(selectors.entries()).map(([id, props]) => {
            const files = distribution.get(id) || [];
            const canDrop = draggedFile ? canAcceptFile(id, draggedFile) : false;
            const isDraggingOver = draggedFile && draggedFromSelector !== id;

            return (
              <div
                key={id}
                className={`p-4 rounded-xl border-2 transition-all min-h-[200px] ${
                  isDraggingOver && canDrop
                    ? 'border-cyan-500 bg-cyan-500/5'
                    : 'border-slate-700 bg-slate-900'
                } ${draggedFromSelector === id ? 'opacity-50' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (canDrop) {
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={() => canDrop && handleDropOnSelector(id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-300">
                    {props.name}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {files.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {files.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-sm">
                      拖放文件到这里
                    </div>
                  ) : (
                    files.map((file, index) => (
                      <div
                        key={`${file.path}-${index}`}
                        draggable
                        onDragStart={() => handleDragStart(file, id)}
                        onDragEnd={handleDragEnd}
                        className={`p-2 rounded-lg bg-slate-800 border border-slate-700 cursor-move transition-all ${
                          draggedFile?.path === file.path
                            ? 'border-cyan-500 shadow-lg shadow-cyan-500/20'
                            : 'hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${
                            file.type === 'video' ? 'bg-rose-500/20 text-rose-400' :
                            file.type === 'image' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-slate-700 text-slate-500'
                          }`}>
                            {file.type === 'video' && <Video className="w-3.5 h-3.5" />}
                            {file.type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
                            {file.type === 'unknown' && <FileText className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-xs text-slate-300 truncate flex-1">
                            {file.name}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-all"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(distribution)}
            className="flex-1 py-2.5 px-4 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-all font-medium"
          >
            确认分配
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-scaleIn"
      >
        {step === 'select' ? renderStep1() : renderStep2()}
      </div>
    </div>
  );
};

// ============================================================================
// FileSelectorGroup 组件
// ============================================================================

interface FileSelectorGroupProps {
  children: React.ReactNode;
  onFilesChange?: (selectorId: string, files: string[]) => void;
}

export const FileSelectorGroup: React.FC<FileSelectorGroupProps> = ({
  children,
  onFilesChange
}) => {
  const selectorsRef = useRef<Map<string, Omit<FileSelectorProps, 'onChange'>>>(new Map());
  const [pendingPaste, setPendingPaste] = useState<Paste | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);

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
  }, []);

  /**
   * 添加文件到指定选择器
   */
  const addFilesToSelector = useCallback((selectorId: string, files: FileItem[]) => {
    // 这个方法由各个 FileSelector 组件调用，更新其内部状态
    // 实际的状态更新在 FileSelector 内部处理
  }, []);

  /**
   * 获取所有选择器
   */
  const getAllSelectors = useCallback(() => {
    return selectorsRef.current;
  }, []);

  /**
   * 处理粘贴事件
   */
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // 检查是否有文件数据
      if (!e.clipboardData?.files.length) return;

      const files = Array.from(e.clipboardData.files);
      const selectors = getAllSelectors();

      if (selectors.size === 0) return;

      // 将文件转换为 FileItem 格式
      const fileItems: FileItem[] = files.map(file => ({
        path: file.path || (file as any).name || '',
        name: file.name,
        type: file.type.startsWith('video') ? 'video' :
              file.type.startsWith('image') ? 'image' : 'unknown',
        size: file.size
      }));

      // 过滤出有效的文件（有路径的）
      const validFiles = fileItems.filter(f => f.path);

      if (validFiles.length === 0) return;

      // 设置待处理的粘贴内容
      setPendingPaste({
        files: validFiles,
        timestamp: Date.now()
      });
      setShowDistributionModal(true);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [getAllSelectors]);

  /**
   * 确认文件分配
   */
  const handleConfirmDistribution = useCallback((distribution: Map<string, FileItem[]>) => {
    // 触发各个选择器的更新
    // 这里需要通过事件或其他方式通知各个 FileSelector 组件
    // 可以考虑使用事件总线或回调

    // TODO: 实现文件分配到各个选择器的逻辑

    setShowDistributionModal(false);
    setPendingPaste(null);
  }, []);

  const contextValue: SelectorContext = {
    registerSelector,
    unregisterSelector,
    addFilesToSelector,
    getAllSelectors
  };

  return (
    <FileSelectorGroupContext.Provider value={contextValue}>
      {children}

      {showDistributionModal && pendingPaste && (
        <PasteDistributionModal
          paste={pendingPaste}
          selectors={getAllSelectors()}
          onConfirm={handleConfirmDistribution}
          onCancel={() => {
            setShowDistributionModal(false);
            setPendingPaste(null);
          }}
        />
      )}
    </FileSelectorGroupContext.Provider>
  );
};

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
