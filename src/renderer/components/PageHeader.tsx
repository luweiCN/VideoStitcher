import React from 'react';
import { ArrowLeft, LucideIcon, Lightbulb } from 'lucide-react';
import FeatureInfoTooltip from './FeatureInfoTooltip';

interface PageHeaderProps {
  /** 返回按钮点击回调 */
  onBack: () => void;
  /** 页面标题 */
  title: string;
  /** 页面图标 */
  icon?: LucideIcon;
  /** 功能描述小字（显示在标题下方）*/
  description?: string;
  /** 功能描述 tooltip 信息（悬浮时显示）*/
  featureInfo?: {
    /** 功能标题 */
    title: string;
    /** 功能描述 */
    description: string;
    /** 详细说明列表 */
    details?: string[];
    /** 主题颜色 */
    themeColor?: 'pink' | 'violet' | 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan';
  };
  /** 功能说明标签文字（显示在 info 图标旁边）*/
  featureTag?: string;
  /** 图标颜色类名 */
  iconColor?: string;
  /** 右侧自定义内容 */
  rightContent?: React.ReactNode;
  /** 是否显示返回按钮 */
  showBackButton?: boolean;
  /** 自定义返回按钮内容 */
  backButtonContent?: React.ReactNode;
}

/**
 * 通用页面头组件
 *
 * 用于所有功能页面的顶部导航栏
 * - 左侧：返回按钮 + 图标 + 标题 + 描述
 * - 右侧：自定义按钮/内容 + 功能信息图标
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  onBack,
  title,
  icon: Icon,
  description,
  featureInfo,
  featureTag,
  iconColor = 'text-white',
  rightContent,
  showBackButton = true,
  backButtonContent,
}) => {
  // 主题颜色配置（与 FeatureInfoTooltip 保持一致）
  const themeColors: Record<string, { bg: string; text: string; border: string }> = {
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  };

  const colors = featureInfo?.themeColor ? themeColors[featureInfo.themeColor] : themeColors.violet;

  return (
    <header className="h-14 border-b border-slate-800 bg-black/50 backdrop-blur-md flex items-center px-4 shrink-0">
      {/* 左侧：返回按钮 + 标题区域 */}
      <div className="flex items-center gap-3">
        {showBackButton && (
          backButtonContent ? (
            <div onClick={onBack} className="cursor-pointer">
              {backButtonContent}
            </div>
          ) : (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
              type="button"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )
        )}
        <div>
          <h1 className="text-base font-bold flex items-center gap-2">
            {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
            <span className={iconColor}>{title}</span>
          </h1>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>

      {/* 右侧：自定义内容 + 功能说明标签 + 功能信息图标 */}
      <div className="flex items-center gap-3 ml-auto">
        {rightContent}
        {featureTag && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${colors.bg} ${colors.border} border`}>
            <Lightbulb className={`w-3 h-3 ${colors.text}`} />
            <span className={`text-xs ${colors.text}`}>{featureTag}</span>
          </div>
        )}
        {featureInfo && (
          <FeatureInfoTooltip
            title={featureInfo.title}
            description={featureInfo.description}
            details={featureInfo.details}
            themeColor={featureInfo.themeColor}
          />
        )}
      </div>
    </header>
  );
};

export default PageHeader;
