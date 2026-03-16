/**
 * A面视频生产 IPC 处理器测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Mock Electron API
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/mock/user-data'),
  },
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// Mock logger
vi.mock('../../../src/main/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// 导入处理器函数
import {
  registerAsideHandlers,
  GenerateScriptsRequest,
  Script,
  StyleTemplate,
  SessionData,
} from '../../../src/main/ipc/aside-handlers';

describe('A面视频生产 IPC 处理器', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('注册处理器', () => {
    it('应该注册所有 IPC 处理器', () => {
      registerAsideHandlers();

      expect(ipcMain.handle).toHaveBeenCalledWith(
        'aside:generate-scripts',
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'aside:load-styles',
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'aside:save-session',
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'aside:load-session',
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'aside:list-sessions',
        expect.any(Function)
      );
      expect(ipcMain.handle).toHaveBeenCalledWith(
        'aside:delete-session',
        expect.any(Function)
      );

      expect(ipcMain.handle).toHaveBeenCalledTimes(6);
    });
  });

  describe('生成脚本处理器', () => {
    let generateScriptsHandler: any;

    beforeEach(() => {
      registerAsideHandlers();
      const call = vi.mocked(ipcMain.handle).mock.calls.find(
        (call) => call[0] === 'aside:generate-scripts'
      );
      generateScriptsHandler = call?.[1];
    });

    it('应该成功生成指定数量的脚本', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '产品宣传视频',
        selectedStyle: '幽默搞笑',
        batchSize: 3,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(true);
      expect(result.scripts).toBeDefined();
      expect(result.scripts?.length).toBe(3);
      expect(result.error).toBeUndefined();

      result.scripts?.forEach((script: Script, index: number) => {
        expect(script.id).toBeDefined();
        expect(script.text).toContain('模拟脚本');
        expect(script.text).toContain((index + 1).toString());
        expect(script.style).toBe('幽默搞笑');
        expect(script.createdAt).toBeDefined();
        expect(script.selected).toBe(false);
      });
    });

    it('应该验证用户需求不为空', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '',
        selectedStyle: '幽默搞笑',
        batchSize: 3,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('用户需求不能为空');
      expect(result.scripts).toBeUndefined();
    });

    it('应该验证用户需求不为空白', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '   ',
        selectedStyle: '幽默搞笑',
        batchSize: 3,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('用户需求不能为空');
    });

    it('应该验证脚本风格不为空', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '产品宣传',
        selectedStyle: '',
        batchSize: 3,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('脚本风格不能为空');
    });

    it('应该验证批量生成数量的最小值', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '产品宣传',
        selectedStyle: '幽默搞笑',
        batchSize: 0,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('批量生成数量必须在 1-10 之间');
    });

    it('应该验证批量生成数量的最大值', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '产品宣传',
        selectedStyle: '幽默搞笑',
        batchSize: 11,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('批量生成数量必须在 1-10 之间');
    });

    it('应该处理边界值 1', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '产品宣传',
        selectedStyle: '幽默搞笑',
        batchSize: 1,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(true);
      expect(result.scripts?.length).toBe(1);
    });

    it('应该处理边界值 10', async () => {
      const request: GenerateScriptsRequest = {
        userRequirement: '产品宣传',
        selectedStyle: '幽默搞笑',
        batchSize: 10,
      };

      const result = await generateScriptsHandler({}, request);

      expect(result.success).toBe(true);
      expect(result.scripts?.length).toBe(10);
    });
  });

  describe('加载风格模板处理器', () => {
    let loadStylesHandler: any;

    beforeEach(() => {
      registerAsideHandlers();
      const call = vi.mocked(ipcMain.handle).mock.calls.find(
        (call) => call[0] === 'aside:load-styles'
      );
      loadStylesHandler = call?.[1];
    });

    it('应该成功加载风格模板', async () => {
      const result = await loadStylesHandler();

      expect(result.success).toBe(true);
      expect(result.styles).toBeDefined();
      expect(result.styles?.length).toBe(5);
      expect(result.error).toBeUndefined();

      // 验证模板内容
      const styles = result.styles as StyleTemplate[];
      expect(styles[0]).toHaveProperty('id');
      expect(styles[0]).toHaveProperty('name');
      expect(styles[0]).toHaveProperty('description');
      expect(styles[0]).toHaveProperty('icon');
      expect(styles[0]).toHaveProperty('createdAt');
    });

    it('应该返回正确的风格类型', async () => {
      const result = await loadStylesHandler();

      const styleNames = result.styles?.map((s: StyleTemplate) => s.name);
      expect(styleNames).toContain('幽默搞笑');
      expect(styleNames).toContain('悬疑推理');
      expect(styleNames).toContain('教学科普');
      expect(styleNames).toContain('剧情叙事');
      expect(styleNames).toContain('新闻解说');
    });
  });

  describe('保存会话处理器', () => {
    let saveSessionHandler: any;

    beforeEach(() => {
      registerAsideHandlers();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const call = vi.mocked(ipcMain.handle).mock.calls.find(
        (call) => call[0] === 'aside:save-session'
      );
      saveSessionHandler = call?.[1];
    });

    it('应该成功保存会话', async () => {
      const session: SessionData = {
        id: 'session-1',
        name: '测试会话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: { test: 'data' },
      };

      const result = await saveSessionHandler({}, session);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-1');
      expect(result.error).toBeUndefined();

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('应该验证会话 ID 不为空', async () => {
      const session: SessionData = {
        id: '',
        name: '测试会话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: {},
      };

      const result = await saveSessionHandler({}, session);

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话 ID 不能为空');
    });

    it('应该验证会话名称不为空', async () => {
      const session: SessionData = {
        id: 'session-1',
        name: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: {},
      };

      const result = await saveSessionHandler({}, session);

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话名称不能为空');
    });

    it('应该更新时间戳', async () => {
      const oldTime = Date.now() - 1000;
      const session: SessionData = {
        id: 'session-1',
        name: '测试会话',
        createdAt: oldTime,
        updatedAt: oldTime,
        state: {},
      };

      await saveSessionHandler({}, session);

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.updatedAt).toBeGreaterThan(oldTime);
    });

    it('应该为新会话设置创建时间', async () => {
      const session: SessionData = {
        id: 'session-1',
        name: '新会话',
        createdAt: 0 as any,
        updatedAt: 0,
        state: {},
      };

      await saveSessionHandler({}, session);

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData.createdAt).toBeGreaterThan(0);
    });
  });

  describe('加载会话处理器', () => {
    let loadSessionHandler: any;

    beforeEach(() => {
      registerAsideHandlers();

      const call = vi.mocked(ipcMain.handle).mock.calls.find(
        (call) => call[0] === 'aside:load-session'
      );
      loadSessionHandler = call?.[1];
    });

    it('应该成功加载会话', async () => {
      const mockSession: SessionData = {
        id: 'session-1',
        name: '测试会话',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: { test: 'data' },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSession));

      const result = await loadSessionHandler({}, 'session-1');

      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeUndefined();
    });

    it('应该验证会话 ID 不为空', async () => {
      const result = await loadSessionHandler({}, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话 ID 不能为空');
    });

    it('应该处理会话不存在的情况', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await loadSessionHandler({}, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话不存在: non-existent');
    });

    it('应该处理文件读取错误', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('文件读取失败');
      });

      const result = await loadSessionHandler({}, 'session-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('文件读取失败');
    });

    it('应该处理 JSON 解析错误', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const result = await loadSessionHandler({}, 'session-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('列出会话处理器', () => {
    let listSessionsHandler: any;

    beforeEach(() => {
      registerAsideHandlers();

      const call = vi.mocked(ipcMain.handle).mock.calls.find(
        (call) => call[0] === 'aside:list-sessions'
      );
      listSessionsHandler = call?.[1];
    });

    it('应该成功列出所有会话', async () => {
      const mockSessions: SessionData[] = [
        {
          id: 'session-1',
          name: '会话1',
          createdAt: 1000,
          updatedAt: 2000,
          state: {},
        },
        {
          id: 'session-2',
          name: '会话2',
          createdAt: 1500,
          updatedAt: 3000,
          state: {},
        },
      ];

      vi.mocked(fs.readdirSync).mockReturnValue(['session-1.json', 'session-2.json']);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockSessions[0]))
        .mockReturnValueOnce(JSON.stringify(mockSessions[1]));

      const result = await listSessionsHandler();

      expect(result.success).toBe(true);
      expect(result.sessions).toBeDefined();
      expect(result.sessions?.length).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('应该按更新时间排序会话（最新的在前）', async () => {
      const mockSessions: SessionData[] = [
        {
          id: 'session-1',
          name: '旧会话',
          createdAt: 1000,
          updatedAt: 1000,
          state: {},
        },
        {
          id: 'session-2',
          name: '新会话',
          createdAt: 2000,
          updatedAt: 2000,
          state: {},
        },
      ];

      vi.mocked(fs.readdirSync).mockReturnValue(['session-1.json', 'session-2.json']);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(mockSessions[0]))
        .mockReturnValueOnce(JSON.stringify(mockSessions[1]));

      const result = await listSessionsHandler();

      expect(result.sessions?.[0].id).toBe('session-2'); // 更新的会话在前
      expect(result.sessions?.[1].id).toBe('session-1');
    });

    it('应该过滤非 JSON 文件', async () => {
      vi.mocked(fs.readdirSync).mockReturnValue(['session-1.json', 'readme.txt', 'data.db']);

      const result = await listSessionsHandler();

      expect(result.success).toBe(true);
      expect(result.sessions).toEqual([]);
    });

    it('应该处理空目录', async () => {
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const result = await listSessionsHandler();

      expect(result.success).toBe(true);
      expect(result.sessions).toEqual([]);
    });

    it('应该处理读取错误', async () => {
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error('读取目录失败');
      });

      const result = await listSessionsHandler();

      expect(result.success).toBe(false);
      expect(result.error).toBe('读取目录失败');
    });
  });

  describe('删除会话处理器', () => {
    let deleteSessionHandler: any;

    beforeEach(() => {
      registerAsideHandlers();

      const call = vi.mocked(ipcMain.handle).mock.calls.find(
        (call) => call[0] === 'aside:delete-session'
      );
      deleteSessionHandler = call?.[1];
    });

    it('应该成功删除会话', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      const result = await deleteSessionHandler({}, 'session-1');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('应该验证会话 ID 不为空', async () => {
      const result = await deleteSessionHandler({}, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话 ID 不能为空');
    });

    it('应该处理会话不存在的情况', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await deleteSessionHandler({}, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('会话不存在: non-existent');
    });

    it('应该处理删除错误', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error('删除失败');
      });

      const result = await deleteSessionHandler({}, 'session-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('删除失败');
    });
  });
});
