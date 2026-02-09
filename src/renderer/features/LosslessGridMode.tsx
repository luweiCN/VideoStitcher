import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Loader2, FolderOpen, Grid3X3, CheckCircle, XCircle, ArrowLeft, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';

interface LosslessGridModeProps {
  onBack: () => void;
}

interface ImageFile {
  id: string;
  path: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  naturalWidth?: number;
  naturalHeight?: number;
  error?: string;
  previewUrl?: string;
}

const LosslessGridMode: React.FC<LosslessGridModeProps> = ({ onBack }) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载全局默认配置
  useEffect(() => {
    const loadGlobalSettings = async () => {
      try {
        const result = await window.api.getGlobalSettings();
        if (result?.defaultOutputDir) {
          setOutputDir(result.defaultOutputDir);
        }
      } catch (err) {
        console.error('加载全局配置失败:', err);
      }
    };
    loadGlobalSettings();
  }, []);

  // 处理拖拽上传
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      return;
    }

    // 获取图片尺寸信息
    const newImages: ImageFile[] = [];

    for (const file of imageFiles) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      await new Promise<void>((resolve) => {
        img.onload = () => {
          const previewUrl = URL.createObjectURL(file);
          newImages.push({
            id: Math.random().toString(36).substr(2, 9),
            path: file.path,
            name: file.name,
            size: file.size,
            status: 'pending' as const,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            previewUrl
          });
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          const previewUrl = URL.createObjectURL(file);
          newImages.push({
            id: Math.random().toString(36).substr(2, 9),
            path: file.path,
            name: file.name,
            size: file.size,
            status: 'pending' as const,
            previewUrl
          });
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    }

    setImages(prev => [...prev, ...newImages]);
  }, []);

  // 文件选择处理
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter(file =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      return;
    }

    const newImages: ImageFile[] = [];

    for (const file of imageFiles) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      await new Promise<void>((resolve) => {
        img.onload = () => {
          const previewUrl = URL.createObjectURL(file);
          newImages.push({
            id: Math.random().toString(36).substr(2, 9),
            path: file.path,
            name: file.name,
            size: file.size,
            status: 'pending' as const,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            previewUrl
          });
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          const previewUrl = URL.createObjectURL(file);
          newImages.push({
            id: Math.random().toString(36).substr(2, 9),
            path: file.path,
            name: file.name,
            size: file.size,
            status: 'pending' as const,
            previewUrl
          });
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    }

    setImages(prev => [...prev, ...newImages]);

    // 清空 input 以便可以重复选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 选择输出目录
  const handleSelectOutputDir = async () => {
    try {
      const dir = await window.api.pickOutDir();
      if (dir) {
        setOutputDir(dir);
      }
    } catch (err) {
      console.error('选择输出目录失败:', err);
    }
  };

  // 移除图片
  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // 清空列表
  const clearImages = () => {
    setImages(prev => {
      prev.forEach(img => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
      return [];
    });
  };

  // 组件卸载时清理所有 previewUrl
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
    };
  }, [images]);

  // 监听处理进度
  useEffect(() => {
    const cleanup = () => {
      window.api.removeAllListeners('image-start');
      window.api.removeAllListeners('image-progress');
      window.api.removeAllListeners('image-failed');
      window.api.removeAllListeners('image-finish');
    };

    window.api.onImageStart((data) => {
      // 处理开始时标记所有待处理图片为处理中
      setImages(prev => prev.map(img =>
        img.status === 'pending' ? { ...img, status: 'processing' } : img
      ));
    });

    window.api.onImageProgress((data) => {
      // 更新当前处理的图片状态
      if (data.current) {
        setImages(prev => prev.map(img => {
          if (img.path === data.current) {
            return { ...img, status: 'completed' };
          }
          return img;
        }));
      }
    });

    window.api.onImageFailed((data) => {
      // 标记失败的图片
      if (data.current) {
        setImages(prev => prev.map(img => {
          if (img.path === data.current) {
            return { ...img, status: 'error', error: data.error };
          }
          return img;
        }));
      }
    });

    window.api.onImageFinish((data) => {
      setIsProcessing(false);
    });

    return cleanup;
  }, []);

  // 开始处理
  const startProcessing = async () => {
    if (images.length === 0) {
      return;
    }
    if (!outputDir) {
      // 如果没有选择输出目录，先让用户选择
      await handleSelectOutputDir();
      if (!outputDir) {
        return;
      }
    }
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      const imagePaths = images.map(img => img.path);
      await window.api.imageGrid({
        images: imagePaths,
        outputDir
      });
    } catch (err: any) {
      console.error('处理失败:', err);
      setIsProcessing(false);
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  // 获取图片预览 URL
  const getImagePreview = (path: string) => {
    return `file://${path}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <PageHeader
        onBack={onBack}
        title="专业无损九宫格"
        icon={Grid3X3}
        iconColor="text-cyan-400"
        description="1:1原图，无损无压缩九宫格切割"
      />

      <main className="flex-1 p-6 flex gap-6 overflow-hidden max-h-[calc(100vh-64px)]">
        {/* Left: Input & Controls */}
        <div className="w-96 flex flex-col gap-6">
          {/* Upload Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4" /> 图片上传
            </h3>

            <label
              className={`flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl transition-all cursor-pointer group ${
                isDragging
                  ? 'border-cyan-500 bg-cyan-950/30'
                  : 'border-slate-700 hover:border-cyan-500 hover:bg-slate-800/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-cyan-400" />
              </div>
              <p className="text-sm text-slate-300 font-medium">点击或拖拽上传图片</p>
              <p className="text-xs text-slate-500 mt-1">建议上传 1:1 正方形原图</p>
            </label>

            <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-lg p-3">
              <p className="text-xs text-cyan-200 leading-relaxed">
                <span className="font-bold">💡 功能说明：</span> 此模式不进行任何压缩，直接按原图分辨率进行 3x3 切割。输出格式为 PNG 以保证无损画质。
              </p>
            </div>
          </div>

          {/* Output Directory */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">导出位置</h3>
            <button
              onClick={handleSelectOutputDir}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
            >
              <FolderOpen className="w-5 h-5" />
              {outputDir ? '更换导出位置' : '选择导出位置'}
            </button>
            {outputDir && (
              <p className="text-xs text-slate-500 mt-2 truncate">
                导出至: {outputDir}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mt-auto">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-sm">已选择 {images.length} 张图片</span>
              {images.length > 0 && (
                <button onClick={clearImages} className="text-xs text-rose-400 hover:text-rose-300">
                  清空列表
                </button>
              )}
            </div>
            <button
              onClick={startProcessing}
              disabled={images.length === 0 || isProcessing}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/20"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderOpen className="w-5 h-5" />}
              {isProcessing ? '正在处理...' : outputDir ? '开始处理' : '选择导出位置并开始'}
            </button>
          </div>
        </div>

        {/* Right: List & Preview */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden flex flex-col">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
            待处理队列
          </h3>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {images.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                <Grid3X3 className="w-16 h-16 opacity-20" />
                <p>暂无图片，请在左侧上传</p>
              </div>
            ) : (
              images.map((img) => (
                <div key={img.id} className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-slate-800 group hover:border-slate-700 transition-colors">
                  <div className="w-12 h-12 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 border border-slate-800">
                    {img.previewUrl ? (
                      <img src={img.previewUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <Upload className="w-5 h-5 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{img.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatSize(img.size)}
                      {img.naturalWidth && ` · ${img.naturalWidth}x${img.naturalHeight}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {img.status === 'completed' && (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-950/30 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> 完成
                      </span>
                    )}
                    {img.status === 'processing' && (
                      <span className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-950/30 px-2 py-1 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin" /> 处理中
                      </span>
                    )}
                    {img.status === 'error' && (
                      <span className="flex items-center gap-1 text-rose-400 text-xs font-bold bg-rose-950/30 px-2 py-1 rounded-full" title={img.error}>
                        <AlertCircle className="w-3 h-3" /> 失败
                      </span>
                    )}
                    {img.status === 'pending' && (
                      <button
                        onClick={() => removeImage(img.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LosslessGridMode;
