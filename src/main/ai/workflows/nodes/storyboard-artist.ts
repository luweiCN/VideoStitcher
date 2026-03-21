/**
 * 分镜师 Agent
 * Agent 4: 根据人物图和剧本生成分镜图（图像）
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, TextGenerationOptions, ImageGenerationOptions } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';
import { StoryboardArtistAgentPrompts } from '../../prompts/storyboard-artist-agent';
import { downloadToCache } from '@main/utils/cache';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp');

/**
 * 分镜师 Agent 节点
 */
export async function storyboardArtistNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 4: 分镜师] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成
    if (state.step4_video) {
      console.log('[Agent 4: 分镜师] 步骤已完成，跳过执行');
      return {};
    }

    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取上下文信息
    const artDirectorOutput = state.step2_characters?.content;
    const castingDirectorOutput = state.step3_storyboard?.content; // 选角导演输出的角色数据（包含图片）
    const scriptContent = state.step1_script?.content;

    if (!artDirectorOutput || !castingDirectorOutput || !scriptContent) {
      throw new Error('[Agent 4: 分镜师] 缺少必要的上下文信息');
    }

    console.log('[Agent 4: 分镜师] 开始生成分镜图');

    // 3. 先调用 LLM 生成分镜描述和提示词
    const systemPrompt = StoryboardArtistAgentPrompts.buildSystemPrompt();
    const sceneBreakdowns = artDirectorOutput.scene_breakdowns || [];
    const userPrompt = StoryboardArtistAgentPrompts.buildUserPrompt(
      artDirectorOutput,
      castingDirectorOutput,
      typeof scriptContent === 'string' ? scriptContent : JSON.stringify(scriptContent),
      sceneBreakdowns
    );

    const textOptions: TextGenerationOptions = {
      temperature: 0.7,
      maxTokens: 8192,
      systemPrompt,
    };

    console.log('[Agent 4: 分镜师] 调用 LLM 生成分镜描述...');
    const textResult = await provider.generateText(userPrompt, textOptions);

    // 4. 解析分镜描述
    console.log('[Agent 4: 分镜师] 解析分镜描述');
    console.log('[Agent 4: 分镜师] LLM 原始输出（前 500 字符）:', textResult.content.substring(0, 500));
    const storyboardPlan = parseStoryboardOutput(textResult.content);
    console.log('[Agent 4: 分镜师] 解析后的结构:', JSON.stringify(storyboardPlan, null, 2).substring(0, 1000));

    if (!storyboardPlan.storyboard_groups || storyboardPlan.storyboard_groups.length === 0) {
      throw new Error('分镜描述生成失败：未生成任何分镜计划');
    }

    console.log(`[Agent 4: 分镜师] 生成了 ${storyboardPlan.storyboard_groups.length} 组分镜计划`);

    // 5. 生成分镜网格图（单张图片包含 5x5 = 25 个分镜）
    console.log('[Agent 4: 分镜师] 生成分镜网格图（5x5）...');

    // 从选角导演输出中提取角色风格标签，保证分镜图与角色形象图风格一致
    const characterProfiles = castingDirectorOutput.character_profiles || [];
    const characterImageUrl = characterProfiles.find((p: any) => p.imageUrl)?.imageUrl;
    const styleTags: string[] = characterProfiles
      .flatMap((p: any) => p.style_consistency_tags || [])
      .filter(Boolean)
      .slice(0, 5); // 最多取 5 个风格标签，避免撑长提示词
    const styleFragment = styleTags.length > 0
      ? styleTags.join(', ')
      : 'photorealistic, cinematic composition';

    if (characterImageUrl) {
      console.log('[Agent 4: 分镜师] 使用角色形象图作为参考:', characterImageUrl.substring(0, 60));
    } else {
      console.warn('[Agent 4: 分镜师] 未找到角色形象图，分镜图将不包含角色参考');
    }

    // 构建分镜网格的详细描述
    const frameDescriptions = storyboardPlan.storyboard_groups
      .flatMap((group: any) => group.frames || [])
      .filter((frame: any) => frame && frame.description) // 过滤掉无效的帧
      .slice(0, 25) // 最多 25 个帧
      .map((frame: any, index: number) => {
        return `Frame ${index + 1}: ${frame.description}`;
      })
      .join('. ');

    console.log(`[Agent 4: 分镜师] 提取了 ${frameDescriptions.split('. ').length} 个帧描述`);

    // 构建图像生成提示词（火山引擎图像 API 限制 4000 字符；系统 prompt 已约束每帧 ≤15 词，25 帧合计约 1875 字符，安全余量充足）
    // 使用角色风格标签替代硬编码的卡通风格词，确保分镜图与角色形象图风格一致
    const storyboardPrompt = `Professional storyboard layout, 5x5 grid of 25 frames arranged in 5 rows and 5 columns, ${styleFragment}, each frame shows: ${frameDescriptions}, consistent character design, sequential narrative flow, no text, no numbers`;

    const imageOptions: ImageGenerationOptions = {
      // 根据视频比例选择分镜图尺寸
      // 16:9 → 2K（2560×1440 横屏）  9:16 → 1024x1792（竖屏）
      size: state.videoSpec?.aspectRatio === '9:16' ? '1024x1792' : '2K',
      quality: 'hd',
      numberOfImages: 1,
      ...(characterImageUrl ? { referenceImageUrl: characterImageUrl } : {}),
    };

    const imageResult = await provider.generateImage(storyboardPrompt, imageOptions);

    if (!imageResult.images || imageResult.images.length === 0) {
      throw new Error('分镜图生成失败：未返回图片');
    }

    const imageUrl = imageResult.images[0].url;
    console.log('[Agent 4: 分镜师] 分镜网格图生成成功');

    // 构建帧数据（用于前端交互）
    const storyboardFrames = storyboardPlan.storyboard_groups.flatMap((group: any, groupIndex: number) => {
      const frames = group.frames || [];
      return frames.map((frame: any, frameIndex: number) => ({
        id: `frame-${groupIndex}-${frameIndex}`,
        frameNumber: frame.frame_number || (groupIndex * frames.length + frameIndex + 1),
        description: frame.description,
        // 所有帧共用同一张大图的 URL
        imageUrl,
        duration: frame.duration || 3,
        isKeyFrame: frame.is_key_frame || false,
        cameraMovement: frame.camera_movement || '',
      }));
    }).slice(0, 25);

    console.log(`[Agent 4: 分镜师] 生成了 ${storyboardFrames.length} 个分镜帧（共用 1 张大图）`);

    // 6. 下载分镜网格图到本地缓存，并用 Sharp 切割为 25 个单帧 base64
    let localGridPath: string | undefined;
    let framesWithBase64 = storyboardFrames;

    try {
      console.log('[Agent 4: 分镜师] 下载分镜网格图到本地缓存...');
      localGridPath = await downloadToCache(imageUrl, '.jpg');
      console.log('[Agent 4: 分镜师] 下载完成:', localGridPath);

      // 获取图片实际尺寸，计算每格大小
      const gridMeta = await (sharp as any)(localGridPath).metadata();
      const gridWidth = gridMeta.width || 2560;
      const gridHeight = gridMeta.height || 1440;
      const frameWidth = Math.floor(gridWidth / 5);
      const frameHeight = Math.floor(gridHeight / 5);

      console.log(`[Agent 4: 分镜师] 网格尺寸 ${gridWidth}×${gridHeight}，每帧 ${frameWidth}×${frameHeight}，开始切割 25 帧`);

      // 切割 25 帧并转 base64（按行优先：第1行5帧，第2行5帧...）
      const frameBase64List: string[] = [];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const frameBuffer = await (sharp as any)(localGridPath)
            .extract({ left: col * frameWidth, top: row * frameHeight, width: frameWidth, height: frameHeight })
            .jpeg({ quality: 85 })
            .toBuffer();
          frameBase64List.push(`data:image/jpeg;base64,${frameBuffer.toString('base64')}`);
        }
      }

      // 将 base64 写入对应帧
      framesWithBase64 = storyboardFrames.map((frame, idx) => ({
        ...frame,
        base64: frameBase64List[idx] || undefined,
      }));

      console.log(`[Agent 4: 分镜师] 切割完成，共 ${frameBase64List.length} 帧`);
    } catch (sharpErr) {
      console.warn('[Agent 4: 分镜师] 切割帧失败，继续使用远程 URL:', sharpErr);
    }

    // 7. 构建输出（5x5 布局）
    const output: StepOutput<any> = {
      content: {
        frames: framesWithBase64,
        rows: 5, // 5x5 布局
        cols: 5,
        imageUrl, // 远程 URL，供前端 fallback 使用
        localGridPath, // 本地缓存路径，供后续 IPC 事件和 Sharp 使用
      },
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-doubao + image-generation',
        tokens: textResult.usage.totalTokens,
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 4: 分镜师] 完成，耗时 ${endTime - startTime}ms`);

    // 7. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step4_video: output,
      currentStep: 5,
    };

    if (state.executionMode === 'director') {
      updates.humanApproval = false;
    }

    return updates;
  } catch (error) {
    console.error('[Agent 4: 分镜师] 执行失败:', error);
    throw error;
  }
}

/**
 * 解析分镜师输出
 */
function parseStoryboardOutput(llmOutput: string): any {
  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // 尝试直接解析整个输出
    return JSON.parse(llmOutput);
  } catch (error) {
    console.warn('[Agent 4: 分镜师] JSON 解析失败，返回原始输出');
    throw new Error('分镜师输出格式错误：无法解析 JSON');
  }
}
