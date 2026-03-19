import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initDirectorWorkflow } from '@/renderer/api/directorMode';

describe('directorMode API - initDirectorWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (window as any).api = {
      asideInitDirectorWorkflow: vi.fn().mockResolvedValue({
        success: true,
        state: { currentStep: 2 },
      }),
    };
  });

  it('应调用 asideInitDirectorWorkflow 并透传结果', async () => {
    const payload = {
      screenplayId: 'sp-1',
      scriptContent: '剧本内容',
      videoSpec: {
        duration: 'short' as const,
        aspectRatio: '9:16' as const,
      },
      projectId: 'project-1',
      creativeDirectionId: 'direction-1',
      personaId: 'persona-1',
    };

    const result = await initDirectorWorkflow(payload);

    expect(window.api.asideInitDirectorWorkflow).toHaveBeenCalledTimes(1);
    expect(window.api.asideInitDirectorWorkflow).toHaveBeenCalledWith(payload);
    expect(result).toEqual({
      success: true,
      state: { currentStep: 2 },
    });
  });
});
