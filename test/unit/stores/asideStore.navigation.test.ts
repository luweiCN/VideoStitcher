/**
 * asideStore 导航功能测试
 */

import { act, renderHook } from '@testing-library/react';
import { useASideStore } from '@renderer/stores/asideStore';

describe('asideStore 导航功能', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    const { result } = renderHook(() => useASideStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('goToNextStep', () => {
    it('应该从 step1 跳转到 step2', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('step1-direction');
      });

      expect(result.current.currentView).toBe('step1-direction');

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentView).toBe('step2-region');
    });

    it('应该从 step2 跳转到 step3', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('step2-region');
      });

      expect(result.current.currentView).toBe('step2-region');

      act(() => {
        result.current.goToNextStep();
      });

      expect(result.current.currentView).toBe('step3-scripts');
    });

    it('在 step3 时应该不执行任何操作', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('step3-scripts');
      });

      expect(result.current.currentView).toBe('step3-scripts');

      act(() => {
        result.current.goToNextStep();
      });

      // 应该保持在 step3
      expect(result.current.currentView).toBe('step3-scripts');
    });

    it('在 library 视图时不应该执行任何操作', () => {
      const { result } = renderHook(() => useASideStore());

      expect(result.current.currentView).toBe('library');

      act(() => {
        result.current.goToNextStep();
      });

      // 应该保持在 library
      expect(result.current.currentView).toBe('library');
    });

    it('在 quick-compose 视图时不应该执行任何操作', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('quick-compose');
      });

      expect(result.current.currentView).toBe('quick-compose');

      act(() => {
        result.current.goToNextStep();
      });

      // 应该保持在 quick-compose
      expect(result.current.currentView).toBe('quick-compose');
    });

    it('在 director-mode 视图时不应该执行任何操作', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('director-mode');
      });

      expect(result.current.currentView).toBe('director-mode');

      act(() => {
        result.current.goToNextStep();
      });

      // 应该保持在 director-mode
      expect(result.current.currentView).toBe('director-mode');
    });
  });

  describe('goToPrevStep', () => {
    it('应该从 step3 返回到 step2', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('step3-scripts');
      });

      expect(result.current.currentView).toBe('step3-scripts');

      act(() => {
        result.current.goToPrevStep();
      });

      expect(result.current.currentView).toBe('step2-region');
    });

    it('应该从 step2 返回到 step1', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('step2-region');
      });

      expect(result.current.currentView).toBe('step2-region');

      act(() => {
        result.current.goToPrevStep();
      });

      expect(result.current.currentView).toBe('step1-direction');
    });

    it('在 step1 时应该返回到 library', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('step1-direction');
      });

      expect(result.current.currentView).toBe('step1-direction');

      act(() => {
        result.current.goToPrevStep();
      });

      expect(result.current.currentView).toBe('library');
    });

    it('在 library 视图时不应该执行任何操作', () => {
      const { result } = renderHook(() => useASideStore());

      expect(result.current.currentView).toBe('library');

      act(() => {
        result.current.goToPrevStep();
      });

      // 应该保持在 library
      expect(result.current.currentView).toBe('library');
    });

    it('在 quick-compose 视图时不应该执行任何操作', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('quick-compose');
      });

      expect(result.current.currentView).toBe('quick-compose');

      act(() => {
        result.current.goToPrevStep();
      });

      // 应该保持在 quick-compose
      expect(result.current.currentView).toBe('quick-compose');
    });

    it('在 director-mode 视图时不应该执行任何操作', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('director-mode');
      });

      expect(result.current.currentView).toBe('director-mode');

      act(() => {
        result.current.goToPrevStep();
      });

      // 应该保持在 director-mode
      expect(result.current.currentView).toBe('director-mode');
    });
  });

  describe('完整导航流程', () => {
    it('应该支持完整的步骤导航流程', () => {
      const { result } = renderHook(() => useASideStore());

      // 从 library 开始
      expect(result.current.currentView).toBe('library');

      // 跳转到 step1
      act(() => {
        result.current.setCurrentView('step1-direction');
      });
      expect(result.current.currentView).toBe('step1-direction');

      // step1 -> step2
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.currentView).toBe('step2-region');

      // step2 -> step3
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.currentView).toBe('step3-scripts');

      // step3 -> step2（返回）
      act(() => {
        result.current.goToPrevStep();
      });
      expect(result.current.currentView).toBe('step2-region');

      // step2 -> step1（返回）
      act(() => {
        result.current.goToPrevStep();
      });
      expect(result.current.currentView).toBe('step1-direction');

      // step1 -> library（返回）
      act(() => {
        result.current.goToPrevStep();
      });
      expect(result.current.currentView).toBe('library');
    });
  });

  describe('特殊视图导航', () => {
    it('应该能够直接跳转到 quick-compose', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('quick-compose');
      });

      expect(result.current.currentView).toBe('quick-compose');

      // quick-compose 不在步骤导航中，goToNextStep 和 goToPrevStep 不应该有任何效果
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.currentView).toBe('quick-compose');

      act(() => {
        result.current.goToPrevStep();
      });
      expect(result.current.currentView).toBe('quick-compose');
    });

    it('应该能够直接跳转到 director-mode', () => {
      const { result } = renderHook(() => useASideStore());

      act(() => {
        result.current.setCurrentView('director-mode');
      });

      expect(result.current.currentView).toBe('director-mode');

      // director-mode 不在步骤导航中，goToNextStep 和 goToPrevStep 不应该有任何效果
      act(() => {
        result.current.goToNextStep();
      });
      expect(result.current.currentView).toBe('director-mode');

      act(() => {
        result.current.goToPrevStep();
      });
      expect(result.current.currentView).toBe('director-mode');
    });
  });
});
