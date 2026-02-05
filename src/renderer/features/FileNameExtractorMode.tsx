import React, { useState } from 'react';
import { FileVideo, Copy, Download, ArrowLeft, FolderOpen, Trash2, CheckCircle } from 'lucide-react';

interface FileNameExtractorModeProps {
  onBack: () => void;
}

const FileNameExtractorMode: React.FC<FileNameExtractorModeProps> = ({ onBack }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const handleSelectFiles = async () => {
    try {
      const selectedFiles = await window.api.pickFiles('选择视频或图片文件', [
        { name: 'Media Files', extensions: ['mp4', 'mov', 'mkv', 'm4v', 'avi', 'jpg', 'jpeg', 'png', 'webp'] }
      ]);
      if (selectedFiles.length > 0) {
        setFiles(selectedFiles);
        const names = selectedFiles.map(file => file.split('/').pop() || file);
        setFileNames(names);
      }
    } catch (err) {
      console.error('选择文件失败:', err);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setFileNames([]);
  };

  const copyToClipboard = async () => {
    if (fileNames.length === 0) return;

    const text = fileNames.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const downloadAsTxt = () => {
    if (fileNames.length === 0) return;

    const content = fileNames.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `文件名列表_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRenameScript = () => {
    if (files.length === 0) return;

    const scriptContent = files.map((oldPath, index) => {
      const oldName = oldPath.split('/').pop() || oldPath;
      const newName = fileNames[index];
      return `mv "${oldName}" "${newName}"`;
    }).join('\n');

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `重命名脚本_${new Date().toISOString().slice(0, 10)}.sh`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>
        <h1 className="text-2xl font-bold text-pink-400">视频/图片文件名提取</h1>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* File Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium mb-1">选择文件</h2>
              <p className="text-sm text-slate-400">支持批量选择视频和图片文件</p>
            </div>
            <div className="flex items-center gap-2">
              {files.length > 0 && (
                <button
                  onClick={clearFiles}
                  className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                  title="清空"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleSelectFiles}
                className="flex items-center gap-2 px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/30 transition-colors"
              >
                <FolderOpen className="w-5 h-5" />
                选择文件
              </button>
            </div>
          </div>

          {files.length > 0 && (
            <div className="text-sm text-slate-400">
              已选择 {files.length} 个文件
            </div>
          )}
        </div>

        {/* Results */}
        {fileNames.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">提取的文件名 ({fileNames.length} 个)</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                >
                  <Copy className="w-4 h-4" />
                  {showCopySuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      已复制
                    </>
                  ) : (
                    '复制列表'
                  )}
                </button>
                <button
                  onClick={downloadAsTxt}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  下载TXT
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-lg p-4 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="pb-2">序号</th>
                    <th className="pb-2">文件名</th>
                  </tr>
                </thead>
                <tbody>
                  {fileNames.map((name, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-2 text-slate-500">{i + 1}</td>
                      <td className="py-2 font-mono">{name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Export Options */}
        {files.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">导出选项</h2>
            <div className="space-y-3">
              <button
                onClick={downloadRenameScript}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                下载重命名脚本 (.sh)
              </button>
              <p className="text-xs text-slate-500 text-center">
                生成 Shell 脚本，可用于批量重命名文件
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <FileVideo className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">请先选择要提取文件名的文件</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileNameExtractorMode;
