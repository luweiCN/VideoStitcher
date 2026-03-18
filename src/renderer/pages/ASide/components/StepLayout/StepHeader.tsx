/**
 * 步骤头部组件
 * 显示标题、步骤指示器、待产库入口
 */

import React from 'react';
import { ProductionQueue } from '../ProductionQueue';

/**
 * StepHeader 组件 Props
 */
export interface StepHeaderProps {
  title?: string; // 标题（简化用法）
  stepNumber: number;
  totalSteps: number;
  showLibrary: boolean;
  rightContent?: React.ReactNode; // 右侧自定义内容
  leftContent?: React.ReactNode; // 左侧自定义内容（优先于 title）
}

/**
 * 步骤头部组件
 */
export function StepHeader({ title, stepNumber, totalSteps, showLibrary, rightContent, leftContent }: StepHeaderProps) {
  // 如果提供了 leftContent，使用它；否则使用默认的 title + 步骤布局
  const leftSection = leftContent || (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
      <p className="text-sm text-slate-500 mt-1">Step {stepNumber} / {totalSteps}</p>
    </div>
  );

  return (
    <div className="flex items-center justify-between">
      {leftSection}
      <div className="flex items-center gap-4">
        {/* 右侧自定义内容 */}
        {rightContent}
        {/* 只有步骤 3-4 且 showLibrary=true 时才显示待产库 */}
        {showLibrary && stepNumber >= 3 && <ProductionQueue />}
      </div>
    </div>
  );
}
