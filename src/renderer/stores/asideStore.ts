/**
 * A面视频生产 - 状态管理
 */

import { create } from 'zustand';
import type {
  StyleTemplate,
  ScriptContent,
  ProductionTask,
  QueueItem,
  StyleConfig,
  ProductionConfig,
} from '../pages/ASide/types';

interface ASideState {
  // 当前步骤
  currentStep: 'style' | 'config' | 'scripts' | 'queue';

  // 风格选择
  selectedStyle: StyleTemplate | null;
  styleTemplates: StyleTemplate[];

  // 配置参数
  config: {
    region: string;
    productName: string;
    batchSize: number;
  };

  // 脚本列表
  scripts: ScriptContent[];
  isGeneratingScripts: boolean;

  // 待产库
  queueItems: QueueItem[];

  // 操作方法
  setCurrentStep: (step: 'style' | 'config' | 'scripts' | 'queue') => void;
  selectStyle: (style: StyleTemplate | null) => void;
  updateConfig: (config: Partial<ASideState['config']>) => void;
  setScripts: (scripts: ScriptContent[]) => void;
  addScript: (script: ScriptContent) => void;
  removeScript: (scriptId: string) => void;
  updateScript: (scriptId: string, updates: Partial<ScriptContent>) => void;
  setGeneratingScripts: (isGenerating: boolean) => void;
  addToQueue: (scriptId: string) => void;
  removeFromQueue: (queueItemId: string) => void;
  updateQueuePriority: (queueItemId: string, priority: 'high' | 'normal' | 'low') => void;
  clearQueue: () => void;
}

export const useASideStore = create<ASideState>((set, get) => ({
  // 初始状态
  currentStep: 'style',
  selectedStyle: null,
  styleTemplates: [],
  config: {
    region: '',
    productName: '',
    batchSize: 3,
  },
  scripts: [],
  isGeneratingScripts: false,
  queueItems: [],

  // 步骤控制
  setCurrentStep: (step) => set({ currentStep: step }),

  // 风格选择
  selectStyle: (style) => set({ selectedStyle: style }),

  // 配置更新
  updateConfig: (config) => set((state) => ({
    config: { ...state.config, ...config },
  })),

  // 脚本管理
  setScripts: (scripts) => set({ scripts }),
  addScript: (script) => set((state) => ({
    scripts: [...state.scripts, script],
  })),
  removeScript: (scriptId) => set((state) => ({
    scripts: state.scripts.filter((s) => s.id !== scriptId),
  })),
  updateScript: (scriptId, updates) => set((state) => ({
    scripts: state.scripts.map((s) =>
      s.id === scriptId ? { ...s, ...updates } : s
    ),
  })),
  setGeneratingScripts: (isGenerating) => set({ isGeneratingScripts: isGenerating }),

  // 待产库管理
  addToQueue: (scriptId) => {
    const state = get();
    const script = state.scripts.find((s) => s.id === scriptId);
    if (!script) return;

    const task: ProductionTask = {
      id: `task-${Date.now()}`,
      scriptId,
      status: 'pending',
      progress: 0,
      config: {
        styleId: state.selectedStyle?.id || '',
        resolution: '1080p',
        aspectRatio: '16:9',
        fps: 30,
        format: 'mp4',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const queueItem: QueueItem = {
      id: `queue-${Date.now()}`,
      task,
      script,
      priority: 'normal',
      order: state.queueItems.length,
    };

    set((state) => ({
      queueItems: [...state.queueItems, queueItem],
    }));
  },

  removeFromQueue: (queueItemId) => set((state) => ({
    queueItems: state.queueItems.filter((item) => item.id !== queueItemId),
  })),

  updateQueuePriority: (queueItemId, priority) => set((state) => ({
    queueItems: state.queueItems.map((item) =>
      item.id === queueItemId ? { ...item, priority } : item
    ),
  })),

  clearQueue: () => set({ queueItems: [] }),
}));
