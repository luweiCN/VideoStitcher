import React, { useState, useEffect } from 'react';
import { FileVideo, Image as ImageIcon, File } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { FileItem } from './FileSelector';
import { formatFileSize, formatDuration } from '../../utils/format';

// ============================================================================
// 工具函数
// ============================================================================

// ============================================================================
// 类型定义
// ============================================================================

interface FileTooltipContentProps {
  /** 文件信息 */
  file: FileItem;
  /** 文件信息更新回调（用于缓存） */
  onInfoUpdate?: (updatedInfo: FileItem) => void;
}

// ============================================================================
// 文件类型颜色配置
// ============================================================================

interface TypeColorConfig {
  bg: string;
  border: string;
  icon: string;
  label: string;
}

const getFileTypeColor = (type: 'video' | 'image' | 'unknown'): TypeColorConfig => {
  if (type === 'video') return {
    bg: 'from-rose-500/20 to-rose-600/10',
    border: 'border-rose-500/30',
    icon: 'text-rose-400',
    label: 'text-rose-300'
  };
  if (type === 'image') return {
    bg: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    label: 'text-emerald-300'
  };
  return {
    bg: 'from-gray-500/20 to-gray-400/10',
    border: 'border-slate-500/30',
    icon: 'text-slate-400',
    label: 'text-slate-100'
  };
};

// ============================================================================
// 主组件
// ============================================================================

/**
 * 文件信息 Tooltip 内容组件
 *
 * 特点：
 * - 懒加载：首次悬浮时才获取文件信息
 * - 缓存：已加载的信息会被缓存
 * - 并行获取：同时获取文件大小和尺寸信息
 */
export const FileTooltipContent: React.FC<FileTooltipContentProps> = ({
  file,
  onInfoUpdate
}) => {
  const [loading, setLoading] = useState(true);
  const [fileInfo, setFileInfo] = useState<FileItem>(file);

  useEffect(() => {
    // 如果已经加载过，直接使用缓存
    if (file._infoLoaded) {
      setFileInfo(file);
      setLoading(false);
      return;
    }

    setLoading(true);

    if (file.type === 'video') {
      // 视频文件：使用 getVideoFullInfo 获取完整信息（缩略图 + 尺寸 + 时长）
      window.api.getVideoFullInfo(file.path, { thumbnailMaxSize: 200 })
        .then((result) => {
          if (result.success) {
            const updatedInfo: FileItem = {
              ...file,
              _infoLoaded: true,
              size: result.fileSize,
              dimensions: result.width && result.height ? `${result.width}x${result.height}` : undefined,
              orientation: result.orientation,
              aspectRatio: result.aspectRatio,
              thumbnail: result.thumbnail,
              duration: result.duration,
            };
            setFileInfo(updatedInfo);
            onInfoUpdate?.(updatedInfo);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else if (file.type === 'image') {
      // 图片文件：使用 getImageFullInfo 获取完整信息（缩略图 + 尺寸 + 文件大小）
      window.api.getImageFullInfo(file.path, { thumbnailMaxSize: 300 })
        .then((result) => {
          if (result.success) {
            const updatedInfo: FileItem = {
              ...file,
              _infoLoaded: true,
              size: result.fileSize,
              dimensions: result.width && result.height ? `${result.width}x${result.height}` : undefined,
              orientation: result.orientation,
              aspectRatio: result.aspectRatio,
              thumbnail: result.thumbnail,
            };
            setFileInfo(updatedInfo);
            onInfoUpdate?.(updatedInfo);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      // 未知类型：只获取文件大小
      window.api.getFileInfo(file.path).then((result) => {
        const updatedInfo: FileItem = {
          ...file,
          _infoLoaded: true,
          size: result.success && result.info ? result.info.size : undefined
        };
        setFileInfo(updatedInfo);
        setLoading(false);
        onInfoUpdate?.(updatedInfo);
      });
    }
  }, [file.path, file.type, file._infoLoaded, onInfoUpdate]);

  const typeColor = getFileTypeColor(fileInfo.type);

  // 判断是否有媒体信息（尺寸或方向）
  const hasMediaInfo = !!(fileInfo.dimensions || fileInfo.orientation || fileInfo.aspectRatio);

  return (
    <Tooltip.Portal>
      <Tooltip.Content
        className="z-50 w-80 overflow-hidden rounded-2xl bg-black backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/50 data-state-closed:animate-hide data-state-open:animate-in"
        sideOffset={-5}
        side="left"
        align="start"
      >
        <Tooltip.Arrow className="fill-slate-700" />

        {/* 头部 - 文件名区域 */}
        <div className={`px-4 py-3 bg-gradient-to-r ${typeColor.bg} border-b border-slate-700/50`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${typeColor.bg} flex items-center justify-center border ${typeColor.border} shrink-0`}>
              {fileInfo.type === 'video' && <FileVideo className={`w-5 h-5 ${typeColor.icon}`} />}
              {fileInfo.type === 'image' && <ImageIcon className={`w-5 h-5 ${typeColor.icon}`} />}
              {fileInfo.type !== 'video' && fileInfo.type !== 'image' && <File className={`w-5 h-5 ${typeColor.icon}`} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 truncate leading-tight">{fileInfo.name}</h3>
              <p className={`text-xs ${typeColor.label} mt-0.5`}>
                {fileInfo.type === 'video' ? '视频文件' : fileInfo.type === 'image' ? '图片文件' : '文件'}
              </p>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-4">
          {/* 加载状态 */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500">加载信息中...</p>
              </div>
            </div>
          ) : (
            <>
              {/* 关键信息网格 - 只在有媒体信息时显示 */}
              {hasMediaInfo ? (
                <div className={`grid gap-2 mb-3 ${fileInfo.size !== undefined ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {/* 尺寸 */}
                  {fileInfo.dimensions && (
                    <div className="bg-black/50 rounded-lg px-2 py-2 border border-slate-700/50 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">尺寸</p>
                      <p className="text-xs font-semibold text-cyan-400 font-mono leading-tight break-all">{fileInfo.dimensions}</p>
                    </div>
                  )}
                  {/* 大小 */}
                  {fileInfo.size !== undefined && (
                    <div className="bg-black/50 rounded-lg px-2 py-2 border border-slate-700/50 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">大小</p>
                      <p className="text-xs font-semibold text-slate-100 leading-tight">{formatFileSize(fileInfo.size)}</p>
                    </div>
                  )}
                  {/* 方向 */}
                  {fileInfo.orientation && (
                    <div className="bg-black/50 rounded-lg px-2 py-2 border border-slate-700/50 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">方向</p>
                      <p className="text-xs font-semibold text-slate-100 leading-tight">
                        {fileInfo.orientation === 'landscape' ? '横版' : fileInfo.orientation === 'portrait' ? '竖版' : '方形'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* 非媒体文件：只显示大小 */
                fileInfo.size !== undefined && (
                  <div className="bg-black/50 rounded-lg px-3 py-3 border border-slate-700/50 text-center mb-3">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">文件大小</p>
                    <p className="text-lg font-semibold text-slate-100">{formatFileSize(fileInfo.size)}</p>
                  </div>
                )
              )}

              {/* 详细信息 */}
              <div className="space-y-2">
                {/* 长宽比 */}
                {fileInfo.aspectRatio && (
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/30 border border-slate-700/30">
                    <span className="text-xs text-slate-500">长宽比</span>
                    <span className="text-sm font-mono font-medium text-slate-100">{fileInfo.aspectRatio}</span>
                  </div>
                )}
                {/* 文件类型 */}
                <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-black/30 border border-slate-700/30">
                  <span className="text-xs text-slate-500">文件类型</span>
                  <span className="text-sm font-mono font-medium text-slate-100">
                    {fileInfo.name.split('.').pop()?.toUpperCase() || '未知'}
                  </span>
                </div>
              </div>

              {/* 路径 */}
              <div className="mt-3 pt-3 border-t border-slate-900">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded bg-black flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                  </div>
                  <p className="text-xs text-slate-400 font-mono break-all leading-relaxed">{fileInfo.path}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </Tooltip.Content>
    </Tooltip.Portal>
  );
};

export default FileTooltipContent;
