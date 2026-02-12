import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Copy, FileText, List, Table, Code, Edit2, Save, X, Download,
  ArrowRightLeft, File as FileIcon, Loader2, Check, Trash2, Hash, CopyCheck
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import OperationLogPanel from '../components/OperationLogPanel';
import PreviewConfirmDialog from '../components/PreviewConfirmDialog';
import { FileSelector, FileSelectorGroup, type FileSelectorRef } from '../components/FileSelector';
import { Button } from '../components/Button/Button';
import { useOperationLogs } from '../hooks/useOperationLogs';
import { useToastMessages } from '../components/Toast/Toast';

interface FileNameExtractorModeProps {
  onBack: () => void;
}

/**
 * 文件信息接口
 */
interface VideoFile {
  id: string;              // 唯一标识
  name: string;            // 文件名（不含扩展名）
  originalName: string;    // 原始完整文件名
  path: string;            // 文件完整路径
}

/**
 * 导出格式类型
 */
type ExportFormat = 'text' | 'md_list' | 'md_table' | 'json';

const FileNameExtractorMode: React.FC<FileNameExtractorModeProps> = ({ onBack }) => {
  // 状态管理
  const [files, setFiles] = useState<VideoFile[]>([]);
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('text');
  const [isEditing, setIsEditing] = useState(false);
  const [showReplacePanel, setShowReplacePanel] = useState(false);
  const [showSequencePanel, setShowSequencePanel] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [sequenceDelimiter, setSequenceDelimiter] = useState('-');
  const [sequenceIndex, setSequenceIndex] = useState<number>(8);
  const [tempNames, setTempNames] = useState<Record<string, string>>({});

  // 重命名相关状态
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameProgress, setRenameProgress] = useState({ current: 0, total: 0 });
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // FileSelector ref - 用于清除选择器状态
  const fileSelectorRef = useRef<FileSelectorRef>(null);

  // 使用日志 Hook
  const {
    logs,
    addLog,
    clearLogs,
    copyLogs,
    downloadLogs,
    logsContainerRef,
    logsEndRef,
    autoScrollEnabled,
    setAutoScrollEnabled,
    autoScrollPaused,
    resumeAutoScroll,
    scrollToBottom,
    scrollToTop,
    onUserInteractStart,
  } = useOperationLogs({
    moduleNameCN: '文件名提取',
    moduleNameEN: 'FileNameExtractor',
  });

  // 使用 Toast Hook
  const toast = useToastMessages();

  // 监听文件重命名进度事件
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanupProgress = (window as any).api.onFileProgress((data: {
      index: number;
      total: number;
      sourcePath?: string;
      targetPath?: string;
      success?: boolean;
      error?: string;
    }) => {
      setRenameProgress({ current: data.index + 1, total: data.total });

      // 每条记录输出详细日志
      if (data.sourcePath && data.targetPath) {
        const sourceName = data.sourcePath.split(/[\/\\]/).pop() || data.sourcePath;
        const targetName = data.targetPath.split(/[\/\\]/).pop() || data.targetPath;

        if (data.success) {
          addLog(`将 "${sourceName}" 重命名为 "${targetName}"`, 'success');
        } else {
          addLog(`重命名失败 "${sourceName}": ${data.error || '未知错误'}`, 'error');
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanupComplete = (window as any).api.onFileComplete((results: { success: number; failed: number }) => {
      setIsRenaming(false);

      addLog(`重命名完成: 成功 ${results.success}, 失败 ${results.failed}`,
        results.failed === 0 ? 'success' : 'warning');

      // 使用 Toast 提示，时长 10 秒
      if (results.failed === 0) {
        toast.success(`成功重命名 ${results.success} 个文件`, '重命名完成', 10000);
      } else {
        toast.warning(`成功 ${results.success} 个，失败 ${results.failed} 个`, '重命名部分完成', 10000);
      }

      // 重命名成功后更新文件路径
      if (results.success > 0) {
        setFiles(prevFiles => {
          const updatedFiles = prevFiles.map(f => {
            const dir = f.path.split(/[\/\\]/).slice(0, -1).join('/');
            const ext = f.originalName.split('.').pop() || '';
            const newPath = `${dir}/${f.name}.${ext}`;
            return {
              ...f,
              path: newPath,
              originalName: `${f.name}.${ext}`
            };
          });
          return updatedFiles;
        });
      }
    });

    return () => {
      cleanupProgress();
      cleanupComplete();
    };
  }, [addLog, toast]);

  // ==================== 文件选择处理 ====================
  /**
   * 处理文件选择
   */
  const handleFilesChange = useCallback((filePaths: string[]) => {
    // 如果是空数组（来自 clearFiles 触发的 onChange），不处理
    if (filePaths.length === 0) {
      return;
    }

    addFilesByPaths(filePaths);

    // 延迟清空 FileSelector 内部列表，避免 onChange 触发死循环
    setTimeout(() => {
      fileSelectorRef.current?.clearFiles();
    }, 0);
  }, []);

  /**
   * 根据文件路径数组添加文件
   */
  const addFilesByPaths = (filePaths: string[]) => {
    const newVideoFiles: VideoFile[] = filePaths.map(path => {
      const fileName = path.split(/[\/\\]/).pop() || path;
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

      return {
        id: Math.random().toString(36).substr(2, 9),
        name: nameWithoutExt,
        originalName: fileName,
        path: path
      };
    });

    setFiles(prev => [...prev, ...newVideoFiles]);
    addLog(`添加 ${newVideoFiles.length} 个文件`, 'info');
  };

  /**
   * 移除单个文件
   */
  const removeFile = (id: string) => {
    const file = files.find(f => f.id === id);
    setFiles(prev => prev.filter(f => f.id !== id));
    if (file) {
      addLog(`移除文件: ${file.name}`, 'info');
    }
    if (isEditing) {
      setTempNames(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  /**
   * 清空所有文件
   */
  const clearAll = () => {
    const count = files.length;
    setFiles([]);
    setIsEditing(false);
    setTempNames({});
    setShowReplacePanel(false);
    setShowSequencePanel(false);
    setFindText('');
    setReplaceText('');
    clearLogs();
    addLog(`清空 ${count} 个文件`, 'info');
  };

  // ==================== 编辑功能 ====================
  /**
   * 开始编辑模式
   */
  const startEditing = () => {
    const names: Record<string, string> = {};
    files.forEach(f => {
      names[f.id] = f.name;
    });
    setTempNames(names);
    setIsEditing(true);
    setShowReplacePanel(false);
    setShowSequencePanel(false);
    addLog('进入编辑模式', 'info');
  };

  /**
   * 切换替换面板
   */
  const toggleReplacePanel = () => {
    setShowReplacePanel(!showReplacePanel);
    setShowSequencePanel(false);
    setIsEditing(false);
  };

  /**
   * 切换序号面板
   */
  const toggleSequencePanel = () => {
    setShowSequencePanel(!showSequencePanel);
    setShowReplacePanel(false);
    setIsEditing(false);
  };

  /**
   * 处理批量文字替换
   */
  const handleReplaceAll = () => {
    if (!findText) return;

    let replaceCount = 0;
    setFiles(prev => prev.map(f => {
      const newBaseName = f.name.split(findText).join(replaceText);
      if (newBaseName !== f.name) {
        const dotIndex = f.originalName.lastIndexOf('.');
        const extension = dotIndex !== -1 ? f.originalName.substring(dotIndex) : '';
        const newFileName = newBaseName + extension;
        replaceCount++;
        return {
          ...f,
          name: newBaseName,
          originalName: newFileName
        };
      }
      return f;
    }));

    addLog(`批量替换: "${findText}" → "${replaceText}", 影响 ${replaceCount} 个文件`, 'success');
    setShowReplacePanel(false);
    setFindText('');
    setReplaceText('');
  };

  /**
   * 处理批量添加序号
   */
  const handleApplySequence = () => {
    if (!sequenceDelimiter || sequenceIndex <= 0) return;

    let updateCount = 0;
    setFiles(prev => prev.map((f, i) => {
      const parts = f.name.split(sequenceDelimiter);
      if (parts.length < sequenceIndex) return f;

      const sequenceNum = (i + 1).toString();
      parts[sequenceIndex - 1] = parts[sequenceIndex - 1] + sequenceNum;

      const newBaseName = parts.join(sequenceDelimiter);
      if (newBaseName !== f.name) {
        const dotIndex = f.originalName.lastIndexOf('.');
        const extension = dotIndex !== -1 ? f.originalName.substring(dotIndex) : '';
        const newFileName = newBaseName + extension;
        updateCount++;

        return {
          ...f,
          name: newBaseName,
          originalName: newFileName
        };
      }
      return f;
    }));

    addLog(`批量添加序号: 在第 ${sequenceIndex} 个 "${sequenceDelimiter}" 左侧, 影响 ${updateCount} 个文件`, 'success');
    setShowSequencePanel(false);
  };

  /**
   * 将第一个文件名应用到所有文件
   */
  const applyFirstNameToAll = () => {
    if (files.length <= 1) return;

    const firstName = isEditing ? (tempNames[files[0].id] || files[0].name) : files[0].name;

    if (isEditing) {
      const newTempNames = { ...tempNames };
      files.forEach(f => {
        newTempNames[f.id] = firstName;
      });
      setTempNames(newTempNames);
    } else {
      setFiles(prev => prev.map(f => {
        const dotIndex = f.originalName.lastIndexOf('.');
        const extension = dotIndex !== -1 ? f.originalName.substring(dotIndex) : '';
        return {
          ...f,
          name: firstName,
          originalName: `${firstName}${extension}`
        };
      }));
    }

    addLog(`应用当前名称 "${firstName}" 到所有 ${files.length} 个文件`, 'success');
  };

  /**
   * 处理临时名称变更
   */
  const handleTempNameChange = (id: string, newName: string) => {
    setTempNames(prev => ({ ...prev, [id]: newName }));
  };

  /**
   * 保存编辑
   */
  const saveEdits = () => {
    let changeCount = 0;
    setFiles(prev => prev.map(f => {
      const newBaseName = tempNames[f.id];
      if (newBaseName !== undefined && newBaseName !== f.name) {
        const dotIndex = f.originalName.lastIndexOf('.');
        const extension = dotIndex !== -1 ? f.originalName.substring(dotIndex) : '';
        const newFileName = newBaseName + extension;
        changeCount++;

        return {
          ...f,
          name: newBaseName,
          originalName: newFileName
        };
      }
      return f;
    }));

    addLog(`保存编辑: 修改 ${changeCount} 个文件名`, 'success');
    setIsEditing(false);
  };

  /**
   * 取消编辑
   */
  const cancelEdits = () => {
    setIsEditing(false);
    setTempNames({});
    addLog('取消编辑', 'info');
  };

  // ==================== 重命名功能 ====================
  /**
   * 点击"执行重命名"按钮
   */
  const handleExecuteRename = () => {
    const operations = files
      .map(f => {
        const originalFileName = f.path.split(/[\/\\]/).pop() || f.path;
        const dotIndex = originalFileName.lastIndexOf('.');
        const ext = dotIndex !== -1 ? originalFileName.substring(dotIndex) : '';
        const newFileName = f.name + ext;

        return {
          sourcePath: f.path,
          targetName: f.name,
          sourceName: originalFileName,
          hasChanged: originalFileName !== newFileName
        };
      })
      .filter(op => op.hasChanged);

    if (operations.length === 0) {
      addLog('所有文件名未改变，无需重命名', 'warning');
      return;
    }

    addLog(`准备重命名 ${operations.length} 个文件`, 'info');
    setShowPreviewDialog(true);
  };

  /**
   * 确认预览后执行重命名
   */
  const handleConfirmRename = async () => {
    setShowPreviewDialog(false);

    const operations = files
      .map(f => ({
        sourcePath: f.path,
        targetName: f.name
      }))
      .filter(op => {
        const originalFileName = op.sourcePath.split(/[\/\\]/).pop() || op.sourcePath;
        const dotIndex = originalFileName.lastIndexOf('.');
        const ext = dotIndex !== -1 ? originalFileName.substring(dotIndex) : '';
        const newFileName = op.targetName + ext;
        return originalFileName !== newFileName;
      });

    setIsRenaming(true);
    setRenameProgress({ current: 0, total: operations.length });
    addLog(`开始执行重命名, 共 ${operations.length} 个文件`, 'info');

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).api.batchRenameFiles({ operations });
    } catch (error) {
      addLog(`重命名失败: ${(error as Error).message}`, 'error');
      setIsRenaming(false);
    }
  };

  // ==================== 导出功能 ====================
  /**
   * 生成导出内容
   */
  const generatedContent = useMemo(() => {
    if (files.length === 0) return '';

    switch (format) {
      case 'md_list':
        return files.map(f => `- ${f.name}`).join('\n');
      case 'md_table':
        return `| 文件名 |\n| --- |\n${files.map(f => `| ${f.name} |`).join('\n')}`;
      case 'json':
        return JSON.stringify(files.map(f => f.name), null, 2);
      case 'text':
      default:
        return files.map(f => f.name).join('\n');
    }
  }, [files, format]);

  /**
   * 复制到剪贴板
   */
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent).then(() => {
      setCopied(true);
      addLog(`已复制 ${files.length} 个文件名到剪贴板`, 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /**
   * 下载为 TXT 文件
   */
  const downloadAsTxt = () => {
    if (files.length === 0) return;
    const content = generatedContent;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `文件名列表_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`下载文件名列表 (TXT, ${files.length} 个文件)`, 'success');
  };

  // 导出格式选项配置
  const formatOptions: { value: ExportFormat; label: string; icon: React.ElementType }[] = [
    { value: 'text', label: '纯文本', icon: FileText },
    { value: 'md_list', label: 'MD 列表', icon: List },
    { value: 'md_table', label: 'MD 表格', icon: Table },
    { value: 'json', label: 'JSON', icon: Code },
  ];

  return (
    <div className="h-screen bg-black text-slate-100 flex flex-col">
      {/* Header */}
      <PageHeader
        onBack={onBack}
        title="文件名提取"
        icon={FileText}
        iconColor="text-pink-400"
        description="批量提取文件名，一键生成列表"
        featureInfo={{
          title: '文件名提取',
          description: '批量提取视频/图片文件名，支持多种导出格式和批量重命名。',
          details: [
            '支持批量导入任意文件',
            '自动提取文件名（不含扩展名）',
            '多种导出格式：纯文本、Markdown、JSON',
            '支持查找替换和批量添加序号',
            '支持批量重命名文件',
          ],
          themeColor: 'pink',
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：上传和设置区域 */}
        <div className="w-80 border-r border-slate-800 bg-black flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {/* 文件选择 */}
            <FileSelectorGroup>
              <FileSelector
                ref={fileSelectorRef}
                id="fileNameExtractorFiles"
                name="选择文件"
                accept="all"
                multiple
                showList={false}
                themeColor="pink"
                directoryCache
                onChange={handleFilesChange}
                disabled={isRenaming}
              />
            </FileSelectorGroup>

            {/* 导出格式 */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">导出格式</h3>
              <div className="grid grid-cols-2 gap-2">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg text-xs transition-all
                      ${format === opt.value
                        ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                        : 'bg-black/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                      }
                    `}
                  >
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容预览区 */}
            <div className="bg-black/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">内容预览</h3>
                <span className="text-[10px] text-slate-500">{generatedContent.length} 字符</span>
              </div>
              <textarea
                className="w-full h-32 bg-black/50 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 resize-none focus:outline-none focus:border-pink-500/50 custom-scrollbar"
                value={generatedContent}
                readOnly
                placeholder="导入文件后在此处预览..."
              />
            </div>

            {/* 操作按钮 */}
            <div className="space-y-2">
              <Button
                onClick={copyToClipboard}
                disabled={files.length === 0}
                variant="primary"
                size="md"
                fullWidth
                themeColor="pink"
                leftIcon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? '已复制' : '一键复制全部'}
              </Button>

              <button
                onClick={clearAll}
                disabled={files.length === 0}
                className="w-full py-2.5 rounded-xl text-sm text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                清空列表
              </button>
            </div>
          </div>
        </div>

        {/* 中间：文件列表 */}
        <div className="flex-1 bg-black flex flex-col overflow-hidden min-w-0">
          {/* 文件列表头部 */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-black/50 shrink-0">
            <h2 className="font-bold text-sm text-slate-300 flex items-center gap-2">
              <FileIcon className="w-4 h-4 text-pink-400" />
              文件列表
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{files.length}</span>
            </h2>
            {files.length > 0 && !isEditing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSequencePanel}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    showSequencePanel
                      ? 'bg-pink-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title="批量增加序号"
                >
                  <Hash className="w-3.5 h-3.5" />
                  序号
                </button>
                <button
                  onClick={toggleReplacePanel}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    showReplacePanel
                      ? 'bg-pink-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title="批量替换文字"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  替换
                </button>
                <button
                  onClick={downloadAsTxt}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                  title="下载为 TXT 文件"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载
                </button>
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  编辑
                </button>
                <Button
                  onClick={handleExecuteRename}
                  disabled={isRenaming}
                  variant="primary"
                  size="sm"
                  themeColor="pink"
                  leftIcon={isRenaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                >
                  {isRenaming ? '重命名中...' : '执行重命名'}
                </Button>
              </div>
            )}
          </div>

          {/* 批量替换面板 */}
          {showReplacePanel && (
            <div className="mx-4 my-3 p-4 bg-pink-500/5 border border-pink-500/20 rounded-xl shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xs text-pink-400 flex items-center gap-2">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  批量文字替换
                </h3>
                <button
                  onClick={() => setShowReplacePanel(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] text-slate-500">查找内容</label>
                  <input
                    type="text"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="输入要查找的文字..."
                    className="w-full bg-black/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 text-white"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] text-slate-500">替换为</label>
                  <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="输入替换后的文字..."
                    className="w-full bg-black/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 text-white"
                  />
                </div>
                <Button
                  onClick={handleReplaceAll}
                  disabled={!findText}
                  variant="primary"
                  size="sm"
                  themeColor="pink"
                >
                  全部替换
                </Button>
              </div>
            </div>
          )}

          {/* 批量序号面板 */}
          {showSequencePanel && (
            <div className="mx-4 my-3 p-4 bg-pink-500/5 border border-pink-500/20 rounded-xl shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xs text-pink-400 flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5" />
                  批量增加序号
                </h3>
                <button
                  onClick={() => setShowSequencePanel(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-3 items-end">
                <div className="w-20 space-y-1">
                  <label className="text-[10px] text-slate-500">分隔符</label>
                  <input
                    type="text"
                    value={sequenceDelimiter}
                    onChange={(e) => setSequenceDelimiter(e.target.value)}
                    placeholder="-"
                    className="w-full bg-black/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 text-white text-center"
                  />
                </div>
                <div className="w-28 space-y-1">
                  <label className="text-[10px] text-slate-500">第 N 个分隔符左侧</label>
                  <input
                    type="number"
                    min="1"
                    value={sequenceIndex}
                    onChange={(e) => setSequenceIndex(parseInt(e.target.value) || 1)}
                    className="w-full bg-black/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 text-white text-center"
                  />
                </div>
                <div className="flex-1 text-[10px] text-slate-500 pb-2">
                  序号将根据文件顺序（1, 2, 3...）自动生成
                </div>
                <Button
                  onClick={handleApplySequence}
                  variant="primary"
                  size="sm"
                  themeColor="pink"
                >
                  应用序号
                </Button>
              </div>
            </div>
          )}

          {/* 提示信息 - 固定在滚动容器外部 */}
          {files.length > 0 && !isRenaming && (
            <div className="px-4 py-3 border-b border-slate-800/50 bg-black/50 shrink-0">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-pink-500/20 rounded-lg text-pink-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-pink-300 mb-1">批量重命名文件：</p>
                  <p className="text-slate-400 leading-relaxed">
                    1. 点击上方「编辑」「替换」或「序号」修改文件名<br/>
                    2. 确认无误后点击「执行重命名」按钮
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 文件列表内容 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* 进度显示 */}
            {isRenaming && (
              <div className="mx-4 my-3 p-4 bg-pink-500/10 border border-pink-500/20 rounded-xl shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-pink-300">正在重命名...</span>
                  <span className="text-xs text-pink-400">{renameProgress.current} / {renameProgress.total}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-rose-500 h-full transition-all duration-300"
                    style={{ width: `${(renameProgress.current / renameProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                  <FileIcon className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-xs">暂无文件，请先导入</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-black z-10">
                  <tr className="border-b border-slate-800 text-slate-500 text-xs">
                    <th className="p-3 font-medium w-12">#</th>
                    <th className="p-3 font-medium">文件名</th>
                    <th className="p-3 font-medium w-16 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <tr key={file.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors group">
                      <td className="p-3 text-slate-600 font-mono text-xs">{index + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            {isEditing ? (
                              <input
                                type="text"
                                value={tempNames[file.id] ?? file.name}
                                onChange={(e) => handleTempNameChange(file.id, e.target.value)}
                                className="w-full bg-black/50 border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-pink-500/50 text-sm text-slate-200"
                                autoFocus={index === 0}
                              />
                            ) : (
                              <span className="text-sm text-slate-200 select-all">{file.name}</span>
                            )}
                          </div>
                          {index === 0 && files.length > 1 && !isEditing && (
                            <button
                              onClick={applyFirstNameToAll}
                              className="flex items-center gap-1 px-2 py-1 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded text-[10px] font-medium border border-pink-500/20 transition-all whitespace-nowrap"
                              title="将此名称应用到后续所有文件"
                            >
                              <CopyCheck className="w-3 h-3" />
                              应用当前
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {!isEditing && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="移除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 编辑模式底部操作栏 */}
          {isEditing && (
            <div className="px-4 py-3 border-t border-slate-800 bg-black/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={cancelEdits}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
              >
                取消
              </button>
              <Button
                onClick={saveEdits}
                variant="primary"
                size="sm"
                themeColor="pink"
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                保存修改
              </Button>
            </div>
          )}
        </div>

        {/* 右侧：日志 */}
        <div className="w-80 border-l border-slate-800 bg-black flex flex-col shrink-0 overflow-y-hidden">
          <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar p-4">
            <OperationLogPanel
              logs={logs}
              addLog={addLog}
              clearLogs={clearLogs}
              copyLogs={copyLogs}
              downloadLogs={downloadLogs}
              logsContainerRef={logsContainerRef}
              logsEndRef={logsEndRef}
              autoScrollEnabled={autoScrollEnabled}
              setAutoScrollEnabled={setAutoScrollEnabled}
              autoScrollPaused={autoScrollPaused}
              resumeAutoScroll={resumeAutoScroll}
              scrollToBottom={scrollToBottom}
              scrollToTop={scrollToTop}
              onUserInteractStart={onUserInteractStart}
              themeColor="pink"
            />
          </div>
        </div>
      </div>

      {/* 预览确认对话框 */}
      <PreviewConfirmDialog
        open={showPreviewDialog}
        changes={files.map(f => {
          const originalFileName = f.path.split(/[\/\\]/).pop() || f.path;
          return {
            sourcePath: f.path,
            targetName: f.name,
            sourceName: originalFileName
          };
        }).filter(change => {
          const dotIndex = change.sourceName.lastIndexOf('.');
          const ext = dotIndex !== -1 ? change.sourceName.substring(dotIndex) : '';
          const newFileName = change.targetName + ext;
          return change.sourceName !== newFileName;
        })}
        onClose={() => setShowPreviewDialog(false)}
        onConfirm={handleConfirmRename}
      />
    </div>
  );
};

export default FileNameExtractorMode;
