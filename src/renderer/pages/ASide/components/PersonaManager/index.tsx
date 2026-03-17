/**
 * 人设管理器组件
 * 显示人设列表，支持选择、添加、编辑人设
 */

import { useState, useEffect } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Persona } from '@shared/types/aside';
import { PersonaCard } from './PersonaCard';
import { AddPersonaModal } from './AddPersonaModal';
import { EditPersonaModal } from './EditPersonaModal';

/**
 * 人设管理器主组件
 */
export function PersonaManager() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { currentProject, selectedPersona, selectPersona } = useASideStore();

  // 加载人设列表
  useEffect(() => {
    if (currentProject) {
      loadPersonas();
    }
  }, [currentProject]);

  /**
   * 加载人设列表
   */
  const loadPersonas = async () => {
    if (!currentProject) return;

    try {
      setIsLoading(true);
      const result = await window.api.asideGetPersonas(currentProject.id);
      if (result.success && result.personas) {
        setPersonas(result.personas);
      }
    } catch (error) {
      console.error('[PersonaManager] 加载人设列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 添加人设
   */
  const handleAddPersona = async (name: string, prompt: string) => {
    if (!currentProject) return;

    try {
      const result = await window.api.asideAddPersona({
        projectId: currentProject.id,
        name,
        prompt,
      });
      if (result.success && result.persona) {
        setPersonas([...personas, result.persona]);
        setIsAddModalOpen(false);
        console.log('[PersonaManager] 添加人设成功:', result.persona.name);
      }
    } catch (error) {
      console.error('[PersonaManager] 添加人设失败:', error);
    }
  };

  /**
   * 编辑人设
   */
  const handleEditPersona = async (personaId: string, name: string, prompt: string) => {
    try {
      const result = await window.api.asideUpdatePersona(personaId, { name, prompt });
      if (result.success) {
        // 重新加载列表
        await loadPersonas();
        setEditingPersona(null);
        console.log('[PersonaManager] 编辑人设成功');
      }
    } catch (error) {
      console.error('[PersonaManager] 编辑人设失败:', error);
    }
  };

  /**
   * 删除人设
   */
  const handleDeletePersona = async (personaId: string) => {
    if (!confirm('确定要删除此人设吗？')) {
      return;
    }

    try {
      const result = await window.api.asideDeletePersona(personaId);
      if (result.success) {
        setPersonas(personas.filter(p => p.id !== personaId));
        console.log('[PersonaManager] 删除人设成功');
      }
    } catch (error) {
      console.error('[PersonaManager] 删除人设失败:', error);
    }
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">人设管理</h2>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>添加人设</span>
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">选择一个角色人设来生成脚本</p>
      </header>

      {/* 人设列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">加载中...</div>
          </div>
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-slate-500 mb-2">还没有任何人设</p>
            <p className="text-sm text-slate-600">点击右上角按钮添加人设</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personas.map(persona => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isSelected={selectedPersona?.id === persona.id}
                onSelect={() => selectPersona(persona)}
                onEdit={() => setEditingPersona(persona)}
                onDelete={() => handleDeletePersona(persona.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 添加人设弹窗 */}
      {isAddModalOpen && (
        <AddPersonaModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddPersona}
        />
      )}

      {/* 编辑人设弹窗 */}
      {editingPersona && (
        <EditPersonaModal
          persona={editingPersona}
          onClose={() => setEditingPersona(null)}
          onSave={(name, prompt) => handleEditPersona(editingPersona.id, name, prompt)}
        />
      )}
    </div>
  );
}
