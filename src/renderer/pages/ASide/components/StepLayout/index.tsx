/**
 * 步骤布局组件
 * 提供统一的步骤页面布局，包含顶部工具栏、内容区、底部导航
 */

import React, { ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StepHeader } from './StepHeader';

/**
 * StepLayout 组件 Props
 */
export interface StepLayoutProps {
  title: string;
  stepNumber: number;
  totalSteps: number;
  showLibrary?: boolean;
  /** 是否显示内置 header（外层已有导航栏时可设为 false） */
  showHeader?: boolean;
  /** main 区域是否允许整页滚动（左右分栏布局时设为 false，由子组件自管滚动） */
  scrollable?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  nextButtons?: ReactNode; // 支持自定义下一步按钮
  leftContent?: ReactNode; // 头部左侧自定义内容
  rightContent?: ReactNode; // 头部右侧自定义内容
  children: ReactNode;
}

/**
 * 步骤布局组件
 */
export function StepLayout({
  title,
  stepNumber,
  totalSteps,
  showLibrary = false,
  showHeader = true,
  scrollable = true,
  onPrev,
  onNext,
  nextButtons,
  leftContent,
  rightContent,
  children,
}: StepLayoutProps) {
  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* 头部 - 粘性（可选） */}
      {showHeader && (
        <header className="sticky top-0 px-6 py-4 border-b border-slate-800 bg-black/50 z-10">
          <StepHeader
            title={title}
            stepNumber={stepNumber}
            totalSteps={totalSteps}
            showLibrary={showLibrary}
            leftContent={leftContent}
            rightContent={rightContent}
          />
        </header>
      )}

      {/* 主内容区 */}
      <main className={`flex-1 ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {children}
      </main>

      {/* 底部导航 - 粘性 */}
      <footer className="sticky bottom-0 px-6 py-4 border-t border-slate-800 bg-black/50">
        <div className="flex items-center justify-between">
          {/* 上一步按钮 */}
          <button
            onClick={onPrev}
            disabled={stepNumber === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              stepNumber === 1
                ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>上一步</span>
          </button>

          {/* 下一步按钮或自定义按钮 */}
          {nextButtons ? (
            <div className="flex items-center gap-3">
              {nextButtons}
            </div>
          ) : (
            <button
              onClick={onNext}
              disabled={!onNext}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${
                onNext
                  ? 'bg-gradient-to-r from-pink-600 to-violet-600 text-white hover:from-pink-700 hover:to-violet-700'
                  : 'bg-slate-900 text-slate-600 cursor-not-allowed'
              }`}
            >
              <span>下一步</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
