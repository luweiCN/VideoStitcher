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
  title: string;
  stepNumber: number;
  totalSteps: number;
  showLibrary: boolean;
}

/**
 * 步骤头部组件
 */
export function StepHeader({ title, stepNumber, totalSteps, showLibrary }: StepHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">Step {stepNumber} / {totalSteps}</p>
      </div>
      {/* 只有步骤 3-4 且 showLibrary=true 时才显示待产库 */}
      {showLibrary && stepNumber >= 3 && <ProductionQueue />}
    </div>
  );
}
