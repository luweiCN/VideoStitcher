/**
 * 项目卡片组件
 * 显示单个项目的信息和操作按钮
 */

import { Folder, Gamepad2, MapPin, Trash2, Clock } from 'lucide-react';
import type { Project } from '@shared/types/aside';

interface ProjectCardProps {
  /** 项目数据 */
  project: Project;
  /** 进入项目回调 */
  onEnter: () => void;
  /** 删除项目回调 */
  onDelete: () => void;
}

/**
 * 项目卡片组件
 */
export function ProjectCard({ project, onEnter, onDelete }: ProjectCardProps) {
  /**
   * 格式化日期
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /**
   * 获取游戏类型图标颜色
   */
  const getGameTypeColor = (gameType: string) => {
    switch (gameType) {
      case '麻将':
        return 'text-amber-400';
      case '扑克':
        return 'text-blue-400';
      case '赛车':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="group bg-black/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      {/* 项目信息 */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <Folder className="w-8 h-8 text-slate-600" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
            title="删除项目"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-lg font-semibold text-slate-100 mb-2">{project.name}</h3>

        <div className="flex flex-col gap-2 text-sm">
          {/* 游戏类型 */}
          <div className="flex items-center gap-2 text-slate-400">
            <Gamepad2 className="w-4 h-4" />
            <span className={getGameTypeColor(project.gameType)}>{project.gameType}</span>
          </div>

          {/* 区域 */}
          {project.region && (
            <div className="flex items-center gap-2 text-slate-400">
              <MapPin className="w-4 h-4" />
              <span>{project.region}</span>
            </div>
          )}

          {/* 创建时间 */}
          <div className="flex items-center gap-2 text-slate-500">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{formatDate(project.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* 进入按钮 */}
      <button
        onClick={onEnter}
        className="w-full py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        进入项目
      </button>
    </div>
  );
}
