import React, { useEffect, useState } from 'react';
import { X, Play, Maximize2, FileVideo, ImageIcon, Film } from 'lucide-react';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({ isOpen, onClose, filePath, fileName }) => {
  const [fileInfo, setFileInfo] = useState<{ type: string; ext: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && filePath) {
      setLoading(true);
      window.api.getFileInfo(filePath).then(res => {
        if (res.success && res.info) {
          setFileInfo({ type: res.info.type, ext: res.info.ext });
        }
        setLoading(false);
      });
    }
  }, [isOpen, filePath]);

  if (!isOpen) return null;

  const previewUrl = `preview://${encodeURIComponent(filePath)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              {fileInfo?.type === 'video' ? <FileVideo className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <h3 className="font-bold text-lg text-white truncate pr-4">{fileName}{fileInfo?.ext}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-black/40 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <span className="text-slate-400 text-sm">加载中...</span>
            </div>
          ) : (
            <>
              {fileInfo?.type === 'video' ? (
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-[calc(90vh-140px)] object-contain shadow-2xl"
                />
              ) : fileInfo?.type === 'image' ? (
                <img
                  src={previewUrl}
                  alt={fileName}
                  className="max-w-full max-h-[calc(90vh-140px)] object-contain shadow-2xl"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-slate-500">
                  <Film className="w-16 h-16 opacity-20" />
                  <p>该文件格式不支持预览</p>
                  <p className="text-xs">{filePath}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer / Info */}
        <div className="p-4 bg-slate-900/80 border-t border-slate-800 text-xs text-slate-500 flex justify-between items-center">
          <span className="truncate flex-1 mr-4">路径: {filePath}</span>
          <span className="whitespace-nowrap uppercase bg-slate-800 px-2 py-1 rounded">{fileInfo?.ext?.replace('.', '') || 'UNKNOWN'}</span>
        </div>
      </div>
    </div>
  );
};

export default MediaPreviewModal;
