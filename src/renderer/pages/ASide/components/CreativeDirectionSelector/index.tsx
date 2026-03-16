/**
 * 创意方向选择器组件
 * 显示创意方向列表，支持选择和添加自定义方向
 */

import { useState, useEffect } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { CreativeDirection } from '@shared/types/aside';
import { DirectionCard } from './DirectionCard';
import { AddDirectionModal } from './AddDirectionModal';

/**
 * 创意方向选择器主组件
 */
export function CreativeDirectionSelector() {
  const [directions, setDirections] = useState<CreativeDirection[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { currentProject, selectDirection, setCurrentView } = useASideStore();

  // 加载创意方向列表
  useEffect(() => {
    if (currentProject) {
      loadDirections();
    }
  }, [currentProject]);

  /**
   * 加载创意方向列表
   */
  const loadDirections = async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      const result = await window.api.getCreativeDirections(currentProject.id);
      if (result.success && result.directions) {
        setDirections(result.directions);
      }
    } catch (error) {
      console.error('[CreativeDirectionSelector] 加载创意方向列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 添加自定义创意方向
   */
  const handleAddDirection = async (name: string, description?: string, iconName?: string) => {
    if (!currentProject) return;

    try {
      const result = await window.api.createCreativeDirection({
        projectId: currentProject.id,
        name,
        description,
        iconName,
        isPreset: false,
      });
      if (result.success && result.direction) {
        setDirections([...directions, result.direction]);
        setIsAddModalOpen(false);
        console.log('[CreativeDirectionSelector] 添加创意方向成功:', result.direction.name);
      }
    } catch (error) {
      console.error('[CreativeDirectionSelector] 添加创意方向失败:', error);
    }
  };

  /**
   * 删除创意方向
   */
  const handleDeleteDirection = async (directionId: string) => {
    if (!confirm('确定要删除此创意方向吗？')) {
      return;
    }

    try {
      const result = await window.api.deleteCreativeDirection(directionId);
      if (result.success) {
        setDirections(directions.filter(d => d.id !== directionId));
        console.log('[CreativeDirectionSelector] 删除创意方向成功');
      }
    } catch (error) {
      console.error('[CreativeDirectionSelector] 删除创意方向失败:', error);
    }
  };

  /**
   * 选择创意方向（跳转到 Step 2）
   */
  const handleSelectDirection = (direction: CreativeDirection) => {
    selectDirection(direction);
    setCurrentView('step2-region');
  };

  /**
   * 返回项目库
   */
  const handleBack = () => {
    setCurrentView('library');
  };

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择一个项目</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* 头部 */}
      <header className="px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={handleBack}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Step 1: 选择创意方向</h1>
            <p className="text-sm text-slate-500 mt-1">项目：{currentProject.name}</p>
          </div>
        </div>
      </header>

      {/* 创意方向列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">加载中...</div>
          </div>
        ) : directions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-slate-500 mb-2">还没有任何创意方向</p>
            <p className="text-sm text-slate-600">点击下方按钮添加创意方向</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {directions.map(direction => (
              <DirectionCard
                key={direction.id}
                direction={direction}
                onSelect={() => handleSelectDirection(direction)}
                onDelete={() => handleDeleteDirection(direction.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部添加按钮 */}
      <div className="px-6 py-4 border-t border-slate-800">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>添加自定义创意方向</span>
        </button>
      </div>

      {/* 添加创意方向弹窗 */}
      {isAddModalOpen && (
        <AddDirectionModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddDirection}
        />
      )}
    </div>
  );
}
