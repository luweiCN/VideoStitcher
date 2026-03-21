/**
 * 人设管理器组件
 * 显示人设列表，支持选择、添加、编辑人设
 */

import { useState, useEffect } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import { useConfirm } from '@renderer/hooks/useConfirm';
import type { Persona } from '@shared/types/aside';
import { PersonaCard } from './PersonaCard';
import { AddPersonaModal } from './AddPersonaModal';
import { EditPersonaModal } from './EditPersonaModal';

export function PersonaManager() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { currentProject, selectedPersona, selectPersona } = useASideStore();
  const confirm = useConfirm();

  // 加载人设列表
  useEffect(() => {
    if (currentProject) {
      loadPersonas();
    }
  }, [currentProject]);

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

  const handleAddPersona = async (name: string, prompt: string, characteristics?: string[]) => {
    if (!currentProject) return;

    try {
      const result = await window.api.asideAddPersona({
        projectId: currentProject.id,
        name,
        prompt,
        characteristics,
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

  const handleEditPersona = async (personaId: string, name: string, prompt: string, characteristics?: string[]) => {
    try {
      const result = await window.api.asideUpdatePersona(personaId, { name, prompt, characteristics });
      if (result.success) {
        await loadPersonas();
        setEditingPersona(null);
        console.log('[PersonaManager] 编辑人设成功');
      }
    } catch (error) {
      console.error('[PersonaManager] 编辑人设失败:', error);
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    const confirmed = await confirm({
      title: '确认删除人设',
      message: '确定要删除此人设吗？此操作无法撤销。',
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'danger',
    });

    if (!confirmed) return;

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
    <Tooltip.Provider delayDuration={200}>
      <div className="h-full flex flex-col bg-black text-slate-100">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">人设管理</h2>
            <p className="text-xs text-slate-500 mt-0.5">选择角色人设生成剧本</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>添加人设</span>
          </button>
        </div>

        {/* 人设列表 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-slate-500">加载中...</div>
            </div>
          ) : personas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-slate-500 mb-1">还没有任何人设</p>
              <p className="text-xs text-slate-600">点击右上角按钮添加</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            projectId={currentProject.id}
            onClose={() => setIsAddModalOpen(false)}
            onAdd={handleAddPersona}
          />
        )}

        {/* 编辑人设弹窗 */}
        {editingPersona && (
          <EditPersonaModal
            persona={editingPersona}
            onClose={() => setEditingPersona(null)}
            onSave={(name, prompt, characteristics) =>
              handleEditPersona(editingPersona.id, name, prompt, characteristics)
            }
          />
        )}
      </div>
    </Tooltip.Provider>
  );
}
