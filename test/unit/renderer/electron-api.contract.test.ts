import { describe, it, expectTypeOf } from 'vitest';
import type { ElectronAPI } from '@/renderer/types/electron';

describe('ElectronAPI 导演模式契约', () => {
  it('应声明 asideInitDirectorWorkflow 方法并返回结构化结果', () => {
    type InitWorkflowFn = ElectronAPI['asideInitDirectorWorkflow'];

    expectTypeOf<InitWorkflowFn>().toEqualTypeOf<(
      data: {
        screenplayId: string;
        scriptContent: string;
        videoSpec: { duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' };
        projectId: string;
        creativeDirectionId?: string;
        personaId?: string;
      }
    ) => Promise<{ success: boolean; state?: unknown; error?: string }>>();
  });
});
