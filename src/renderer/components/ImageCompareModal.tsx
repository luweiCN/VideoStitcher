import React, { useState, useEffect } from "react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { X } from "lucide-react";

/**
 * 图片对比弹窗 - 用于查看处理前后的效果对比
 */

interface ImageCompareModalProps {
  visible: boolean;
  onClose: () => void;
  /** 处理前的图片路径 */
  beforePath: string;
  /** 处理后的图片路径 */
  afterPath: string;
  /** 处理前的文件大小（字节） */
  beforeSize?: number;
  /** 处理后的文件大小（字节） */
  afterSize?: number;
  /** 图片名称 */
  fileName: string;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ImageCompareModal: React.FC<ImageCompareModalProps> = ({
  visible,
  onClose,
  beforePath,
  afterPath,
  beforeSize,
  afterSize,
  fileName,
}) => {
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isPortrait, setIsPortrait] = useState(false);

  // 加载图片预览 URL 和尺寸信息
  useEffect(() => {
    const loadImages = async () => {
      try {
        const [[beforeResult, afterResult], dimensions] = await Promise.all([
          Promise.all([
            window.api.getPreviewUrl(beforePath),
            window.api.getPreviewUrl(afterPath),
          ]),
          window.api.getImageDimensions(beforePath),
        ]);

        if (beforeResult.success && beforeResult.url) {
          setBeforeUrl(beforeResult.url);
        }
        if (afterResult.success && afterResult.url) {
          setAfterUrl(afterResult.url);
        }

        // 根据图片尺寸判断是横版还是竖版
        if (dimensions.success && dimensions.width && dimensions.height) {
          setIsPortrait(dimensions.height > dimensions.width);
        }
      } catch (err) {
        console.error("加载图片对比失败:", err);
      }
    };

    if (visible) {
      loadImages();
    }

    // 清理 URL
    return () => {
      setBeforeUrl(null);
      setAfterUrl(null);
      setIsPortrait(false);
    };
  }, [visible, beforePath, afterPath]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (visible) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-[90vw] h-[85vh] bg-black backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-black/50">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-200 truncate">
              效果对比
            </h3>
            <span className="text-sm text-slate-500 truncate">{fileName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-900 rounded-xl transition-colors text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          {beforeUrl && afterUrl ? (
            <>
              {/* 对比滑杆 */}
              <div className="relative flex-1">
                <ReactCompareSlider
                  itemOne={
                    <ReactCompareSliderImage src={beforeUrl} alt="处理前" />
                  }
                  itemTwo={
                    <ReactCompareSliderImage src={afterUrl} alt="处理后" />
                  }
                  position={sliderPosition}
                  onPositionChange={setSliderPosition}
                  portrait={isPortrait}
                />
                {/* 原图标签 */}
                <div className={`absolute top-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-medium text-white ${isPortrait ? 'left-1/2 -translate-x-1/2' : 'left-4'}`}>
                  原图
                </div>
                {/* 处理后标签 */}
                <div className={`absolute top-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-medium text-white ${isPortrait ? 'right-1/2 translate-x-1/2' : 'right-4'}`}>
                  处理后
                </div>
              </div>

              {/* 底部信息栏 */}
              <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-black/50 border-t border-slate-800">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">处理前</span>
                    <span className="text-sm font-mono text-slate-300">
                      {beforeSize !== undefined && formatFileSize(beforeSize)}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">处理后</span>
                    <span className="text-sm font-mono text-emerald-400">
                      {afterSize !== undefined && formatFileSize(afterSize)}
                    </span>
                  </div>
                  {/* 压缩比例 */}
                  {beforeSize && afterSize ? (
                    <>
                      <div className="h-8 w-px bg-slate-700" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">压缩比</span>
                        <span className="text-sm font-mono text-fuchsia-400">
                          {((1 - afterSize / beforeSize) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="text-xs text-slate-600">
                  滑动滑杆查看对比效果
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate-500">加载图片失败</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCompareModal;
