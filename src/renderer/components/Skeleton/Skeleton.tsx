/**
 * 骨架屏组件 - 加载占位符
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

/**
 * 基础骨架屏组件
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-slate-800';

  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

/**
 * 风格卡片骨架屏
 */
export const StyleCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-xl border-2 border-slate-800 overflow-hidden">
      {/* 缩略图 */}
      <Skeleton className="aspect-video" />

      {/* 信息区域 */}
      <div className="p-4 bg-black space-y-3">
        <Skeleton variant="text" className="h-5 w-3/4" />
        <Skeleton variant="text" className="h-3 w-full" />
        <Skeleton variant="text" className="h-3 w-2/3" />

        {/* 标签 */}
        <div className="flex gap-2">
          <Skeleton variant="rectangular" className="h-5 w-14" />
          <Skeleton variant="rectangular" className="h-5 w-14" />
        </div>
      </div>
    </div>
  );
};

/**
 * 风格选择器骨架屏
 */
export const StyleSelectorSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 分类标题 */}
      <div>
        <Skeleton variant="text" className="h-4 w-20 mb-3" />

        {/* 卡片网格 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <StyleCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 脚本项骨架屏
 */
export const ScriptItemSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton variant="text" className="h-5 w-2/3" />
        <Skeleton variant="rectangular" className="h-6 w-16" />
      </div>
      <Skeleton variant="text" className="h-3 w-full" />
      <Skeleton variant="text" className="h-3 w-3/4" />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="h-8 w-20" />
        <Skeleton variant="rectangular" className="h-8 w-20" />
      </div>
    </div>
  );
};

/**
 * 脚本列表骨架屏
 */
export const ScriptListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <ScriptItemSkeleton key={index} />
      ))}
    </div>
  );
};

export default Skeleton;
