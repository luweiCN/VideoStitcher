import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ArrowLeft, Upload, Copy, FileVideo, Check, Trash2, FileText, List, Table, Code, Edit2, Save, X, Download, ArrowRightLeft, File as FileIcon, FolderOpen, Loader2, AlertCircle, Hash, CopyCheck, Eye } from 'lucide-react';
import PreviewConfirmDialog from '../components/PreviewConfirmDialog';
import PageHeader from '../components/PageHeader';
import InlineMediaPreview from '../components/InlineMediaPreview';
import MediaPreviewModal from '../components/MediaPreviewModal';

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
  const [isDragging, setIsDragging] = useState(false);
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
  const [platform, setPlatform] = useState<string>('unknown');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重命名相关状态
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameProgress, setRenameProgress] = useState({ current: 0, total: 0 });
  const [renameResults, setRenameResults] = useState<{ success: number; failed: number } | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // 预览相关状态
  const [previewFile, setPreviewFile] = useState<VideoFile | null>(null);

  // 获取系统平台信息
  useEffect(() => {
    const getPlatformInfo = async () => {
      try {
        const info = await window.api.getPlatform();
        setPlatform(info.platform);
      } catch {
        // 默认使用 unknown
        setPlatform('unknown');
      }
    };
    getPlatformInfo();
  }, []);

  // 监听文件重命名进度事件
  useEffect(() => {
    const cleanupProgress = window.api.onFileProgress((data) => {
      setRenameProgress({ current: data.index + 1, total: data.total });
    });

    const cleanupComplete = window.api.onFileComplete((results) => {
      setRenameResults({ success: results.success, failed: results.failed });
      setIsRenaming(false);
      // 重命名成功后更新文件路径
      if (results.success > 0 && results.failed === 0) {
        // 更新文件路径为重命名后的新路径
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
  }, []);

  // ==================== 拖拽处理 ====================
  /**
   * 处理拖拽悬停事件
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  /**
   * 处理拖拽离开事件
   */
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  /**
   * 处理文件拖放事件
   * 注意：在 Electron 中拖放获取的是文件路径，需要特殊处理
   */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // 获取拖放的文件路径
    const filePaths = Array.from(e.dataTransfer.files).map(file => {
      return (file as any).path || file.name;
    });

    if (filePaths.length > 0) {
      addFilesByPaths(filePaths);
    }
  };

  /**
   * 处理文件选择对话框
   */
  const handleSelectFiles = async () => {
    try {
      const selectedFiles = await window.api.pickFiles('选择视频或图片文件', [
        { name: 'Media Files', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi', 'jpg', 'jpeg', 'png', 'webp'] }
      ]);
      if (selectedFiles.length > 0) {
        addFilesByPaths(selectedFiles);
      }
    } catch (err) {
      console.error('选择文件失败:', err);
    }
  };

  // ==================== 文件处理 ====================
  /**
   * 根据文件路径数组添加文件
   */
  const addFilesByPaths = (filePaths: string[]) => {
    const newVideoFiles: VideoFile[] = filePaths.map(path => {
      // 提取文件名（不含扩展名）
      // 兼容 Windows (\) 和 Unix (/) 路径分隔符
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
  };

  /**
   * 移除单个文件
   */
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
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
    setFiles([]);
    setIsEditing(false);
    setTempNames({});
    setShowReplacePanel(false);
    setShowSequencePanel(false);
    setFindText('');
    setReplaceText('');
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

    setFiles(prev => prev.map(f => {
      // 使用 split/join 替代 replaceAll 以兼容旧版本 Node.js
      const newBaseName = f.name.split(findText).join(replaceText);
      if (newBaseName !== f.name) {
        const dotIndex = f.originalName.lastIndexOf('.');
        const extension = dotIndex !== -1 ? f.originalName.substring(dotIndex) : '';
        const newFileName = newBaseName + extension;

        return {
          ...f,
          name: newBaseName,
          originalName: newFileName
        };
      }
      return f;
    }));

    setShowReplacePanel(false);
    setFindText('');
    setReplaceText('');
  };

  /**
   * 处理批量添加序号
   */
  const handleApplySequence = () => {
    if (!sequenceDelimiter || sequenceIndex <= 0) return;

    setFiles(prev => prev.map((f, i) => {
      const parts = f.name.split(sequenceDelimiter);
      if (parts.length < sequenceIndex) return f;

      const sequenceNum = (i + 1).toString();
      // 在第 N 个分隔符左侧增加序号
      // 例如 index 为 8，则在 parts[7] 后面增加序号
      parts[sequenceIndex - 1] = parts[sequenceIndex - 1] + sequenceNum;
      
      const newBaseName = parts.join(sequenceDelimiter);
      if (newBaseName !== f.name) {
        const dotIndex = f.originalName.lastIndexOf('.');
        const extension = dotIndex !== -1 ? f.originalName.substring(dotIndex) : '';
        const newFileName = newBaseName + extension;

        return {
          ...f,
          name: newBaseName,
          originalName: newFileName
        };
      }
      return f;
    }));

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
    setFiles(prev => prev.map(f => {
      const newBaseName = tempNames[f.id];
      if (newBaseName !== undefined && newBaseName !== f.name) {
        const dotIndex = f.originalName.lastIndexOf('.');
        const extension = dotIndex !== -1 ? f.originalName.substring(dotIndex) : '';
        const newFileName = newBaseName + extension;

        return {
          ...f,
          name: newBaseName,
          originalName: newFileName
        };
      }
      return f;
    }));
    setIsEditing(false);
  };

  /**
   * 取消编辑
   */
  const cancelEdits = () => {
    setIsEditing(false);
    setTempNames({});
  };

  // ==================== 重命名功能 ====================
  /**
   * 点击"执行重命名"按钮
   * 收集需要重命名的文件并显示预览对话框
   */
  const handleExecuteRename = () => {
    // 收集需要重命名的文件
    const operations = files
      .map(f => {
        // 从完整路径中提取原始文件名
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
      alert('所有文件名未改变，无需重命名');
      return;
    }

    // 显示预览对话框
    setShowPreviewDialog(true);
  };

  /**
   * 确认预览后执行重命名
   */
  const handleConfirmRename = async () => {
    setShowPreviewDialog(false);

    // 收集需要重命名的文件
    const operations = files
      .map(f => ({
        sourcePath: f.path,
        targetName: f.name
      }))
      .filter(op => {
        // 检查是否真的需要重命名
        const originalFileName = op.sourcePath.split(/[\/\\]/).pop() || op.sourcePath;
        const dotIndex = originalFileName.lastIndexOf('.');
        const ext = dotIndex !== -1 ? originalFileName.substring(dotIndex) : '';
        const newFileName = op.targetName + ext;
        return originalFileName !== newFileName;
      });

    setIsRenaming(true);
    setRenameProgress({ current: 0, total: operations.length });
    setRenameResults(null);

    try {
      await window.api.batchRenameFiles({ operations });
    } catch (error) {
      console.error('重命名失败:', error);
      alert('重命名失败：' + (error as Error).message);
      setIsRenaming(false);
    }
  };

  // ==================== 导出功能 ====================
  /**
   * 生成导出内容（根据选择的格式）
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
  };

  // 导出格式选项配置
  const formatOptions: { value: ExportFormat; label: string; icon: React.ElementType }[] = [
    { value: 'text', label: '纯文本 (Excel)', icon: FileText },
    { value: 'md_list', label: 'Markdown 列表', icon: List },
    { value: 'md_table', label: 'Markdown 表格', icon: Table },
    { value: 'json', label: 'JSON 格式', icon: Code },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Header */}
      <PageHeader
        onBack={onBack}
        title="文件名提取"
        icon={FileText}
        iconColor="text-pink-400"
        description="批量提取视频/图片文件名，一键生成列表"
      />

      <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：上传和设置区域 */}
        <div className="lg:col-span-1 space-y-6 flex flex-col h-[calc(100vh-140px)]">
          {/* 上传区域 */}
          <div
            className={`
              border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer flex-shrink-0
              flex flex-col items-center justify-center gap-3 h-48
              ${isDragging
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-800 bg-slate-900/50 hover:border-indigo-500/50 hover:bg-slate-900'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleSelectFiles}
          >
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium">点击或拖拽文件</p>
              <p className="text-slate-400 text-xs mt-1">支持批量导入</p>
            </div>
          </div>

          {/* 控制面板 */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col flex-1 min-h-0">
            {/* 导出格式选择 */}
            <div className="mb-4 flex-shrink-0">
              <label className="text-sm font-medium text-slate-400 mb-3 block">导出格式</label>
              <div className="grid grid-cols-2 gap-2">
                {formatOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    className={`
                      flex items-center gap-2 p-2 rounded-lg text-sm transition-all
                      ${format === opt.value
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/50'
                        : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                      }
                    `}
                  >
                    <opt.icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容预览区 */}
            <div className="flex-1 min-h-0 mb-4 flex flex-col">
              <label className="text-sm font-medium text-slate-400 mb-2 flex items-center justify-between">
                <span>内容预览</span>
                <span className="text-xs text-slate-500">{generatedContent.length} 字符</span>
              </label>
              <textarea
                className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-sm text-slate-300 resize-none focus:outline-none focus:border-indigo-500/50 custom-scrollbar"
                value={generatedContent}
                readOnly
                placeholder="导入文件后在此处预览..."
              />
            </div>

            {/* 操作按钮组 */}
            <div className="space-y-3 flex-shrink-0">
              <button
                onClick={copyToClipboard}
                disabled={files.length === 0}
                className={`
                  w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                  ${files.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02]'
                  }
                `}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? '已复制' : '一键复制全部'}
              </button>

              <button
                onClick={clearAll}
                disabled={files.length === 0}
                className="w-full py-3 rounded-xl font-medium text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                清空列表
              </button>
            </div>
          </div>
        </div>

        {/* 右侧：文件列表 */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
          {/* 文件列表头部 */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <FileIcon className="w-5 h-5 text-indigo-400" />
              文件列表
              <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{files.length}</span>
            </h2>
            {files.length > 0 && !isEditing && (
              <div className="flex items-center gap-3">
                {/* 左侧工具按钮 */}
                <div className="flex gap-2">
                  <button
                    onClick={toggleSequencePanel}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                      ${showSequencePanel
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                      }
                    `}
                    title="批量增加序号"
                  >
                    <Hash className="w-4 h-4" />
                    序号
                  </button>
                  <button
                    onClick={toggleReplacePanel}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
                      ${showReplacePanel
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                      }
                    `}
                    title="批量替换文字"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    替换
                  </button>
                  <button
                    onClick={downloadAsTxt}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
                    title="下载为 TXT 文件"
                  >
                    <Download className="w-4 h-4" />
                    下载TXT
                  </button>
                  <button
                    onClick={startEditing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    编辑名称
                  </button>
                </div>

                {/* 右侧执行按钮 */}
                {/* 执行重命名按钮 */}
                <button
                  onClick={handleExecuteRename}
                  disabled={isRenaming}
                  className={`
                    flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all
                    ${isRenaming
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    }
                  `}
                >
                  {isRenaming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      重命名中...
                    </>
                  ) : (
                    '执行重命名'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 批量替换面板 */}
          {showReplacePanel && (
            <div className="mx-6 mb-4 p-4 bg-slate-800/50 border border-indigo-500/30 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  批量文字替换
                </h3>
                <button
                  onClick={() => setShowReplacePanel(false)}
                  className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-slate-400 ml-1">查找内容</label>
                  <input
                    type="text"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="输入要查找的文字..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-slate-400 ml-1">替换为</label>
                  <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="输入替换后的文字..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
                <button
                  onClick={handleReplaceAll}
                  disabled={!findText}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] h-[38px]"
                >
                  全部替换
                </button>
              </div>
            </div>
          )}

          {/* 批量序号面板 */}
          {showSequencePanel && (
            <div className="mx-6 mb-4 p-4 bg-slate-800/50 border border-indigo-500/30 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  批量增加序号
                </h3>
                <button
                  onClick={() => setShowSequencePanel(false)}
                  className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-4 items-end">
                <div className="w-24 space-y-1">
                  <label className="text-xs text-slate-400 ml-1">分隔符</label>
                  <input
                    type="text"
                    value={sequenceDelimiter}
                    onChange={(e) => setSequenceDelimiter(e.target.value)}
                    placeholder="例如: -"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white text-center"
                  />
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-xs text-slate-400 ml-1">在第 N 个分隔符左侧</label>
                  <input
                    type="number"
                    min="1"
                    value={sequenceIndex}
                    onChange={(e) => setSequenceIndex(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white text-center"
                  />
                </div>
                <div className="flex-1 text-xs text-slate-500 pb-2 italic">
                  说明：序号将根据文件在列表中的顺序（1, 2, 3...）自动生成并插入。
                </div>
                <button
                  onClick={handleApplySequence}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] h-[38px]"
                >
                  应用序号
                </button>
              </div>
            </div>
          )}

          {/* 文件列表内容 */}
          <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
            {/* 进度显示 */}
            {isRenaming && (
              <div className="mx-6 mt-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-indigo-300">
                    正在重命名...
                  </span>
                  <span className="text-sm text-indigo-400">
                    {renameProgress.current} / {renameProgress.total}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${(renameProgress.current / renameProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 完成结果显示 */}
            {renameResults && !isRenaming && (
              <div className={`mx-6 mt-4 p-4 border rounded-2xl flex items-start gap-3 ${renameResults.failed === 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className={`p-1.5 rounded-lg ${renameResults.failed === 0 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  {renameResults.failed === 0 ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                </div>
                <div className="text-xs flex-1">
                  <p className={`font-bold mb-1 ${renameResults.failed === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {renameResults.failed === 0 ? '✅ 重命名完成！' : '⚠️ 重命名部分完成'}
                  </p>
                  <p className="text-slate-300">
                    成功: <span className="text-emerald-400 font-bold">{renameResults.success}</span>
                    {renameResults.failed > 0 && <> 失败: <span className="text-rose-400 font-bold">{renameResults.failed}</span></>}
                  </p>
                </div>
              </div>
            )}

            {files.length > 0 && !renameResults && (
              <div className="p-4 bg-indigo-500/10 border-b border-indigo-500/20 flex items-start gap-3">
                <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-500">
                  <Code className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-indigo-300 mb-1">💡 批量重命名文件：</p>
                  <p className="text-indigo-200/70 leading-relaxed">
                    1. 点击右上角 <strong className="text-indigo-400">"编辑名称"</strong>、<strong className="text-indigo-400">"替换"</strong> 或 <strong className="text-indigo-400">"序号"</strong> 修改文件名。<br />
                    2. 确认无误后点击 <strong className="text-indigo-400">"执行重命名"</strong> 按钮。<br />
                    3. 重命名完成后可点击 <strong className="text-indigo-400">"撤销"</strong> 按钮恢复原始文件名。
                  </p>
                </div>
              </div>
            )}

            {files.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center">
                  <FileIcon className="w-10 h-10 opacity-50" />
                </div>
                <p>暂无文件，请先导入</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 z-10 shadow-sm">
                  <tr className="border-b border-slate-800 text-slate-400 text-sm">
                    <th className="p-4 font-medium w-16">#</th>
                    <th className="p-4 font-medium w-24">预览</th>
                    <th className="p-4 font-medium">文件名</th>
                    <th className="p-4 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <tr key={file.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4 text-slate-500 font-mono text-sm">{index + 1}</td>
                      <td className="p-4">
                        <InlineMediaPreview 
                          filePath={file.path} 
                          onClick={() => setPreviewFile(file)} 
                        />
                      </td>
                      <td className="p-4 font-medium text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            {isEditing ? (
                              <input
                                type="text"
                                value={tempNames[file.id] ?? file.name}
                                onChange={(e) => handleTempNameChange(file.id, e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500/50 text-sm transition-all"
                                autoFocus={index === 0}
                              />
                            ) : (
                              <span className="select-all">{file.name}</span>
                            )}
                          </div>
                          {index === 0 && files.length > 1 && (
                            <button
                              onClick={applyFirstNameToAll}
                              className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-md text-xs font-medium border border-indigo-500/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                              title="将此名称应用到后续所有文件"
                            >
                              <CopyCheck className="w-3.5 h-3.5" />
                              应用当前
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        {!isEditing && (
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="移除"
                          >
                            <Trash2 className="w-4 h-4" />
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
            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={cancelEdits}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={saveEdits}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                保存修改
              </button>
            </div>
          )}
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

      {/* 媒体预览弹窗 */}
      <MediaPreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        filePath={previewFile?.path || ''}
        fileName={previewFile?.name || ''}
      />
    </div>
  );
};

export default FileNameExtractorMode;
