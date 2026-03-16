/**
 * 工具栏 - 步骤切换和操作按钮
 */

import React, { useState } from 'react';
import { Users, Film, Play, Download, ChevronRight } from 'lucide-react';
import type { ExportConfig } from '../types';

interface ToolbarProps {
  currentStep: 'character' | 'storyboard' | 'preview';
  onStepChange: (step: 'character' | 'storyboard' | 'preview') => void;
  onExport: (config: ExportConfig) => void;
  isProcessing: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentStep,
  onStepChange,
  onExport,
  isProcessing,
}) => {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'mp4',
    resolution: '1080p',
    fps: 30,
    quality: 'high',
  });

  const steps = [
    { id: 'character', label: '角色创建', icon: Users },
    { id: 'storyboard', label: '分镜设计', icon: Film },
    { id: 'preview', label: '预览导出', icon: Play },
  ] as const;

  // 处理导出
  const handleExport = () => {
    onExport(exportConfig);
    setShowExportDialog(false);
  };

  return (
    <>
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        {/* 步骤切换 */}
        <div className="flex items-center gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isPast = steps.findIndex(s => s.id === currentStep) > index;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => onStepChange(step.id)}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500'
                      : isPast
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isActive
                        ? 'bg-violet-500'
                        : isPast
                        ? 'bg-emerald-500'
                        : 'bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{step.label}</span>
                </button>

                {index < steps.length - 1 && (
                  <ChevronRight
                    className={`w-4 h-4 ${
                      isPast ? 'text-emerald-500' : 'text-slate-600'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* 导出按钮 */}
        {currentStep === 'preview' && (
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">导出视频</span>
          </button>
        )}
      </div>

      {/* 导出对话框 */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">导出配置</h3>

            <div className="space-y-4">
              {/* 格式选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  视频格式
                </label>
                <select
                  value={exportConfig.format}
                  onChange={(e) =>
                    setExportConfig({ ...exportConfig, format: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
                >
                  <option value="mp4">MP4</option>
                  <option value="mov">MOV</option>
                  <option value="webm">WebM</option>
                </select>
              </div>

              {/* 分辨率选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  分辨率
                </label>
                <select
                  value={exportConfig.resolution}
                  onChange={(e) =>
                    setExportConfig({ ...exportConfig, resolution: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
                >
                  <option value="1080p">1080p (1920x1080)</option>
                  <option value="2K">2K (2560x1440)</option>
                  <option value="4K">4K (3840x2160)</option>
                </select>
              </div>

              {/* 帧率选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  帧率
                </label>
                <select
                  value={exportConfig.fps}
                  onChange={(e) =>
                    setExportConfig({ ...exportConfig, fps: Number(e.target.value) as any })
                  }
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
                >
                  <option value={24}>24 FPS</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </div>

              {/* 质量选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  画质
                </label>
                <select
                  value={exportConfig.quality}
                  onChange={(e) =>
                    setExportConfig({ ...exportConfig, quality: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
                >
                  <option value="low">低 (快速导出)</option>
                  <option value="medium">中 (平衡)</option>
                  <option value="high">高 (最佳画质)</option>
                </select>
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowExportDialog(false)}
                className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                开始导出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
