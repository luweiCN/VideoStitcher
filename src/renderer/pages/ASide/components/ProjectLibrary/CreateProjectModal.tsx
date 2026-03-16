/**
 * 创建项目弹窗组件
 * 用于创建新项目
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { GameType } from '@shared/types/aside';

interface CreateProjectModalProps {
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 创建项目回调 */
  onCreate: (name: string, gameType: GameType) => void;
}

/**
 * 创建项目弹窗组件
 */
export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [gameType, setGameType] = useState<GameType>('麻将');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('请输入项目名称');
      return;
    }
    setIsLoading(true);
    onCreate(name.trim(), gameType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-slate-800 rounded-xl shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-semibold">创建新项目</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 项目名称 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              项目名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：广东麻将推广"
              maxLength={20}
              className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-700"
              autoFocus
            />
          </div>

          {/* 游戏类型 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              游戏类型 <span className="text-red-400">*</span>
            </label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value as GameType)}
              className="w-full px-3 py-2 bg-black/50 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-slate-700"
            >
              <option value="麻将">麻将</option>
              <option value="扑克">扑克</option>
              <option value="赛车">赛车</option>
            </select>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
