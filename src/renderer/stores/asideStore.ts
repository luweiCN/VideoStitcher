/**
 * A面视频生产状态管理
 * 使用 Zustand 进行全局状态管理
 */

import { create } from 'zustand';
import type { Project, CreativeDirection, Persona, Script, AIModel } from '@shared/types/aside';

/**
 * 视图类型
 */
export type ASideView =
  | 'library' // 项目库
  | 'step1-direction' // 第一步：创意方向
  | 'step2-region' // 第二步：区域选择
  | 'step3-scripts'; // 第三步：脚本生成

/**
 * A面 Store 接口
 */
interface ASideStore {
  // ==================== 状态 ====================

  /** 当前视图 */
  currentView: ASideView;

  /** 当前选中的项目 */
  currentProject: Project | null;

  /** 当前选中的创意方向 */
  selectedDirection: CreativeDirection | null;

  /** 当前选中的区域 */
  selectedRegion: string;

  /** 当前选中的人设 */
  selectedPersona: Persona | null;

  /** 当前选择的 AI 模型 */
  selectedModel: AIModel;

  /** 要生成的脚本数量 */
  scriptCount: number;

  /** 已生成的脚本列表 */
  generatedScripts: Script[];

  /** 待产库脚本列表 */
  libraryScripts: Script[];

  /** 是否正在加载 */
  isLoading: boolean;

  /** 错误信息 */
  error: string | null;

  // ==================== 导航 Actions ====================

  /** 设置当前视图 */
  setCurrentView: (view: ASideView) => void;

  /** 重置到初始状态 */
  reset: () => void;

  // ==================== 项目 Actions ====================

  /** 选择项目 */
  selectProject: (project: Project) => void;

  // ==================== 创意方向 Actions ====================

  /** 选择创意方向 */
  selectDirection: (direction: CreativeDirection) => void;

  /** 清除创意方向选择 */
  clearDirection: () => void;

  // ==================== 区域 Actions ====================

  /** 选择区域 */
  selectRegion: (region: string) => void;

  // ==================== 人设 Actions ====================

  /** 选择人设 */
  selectPersona: (persona: Persona) => void;

  /** 清除人设选择 */
  clearPersona: () => void;

  // ==================== 模型配置 Actions ====================

  /** 设置 AI 模型 */
  setModel: (model: AIModel) => void;

  /** 设置脚本数量 */
  setScriptCount: (count: number) => void;

  // ==================== 脚本 Actions ====================

  /** 设置生成的脚本列表 */
  setGeneratedScripts: (scripts: Script[]) => void;

  /** 添加生成的脚本 */
  addGeneratedScript: (script: Script) => void;

  /** 移除生成的脚本 */
  removeGeneratedScript: (scriptId: string) => void;

  /** 清空生成的脚本 */
  clearGeneratedScripts: () => void;

  /** 设置待产库脚本列表 */
  setLibraryScripts: (scripts: Script[]) => void;

  /** 添加脚本到待产库 */
  addLibraryScript: (script: Script) => void;

  /** 从待产库移除脚本 */
  removeLibraryScript: (scriptId: string) => void;

  /** 更新待产库中的脚本 */
  updateLibraryScript: (scriptId: string, updates: Partial<Script>) => void;

  // ==================== 加载状态 Actions ====================

  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;

  /** 设置错误信息 */
  setError: (error: string | null) => void;

  /** 清除错误信息 */
  clearError: () => void;
}

/**
 * 初始状态
 */
const initialState = {
  currentView: 'library' as ASideView,
  currentProject: null,
  selectedDirection: null,
  selectedRegion: 'universal',
  selectedPersona: null,
  selectedModel: 'gemini' as AIModel,
  scriptCount: 5,
  generatedScripts: [],
  libraryScripts: [],
  isLoading: false,
  error: null,
};

/**
 * A面视频生产 Store
 */
export const useASideStore = create<ASideStore>((set, get) => ({
  // ==================== 初始状态 ====================

  ...initialState,

  // ==================== 导航 Actions ====================

  setCurrentView: (view) => {
    console.log('[ASideStore] 切换视图:', view);
    set({ currentView: view });
  },

  reset: () => {
    console.log('[ASideStore] 重置状态');
    set(initialState);
  },

  // ==================== 项目 Actions ====================

  selectProject: (project) => {
    console.log('[ASideStore] 选择项目:', project.name);
    set({
      currentProject: project,
      selectedDirection: null,
      selectedPersona: null,
      generatedScripts: [],
      libraryScripts: [],
      error: null,
    });
  },

  // ==================== 创意方向 Actions ====================

  selectDirection: (direction) => {
    console.log('[ASideStore] 选择创意方向:', direction.name);
    set({ selectedDirection: direction });
  },

  clearDirection: () => {
    console.log('[ASideStore] 清除创意方向选择');
    set({ selectedDirection: null });
  },

  // ==================== 区域 Actions ====================

  selectRegion: (region) => {
    console.log('[ASideStore] 选择区域:', region);
    set({ selectedRegion: region });
  },

  // ==================== 人设 Actions ====================

  selectPersona: (persona) => {
    console.log('[ASideStore] 选择人设:', persona.name);
    set({ selectedPersona: persona });
  },

  clearPersona: () => {
    console.log('[ASideStore] 清除人设选择');
    set({ selectedPersona: null });
  },

  // ==================== 模型配置 Actions ====================

  setModel: (model) => {
    console.log('[ASideStore] 设置 AI 模型:', model);
    set({ selectedModel: model });
  },

  setScriptCount: (count) => {
    console.log('[ASideStore] 设置脚本数量:', count);
    set({ scriptCount: count });
  },

  // ==================== 脚本 Actions ====================

  setGeneratedScripts: (scripts) => {
    console.log('[ASideStore] 设置生成的脚本列表，数量:', scripts.length);
    set({ generatedScripts: scripts });
  },

  addGeneratedScript: (script) => {
    console.log('[ASideStore] 添加生成的脚本:', script.id);
    set((state) => ({
      generatedScripts: [...state.generatedScripts, script],
    }));
  },

  removeGeneratedScript: (scriptId) => {
    console.log('[ASideStore] 移除生成的脚本:', scriptId);
    set((state) => ({
      generatedScripts: state.generatedScripts.filter((s) => s.id !== scriptId),
    }));
  },

  clearGeneratedScripts: () => {
    console.log('[ASideStore] 清空生成的脚本');
    set({ generatedScripts: [] });
  },

  setLibraryScripts: (scripts) => {
    console.log('[ASideStore] 设置待产库脚本列表，数量:', scripts.length);
    set({ libraryScripts: scripts });
  },

  addLibraryScript: (script) => {
    console.log('[ASideStore] 添加脚本到待产库:', script.id);
    set((state) => ({
      libraryScripts: [...state.libraryScripts, script],
    }));
  },

  removeLibraryScript: (scriptId) => {
    console.log('[ASideStore] 从待产库移除脚本:', scriptId);
    set((state) => ({
      libraryScripts: state.libraryScripts.filter((s) => s.id !== scriptId),
    }));
  },

  updateLibraryScript: (scriptId, updates) => {
    console.log('[ASideStore] 更新待产库脚本:', scriptId, updates);
    set((state) => ({
      libraryScripts: state.libraryScripts.map((s) =>
        s.id === scriptId ? { ...s, ...updates } : s
      ),
    }));
  },

  // ==================== 加载状态 Actions ====================

  setLoading: (loading) => {
    console.log('[ASideStore] 设置加载状态:', loading);
    set({ isLoading: loading });
  },

  setError: (error) => {
    console.log('[ASideStore] 设置错误信息:', error);
    set({ error });
  },

  clearError: () => {
    console.log('[ASideStore] 清除错误信息');
    set({ error: null });
  },
}));
