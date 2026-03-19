import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChatPanel } from '@/renderer/pages/ASide/components/DirectorMode/ChatPanel';

const mockGenerateCharacters = vi.fn();
const mockUpdateCharacterImage = vi.fn();
const mockGenerateStoryboard = vi.fn();
const mockComposeVideo = vi.fn();

const mockDirectorMode = {
  characters: [
    {
      id: 'char-1',
      name: '角色A',
      description: '主角描述',
      imageUrl: undefined,
    },
  ],
  storyboard: null,
  characterImages: new Map<string, string>(),
  videos: [],
  isGeneratingCharacters: false,
  isGeneratingStoryboard: false,
  isComposingVideo: false,
  error: null,
  generateCharacters: mockGenerateCharacters,
  regenerateCharacter: vi.fn(),
  generateStoryboard: mockGenerateStoryboard,
  regenerateStoryboard: vi.fn(),
  composeVideo: mockComposeVideo,
  editCharacter: vi.fn(),
  addCharacter: vi.fn(),
  updateCharacterImage: mockUpdateCharacterImage,
  addVideo: vi.fn(),
};

vi.mock('@renderer/pages/ASide/hooks/useDirectorMode', () => ({
  useDirectorMode: () => mockDirectorMode,
}));

describe('ChatPanel 选角流程', () => {
  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  const clickOption = async (label: string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: label }));
    });
  };

  const getLatestEnabledButton = async (label: string) => {
    for (let i = 0; i < 20; i++) {
      const buttons = screen.queryAllByRole('button', { name: label });
      const target = [...buttons].reverse().find((button) => !button.hasAttribute('disabled'));

      if (target) {
        return target;
      }

      await advance(200);
    }

    throw new Error(`未找到可点击按钮: ${label}`);
  };

  const clickLatestEnabledOption = async (label: string) => {
    const target = await getLatestEnabledButton(label);

    await act(async () => {
      fireEvent.click(target);
    });
  };

  const runToCastingFreeMode = async () => {
    await advance(800);
    await advance(1500);
    await clickOption('短视频 (15s以下)');

    await advance(1000);
    await clickOption('竖版 (9:16)');

    await advance(1200);
    await advance(1000);
    await advance(2000);
    await advance(2000);

    await clickOption('无需修改');

    await advance(1500);
    await advance(1000);
    await advance(800);

    await clickOption('自由发挥');
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(),
      writable: true,
    });

    mockGenerateCharacters.mockResolvedValue([
      {
        id: 'char-1',
        name: '角色A',
        description: '主角描述',
        imageUrl: undefined,
      },
    ]);

    (window as any).api = {
      asideGenerateCharacterImage: vi.fn().mockResolvedValue({
        success: true,
        imageUrl: 'https://example.com/char-1.png',
      }),
      asideComposeVideo: vi.fn().mockResolvedValue({ success: true, videoUrl: 'https://example.com/video.mp4' }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('在自由发挥模式下应调用人物形象生成 API', async () => {
    render(
      <ChatPanel
        screenplayId="sp-1"
        isWorkflowInitialized={true}
      />
    );

    await runToCastingFreeMode();
    await advance(50);

    expect((window as any).api.asideGenerateCharacterImage).toHaveBeenCalledTimes(1);
  });

  it('自由发挥后应展示角色确认按钮', async () => {
    render(
      <ChatPanel
        screenplayId="sp-1"
        isWorkflowInitialized={true}
      />
    );

    await runToCastingFreeMode();
    await advance(50);

    expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument();
  });

  it('切换剧本后应重新开始艺术总监流程', async () => {
    const { rerender } = render(
      <ChatPanel
        screenplayId="sp-1"
        isWorkflowInitialized={true}
      />
    );

    await advance(800);
    await advance(1500);
    await clickOption('短视频 (15s以下)');

    rerender(
      <ChatPanel
        screenplayId="sp-2"
        isWorkflowInitialized={true}
      />
    );

    await advance(800);
    await advance(1500);

    const restartButton = await getLatestEnabledButton('短视频 (15s以下)');
    expect(restartButton).toBeInTheDocument();
  });

  it('分镜确认后应进入摄像导演并展示视频确认选项', async () => {
    render(
      <ChatPanel
        screenplayId="sp-1"
        isWorkflowInitialized={true}
      />
    );

    await runToCastingFreeMode();
    await advance(50);

    // 确认角色形象，进入分镜流程
    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    // 确认分镜，进入摄像导演流程
    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    expect(mockComposeVideo).toHaveBeenCalledTimes(1);

    const videoConfirmButton = await getLatestEnabledButton('确认');
    expect(videoConfirmButton).toBeInTheDocument();
  });

  it('摄像导演确认视频时快速重复点击不应重复触发拼接', async () => {
    render(
      <ChatPanel
        screenplayId="sp-1"
        isWorkflowInitialized={true}
      />
    );

    await runToCastingFreeMode();
    await advance(50);

    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    const confirmButton = await getLatestEnabledButton('确认');

    await act(async () => {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
    });

    await advance(2500);

    expect((window as any).api.asideComposeVideo).toHaveBeenCalledTimes(1);
  });

  it('摄像导演确认视频失败时应展示失败提示', async () => {
    (window as any).api.asideComposeVideo.mockResolvedValueOnce({
      success: false,
      error: '拼接服务异常',
    });

    render(
      <ChatPanel
        screenplayId="sp-1"
        isWorkflowInitialized={true}
      />
    );

    await runToCastingFreeMode();
    await advance(50);

    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    await clickLatestEnabledOption('确认');
    await advance(2500);

    expect(screen.getByText('视频拼接失败：拼接服务异常')).toBeInTheDocument();
  });

  it('摄像导演重新生成视频时应再次调用视频生成能力', async () => {
    render(
      <ChatPanel
        screenplayId="sp-1"
        isWorkflowInitialized={true}
      />
    );

    await runToCastingFreeMode();
    await advance(50);

    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    await clickLatestEnabledOption('确认');
    await advance(1500);
    await advance(1000);
    await advance(800);
    await advance(1200);
    await advance(3000);

    expect(mockComposeVideo).toHaveBeenCalledTimes(1);

    await clickLatestEnabledOption('重新生成');
    await advance(3000);

    expect(mockComposeVideo).toHaveBeenCalledTimes(2);
  });
});


