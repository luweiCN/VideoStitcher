/**
 * 待产库组件
 * 显示待产库脚本列表，支持拖拽排序、删除、清空
 */

import { useState, useEffect } from 'react';
import { Inbox, Trash2 } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Script } from '@shared/types/aside';
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
      const result = await window.api.getScripts(currentProject.id, 'library');
      if (result.success && result.scripts) {
        setLibraryScripts(result.scripts);
      }
    } catch (error) {
      console.error('[ProductionQueue] 加载待产库失败:', error);
    }
  };

  /**
   * 删除脚本
   */
  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm('确定要删除此脚本吗？')) {
      return;
    }

    try {
      const result = await window.api.deleteScript(scriptId);
      if (result.success) {
        removeLibraryScript(scriptId);
        console.log('[ProductionQueue] 删除脚本成功');
      }
    } catch (error) {
      console.error('[ProductionQueue] 删除脚本失败:', error);
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
      // 删除所有脚本
      await Promise.all(
        libraryScripts.map(script => window.api.deleteScript(script.id))
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
        onClick={() => setIsModalOpen(true)}
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
          scripts={libraryScripts}
          onClose={() => setIsModalOpen(false)}
          onDelete={handleDeleteScript}
          onClearAll={handleClearAll}
        />
      )}
    </>
  );
}
