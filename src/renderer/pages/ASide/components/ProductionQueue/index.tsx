/**
 * 待产库组件
 * 显示待产库剧本列表，支持拖拽排序、删除、清空
 */

import { useState, useEffect } from 'react';
import { Inbox, Trash2 } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Screenplay } from '@shared/types/aside';
import { QueueItem } from './QueueItem';
import { QueueModal } from './QueueModal';

/**
 * 待产库主组件
 */
export function ProductionQueue() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { currentProject, libraryScripts, setLibraryScripts, removeLibraryScript } = useASideStore();

  // 加载待产库脚本
  useEffect(() => {
    if (currentProject) {
      loadLibraryScripts();
    }
  }, [currentProject]);

  /**
   * 加载待产库脚本
   */
  const loadLibraryScripts = async () => {
    if (!currentProject) return;

    try {
      const result = await window.api.asideGetLibraryScreenplays(currentProject.id);
      if (result.success && result.screenplays) {
        setLibraryScripts(result.screenplays);
      }
    } catch (error) {
      console.error('[ProductionQueue] 加载待产库失败:', error);
    }
  };

  /**
   * 删除剧本
   */
  const handleDeleteScreenplay = async (screenplayId: string) => {
    if (!confirm('确定要删除此剧本吗？')) {
      return;
    }

    try {
      const result = await window.api.asideRemoveScreenplayFromLibrary(screenplayId);
      if (result.success) {
        removeLibraryScript(screenplayId);
        console.log('[ProductionQueue] 删除剧本成功');
      }
    } catch (error) {
      console.error('[ProductionQueue] 删除剧本失败:', error);
    }
  };

  /**
   * 清空待产库
   */
  const handleClearAll = async () => {
    if (!confirm('确定要清空待产库吗？此操作不可恢复。')) {
      return;
    }

    try {
      // 删除所有剧本
      await Promise.all(
        libraryScripts.map(screenplay => window.api.asideRemoveScreenplayFromLibrary(screenplay.id))
      );
      setLibraryScripts([]);
      console.log('[ProductionQueue] 清空待产库成功');
    } catch (error) {
      console.error('[ProductionQueue] 清空待产库失败:', error);
    }
  };

  return (
    <>
      {/* 待产库按钮 */}
      <button
        onClick={() => {
          setIsModalOpen(true);
          loadLibraryScripts(); // 🔥 打开时刷新数据
        }}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors relative"
      >
        <Inbox className="w-4 h-4" />
        <span>待产库</span>
        {libraryScripts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-violet-600 text-white text-xs rounded-full flex items-center justify-center">
            {libraryScripts.length}
          </span>
        )}
      </button>

      {/* 待产库弹窗 */}
      {isModalOpen && (
        <QueueModal
          screenplays={libraryScripts}
          onClose={() => setIsModalOpen(false)}
          onDelete={handleDeleteScreenplay}
          onClearAll={handleClearAll}
        />
      )}
    </>
  );
}
