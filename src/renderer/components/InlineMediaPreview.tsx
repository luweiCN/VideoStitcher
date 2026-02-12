import React, { useEffect, useState } from 'react';
import { Play, ImageIcon, FileVideo, Film } from 'lucide-react';

interface InlineMediaPreviewProps {
  filePath: string;
  onClick: () => void;
}

const InlineMediaPreview: React.FC<InlineMediaPreviewProps> = ({ filePath, onClick }) => {
  const [fileInfo, setFileInfo] = useState<{ type: string; ext: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    window.api.getFileInfo(filePath).then(res => {
      if (isMounted) {
        if (res.success && res.info) {
          setFileInfo({ type: res.info.type, ext: res.info.ext });
        }
        setLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [filePath]);

  const previewUrl = `preview://${encodeURIComponent(filePath)}`;

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="relative w-16 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 cursor-pointer group hover:border-indigo-500/50 transition-all flex-shrink-0"
    >
      {loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-3 h-3 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : fileInfo?.type === 'video' ? (
        <div className="w-full h-full relative">
          <video 
            src={previewUrl} 
            className="w-full h-full object-cover"
            onLoadedMetadata={(e) => {
              // 跳转到第一秒以显示预览帧
              (e.target as HTMLVideoElement).currentTime = 0.1;
            }}
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <Play className="w-4 h-4 text-white opacity-80 group-hover:scale-110 transition-transform shadow-sm" />
          </div>
          <div className="absolute bottom-0 right-0 p-0.5 bg-black/60 rounded-tl-sm">
            <FileVideo className="w-2.5 h-2.5 text-indigo-400" />
          </div>
        </div>
      ) : fileInfo?.type === 'image' ? (
        <div className="w-full h-full relative">
          <img src={previewUrl} className="w-full h-full object-cover" alt="preview" />
          <div className="absolute inset-0 group-hover:bg-black/10 transition-colors" />
          <div className="absolute bottom-0 right-0 p-0.5 bg-black/60 rounded-tl-sm">
            <ImageIcon className="w-2.5 h-2.5 text-emerald-400" />
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Film className="w-4 h-4 text-slate-600" />
        </div>
      )}
      
      {/* Hover overlay hint */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/10 pointer-events-none">
        <div className="bg-indigo-500 text-white text-[8px] font-bold px-1 rounded shadow-lg">点击预览</div>
      </div>
    </div>
  );
};

export default InlineMediaPreview;
