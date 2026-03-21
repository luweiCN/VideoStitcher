/**
 * 创意方向选择器组件
 * 显示创意方向列表，支持选择和添加自定义方向
 */

import { useState, useEffect } from 'react';
import { Plus, LayoutGrid, List, Wand2, Loader2 } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import { useConfirm } from '@renderer/hooks/useConfirm';
import type { CreativeDirection } from '@shared/types/aside';
import { DirectionCard } from './DirectionCard';
import { AddDirectionModal } from './AddDirectionModal';
import { EditDirectionModal } from './EditDirectionModal';
import { ConveyorBelt } from './ConveyorBelt';
import { StepLayout } from '../StepLayout';

/**
 * 创意方向选择器主组件
 */
export function CreativeDirectionSelector() {
  const [directions, setDirections] = useState<CreativeDirection[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDirection, setEditingDirection] = useState<CreativeDirection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const {
    currentProject,
    selectedDirection,
    selectDirection,
    setCurrentView,
    goToNextStep
  } = useASideStore();

  const confirm = useConfirm();

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
      const result = await window.api.asideGetCreativeDirections(currentProject.id);
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
      const result = await window.api.asideAddCreativeDirection({
        projectId: currentProject.id,
        name,
        description,
        iconName,
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
    const confirmed = await confirm({
      title: '确认删除创意方向',
      message: '确定要删除此创意方向吗？',
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const result = await window.api.asideDeleteCreativeDirection(directionId);
      if (result.success) {
        setDirections(directions.filter(d => d.id !== directionId));
        console.log('[CreativeDirectionSelector] 删除创意方向成功');
      }
    } catch (error) {
      console.error('[CreativeDirectionSelector] 删除创意方向失败:', error);
    }
  };

  /**
   * 编辑创意方向
   */
  const handleEditDirection = (direction: CreativeDirection) => {
    setEditingDirection(direction);
  };

  /**
   * 保存编辑的创意方向
   */
  const handleSaveDirection = async (directionId: string, name: string, description?: string, iconName?: string) => {
    try {
      const result = await window.api.asideUpdateCreativeDirection(directionId, {
        name,
        description,
        iconName,
      });
      if (result.success) {
        await loadDirections();
        setEditingDirection(null);
        console.log('[CreativeDirectionSelector] 编辑创意方向成功');
      }
    } catch (error) {
      console.error('[CreativeDirectionSelector] 编辑创意方向失败:', error);
    }
  };

  /**
   * 选择创意方向
   */
  const handleSelectDirection = (direction: CreativeDirection) => {
    selectDirection(direction);
  };

  /**
   * 返回项目库
   */
  const handleBackToLibrary = () => {
    setCurrentView('library');
  };

  /**
   * AI 批量生成创意方向
   */
  const handleAIGenerate = async () => {
    if (!currentProject) return;
    setIsGenerating(true);
    try {
      const result = await window.api.asideGenerateCreativeDirections(currentProject.id);
      if (result.success && result.directions) {
        await loadDirections();
        console.log('[CreativeDirectionSelector] AI 生成创意方向成功:', result.directions.length);
      } else {
        console.error('[CreativeDirectionSelector] AI 生成失败:', result.error);
      }
    } catch (error) {
      console.error('[CreativeDirectionSelector] AI 生成创意方向异常:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 进入下一步
   */
  const handleGoToNextStep = () => {
    if (selectedDirection) {
      goToNextStep();
    }
  };

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-500">
        <p>请先选择一个项目</p>
      </div>
    );
  }

  // 头部左侧内容：项目信息 + 步骤信息
  const leftContent = (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">选择创意方向</h1>
      <p className="text-sm text-slate-500 mt-1">Step 1 / 4</p>
    </div>
  );

  // 头部右侧内容：布局切换 + AI 生成 + 添加按钮
  const rightContent = (
    <div className="flex items-center gap-3">
      {/* 视图切换按钮 */}
      <div className="flex items-center bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => setViewMode('card')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'card'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-100'
          }`}
          title="卡片视图"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'list'
              ? 'bg-violet-600 text-white'
              : 'text-slate-400 hover:text-slate-100'
          }`}
          title="列表视图"
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* AI 生成按钮 */}
      <button
        onClick={handleAIGenerate}
        disabled={isGenerating}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:border-violet-500 hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="根据游戏信息 AI 生成 5 个专属创意方向"
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wand2 className="w-4 h-4" />
        )}
        <span>{isGenerating ? '生成中...' : 'AI 生成'}</span>
      </button>

      {/* 手动添加按钮 */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>添加创意方向</span>
      </button>
    </div>
  );

  return (
    <StepLayout
      title="选择创意方向"
      stepNumber={1}
      totalSteps={4}
      showLibrary={false}
      onPrev={handleBackToLibrary}
      onNext={selectedDirection ? handleGoToNextStep : undefined}
      leftContent={leftContent}
      rightContent={rightContent}
    >
      {/* 内容区 */}
      <div className="flex-1 overflow-hidden p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">加载中...</div>
          </div>
        ) : directions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-slate-500 mb-2">还没有任何创意方向</p>
            <p className="text-sm text-slate-600">点击上方按钮添加创意方向</p>
          </div>
        ) : viewMode === 'card' ? (
          /* 卡片视图 - 传送带动画 */
          <ConveyorBelt
            directions={directions}
            selectedId={selectedDirection?.id || null}
            onSelect={handleSelectDirection}
            onEdit={handleEditDirection}
            onDelete={handleDeleteDirection}
          />
        ) : (
          /* 列表视图 - 静态网格 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto h-full">
            {directions.map(direction => (
              <DirectionCard
                key={direction.id}
                direction={direction}
                isSelected={selectedDirection?.id === direction.id}
                onSelect={() => handleSelectDirection(direction)}
                onEdit={() => handleEditDirection(direction)}
                onDelete={() => handleDeleteDirection(direction.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 添加创意方向弹窗 */}
      {isAddModalOpen && (
        <AddDirectionModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddDirection}
        />
      )}

      {/* 编辑创意方向弹窗 */}
      {editingDirection && (
        <EditDirectionModal
          direction={editingDirection}
          onClose={() => setEditingDirection(null)}
          onSave={handleSaveDirection}
        />
      )}
    </StepLayout>
  );
}
