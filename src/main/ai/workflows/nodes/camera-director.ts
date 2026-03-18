/**
 * 摄像导演 Agent
 * Agent 4: 根据分镜生成最终视频
 *
 * 流程：
 * 1. 智能选择分镜（根据目标时长）
 * 2. 为选中分镜生成短视频（图生视频）
 * 3. 拼接所有短视频为最终长视频
 */

import type { WorkflowState, StoryboardFrame, VideoOutput } from '../state';
import { getGlobalProvider } from '../../provider-manager';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 摄像导演 Agent 节点
 */
export async function cameraDirectorNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  console.log('[Agent 4: 摄像导演] 开始执行');
  const startTime = Date.now();

  try {
    // 0. 检查是否已完成（用于恢复工作流时跳过已完成的步骤）
    if (state.step4_video) {
      console.log('[Agent 4: 摄像导演] 步骤已完成，跳过执行');
      return {};
    }

    // 1. 获取分镜和目标时长
    const storyboard = state.step3_storyboard;
    if (!storyboard || storyboard.length === 0) {
      throw new Error('[Agent 4: 摄像导演] 缺少分镜数据');
    }

    // 从 Agent 1 的输出中获取预估时长
    const estimatedDuration = state.step1_script?.content?.estimatedDuration || 30;
    console.log(`[Agent 4: 摄像导演] 目标时长: ${estimatedDuration}秒 (AI 预估), 分镜数: ${storyboard.length}`);

    // 2. 智能选择分镜（根据 AI 预估的时长）
    const selectedFrames = selectFramesForDuration(storyboard, estimatedDuration);
    console.log(`[Agent 4: 摄像导演] 选中 ${selectedFrames.length}/${storyboard.length} 个分镜`);

    // 3. 创建输出目录
    const outputDir = path.join(
      state.projectId,
      'output',
      `video-${Date.now()}`
    );
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 4. 为每个选中分镜生成短视频
    const provider = getGlobalProvider();
    const videoSegments: string[] = [];

    for (let i = 0; i < selectedFrames.length; i++) {
      const frame = selectedFrames[i];
      console.log(`[Agent 4: 摄像导演] 生成分镜视频 ${i + 1}/${selectedFrames.length}: ${frame.description}`);

      try {
        // 调用 AI 图生视频
        const videoResult = await provider.generateVideo!(frame.imageUrl, {
          duration: frame.duration,
          aspectRatio: state.videoSpec.aspectRatio,
          fps: 24,
          resolution: '1080p',
        });

        // 下载视频到本地
        const segmentPath = path.join(outputDir, `segment-${i + 1}.mp4`);
        await downloadVideo(videoResult.videoUrl, segmentPath);
        videoSegments.push(segmentPath);

        console.log(`[Agent 4: 摄像导演] 分镜视频 ${i + 1} 完成`);
      } catch (error) {
        console.error(`[Agent 4: 摄像导演] 分镜视频 ${i + 1} 生成失败:`, error);

        // 使用占位符视频（黑色画面）
        const placeholderPath = path.join(outputDir, `segment-${i + 1}.mp4`);
        await createPlaceholderVideo(placeholderPath, frame.duration);
        videoSegments.push(placeholderPath);
      }
    }

    // 5. 拼接所有短视频
    const finalVideoPath = path.join(outputDir, 'output.mp4');
    console.log('[Agent 4: 摄像导演] 开始拼接视频片段');

    await concatenateVideos(videoSegments, finalVideoPath);

    const duration = Date.now() - startTime;
    console.log(`[Agent 4: 摄像导演] 视频生成完成，总耗时 ${duration}ms`);

    // 6. 获取视频信息
    const videoStats = fs.statSync(finalVideoPath);

    return {
      step4_video: {
        videoUrl: finalVideoPath,
        duration: selectedFrames.reduce((sum, frame) => sum + frame.duration, 0),
        thumbnailUrl: selectedFrames[0]?.imageUrl || '',
        resolution: state.videoSpec.aspectRatio === '16:9' ? '1920x1080' : '1080x1920',
        fileSize: videoStats.size,
      },
      currentStep: 5, // 完成
      // 导演模式最后一个步骤也设置 humanApproval = false
      ...(state.executionMode === 'director' && { humanApproval: false }),
    };
  } catch (error) {
    console.error('[Agent 4: 摄像导演] 执行失败:', error);
    throw error;
  }
}

/**
 * 智能选择分镜（根据 AI 预估的视频时长）
 *
 * 策略：
 * - 时长 <= 20秒：选择关键帧，每个帧时长短
 * - 时长 20-40秒：选择大部分帧，中等时长
 * - 时长 > 40秒：使用所有帧，时长较长
 */
function selectFramesForDuration(
  frames: StoryboardFrame[],
  targetDuration: number
): StoryboardFrame[] {
  const totalFrameDuration = frames.reduce((sum, f) => sum + f.duration, 0);

  // 如果总时长已经符合目标，直接返回
  if (totalFrameDuration <= targetDuration) {
    return frames.map(f => ({
      ...f,
      duration: Math.max(f.duration, 2), // 最少2秒
    }));
  }

  // 短视频策略（<= 20秒）：只选择关键帧
  if (targetDuration <= 20) {
    const keyFrames = frames.filter(f => f.isKeyFrame);

    if (keyFrames.length === 0) {
      // 如果没有关键帧，选择均匀分布的帧
      const step = Math.ceil(frames.length / 5); // 最多5个分镜
      const selected = frames.filter((_, i) => i % step === 0);
      return selected.map(f => ({
        ...f,
        duration: Math.min(f.duration, 3), // 每个分镜最多3秒
      }));
    }

    // 计算每个关键帧的时长
    const durationPerFrame = Math.floor(targetDuration / keyFrames.length);
    return keyFrames.map(f => ({
      ...f,
      duration: Math.min(f.duration, Math.max(durationPerFrame, 2)),
    }));
  }

  // 中等视频策略（20-40秒）：选择部分帧
  if (targetDuration <= 40) {
    // 选择 70% 的帧
    const selectRatio = 0.7;
    const step = Math.ceil(1 / selectRatio);
    const selected = frames.filter((_, i) => i % step === 0);

    const scale = targetDuration / (totalFrameDuration * selectRatio);
    return selected.map(f => ({
      ...f,
      duration: Math.round(f.duration * scale),
    }));
  }

  // 长视频策略（> 40秒）：使用所有分镜，按比例缩放时长
  const scale = targetDuration / totalFrameDuration;
  return frames.map(f => ({
    ...f,
    duration: Math.round(f.duration * scale),
  }));
}

/**
 * 下载视频到本地
 */
async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载视频失败: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

/**
 * 创建占位符视频（黑色画面）
 */
async function createPlaceholderVideo(outputPath: string, duration: number): Promise<void> {
  const command = `ffmpeg -f lavfi -i color=c=black:s=1920x1080:d=${duration} -c:v libx264 -preset ultrafast -crf 28 "${outputPath}"`;

  try {
    await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
  } catch (error) {
    console.error('[Agent 4: 摄像导演] 创建占位符视频失败:', error);
    throw error;
  }
}

/**
 * 拼接多个视频片段
 */
async function concatenateVideos(
  videoPaths: string[],
  outputPath: string
): Promise<void> {
  if (videoPaths.length === 0) {
    throw new Error('没有视频片段可拼接');
  }

  if (videoPaths.length === 1) {
    // 只有一个视频，直接复制
    fs.copyFileSync(videoPaths[0], outputPath);
    return;
  }

  // 创建临时文件列表
  const listFile = path.join(path.dirname(outputPath), 'videos.txt');
  const fileList = videoPaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(listFile, fileList);

  // FFmpeg 拼接命令
  const command = `ffmpeg -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p "${outputPath}"`;

  console.log('[Agent 4: 摄像导演] FFmpeg 拼接命令:', command);

  try {
    await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
    console.log('[Agent 4: 摄像导演] 视频拼接成功');
  } catch (error) {
    console.error('[Agent 4: 摄像导演] FFmpeg 拼接失败:', error);
    throw error;
  } finally {
    // 清理临时文件
    if (fs.existsSync(listFile)) {
      fs.unlinkSync(listFile);
    }
  }
}
