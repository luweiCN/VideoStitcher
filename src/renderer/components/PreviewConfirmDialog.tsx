import React from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

interface PreviewConfirmDialogProps {
  /**
   * 是否显示对话框
   */
  open: boolean;
  /**
   * 预览数据
   */
  changes: Array<{
    sourcePath: string;
    targetName: string;
    sourceName: string;
  }>;
  /**
   * 关闭对话框
   */
  onClose: () => void;
  /**
   * 确认执行
   */
  onConfirm: () => void;
}

/**
 * 文件重命名预览确认对话框
 * 显示即将重命名的文件变更预览
 */
const PreviewConfirmDialog: React.FC<PreviewConfirmDialogProps> = ({
  open,
  changes,
  onClose,
  onConfirm
}) => {
  if (!open) return null;

  // 提取文件名（不包含路径）
  const getFileName = (fullPath: string) => {
    return fullPath.split(/[\/\\]/).pop() || fullPath;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框内容 */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">确认重命名</h2>
              <p className="text-sm text-slate-400">以下 {changes.length} 个文件将被重命名</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 变更列表 */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-2">
            {changes.map((change, index) => {
              const sourceFileName = getFileName(change.sourcePath);
              const dotIndex = sourceFileName.lastIndexOf('.');
              const ext = dotIndex !== -1 ? sourceFileName.substring(dotIndex) : '';
              const targetFileName = change.targetName + ext;

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl group hover:bg-slate-800 transition-colors"
                >
                  {/* 序号 */}
                  <div className="w-8 h-8 flex items-center justify-center bg-slate-700 rounded-lg text-xs font-mono text-slate-400">
                    {index + 1}
                  </div>

                  {/* 文件名变更 */}
                  <div className="flex-1 flex items-start gap-3 min-w-0 py-1">
                    <div className="flex-1 min-w-0">
                      <span className="text-rose-400 font-mono text-xs break-all select-all" title={sourceFileName}>
                        {sourceFileName}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <span className="text-emerald-400 font-mono text-xs break-all select-all" title={targetFileName}>
                        {targetFileName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 警告提示 */}
        <div className="px-6 pb-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-amber-400">⚠️ 注意</p>
              <p className="text-amber-200/70 mt-1">
                此操作将直接修改文件系统中的文件名。建议先备份重要文件。
              </p>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            确认执行重命名
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewConfirmDialog;
