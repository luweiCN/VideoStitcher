/**
 * 任务状态徽章组件
 */

import React from 'react';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { TaskStatus } from '@shared/types/task';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<TaskStatus, {
  label: string;
  icon: React.ReactNode;
  className: string;
}> = {
  pending: {
    label: '待执行',
    icon: <Clock className="w-3 h-3" />,
    className: 'bg-slate-700/50 text-slate-400 border-slate-600/50',
  },
  running: {
    label: '执行中',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    className: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  },
  completed: {
    label: '已完成',
    icon: <CheckCircle className="w-3 h-3" />,
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  failed: {
    label: '失败',
    icon: <XCircle className="w-3 h-3" />,
    className: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  cancelled: {
    label: '已取消',
    icon: <XCircle className="w-3 h-3" />,
    className: 'bg-slate-700/50 text-slate-500 border-slate-600/50',
  },
};

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.className} ${sizeClasses}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

export default TaskStatusBadge;
