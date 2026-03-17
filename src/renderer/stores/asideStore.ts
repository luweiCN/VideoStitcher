/**
 * A面视频生产状态管理
 * 使用 Zustand 进行全局状态管理
 */

import { create } from 'zustand';
import type { Project, CreativeDirection, Persona, Screenplay, AIModel } from '@shared/types/aside';

/**
 * 视图类型
 */
export type ASideView =
  | 'library' // 项目库
  | 'step1-direction' // 第一步：创意方向
  | 'step2-region' // 第二步：区域选择
  | 'step3-scripts' // 第三步：剧本生成
  | 'quick-compose' // 快速合成
  | 'director-mode'; // 导演模式：视频生成

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

  /** 要生成的剧本数量 */
  scriptCount: number;

  /** 已生成的剧本列表 */
  generatedScripts: Screenplay[];

  /** 待产库剧本列表 */
  libraryScripts: Screenplay[];

  /** 是否正在加载 */
  isLoading: boolean;

  /** 错误信息 */
  error: string | null;

  // ==================== 导航 Actions ====================

  /** 设置当前视图 */
  setCurrentView: (view: ASideView) => void;

  /** 跳转到下一步 */
  goToNextStep: () => void;

  /** 返回上一步 */
  goToPrevStep: () => void;

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

  /** 设置剧本数量 */
  setScriptCount: (count: number) => void;

  // ==================== 剧本 Actions ====================

  /** 设置生成的剧本列表 */
  setGeneratedScripts: (screenplays: Screenplay[]) => void;

  /** 添加生成的剧本 */
  addGeneratedScript: (screenplay: Screenplay) => void;

  /** 移除生成的剧本 */
  removeGeneratedScript: (screenplayId: string) => void;

  /** 清空生成的剧本 */
  clearGeneratedScripts: () => void;

  /** 设置待产库剧本列表 */
  setLibraryScripts: (screenplays: Screenplay[]) => void;

  /** 添加剧本到待产库 */
  addLibraryScript: (screenplay: Screenplay) => void;

  /** 从待产库移除剧本 */
  removeLibraryScript: (screenplayId: string) => void;

  /** 更新待产库中的剧本 */
  updateLibraryScript: (screenplayId: string, updates: Partial<Screenplay>) => void;

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

  goToNextStep: () => {
    const { currentView } = get();
    const stepOrder: ASideView[] = ['step1-direction', 'step2-region', 'step3-scripts'];
    const currentIndex = stepOrder.indexOf(currentView);

    if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
      const nextView = stepOrder[currentIndex + 1];
      console.log('[ASideStore] 跳转到下一步:', nextView);
      set({ currentView: nextView });
    } else {
      console.log('[ASideStore] 已在最后一步或不在步骤视图中，无法继续');
    }
  },

  goToPrevStep: () => {
    const { currentView } = get();
    const stepOrder: ASideView[] = ['step1-direction', 'step2-region', 'step3-scripts'];
    const currentIndex = stepOrder.indexOf(currentView);

    if (currentIndex > 0) {
      const prevView = stepOrder[currentIndex - 1];
      console.log('[ASideStore] 返回上一步:', prevView);
      set({ currentView: prevView });
    } else if (currentIndex === 0) {
      console.log('[ASideStore] 在第一步，返回项目库');
      set({ currentView: 'library' });
    } else {
      console.log('[ASideStore] 不在步骤视图中，无法返回');
    }
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
    console.log('[ASideStore] 设置剧本数量:', count);
    set({ scriptCount: count });
  },

  // ==================== 剧本 Actions ====================

  setGeneratedScripts: (screenplays) => {
    console.log('[ASideStore] 设置生成的剧本列表，数量:', screenplays.length);
    set({ generatedScripts: screenplays });
  },

  addGeneratedScript: (screenplay) => {
    console.log('[ASideStore] 添加生成的剧本:', screenplay.id);
    set((state) => ({
      generatedScripts: [...state.generatedScripts, screenplay],
    }));
  },

  removeGeneratedScript: (screenplayId) => {
    console.log('[ASideStore] 移除生成的剧本:', screenplayId);
    set((state) => ({
      generatedScripts: state.generatedScripts.filter((s) => s.id !== screenplayId),
    }));
  },

  clearGeneratedScripts: () => {
    console.log('[ASideStore] 清空生成的剧本');
    set({ generatedScripts: [] });
  },

  setLibraryScripts: (screenplays) => {
    console.log('[ASideStore] 设置待产库剧本列表，数量:', screenplays.length);
    set({ libraryScripts: screenplays });
  },

  addLibraryScript: (screenplay) => {
    console.log('[ASideStore] 添加剧本到待产库:', screenplay.id);
    set((state) => ({
      libraryScripts: [...state.libraryScripts, screenplay],
    }));
  },

  removeLibraryScript: (screenplayId) => {
    console.log('[ASideStore] 从待产库移除剧本:', screenplayId);
    set((state) => ({
      libraryScripts: state.libraryScripts.filter((s) => s.id !== screenplayId),
    }));
  },

  updateLibraryScript: (screenplayId, updates) => {
    console.log('[ASideStore] 更新待产库剧本:', screenplayId, updates);
    set((state) => ({
      libraryScripts: state.libraryScripts.map((s) =>
        s.id === screenplayId ? { ...s, ...updates } : s
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
