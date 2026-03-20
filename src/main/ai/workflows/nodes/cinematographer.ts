/**
 * 摄像师 Agent
 * Agent 5: 根据分镜图生成最终视频
 *
 * 流程：
 * 1. 董事会 Agent 5（摄像师）节点
 * 2. 生成视频生成计划（render_queue）
 * 3. 根据时长决定调用次数：
 *    - 短视频（<15s）：1 次
 *    - 长视频（15-30s）：2 次
 * 4. 每次调用使用分镜图作为首帧，后续调用使用前一次的最后一帧作为参考帧
 * 5. 使用 ffmpeg 拼接视频（如果有多段）
 * 6. 返回最终视频 URL
 */

import type { WorkflowState, StepOutput } from '../state';
import type { AIProvider, VideoGenerationOptions } from '../../providers/interface';
import { getGlobalProvider } from '../../provider-manager';
import { CinematographerAgentPrompts } from '../../prompts/cinematographer-agent';
import { downloadToCache } from '@main/utils/cache';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';

/**
 * 渲染队列项（与 LLM 输出格式保持一致）
 */
interface RenderQueueItem {
  chunk_id: number;
  duration_seconds: number;
  start_frame?: number;
  end_frame?: number;
  /** 0-based，对应分镜帧数组首帧下标，用于 i2v 参考图 */
  first_frame_index?: number;
  /** 0-based，对应分镜帧数组尾帧下标 */
  last_frame_index?: number;
  video_generation_prompt: string;
  camera_movement?: string;
  transition_note?: string;
}

/**
 * 最终输出设置
 */
interface FinalOutputSettings {
  resolution: string;
  fps: number;
  codec: string;
}

/**
 * 摄像师输出
 */
interface CinematographerOutput {
  render_queue: RenderQueueItem[];
  total_duration_seconds: number;
  final_output_settings: FinalOutputSettings;
}

/**
 * 摄像师 Agent 节点
 */
export async function cinematographerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 5: 摄像师] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成
    if (state.step5_final) {
      console.log('[Agent 5: 摄像师] 步骤已完成，跳过执行');
      return {};
    }

    // 1. 获取 AI 提供商
    const provider = getGlobalProvider();

    // 2. 获取上下文信息
    const storyboardOutput = state.step4_video?.content; // 分镜师输出
    const videoSpec = state.videoSpec;

    if (!storyboardOutput) {
      throw new Error('[Agent 5: 摄像师] 缺少分镜师输出');
    }

    console.log('[Agent 5: 摄像师] 开始生成视频合成计划');

    // 3. 从选角导演输出中获取角色形象图（前端已通过 aside:generate-character-image 生成）
    const castingDirectorProfiles = state.step3_storyboard?.content?.character_profiles || [];
    const characterImageUrl: string | undefined = castingDirectorProfiles.find((p: any) => p.imageUrl)?.imageUrl;
    if (characterImageUrl) {
      console.log('[Agent 5: 摄影师] 找到角色形象图，将作为参考图传入视频生成');
    } else {
      console.warn('[Agent 5: 摄影师] 未找到角色形象图，将仅使用分镜图和文字提示词');
    }

    // 3. 调用 LLM 生成视频合成计划（render_queue）
    const artDirectorOutput = state.step2_characters?.content;
    const sceneBreakdowns = artDirectorOutput?.scene_breakdowns || [];
    const systemPrompt = CinematographerAgentPrompts.buildSystemPrompt();
    const userPrompt = CinematographerAgentPrompts.buildUserPrompt(
      storyboardOutput,
      {
        duration: videoSpec?.duration || 'short',
        aspectRatio: videoSpec?.aspectRatio || '16:9',
      },
      sceneBreakdowns
    );

    const textOptions = {
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt,
    };

    console.log('[Agent 5: 摄影师] 调用 LLM...');
    const result = await provider.generateText(userPrompt, textOptions);

    // 4. 解析输出
    console.log('[Agent 5: 摄影师] 解析 LLM 输出');
    const plan = parseCinematographerOutput(result.content);

    console.log(`[Agent 5: 摄影师] 成功生成视频合成计划，共 ${plan.render_queue.length || 0} 个渲染任务`);

    // 5. 检查视频生成能力
    if (!provider.generateVideo) {
      throw new Error('[Agent 5: 摄影师] 提供商不支持视频生成');
    }

    // 6. 准备视频临时目录（使用系统临时目录，避免从 TOS URL 中派生路径）
    const tempDir = path.join(os.tmpdir(), `video_temp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('[Agent 5: 摄影师] 临时目录:', tempDir);

    // 7. 生成视频片段
    const videoSegments: string[] = [];
    const localVideoSegments: string[] = []; // 本地缓存路径列表
    // 各帧的文字描述和 base64，用于增强 prompt 和 i2v 参考图
    const storyboardFrames: any[] = storyboardOutput.frames || [];

    for (const renderTask of plan.render_queue) {
      // 提取该视频块对应的分镜帧描述，作为 prompt 补充
      const startFrame = renderTask.start_frame ?? 1;
      const endFrame = renderTask.end_frame ?? storyboardFrames.length;
      const relevantFrameDescriptions = storyboardFrames
        .filter((f: any) => f.frameNumber >= startFrame && f.frameNumber <= endFrame)
        .map((f: any) => `Frame ${f.frameNumber}: ${f.description}`)
        .join('; ');

      // 从 first_frame_index 取对应帧的 base64 作为 i2v 首帧参考图
      // 回退到整张分镜大图 URL
      const firstFrameIdx = renderTask.first_frame_index ?? 0;
      const firstFrameBase64: string | undefined = storyboardFrames[firstFrameIdx]?.base64;
      const storyboardImageUrl: string | undefined = storyboardOutput.imageUrl;

      // 构建参考图列表：首帧 base64 → 角色图（可选）
      const referenceImageUrls: string[] = [];
      const refAnnotations: string[] = [];

      if (firstFrameBase64) {
        // i2v：使用对应分镜帧 base64 作为首帧
        referenceImageUrls.push(firstFrameBase64);
        refAnnotations.push(`[图${referenceImageUrls.length}]是该视频段的起始画面参考（分镜第 ${firstFrameIdx + 1} 帧）`);
        console.log(`[Agent 5: 摄影师] 使用分镜第 ${firstFrameIdx + 1} 帧 base64 作为 i2v 参考`);
      } else if (storyboardImageUrl) {
        // 降级：使用整张分镜大图
        referenceImageUrls.push(storyboardImageUrl);
        refAnnotations.push(`[图${referenceImageUrls.length}]是场景的分镜构图参考`);
        console.warn(`[Agent 5: 摄影师] 未找到帧 base64（index=${firstFrameIdx}），降级使用整张分镜图`);
      }
      if (characterImageUrl) {
        referenceImageUrls.push(characterImageUrl);
        refAnnotations.push(`[图${referenceImageUrls.length}]是角色的外观形象参考`);
      }

      // 构建最终提示词：[图N] 参考说明 + 运镜指令 + 分镜帧文字描述
      const refPrefix = refAnnotations.length > 0 ? `${refAnnotations.join('，')}。` : '';
      const sceneContext = relevantFrameDescriptions
        ? ` | Scene context: ${relevantFrameDescriptions}`
        : '';
      const fullPrompt = `${refPrefix}${renderTask.video_generation_prompt}${sceneContext}`;

      console.log(`[Agent 5: 摄影师] 开始生成第 ${renderTask.chunk_id} 段视频`, {
        duration: renderTask.duration_seconds,
        frames: `${startFrame}-${endFrame}`,
        firstFrameIndex: firstFrameIdx,
        referenceImages: referenceImageUrls.length,
        promptPreview: fullPrompt.substring(0, 150),
      });

      // 构建视频生成选项：传入参考图列表（首帧 base64 + 角色图）
      const videoOptions: VideoGenerationOptions = {
        duration: renderTask.duration_seconds,
        aspectRatio: videoSpec?.aspectRatio || '16:9',
        ...(referenceImageUrls.length > 0 ? { referenceImageUrls } : {}),
      };

      const videoResult = await provider.generateVideo(fullPrompt, videoOptions);

      if (!videoResult.videoUrl) {
        throw new Error(`第 ${renderTask.chunk_id} 段视频生成失败：未返回视频 URL`);
      }

      videoSegments.push(videoResult.videoUrl);
      console.log(`[Agent 5: 摄影师] 第 ${renderTask.chunk_id} 段视频生成完成: ${videoResult.videoUrl}`);

      // 下载视频到本地缓存（供 IPC 传递和 ffmpeg 拼接使用）
      try {
        const localVideoPath = await downloadToCache(videoResult.videoUrl, '.mp4');
        localVideoSegments.push(localVideoPath);
        console.log(`[Agent 5: 摄影师] 第 ${renderTask.chunk_id} 段视频已下载到本地: ${localVideoPath}`);
      } catch (downloadErr) {
        console.warn(`[Agent 5: 摄影师] 第 ${renderTask.chunk_id} 段视频下载失败，使用远程 URL:`, downloadErr);
        localVideoSegments.push(videoResult.videoUrl); // 降级：保存远程 URL
      }
    }

    // 8. 拼接视频片段（如果有多段）
    let finalVideoUrl: string;
    let localVideoPath: string | undefined;

    if (videoSegments.length === 1) {
      finalVideoUrl = videoSegments[0];
      localVideoPath = localVideoSegments[0];
      console.log('[Agent 5: 摄影师] 单段视频，无需拼接');
    } else if (videoSegments.length > 1) {
      console.log(`[Agent 5: 摄影师] 开始拼接 ${videoSegments.length} 个视频片段`);

      // 优先使用本地缓存路径进行拼接（避免重复下载）
      const localPaths = localVideoSegments.filter(p => p.startsWith('/'));
      const pathsToConcat = localPaths.length === localVideoSegments.length
        ? localPaths
        : videoSegments; // 降级：使用远程 URL

      localVideoPath = await concatenateVideos(
        pathsToConcat,
        tempDir,
        plan.final_output_settings
      );
      finalVideoUrl = localVideoPath;

      console.log(`[Agent 5: 摄影师] 视频拼接完成: ${localVideoPath}`);
    } else {
      throw new Error('[Agent 5: 摄影师] 没有生成任何视频片段');
    }

    // 9. 构建输出
    const output: StepOutput<any> = {
      content: {
        videoUrl: finalVideoUrl,          // 最终视频 URL 或本地路径
        localVideoPath,                   // 本地缓存路径（供 IPC 传递）
        localVideoSegments,               // 各段本地路径（供调试）
        totalDuration: plan.total_duration_seconds,
        videoChunks: videoSegments.length,
        renderQueue: plan.render_queue,
      },
      metadata: {
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        model: 'volcengine-video',
      },
    };

    const endTime = Date.now();
    console.log(`[Agent 5: 摄影师] 完成，耗时 ${endTime - startTime}ms`);

    // 10. 返回状态更新
    const updates: Partial<WorkflowState> = {
      step5_final: output,
      currentStep: 6,
    };

    // 导演模式：不设置 humanApproval，让工作流结束
    return updates;
  } catch (error) {
    console.error('[Agent 5: 摄影师] 执行失败:', error);
    throw error;
  }
}

/**
 * 解析摄像师输出
 */
function parseCinematographerOutput(llmOutput: string): CinematographerOutput {
  let parsed: unknown;

  try {
    // 尝试提取 JSON 代码块
    const jsonMatch = llmOutput.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // 尝试直接解析整个输出
      parsed = JSON.parse(llmOutput);
    }
  } catch (error) {
    console.warn('[Agent 5: 摄影师] JSON 解析失败，返回原始输出');
    throw new Error('摄像师输出格式错误：无法解析 JSON');
  }

  return parsed;
}

/**
 * 使用 ffmpeg 拼接多个视频片段
 * 支持本地路径（直接使用）和远程 URL（自动下载）
 */
async function concatenateVideos(
  videoPaths: string[],
  tempDir: string,
  settings: FinalOutputSettings
): Promise<string> {
  console.log('[FFmpeg] 开始拼接视频片段:', videoPaths);

  // 1. 确保所有片段都是本地文件（远程 URL 需要先下载）
  const localVideoPaths: string[] = [];
  for (let i = 0; i < videoPaths.length; i++) {
    const input = videoPaths[i];
    if (input.startsWith('/') || input.startsWith('file://')) {
      // 已是本地路径，直接使用
      localVideoPaths.push(input);
      console.log(`[FFmpeg] 第 ${i + 1} 个片段已是本地文件: ${input}`);
    } else {
      // 远程 URL，下载到临时目录
      const localPath = path.join(tempDir, `segment_${i}.mp4`);
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        https.get(input, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
      });
      await fs.promises.writeFile(localPath, buffer);
      localVideoPaths.push(localPath);
      console.log(`[FFmpeg] 已下载第 ${i + 1} 个视频片段到: ${localPath}`);
    }
  }

  // 2. 创建 ffmpeg concat 文件列表
  const listFile = path.join(tempDir, 'files.txt');
  const fileListContent = localVideoPaths.map(p => `file '${p}'`).join('\n');
  await fs.promises.writeFile(listFile, fileListContent);

  // 3. 生成最终视频文件名
  const finalVideoPath = path.join(tempDir, `final_${uuidv4()}.mp4`);

  // 4. 执行 ffmpeg concat 命令
  const ffmpegPath = '/opt/homebrew/bin/ffmpeg'; // macOS Homebrew ffmpeg 路径
  const ffmpegArgs = [
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    '-y', finalVideoPath,
  ];

  console.log('[FFmpeg] 执行拼接命令:', ffmpegArgs.join(' '));

  return new Promise((resolve, reject) => {
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

    let stderr = '';
    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[FFmpeg] 视频拼接完成: ${finalVideoPath}`);
        resolve(finalVideoPath);
      } else {
        console.error(`[FFmpeg] 拼接失败，退出码: ${code}`);
        console.error(`[FFmpeg] stderr: ${stderr}`);
        reject(new Error(`ffmpeg 拼接失败，退出码: ${code}`));
      }
    });
  });
}

// 兼容性导出（保持旧名称可用）
export const cameraDirectorNode = cinematographerNode;
