/**
 * A面视频生产 Store 集成测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useASideStore } from '../../../src/renderer/stores/asideStore';
import type {
  StyleTemplate,
  ScriptContent,
  ProductionTask,
  QueueItem,
} from '../../../src/renderer/pages/ASide/types';

// Mock 数据
const mockStyleTemplate: StyleTemplate = {
  id: 'style-1',
  name: '幽默搞笑',
  description: '轻松幽默，引人发笑的风格',
  thumbnail: 'https://example.com/thumb.jpg',
  category: '热门',
  tags: ['搞笑', '轻松'],
  config: {
    colorTone: 'warm',
    transitionStyle: 'dynamic',
    textAnimation: 'bounce',
    cameraMovement: 'dynamic',
    shotDuration: 3,
    bgmStyle: 'upbeat',
    bgmVolume: 80,
    voiceVolume: 100,
  },
};

const mockScript: ScriptContent = {
  id: 'script-1',
  title: '测试脚本',
  scenes: [
    {
      id: 'scene-1',
      sequence: 1,
      content: '开场白',
      duration: 5,
      visualHint: '明亮的背景',
      transition: 'fade',
    },
    {
      id: 'scene-2',
      sequence: 2,
      content: '主要内容',
      duration: 10,
      visualHint: '产品展示',
      transition: 'slide',
    },
  ],
  totalDuration: 15,
  createdAt: new Date(),
};

describe('A面视频生产 Store (asideStore)', () => {
  beforeEach(() => {
    // 重置 store
    useASideStore.setState({
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
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useASideStore.getState();

      expect(state.currentStep).toBe('style');
      expect(state.selectedStyle).toBeNull();
      expect(state.styleTemplates).toEqual([]);
      expect(state.config).toEqual({
        region: '',
        productName: '',
        batchSize: 3,
      });
      expect(state.scripts).toEqual([]);
      expect(state.isGeneratingScripts).toBe(false);
      expect(state.queueItems).toEqual([]);
    });
  });

  describe('步骤控制', () => {
    it('应该能够设置当前步骤', () => {
      const { setCurrentStep } = useASideStore.getState();

      setCurrentStep('config');
      expect(useASideStore.getState().currentStep).toBe('config');

      setCurrentStep('scripts');
      expect(useASideStore.getState().currentStep).toBe('scripts');

      setCurrentStep('queue');
      expect(useASideStore.getState().currentStep).toBe('queue');

      setCurrentStep('style');
      expect(useASideStore.getState().currentStep).toBe('style');
    });
  });

  describe('风格选择', () => {
    it('应该能够选择风格模板', () => {
      const { selectStyle } = useASideStore.getState();

      selectStyle(mockStyleTemplate);
      expect(useASideStore.getState().selectedStyle).toEqual(mockStyleTemplate);
    });

    it('应该能够取消选择风格模板', () => {
      const { selectStyle } = useASideStore.getState();

      selectStyle(mockStyleTemplate);
      expect(useASideStore.getState().selectedStyle).toEqual(mockStyleTemplate);

      selectStyle(null);
      expect(useASideStore.getState().selectedStyle).toBeNull();
    });
  });

  describe('配置更新', () => {
    it('应该能够更新单个配置项', () => {
      const { updateConfig } = useASideStore.getState();

      updateConfig({ region: '中国' });
      expect(useASideStore.getState().config.region).toBe('中国');
    });

    it('应该能够同时更新多个配置项', () => {
      const { updateConfig } = useASideStore.getState();

      updateConfig({
        region: '美国',
        productName: '测试产品',
        batchSize: 5,
      });

      const config = useASideStore.getState().config;
      expect(config.region).toBe('美国');
      expect(config.productName).toBe('测试产品');
      expect(config.batchSize).toBe(5);
    });

    it('应该保留未更新的配置项', () => {
      const { updateConfig } = useASideStore.getState();

      updateConfig({ region: '日本', batchSize: 10 });
      updateConfig({ productName: '新产品' });

      const config = useASideStore.getState().config;
      expect(config.region).toBe('日本');
      expect(config.batchSize).toBe(10);
      expect(config.productName).toBe('新产品');
    });
  });

  describe('脚本管理', () => {
    it('应该能够设置脚本列表', () => {
      const { setScripts } = useASideStore.getState();
      const scripts = [mockScript];

      setScripts(scripts);
      expect(useASideStore.getState().scripts).toEqual(scripts);
    });

    it('应该能够添加单个脚本', () => {
      const { addScript } = useASideStore.getState();

      addScript(mockScript);
      expect(useASideStore.getState().scripts).toHaveLength(1);
      expect(useASideStore.getState().scripts[0]).toEqual(mockScript);

      const anotherScript = { ...mockScript, id: 'script-2' };
      addScript(anotherScript);
      expect(useASideStore.getState().scripts).toHaveLength(2);
    });

    it('应该能够删除脚本', () => {
      const { setScripts, removeScript } = useASideStore.getState();
      const scripts = [
        mockScript,
        { ...mockScript, id: 'script-2' },
        { ...mockScript, id: 'script-3' },
      ];

      setScripts(scripts);
      expect(useASideStore.getState().scripts).toHaveLength(3);

      removeScript('script-2');
      expect(useASideStore.getState().scripts).toHaveLength(2);
      expect(useASideStore.getState().scripts.find((s) => s.id === 'script-2')).toBeUndefined();
    });

    it('应该能够更新脚本', () => {
      const { setScripts, updateScript } = useASideStore.getState();
      setScripts([mockScript]);

      updateScript('script-1', { title: '更新后的标题' });

      const updated = useASideStore.getState().scripts.find((s) => s.id === 'script-1');
      expect(updated?.title).toBe('更新后的标题');
      expect(updated?.totalDuration).toBe(15); // 保留未更新的字段
    });

    it('删除不存在的脚本应该不产生效果', () => {
      const { setScripts, removeScript } = useASideStore.getState();
      setScripts([mockScript]);

      removeScript('non-existent-id');
      expect(useASideStore.getState().scripts).toHaveLength(1);
    });

    it('更新不存在的脚本应该不产生效果', () => {
      const { setScripts, updateScript } = useASideStore.getState();
      setScripts([mockScript]);

      updateScript('non-existent-id', { title: '新标题' });
      expect(useASideStore.getState().scripts[0].title).toBe('测试脚本');
    });

    it('应该能够设置生成状态', () => {
      const { setGeneratingScripts } = useASideStore.getState();

      setGeneratingScripts(true);
      expect(useASideStore.getState().isGeneratingScripts).toBe(true);

      setGeneratingScripts(false);
      expect(useASideStore.getState().isGeneratingScripts).toBe(false);
    });
  });

  describe('待产库管理', () => {
    beforeEach(() => {
      const { selectStyle, setScripts } = useASideStore.getState();
      selectStyle(mockStyleTemplate);
      setScripts([mockScript]);
    });

    it('应该能够添加脚本到待产库', () => {
      const { addToQueue } = useASideStore.getState();

      addToQueue('script-1');
      expect(useASideStore.getState().queueItems).toHaveLength(1);

      const queueItem = useASideStore.getState().queueItems[0];
      expect(queueItem.script).toEqual(mockScript);
      expect(queueItem.priority).toBe('normal');
      expect(queueItem.task.status).toBe('pending');
      expect(queueItem.task.progress).toBe(0);
    });

    it('应该能够从待产库移除项目', () => {
      const { addToQueue, removeFromQueue } = useASideStore.getState();

      addToQueue('script-1');
      const queueItemId = useASideStore.getState().queueItems[0].id;

      removeFromQueue(queueItemId);
      expect(useASideStore.getState().queueItems).toHaveLength(0);
    });

    it('应该能够更新待产库项目的优先级', () => {
      const { addToQueue, updateQueuePriority } = useASideStore.getState();

      addToQueue('script-1');
      const queueItemId = useASideStore.getState().queueItems[0].id;

      updateQueuePriority(queueItemId, 'high');
      expect(useASideStore.getState().queueItems[0].priority).toBe('high');

      updateQueuePriority(queueItemId, 'low');
      expect(useASideStore.getState().queueItems[0].priority).toBe('low');
    });

    it('应该能够清空待产库', () => {
      const { addToQueue, clearQueue } = useASideStore.getState();

      addToQueue('script-1');
      expect(useASideStore.getState().queueItems).toHaveLength(1);

      clearQueue();
      expect(useASideStore.getState().queueItems).toHaveLength(0);
    });

    it('添加不存在的脚本到待产库应该不产生效果', () => {
      const { addToQueue } = useASideStore.getState();

      addToQueue('non-existent-script');
      expect(useASideStore.getState().queueItems).toHaveLength(0);
    });

    it('添加到待产库时应该使用选中的风格模板', () => {
      const { addToQueue } = useASideStore.getState();

      addToQueue('script-1');
      const queueItem = useASideStore.getState().queueItems[0];

      expect(queueItem.task.config.styleId).toBe('style-1');
    });

    it('待产库项目应该按添加顺序排列', () => {
      const { setScripts, addToQueue } = useASideStore.getState();

      const scripts = [
        mockScript,
        { ...mockScript, id: 'script-2' },
        { ...mockScript, id: 'script-3' },
      ];
      setScripts(scripts);

      addToQueue('script-1');
      addToQueue('script-2');
      addToQueue('script-3');

      const queueItems = useASideStore.getState().queueItems;
      expect(queueItems[0].order).toBe(0);
      expect(queueItems[1].order).toBe(1);
      expect(queueItems[2].order).toBe(2);
    });
  });

  describe('复杂交互流程', () => {
    it('应该支持完整的视频生产流程', () => {
      const store = useASideStore.getState();

      // 1. 选择风格
      store.selectStyle(mockStyleTemplate);
      expect(useASideStore.getState().selectedStyle).toEqual(mockStyleTemplate);

      // 2. 配置参数
      store.updateConfig({
        region: '中国',
        productName: '测试产品',
        batchSize: 5,
      });
      expect(useASideStore.getState().config.batchSize).toBe(5);

      // 3. 切换到配置步骤
      store.setCurrentStep('config');
      expect(useASideStore.getState().currentStep).toBe('config');

      // 4. 生成脚本
      store.setGeneratingScripts(true);
      const scripts = Array.from({ length: 5 }, (_, i) => ({
        ...mockScript,
        id: `script-${i + 1}`,
        title: `脚本 ${i + 1}`,
      }));
      store.setScripts(scripts);
      store.setGeneratingScripts(false);

      expect(useASideStore.getState().scripts).toHaveLength(5);
      expect(useASideStore.getState().isGeneratingScripts).toBe(false);

      // 5. 切换到脚本步骤
      store.setCurrentStep('scripts');
      expect(useASideStore.getState().currentStep).toBe('scripts');

      // 6. 选择脚本添加到待产库
      store.addToQueue('script-1');
      store.addToQueue('script-3');
      expect(useASideStore.getState().queueItems).toHaveLength(2);

      // 7. 更新优先级
      const queueItemId = useASideStore.getState().queueItems[0].id;
      store.updateQueuePriority(queueItemId, 'high');
      expect(useASideStore.getState().queueItems[0].priority).toBe('high');

      // 8. 切换到待产库步骤
      store.setCurrentStep('queue');
      expect(useASideStore.getState().currentStep).toBe('queue');
    });

    it('应该支持脚本编辑和更新的流程', () => {
      const { setScripts, updateScript } = useASideStore.getState();

      // 添加初始脚本
      setScripts([mockScript]);

      // 编辑脚本标题
      updateScript('script-1', { title: '新标题' });
      expect(useASideStore.getState().scripts[0].title).toBe('新标题');

      // 编辑脚本的场景
      updateScript('script-1', {
        scenes: [
          ...mockScript.scenes,
          {
            id: 'scene-3',
            sequence: 3,
            content: '结尾',
            duration: 3,
          },
        ],
        totalDuration: 18,
      });

      const updated = useASideStore.getState().scripts[0];
      expect(updated.scenes).toHaveLength(3);
      expect(updated.totalDuration).toBe(18);
    });

    it('应该支持待产库的完整管理流程', () => {
      const { setScripts, addToQueue, updateQueuePriority, removeFromQueue } =
        useASideStore.getState();

      // 准备多个脚本
      const scripts = [
        mockScript,
        { ...mockScript, id: 'script-2' },
        { ...mockScript, id: 'script-3' },
      ];
      setScripts(scripts);

      // 添加到待产库
      addToQueue('script-1');
      addToQueue('script-2');
      addToQueue('script-3');

      expect(useASideStore.getState().queueItems).toHaveLength(3);

      // 更新优先级
      const item1 = useASideStore.getState().queueItems[0];
      const item2 = useASideStore.getState().queueItems[1];

      updateQueuePriority(item1.id, 'high');
      updateQueuePriority(item2.id, 'low');

      expect(useASideStore.getState().queueItems[0].priority).toBe('high');
      expect(useASideStore.getState().queueItems[1].priority).toBe('low');

      // 移除一个项目
      const item3 = useASideStore.getState().queueItems[2];
      removeFromQueue(item3.id);

      expect(useASideStore.getState().queueItems).toHaveLength(2);
    });

    it('应该支持重置状态并开始新会话', () => {
      const store = useASideStore.getState();

      // 设置完整状态
      store.selectStyle(mockStyleTemplate);
      store.updateConfig({ region: '中国', productName: '产品', batchSize: 5 });
      store.setScripts([mockScript]);
      store.addToQueue('script-1');
      store.setCurrentStep('queue');

      // 重置状态
      useASideStore.setState({
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
      });

      const state = useASideStore.getState();
      expect(state.currentStep).toBe('style');
      expect(state.selectedStyle).toBeNull();
      expect(state.scripts).toHaveLength(0);
      expect(state.queueItems).toHaveLength(0);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空脚本列表', () => {
      const { setScripts, removeScript } = useASideStore.getState();

      setScripts([]);
      removeScript('non-existent');

      expect(useASideStore.getState().scripts).toEqual([]);
    });

    it('应该处理空待产库', () => {
      const { removeFromQueue, updateQueuePriority, clearQueue } = useASideStore.getState();

      removeFromQueue('non-existent');
      updateQueuePriority('non-existent', 'high');
      clearQueue();

      expect(useASideStore.getState().queueItems).toEqual([]);
    });

    it('应该处理重复添加相同脚本到待产库', () => {
      const { setScripts, addToQueue } = useASideStore.getState();
      setScripts([mockScript]);

      addToQueue('script-1');
      addToQueue('script-1');

      // 虽然添加两次，但应该创建两个不同的任务
      expect(useASideStore.getState().queueItems).toHaveLength(2);
    });

    it('应该处理批量操作', () => {
      const { setScripts, addScript } = useASideStore.getState();

      // 设置初始脚本
      const scripts = Array.from({ length: 100 }, (_, i) => ({
        ...mockScript,
        id: `script-${i}`,
        title: `脚本 ${i}`,
      }));

      setScripts(scripts);
      expect(useASideStore.getState().scripts).toHaveLength(100);

      // 添加更多脚本
      addScript({ ...mockScript, id: 'script-100' });
      expect(useASideStore.getState().scripts).toHaveLength(101);
    });

    it('应该处理配置的多次更新', () => {
      const { updateConfig } = useASideStore.getState();

      for (let i = 0; i < 10; i++) {
        updateConfig({ batchSize: i + 1 });
      }

      expect(useASideStore.getState().config.batchSize).toBe(10);
    });
  });
});
