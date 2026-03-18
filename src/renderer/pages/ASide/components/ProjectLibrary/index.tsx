/**
 * 项目库组件
 * 显示所有项目列表，支持创建、删除项目
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Folder, ArrowLeft } from 'lucide-react';
import { useASideStore } from '@renderer/stores/asideStore';
import { useConfirm } from '@renderer/hooks/useConfirm';
import type { Project, GameType } from '@shared/types/aside';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './CreateProjectModal';
import { EditProjectModal } from './EditProjectModal';

/**
 * 项目库主组件
 */
export function ProjectLibrary() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();
  const { selectProject, setCurrentView } = useASideStore();
  const confirm = useConfirm();

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, []);

  /**
   * 加载项目列表
   */
  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const result = await window.api.asideGetProjects();
      if (result.success && result.projects) {
        setProjects(result.projects);
      }
    } catch (error) {
      console.error('[ProjectLibrary] 加载项目列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 创建新项目
   */
  const handleCreateProject = async (name: string, gameType: GameType, sellingPoint?: string) => {
    try {
      const result = await window.api.asideCreateProject(name, gameType, sellingPoint);
      if (result.success && result.project) {
        setProjects([...projects, result.project]);
        setIsCreateModalOpen(false);
        console.log('[ProjectLibrary] 创建项目成功:', result.project.name);

        // 自动选择该项目并跳转到 Step 1
        selectProject(result.project);
        setCurrentView('step1-direction');
        console.log('[ProjectLibrary] 已自动选择项目并跳转到创意方向选择');
      }
    } catch (error) {
      console.error('[ProjectLibrary] 创建项目失败:', error);
    }
  };

  /**
   * 删除项目
   */
  const handleDeleteProject = async (project: Project) => {
    const confirmed = await confirm({
      title: '确认删除项目',
      message: `确定要删除项目「${project.name}」吗？此操作将删除所有相关的创意方向、人设和剧本数据，且无法恢复。`,
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const result = await window.api.asideDeleteProject(project.id);
      if (result.success) {
        setProjects(projects.filter(p => p.id !== project.id));
        console.log('[ProjectLibrary] 删除项目成功');
      }
    } catch (error) {
      console.error('[ProjectLibrary] 删除项目失败:', error);
    }
  };

  /**
   * 更新项目
   */
  const handleUpdateProject = async (id: string, data: { name: string; gameType: GameType; sellingPoint?: string }) => {
    try {
      const result = await window.api.asideUpdateProject(id, data);
      if (result.success && result.project) {
        setProjects(projects.map(p => p.id === id ? result.project : p));
        setEditingProject(null);
        console.log('[ProjectLibrary] 更新项目成功:', result.project.name);
      }
    } catch (error) {
      console.error('[ProjectLibrary] 更新项目失败:', error);
    }
  };

  /**
   * 返回首页
   */
  const handleBackToHome = () => {
    navigate('/');
  };

  /**
   * 进入项目（跳转到 Step 1）
   */
  const handleEnterProject = (project: Project) => {
    selectProject(project);
    setCurrentView('step1-direction');
  };

  return (
    <div className="h-full flex flex-col bg-black text-slate-100">
      {/* 头部 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>
          <div className="h-6 w-px bg-slate-700" />
          <div>
            <h1 className="text-2xl font-bold">项目库</h1>
            <p className="text-sm text-slate-500 mt-1">选择或创建一个项目开始生产视频</p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          <span>创建项目</span>
        </button>
      </header>

      {/* 项目列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">加载中...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Folder className="w-16 h-16 text-slate-700 mb-4" />
            <p className="text-slate-500 mb-2">还没有任何项目</p>
            <p className="text-sm text-slate-600">点击右上角按钮创建第一个项目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onEnter={() => handleEnterProject(project)}
                onEdit={() => setEditingProject(project)}
                onDelete={() => handleDeleteProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 创建项目弹窗 */}
      {isCreateModalOpen && (
        <CreateProjectModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateProject}
        />
      )}

      {/* 编辑项目弹窗 */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdate={handleUpdateProject}
        />
      )}
    </div>
  );
}
