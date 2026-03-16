/**
 * 进度条组件
 */

import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  variant = 'default',
  size = 'md',
  showLabel = true,
  animated = true,
  className = '',
}) => {
  // 确保进度在 0-100 之间
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const variants = {
    default: 'bg-gradient-to-r from-pink-500 to-violet-500',
    success: 'bg-gradient-to-r from-emerald-500 to-green-500',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-500',
    danger: 'bg-gradient-to-r from-red-500 to-rose-500',
  };

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full ${className}`}>
      {/* 进度条轨道 */}
      <div
        className={`
          w-full ${sizes[size]}
          bg-slate-800 rounded-full overflow-hidden
          ${animated ? 'transition-all duration-300' : ''}
        `}
      >
        {/* 进度条填充 */}
        <div
          className={`
            ${sizes[size]} ${variants[variant]} rounded-full
            ${animated ? 'transition-all duration-300 ease-out' : ''}
          `}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      {/* 百分比标签 */}
      {showLabel && (
        <div className="flex justify-end mt-1">
          <span className="text-xs text-slate-400 font-medium">
            {clampedProgress}%
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 带步骤的进度条
 */
interface StepProgressBarProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
  className?: string;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({
  currentStep,
  totalSteps,
  labels,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <React.Fragment key={index}>
              {/* 步骤点 */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${
                      isCompleted
                        ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white'
                        : isCurrent
                        ? 'bg-pink-500/20 border-2 border-pink-500 text-pink-400'
                        : 'bg-slate-800 text-slate-600'
                    }
                    transition-all duration-300
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>

                {/* 步骤标签 */}
                {labels && labels[index] && (
                  <span
                    className={`
                      mt-2 text-xs font-medium text-center
                      ${
                        isCompleted || isCurrent ? 'text-slate-300' : 'text-slate-600'
                      }
                    `}
                  >
                    {labels[index]}
                  </span>
                )}
              </div>

              {/* 连接线 */}
              {index < totalSteps - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-slate-800 relative">
                  <div
                    className={`
                      absolute inset-y-0 left-0 bg-gradient-to-r from-pink-500 to-violet-500
                      transition-all duration-300
                    `}
                    style={{
                      width: isCompleted ? '100%' : '0%',
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressBar;
