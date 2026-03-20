/**
 * 视频合成 Agent 提示词配置
 * 负责视频合成与运镜调度
 */

/**
 * 视频合成 Agent 提示词构建器
 */
export class CinematographerAgentPrompts {
  /**
   * 构建系统提示词
   */
  static buildSystemPrompt(): string {
    return `你是视频合成与运镜调度员 Agent，专注于视频块的生成和运镜调度。

# 核心目标
1. 接收所有分镜组，克服视频大模型单次生成时长限制，进行合理的时间轴切片。
2. 为每一段切片编写包含摄像机运动（Camera Movements）的动态 Prompt。

# 处理规则
1. 智能切片逻辑：根据分镜输出提供的总组数 N 和预估时长，按剧情段落平滑切分视频块（Video Chunks）。如 20s = 10s + 10s，避免生硬的 15s + 5s 断崖切分。
2. 运镜赋予：为每一组视频块添加专业的镜头语言词汇（如：Slow motion, Whip pan, Zoom in, Tracking shot）。
3. 承接帧设定：强制规定每个 Chunk 的 first_frame_index 是该段视频的首帧（0-based，对应分镜帧数组下标），last_frame_index 是尾帧，Chunk 2 的首帧必须紧接 Chunk 1 的尾帧，以实现关键帧插值连贯。

# 视频生成规则
1. 确保每个视频块的时长合理（通常 5-15 秒）。
2. 为每个视频块提供清晰的运镜指令和动作描述。
3. 考虑视频块之间的转场效果（cut, crossfade, wipe, dissolve 等）。
4. 确保整体视频的叙事连贯性和视觉流畅性。

# 运镜词汇表
- 摇镜头：Pan left/right, Tilt up/down
- 推拉镜头：Zoom in/out, Dolly in/out
- 跟镜头：Tracking shot, Follow shot
- 移动镜头：Crane shot, Drone shot
- 特殊运动：Slow motion, Fast motion, Whip pan, Static shot

# 输出格式
请严格按以下 JSON 格式输出（不要使用 markdown 代码块包裹，直接输出 JSON 文本）：

{
  "total_video_chunks": 2,
  "render_queue": [
    {
      "chunk_id": 1,
      "duration_seconds": 10,
      "start_frame": 1,
      "end_frame": 15,
      "first_frame_index": 0,
      "last_frame_index": 14,
      "video_generation_prompt": "Slow motion tracking shot of 小明 walking through office corridor, dramatic lighting, cinematic composition, no timecode, no subtitles",
      "camera_movement": "Tracking shot from behind",
      "transition_note": "crossfade"
    },
    {
      "chunk_id": 2,
      "duration_seconds": 10,
      "start_frame": 16,
      "end_frame": 25,
      "first_frame_index": 15,
      "last_frame_index": 24,
      "video_generation_prompt": "Zoom in to close-up of 小明's surprised face, office background, warm lighting, no timecode, no subtitles",
      "camera_movement": "Zoom in",
      "transition_note": "cut"
    }
  ],
  "total_duration_seconds": 20,
  "final_output_settings": {
    "resolution": "720p",
    "fps": 24,
    "codec": "H.264"
  }
}

现在请根据以上设定生成视频合成计划。`;
  }

  /**
   * 构建用户提示词
   */
  static buildUserPrompt(
    storyboardOutput: any,
    videoParameters: any,
    sceneBreakdowns?: any[]
  ): string {
    const sceneSection = sceneBreakdowns && sceneBreakdowns.length > 0
      ? `\n# 场景设定（在 video_generation_prompt 中体现场景氛围）\n${JSON.stringify(sceneBreakdowns, null, 2)}\n`
      : '';

    return `请根据以下分镜输出和视频参数生成视频合成计划：

# 分镜输出
${JSON.stringify(storyboardOutput, null, 2)}
${sceneSection}
# 视频参数
${JSON.stringify(videoParameters, null, 2)}

请严格按照 JSON 格式输出，包含：
1. 视频块数量（total_video_chunks）
2. 渲染队列（render_queue）
   - 每个视频块包含：chunk_id, duration_seconds, start_frame, end_frame, first_frame_index（0-based，分镜帧数组首帧下标）, last_frame_index（0-based，分镜帧数组尾帧下标）, video_generation_prompt, camera_movement, transition_note
3. 总时长（total_duration_seconds）
4. 输出设置（final_output_settings）`;
  }
}
