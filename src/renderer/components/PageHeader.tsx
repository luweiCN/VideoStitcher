import React from 'react';
import { ArrowLeft, LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  /** 返回按钮点击回调 */
  onBack: () => void;
  /** 页面标题 */
  title: string;
  /** 页面图标 */
  icon?: LucideIcon;
  /** 功能描述小字 */
  description?: string;
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
 * - 右侧：自定义按钮/内容
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  onBack,
  title,
  icon: Icon,
  description,
  iconColor = 'text-white',
  rightContent,
  showBackButton = true,
  backButtonContent,
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center px-4 shrink-0">
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

      {/* 右侧：自定义内容 */}
      {rightContent && (
        <div className="flex items-center gap-3 ml-auto">
          {rightContent}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
