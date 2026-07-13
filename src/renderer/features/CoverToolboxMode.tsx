import React, { useState } from 'react';
import { Image as ImageIcon, RefreshCw, Shrink } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageThemeToggle from '@/components/PageThemeToggle';
import { useHomeSkin } from '@/hooks/useHomeSkin';
import { usePageTheme } from '@/hooks/usePageTheme';
import CoverFormatMode from './CoverFormatMode';
import CoverCompressMode from './CoverCompressMode';
import ImageWorkshopModeSwitcher from './ImageWorkshopModeSwitcher';

type CoverToolboxTab = 'format' | 'compress';

const tabs: Array<{
  id: CoverToolboxTab;
  title: string;
  description: string;
  icon: typeof RefreshCw;
  activeClass: string;
}> = [
  {
    id: 'format',
    title: '格式转换',
    description: '横版、竖版、方图自动转标准封面尺寸',
    icon: RefreshCw,
    activeClass: 'border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-300 shadow-fuchsia-950/20',
  },
  {
    id: 'compress',
    title: '压缩优化',
    description: '按目标大小批量压缩封面图片',
    icon: Shrink,
    activeClass: 'border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-emerald-950/20',
  },
];

const CoverToolboxMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CoverToolboxTab>('format');
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const { isMetalSkin, workspaceSkinClassName } = useHomeSkin();

  return (
    <div
      className={`${workspaceSkinClassName} h-screen flex flex-col ${
        isLightTheme ? 'theme-light-page bg-[#F8F8F5] text-[#222222]' : 'bg-[#181818] text-[#D1D1D1]'
      }`}
    >
      <PageHeader
        backPath="/"
        title="图片素材工坊 · 封面工具"
        icon={ImageIcon}
        iconColor={isLightTheme ? 'text-blue-600' : 'text-blue-400'}
        description="封面格式转换与压缩优化"
        featureInfo={{
          title: '封面工具箱',
          description: '把封面格式转换和封面压缩合并到一个入口中，减少主页功能占位。',
          details: [
            '格式转换：按图片比例输出横版、竖版或方形封面',
            '压缩优化：按目标文件大小批量压缩封面图片',
            '两个功能保留原有处理流程，可在工具箱内自由切换',
          ],
          themeColor: 'blue',
        }}
        rightContent={
          <div className="flex items-center gap-2">
            <ImageWorkshopModeSwitcher mode="cover" />
            {!isMetalSkin && <PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />}
          </div>
        }
      />

      <div className="border-b border-slate-800 bg-black/70 px-4 py-3">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group flex min-w-[220px] items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 ${
                  isActive
                    ? tab.activeClass
                    : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    isActive ? 'bg-white/10' : 'bg-slate-900 text-slate-500 group-hover:text-slate-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{tab.title}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{tab.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'format' ? <CoverFormatMode embedded /> : <CoverCompressMode embedded />}
      </div>
    </div>
  );
};

export default CoverToolboxMode;
