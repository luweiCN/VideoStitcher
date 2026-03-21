/**
 * AI 创意视频 - 地区设置页（三级目录）
 * 复用 RegionSettingsPage，套上 AI 创意视频的导航 shell
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, MapPin } from 'lucide-react';
import { RegionSettingsPage } from '@renderer/pages/ASide/components/Settings/RegionSettingsPage';

const AICreativeRegionSettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* 面包屑导航 */}
      <div className="flex items-center gap-3 px-8 py-5 border-b border-slate-800/60 flex-shrink-0">
        <button
          onClick={() => navigate('/ai-creative/settings')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm">设置</span>
        </button>
        <span className="text-slate-700">/</span>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-slate-400" />
          <h1 className="text-base font-semibold text-white">地区设置</h1>
        </div>
      </div>

      {/* 地区设置主体（铺满剩余高度） */}
      <div className="flex-1 overflow-hidden">
        <RegionSettingsPage />
      </div>
    </div>
  );
};

export default AICreativeRegionSettingsPage;
