# Aside 视频工作流重设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复视频生成工作流中的多个问题，包括：地区数据保存、视频分辨率降低、场景卡片展示、分镜网格切帧、摄像导演首尾帧图生视频、本地缓存下载、画板预览支持。

**Architecture:** 工作流分为主进程（AI 节点计算）+ 渲染进程（前端画板展示）。引入 `downloadToCache` 工具函数统一处理媒体本地化，分镜师用 Sharp 切割 5×5 大图为 25 帧 base64，摄像导演用首尾帧（i2v）替代参考图（r2v）模式。

**Tech Stack:** TypeScript, Electron, Sharp, VolcEngine API（Seedance i2v）, React, Zustand

---

## 文件地图

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main/utils/cache.ts` | **新建** | `downloadToCache()` 下载工具 |
| `src/main/ai/prompts/screenplay-agent.ts` | 修改 | `'全球通用'` → `'全国通用'` |
| `src/main/ai/prompts/art-director-agent.ts` | 修改 | `'全球通用'` → `'全国通用'` |
| `src/main/ipc/director-mode-handlers.ts` | 修改 | `aside:init-director-workflow` 接收 `region` 并传入状态 |
| `src/main/ai/providers/volcengine/video.ts` | 修改 | 默认分辨率改为 `720p`；添加首尾帧（`last_frame`）支持 |
| `src/main/ai/providers/interface.ts` | 修改 | `VideoGenerationOptions` 添加 `lastFrameImageUrl` 字段 |
| `src/main/ai/workflows/nodes/storyboard-artist.ts` | 修改 | 按 `aspectRatio` 决定图尺寸；用 Sharp 切割 25 帧 base64；保存到 state；downloadToCache |
| `src/main/ai/workflows/state.ts` | 修改 | step4 content 添加 `frames[].base64` 字段 |
| `src/main/ai/prompts/cinematographer-agent.ts` | 修改 | 告知 LLM 各帧 base64 可作为首尾帧，输出 `first_frame_index`/`last_frame_index` |
| `src/main/ai/workflows/nodes/cinematographer.ts` | 修改 | 用 base64 首尾帧调 i2v；下载最终视频到缓存；更新 state |
| `src/renderer/pages/ASide/components/DirectorMode/index.tsx` | 修改 | 从 `useDirectorMode` 取场景/分镜/视频数据传入 CanvasPanel |
| `src/renderer/pages/ASide/components/DirectorMode/CanvasPanel.tsx` | 修改 | 分镜图、最终视频改用本地 `preview://` 协议路径 |
| `src/renderer/pages/ASide/hooks/useDirectorMode.ts` | 修改 | 添加 `finalVideoPath` 状态；监听视频完成事件 |

---

## Task 0: 创建 downloadToCache 工具

**Files:**
- Create: `src/main/utils/cache.ts`

- [ ] **Step 1: 写工具函数**

```typescript
/**
 * 缓存工具：将远程 URL 下载到 app.getPath('userData')/temp/
 */
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

/** 获取缓存目录（保证目录存在） */
export function getCacheDir(): string {
  const cacheDir = path.join(app.getPath('userData'), 'temp');
  fs.mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

/**
 * 下载 URL 到本地缓存文件
 * @param url HTTPS/HTTP 地址
 * @param ext 文件后缀，如 '.mp4' '.jpg'（不含点时自动加）
 * @returns 本地绝对路径
 */
export async function downloadToCache(url: string, ext: string): Promise<string> {
  const suffix = ext.startsWith('.') ? ext : `.${ext}`;
  const filename = `${uuidv4()}${suffix}`;
  const localPath = path.join(getCacheDir(), filename);

  const protocol = url.startsWith('https') ? https : http;

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    protocol.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(localPath, () => {}); // 清理残文件
      reject(err);
    });
  });

  console.log(`[Cache] 已下载到: ${localPath}`);
  return localPath;
}
```

- [ ] **Step 2: 确认文件存在**

```bash
ls src/main/utils/cache.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/main/utils/cache.ts
git commit -m "feat: 添加 downloadToCache 工具函数"
```

---

## Task 1: 修复 "全球通用" → "全国通用"

**Files:**
- Modify: `src/main/ai/prompts/screenplay-agent.ts`
- Modify: `src/main/ai/prompts/art-director-agent.ts`

- [ ] **Step 1: 修改 screenplay-agent.ts**

在 `src/main/ai/prompts/screenplay-agent.ts` 找到：
```typescript
'universal': '全球通用',
```
改为：
```typescript
'universal': '全国通用',
```

同时把提示词正文中的 `全球通用` 文本也对应修改（约第 73 行）：
```
- 全国通用：使用普世价值观、国际化场景、通用的情感共鸣点
```

- [ ] **Step 2: 修改 art-director-agent.ts**

在 `src/main/ai/prompts/art-director-agent.ts` 同样修改：
```typescript
'universal': '全球通用',
```
→
```typescript
'universal': '全国通用',
```

- [ ] **Step 3: 确认修改**

```bash
grep -n "全球通用" src/main/ai/prompts/screenplay-agent.ts src/main/ai/prompts/art-director-agent.ts
# 期望：无输出（全部已替换）
```

- [ ] **Step 4: 提交**

```bash
git add src/main/ai/prompts/screenplay-agent.ts src/main/ai/prompts/art-director-agent.ts
git commit -m "fix: 地区描述从全球通用改为全国通用"
```

---

## Task 2: 地区数据保存到初始化工作流

**背景:** `aside:init-director-workflow` 已经接收了 `region` 字段但没有传入 `createInitialWorkflowState`（见 `director-mode-handlers.ts:741`）。

**Files:**
- Modify: `src/main/ipc/director-mode-handlers.ts`

- [ ] **Step 1: 确认缺失位置**

在 `director-mode-handlers.ts` 中搜索 `aside:init-director-workflow`，找到：
```typescript
const initialState = createInitialWorkflowState({
  ...
  region: data.region,  // ← 检查这行是否存在
});
```

如果已有 `region: data.region`，则跳过。如果缺失，添加该行。

- [ ] **Step 2: 确认 `data` 接口声明包含 `region`**

在同一 handler 中，接口声明应包含：
```typescript
ipcMain.handle('aside:init-director-workflow', async (_event, data: {
  screenplayId: string;
  scriptContent: string;
  videoSpec: { duration: 'short' | 'long'; aspectRatio: '16:9' | '9:16' };
  projectId: string;
  creativeDirectionId?: string;
  personaId?: string;
  region?: string;   // ← 确认存在
}) => {
```

- [ ] **Step 3: 提交**

```bash
git add src/main/ipc/director-mode-handlers.ts
git commit -m "fix: 确保地区数据传入工作流初始状态"
```

---

## Task 3: 视频分辨率改为 720p

**Files:**
- Modify: `src/main/ai/providers/volcengine/video.ts`
- Modify: `src/main/ai/prompts/cinematographer-agent.ts`

- [ ] **Step 1: 修改 video.ts 默认分辨率**

在 `video.ts` 中找到 `generateVideoFromImage` 方法返回值：
```typescript
resolution: options?.resolution || '1080p',
```
改为：
```typescript
resolution: options?.resolution || '720p',
```

- [ ] **Step 2: 修改 cinematographer-agent.ts 输出格式示例**

在 `final_output_settings` 示例中：
```json
"resolution": "1080x1920",
```
改为：
```json
"resolution": "720p",
```

同时在 `final_output_settings` 描述中明确建议 720p：
```typescript
// 在 buildSystemPrompt() 中添加说明
// "# 分辨率要求\n使用 720p 以节省成本，竖屏对应 720×1280，横屏对应 1280×720。"
```

- [ ] **Step 3: 提交**

```bash
git add src/main/ai/providers/volcengine/video.ts src/main/ai/prompts/cinematographer-agent.ts
git commit -m "fix: 视频分辨率改为 720p 以降低成本"
```

---

## Task 4: 场景描述添加到画板节点

**背景:** 艺术总监（step2）已输出 `scene_breakdowns`，`useDirectorMode.ts` 已有 `sceneBreakdowns` 状态，但 `index.tsx` 中有 TODO 注释说未实现。

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/index.tsx`
- Modify: `src/renderer/pages/ASide/hooks/useDirectorMode.ts`

- [ ] **Step 1: 确认 useDirectorMode 已暴露 sceneBreakdowns**

在 `useDirectorMode.ts` 确认 return 中包含 `sceneBreakdowns`，如不存在则添加。

- [ ] **Step 2: 在 index.tsx 中解构 sceneBreakdowns**

```typescript
const {
  characters,
  storyboard,
  sceneBreakdowns,  // ← 添加
  // ...其他
} = directorMode;
```

- [ ] **Step 3: 在 canvasNodes 计算中添加场景节点**

找到 index.tsx 中以下 TODO 注释：
```typescript
// TODO: 后续需要在 useDirectorMode 中添加 sceneBreakdowns 状态
```

替换为场景节点生成代码：
```typescript
// 场景设定节点 - 在脚本下方，人物上方
if (sceneBreakdowns && sceneBreakdowns.length > 0) {
  const scene = sceneBreakdowns[0]; // 目前只展示主场景
  nodes.push({
    id: 'node_scene',
    type: 'scene',
    x: CANVAS_CENTER_X - NODE_WIDTH / 2,
    y: 50 + PADDING_Y * 0.5,
    width: NODE_WIDTH,
    data: {
      sceneName: scene.scene_name || '主场景',
      environment: scene.environment || '',
      atmosphere: scene.atmosphere || '',
    },
  });
}
```

- [ ] **Step 4: 在 NodeCanvas 中支持 'scene' 节点类型**

在 `NodeCanvas.tsx` 找到节点渲染 switch，添加 scene 类型处理（参考 script 节点样式，绿色系）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/index.tsx
git add src/renderer/pages/ASide/components/DirectorMode/NodeCanvas.tsx
git add src/renderer/pages/ASide/hooks/useDirectorMode.ts
git commit -m "feat: 艺术总监场景描述展示为画板节点"
```

---

## Task 5: 场景描述传递给分镜师和摄像导演

**Files:**
- Modify: `src/main/ai/prompts/storyboard-artist-agent.ts`
- Modify: `src/main/ai/workflows/nodes/storyboard-artist.ts`
- Modify: `src/main/ai/prompts/cinematographer-agent.ts`
- Modify: `src/main/ai/workflows/nodes/cinematographer.ts`

- [ ] **Step 1: 修改分镜师 userPrompt 添加场景描述**

在 `storyboard-artist-agent.ts` 的 `buildUserPrompt` 中，添加场景信息参数：
```typescript
static buildUserPrompt(
  artDirectorOutput: any,
  castingDirectorOutput: any,
  scriptContent: string,
  sceneBreakdowns?: any[]  // ← 新增
): string {
  const sceneSection = sceneBreakdowns && sceneBreakdowns.length > 0
    ? `\n\n# 场景设定（来自艺术总监）\n${JSON.stringify(sceneBreakdowns, null, 2)}`
    : '';

  return `...(原有内容)...${sceneSection}`;
}
```

- [ ] **Step 2: 在 storyboard-artist.ts 中传入场景数据**

```typescript
const artDirectorOutput = state.step2_characters?.content;
const sceneBreakdowns = artDirectorOutput?.scene_breakdowns;

const userPrompt = StoryboardArtistAgentPrompts.buildUserPrompt(
  artDirectorOutput,
  castingDirectorOutput,
  typeof scriptContent === 'string' ? scriptContent : JSON.stringify(scriptContent),
  sceneBreakdowns,  // ← 新增
);
```

- [ ] **Step 3: 摄像导演 buildUserPrompt 添加场景信息**

在 `cinematographer-agent.ts` 的 `buildUserPrompt` 中接受 `sceneBreakdowns`：
```typescript
static buildUserPrompt(
  storyboardOutput: any,
  videoParameters: any,
  sceneBreakdowns?: any[]
): string {
  const sceneSection = sceneBreakdowns?.length
    ? `\n\n# 场景设定\n${JSON.stringify(sceneBreakdowns, null, 2)}`
    : '';
  return `...(原有内容)...${sceneSection}`;
}
```

- [ ] **Step 4: 在 cinematographer.ts 中传入场景数据**

```typescript
const artDirectorOutput = state.step2_characters?.content;
const sceneBreakdowns = artDirectorOutput?.scene_breakdowns;

const userPrompt = CinematographerAgentPrompts.buildUserPrompt(
  storyboardOutput,
  { duration: videoSpec?.duration || 'short', aspectRatio: videoSpec?.aspectRatio || '16:9' },
  sceneBreakdowns,
);
```

- [ ] **Step 5: 提交**

```bash
git add src/main/ai/prompts/storyboard-artist-agent.ts
git add src/main/ai/workflows/nodes/storyboard-artist.ts
git add src/main/ai/prompts/cinematographer-agent.ts
git add src/main/ai/workflows/nodes/cinematographer.ts
git commit -m "feat: 场景描述传递给分镜师和摄像导演"
```

---

## Task 6: 分镜师按 aspectRatio 生成正确尺寸的大图

**背景:** 当前分镜图固定生成 `2K`（2560×1440，横版）。竖版视频应生成 1440×2560。
火山引擎图片 API 支持 `2K` 和特定尺寸字符串，需确认 API 支持竖版分辨率。

**Files:**
- Modify: `src/main/ai/providers/volcengine/image.ts`
- Modify: `src/main/ai/providers/interface.ts`
- Modify: `src/main/ai/workflows/nodes/storyboard-artist.ts`

- [ ] **Step 1: 确认火山引擎图片 API 支持的尺寸**

查看 `src/main/ai/providers/volcengine/image.ts` 中的 `SUPPORTED_SIZES` 数组，确认是否支持竖版分辨率（如 `'9:16'` 格式或 `1440x2560`）。如果不支持，可以在后期用 Sharp 旋转处理。

- [ ] **Step 2: 在 storyboard-artist.ts 中根据 aspectRatio 设置尺寸**

```typescript
const aspectRatio = state.videoSpec?.aspectRatio || '9:16';
// 横版：2560×1440（5列512px × 5行288px）
// 竖版：1440×2560（5列288px × 5行512px）
const imageSize = aspectRatio === '16:9' ? '2K' : '9:16_2K'; // 根据 API 实际支持调整

const imageOptions: ImageGenerationOptions = {
  size: imageSize,
  quality: 'hd',
  numberOfImages: 1,
  ...(characterImageUrl ? { referenceImageUrl: characterImageUrl } : {}),
};
```

**注意:** 如果 API 不支持竖版 2K，则始终生成横版 2K（2560×1440），再用 Sharp 旋转/裁剪成竖版分镜。该决策在实现时根据 API 文档确认。

- [ ] **Step 3: 更新分镜 prompt 中的宫格比例说明**

```typescript
const gridAspectRatio = aspectRatio === '16:9' ? '16:9' : '9:16';
const storyboardPrompt = `Professional storyboard layout, 5x5 grid of 25 frames in ${gridAspectRatio} format, ...`;
```

- [ ] **Step 4: 提交**

```bash
git add src/main/ai/workflows/nodes/storyboard-artist.ts
git commit -m "feat: 分镜图按视频方向生成对应尺寸"
```

---

## Task 7: Sharp 切割 25 帧 + base64 存 state + downloadToCache

**核心逻辑:**
- 大图尺寸：`2560×1440`（横版）或 `1440×2560`（竖版）
- 每格尺寸：`512×288`（横版）或 `288×512`（竖版）
- 帧排列：从左到右、从上到下，共 5×5=25 个格子
- 大图先 downloadToCache 存本地，再用 Sharp 切割，各帧 base64 存入 state

**Files:**
- Modify: `src/main/ai/workflows/nodes/storyboard-artist.ts`
- Modify: `src/main/ai/workflows/state.ts`

- [ ] **Step 1: 在 state.ts 的 StoryboardFrame 中添加 base64 字段**

```typescript
export interface StoryboardFrame {
  id: string;
  frameNumber: number;
  description: string;
  imageUrl: string;       // 大图 URL（TOS 地址）
  localPath?: string;     // 大图本地缓存路径（新增）
  frameBase64?: string;   // 该帧的 base64（新增，切割后）
  duration: number;
  isKeyFrame?: boolean;
  cameraMovement?: string;
}
```

- [ ] **Step 2: 在 storyboard-artist.ts 中生成图后立即切割**

在 `imageResult` 返回后（`const imageUrl = imageResult.images[0].url;` 之后）添加：

```typescript
import sharp from 'sharp';
import { downloadToCache } from '@main/utils/cache';

// 下载大图到本地缓存
const localGridPath = await downloadToCache(imageUrl, '.jpg');
console.log('[Agent 4: 分镜师] 大图已缓存:', localGridPath);

// 根据 aspectRatio 确定切割参数
const aspectRatio = state.videoSpec?.aspectRatio || '9:16';
const gridCols = 5;
const gridRows = 5;
// 从实际图片元数据获取尺寸
const metadata = await sharp(localGridPath).metadata();
const totalW = metadata.width!;
const totalH = metadata.height!;
const frameW = Math.floor(totalW / gridCols);
const frameH = Math.floor(totalH / gridRows);

console.log(`[Agent 4: 分镜师] 开始切割 ${gridRows}×${gridCols} 分镜帧，每格 ${frameW}×${frameH}`);

// 切割 25 个帧，生成 base64
const frameBase64List: string[] = [];
for (let row = 0; row < gridRows; row++) {
  for (let col = 0; col < gridCols; col++) {
    const frameBuffer = await sharp(localGridPath)
      .extract({
        left: col * frameW,
        top: row * frameH,
        width: frameW,
        height: frameH,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    const base64 = `data:image/jpeg;base64,${frameBuffer.toString('base64')}`;
    frameBase64List.push(base64);
  }
}
console.log(`[Agent 4: 分镜师] 已切割 ${frameBase64List.length} 个帧`);
```

- [ ] **Step 3: 将 base64 存入 storyboardFrames**

在构建 `storyboardFrames` 时添加 `frameBase64` 和 `localPath`：

```typescript
const storyboardFrames = storyboardPlan.storyboard_groups.flatMap((group: any, groupIndex: number) => {
  const frames = group.frames || [];
  return frames.map((frame: any, frameIndex: number) => {
    const frameNum = frame.frame_number || (groupIndex * frames.length + frameIndex + 1);
    const frameIdx = frameNum - 1; // 0-indexed
    return {
      id: `frame-${groupIndex}-${frameIndex}`,
      frameNumber: frameNum,
      description: frame.description,
      imageUrl,               // 原始 TOS 大图 URL
      localPath: localGridPath, // 本地缓存大图路径
      frameBase64: frameBase64List[frameIdx] || frameBase64List[0], // 该帧 base64
      duration: frame.duration || 3,
      isKeyFrame: frame.is_key_frame || false,
      cameraMovement: frame.camera_movement || '',
    };
  });
}).slice(0, 25);
```

- [ ] **Step 4: 在 output content 中添加 localGridPath 和 frameBase64List**

```typescript
const output: StepOutput<any> = {
  content: {
    frames: storyboardFrames,
    rows: 5,
    cols: 5,
    imageUrl,             // TOS URL
    localGridPath,        // 本地路径（新增）
    frameBase64List,      // 全部帧 base64（新增，按顺序）
  },
  metadata: { ... }
};
```

- [ ] **Step 5: 提交**

```bash
git add src/main/ai/workflows/nodes/storyboard-artist.ts
git add src/main/ai/workflows/state.ts
git commit -m "feat: 分镜师切割25帧base64并缓存到本地"
```

---

## Task 8: 摄像导演 LLM 输出首尾帧索引

**核心变化:** 不再用"参考图 r2v"模式，改用"首帧 i2v"模式。摄像导演 LLM 输出 `first_frame_index` 和 `last_frame_index`（1-25），主进程用对应帧的 base64 调 i2v API。

**Files:**
- Modify: `src/main/ai/prompts/cinematographer-agent.ts`

- [ ] **Step 1: 更新 buildSystemPrompt 说明首尾帧机制**

```typescript
static buildSystemPrompt(): string {
  return `你是视频合成与运镜调度员 Agent，专注于视频块的生成和运镜调度。

# 核心目标
1. 接收分镜帧数据（25 帧 base64 图片），决定视频分段策略。
2. 为每段视频指定首帧（first_frame_index）和末帧（last_frame_index）索引（1-25）。
3. 为每段视频生成包含镜头运动的动态 Prompt。

# 首尾帧规则
- first_frame_index：该段视频的开始帧（图生视频首帧锁定）
- last_frame_index：该段视频的结束帧（下一段的首帧参考，实现连贯性）
- 段间衔接：第 N+1 段的 first_frame_index 应紧接第 N 段的 last_frame_index

# 处理规则
...（保留原有处理规则）

# 输出格式
{
  "total_video_chunks": 2,
  "render_queue": [
    {
      "chunk_id": 1,
      "duration_seconds": 10,
      "first_frame_index": 1,
      "last_frame_index": 12,
      "video_generation_prompt": "Slow motion tracking shot...",
      "camera_movement": "Tracking shot from behind",
      "transition_note": "crossfade"
    },
    {
      "chunk_id": 2,
      "duration_seconds": 10,
      "first_frame_index": 13,
      "last_frame_index": 25,
      "video_generation_prompt": "Zoom in to close-up...",
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
}`;
}
```

- [ ] **Step 2: 更新 buildUserPrompt 传入帧信息（不含 base64 节省 token）**

```typescript
static buildUserPrompt(
  storyboardOutput: any,
  videoParameters: any,
  sceneBreakdowns?: any[]
): string {
  // 只传帧描述（不传 base64，节省 token）
  const framesInfo = (storyboardOutput.frames || []).map((f: any) => ({
    frameNumber: f.frameNumber,
    description: f.description,
    cameraMovement: f.cameraMovement,
  }));

  const sceneSection = sceneBreakdowns?.length
    ? `\n\n# 场景设定\n${JSON.stringify(sceneBreakdowns, null, 2)}`
    : '';

  return `请根据以下分镜帧信息和视频参数生成视频合成计划：

# 分镜帧信息（共 ${framesInfo.length} 帧）
${JSON.stringify(framesInfo, null, 2)}

# 视频参数
${JSON.stringify(videoParameters, null, 2)}${sceneSection}

请输出 JSON，包含 first_frame_index 和 last_frame_index（均为 1-25 的整数）。`;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/main/ai/prompts/cinematographer-agent.ts
git commit -m "feat: 摄像导演LLM输出首尾帧索引以支持i2v模式"
```

---

## Task 9: 摄像导演执行层：base64 首帧调 i2v API + 下载视频到本地

**Files:**
- Modify: `src/main/ai/providers/interface.ts`
- Modify: `src/main/ai/providers/volcengine/video.ts`
- Modify: `src/main/ai/workflows/nodes/cinematographer.ts`

- [ ] **Step 1: interface.ts 添加 lastFrameImageUrl（预留）**

```typescript
export interface VideoGenerationOptions {
  duration?: number;
  aspectRatio?: '16:9' | '9:16';
  fps?: number;
  resolution?: '720p' | '1080p' | '4k';
  imageUrl?: string;           // 首帧（i2v）
  lastFrameImageUrl?: string;  // 末帧（i2v，部分模型支持）
  referenceImageUrls?: string[]; // 参考图（r2v，当前模型支持有限）
}
```

- [ ] **Step 2: video.ts 中支持 base64 首帧**

在 `createVideoTask` 中，当 `imageUrl` 以 `data:` 开头时，直接作为 base64 传入：

```typescript
if (imageUrl) {
  contentItems.push({
    type: 'image_url',
    image_url: { url: imageUrl }, // base64 data URI 和 https URL 都支持
    role: 'first_frame',
  });
}
```

（VolcEngine 文档确认支持 base64，无需修改。）

- [ ] **Step 3: 修改 cinematographer.ts 核心逻辑**

删除原有 `referenceImageUrls` 逻辑，改用 `first_frame_index`：

```typescript
// 获取帧 base64 列表
const frameBase64List: string[] = storyboardOutput.frameBase64List || [];
const storyboardFrames: any[] = storyboardOutput.frames || [];

for (const renderTask of plan.render_queue) {
  const firstFrameIdx = (renderTask.first_frame_index || 1) - 1;
  const firstFrameBase64 = frameBase64List[firstFrameIdx];

  if (!firstFrameBase64) {
    throw new Error(`[Agent 5: 摄影师] 找不到首帧 base64，索引: ${firstFrameIdx}`);
  }

  // 从帧描述构建 prompt
  const startIdx = (renderTask.first_frame_index || 1) - 1;
  const endIdx = (renderTask.last_frame_index || storyboardFrames.length) - 1;
  const relevantFrameDescriptions = storyboardFrames
    .slice(startIdx, endIdx + 1)
    .map((f: any, i: number) => `Frame ${startIdx + i + 1}: ${f.description}`)
    .join('; ');

  const sceneContext = relevantFrameDescriptions
    ? ` | Scene context: ${relevantFrameDescriptions}`
    : '';
  const fullPrompt = `${renderTask.video_generation_prompt}${sceneContext}`;

  const videoOptions: VideoGenerationOptions = {
    duration: renderTask.duration_seconds,
    aspectRatio: videoSpec?.aspectRatio || '16:9',
    imageUrl: firstFrameBase64,  // base64 首帧，触发 i2v 模式
    resolution: '720p',
  };

  console.log(`[Agent 5: 摄影师] 生成第 ${renderTask.chunk_id} 段，首帧索引: ${firstFrameIdx + 1}`);
  const videoResult = await provider.generateVideo(fullPrompt, videoOptions);

  if (!videoResult.videoUrl) {
    throw new Error(`第 ${renderTask.chunk_id} 段视频生成失败`);
  }

  // 下载视频到本地缓存
  const localVideoPath = await downloadToCache(videoResult.videoUrl, '.mp4');
  videoSegments.push({ url: videoResult.videoUrl, localPath: localVideoPath });
}
```

- [ ] **Step 4: 更新 output 内容包含本地路径**

```typescript
const output: StepOutput<any> = {
  content: {
    videoUrl: finalVideoUrl,           // 可能是本地路径（拼接后）或 TOS URL（单段）
    localVideoPath: videoSegments[0]?.localPath, // 单段时的本地路径
    totalDuration: plan.total_duration_seconds,
    videoChunks: videoSegments.length,
  },
  metadata: { ... }
};
```

- [ ] **Step 5: 提交**

```bash
git add src/main/ai/providers/interface.ts
git add src/main/ai/providers/volcengine/video.ts
git add src/main/ai/workflows/nodes/cinematographer.ts
git commit -m "feat: 摄像导演改用首帧i2v模式并将视频下载到本地缓存"
```

---

## Task 10: 画板接入本地缓存路径

**背景:** 画板目前显示 TOS HTTPS URL（会过期），改为用本地 `preview://` 协议路径（不过期，可播放）。

**Files:**
- Modify: `src/renderer/pages/ASide/hooks/useDirectorMode.ts`
- Modify: `src/main/ipc/director-mode-handlers.ts`

- [ ] **Step 1: 在 useDirectorMode 中添加 finalVideoLocalPath 状态**

```typescript
const [finalVideoLocalPath, setFinalVideoLocalPath] = useState<string | null>(null);

// 监听视频完成事件
useEffect(() => {
  const handler = (_: any, data: { screenplayId: string; localVideoPath?: string; videoUrl?: string }) => {
    if (data.screenplayId === screenplayId) {
      if (data.localVideoPath) setFinalVideoLocalPath(data.localVideoPath);
    }
  };
  window.electron.ipcRenderer.on('aside:workflow:video', handler);
  return () => { window.electron.ipcRenderer.removeListener('aside:workflow:video', handler); };
}, [screenplayId]);
```

- [ ] **Step 2: 在 director-mode-handlers.ts 中发送 video 事件**

在摄像导演完成后（`composeVideo` handler 结尾），发送：

```typescript
const finalContent = result.state.step5_final?.content;
event.sender.send('aside:workflow:video', {
  screenplayId,
  videoUrl: finalContent?.videoUrl,
  localVideoPath: finalContent?.localVideoPath,
});
```

- [ ] **Step 3: 确认 storyboard 事件包含 localGridPath**

在 `generateStoryboard` handler 中，`convertToStoryboard` 转换后确认 storyboard 对象包含 `localGridPath`。如不包含，修改转换逻辑：

```typescript
const storyboard = {
  ...convertToStoryboard(result.state.step4_video.content),
  localGridPath: result.state.step4_video.content.localGridPath,
};
```

- [ ] **Step 4: 提交**

```bash
git add src/renderer/pages/ASide/hooks/useDirectorMode.ts
git add src/main/ipc/director-mode-handlers.ts
git commit -m "feat: 画板接收视频和分镜图的本地缓存路径"
```

---

## Task 11: 画板预览支持（点击打开 MediaPreviewModal）

**Files:**
- Modify: `src/renderer/pages/ASide/components/DirectorMode/CanvasPanel.tsx`
- Modify: `src/renderer/pages/ASide/components/DirectorMode/index.tsx`

- [ ] **Step 1: CanvasPanel 接收本地路径并使用 preview:// 协议**

在 CanvasPanel 中，将分镜图和视频的 `imageUrl`/`url` 转换为 `preview://` 格式：

```typescript
// preview:// 协议将本地绝对路径映射为可访问 URL
const toPreviewUrl = (localPath?: string) =>
  localPath ? `preview://${localPath}` : undefined;
```

- [ ] **Step 2: 分镜图使用 preview:// URL**

在 CanvasPanel 分镜图 tab 中：
```tsx
{storyboard.localGridPath ? (
  <img
    src={toPreviewUrl(storyboard.localGridPath)}
    alt="分镜图"
    className="w-full h-auto cursor-pointer"
    onClick={() => onPreviewMedia?.(storyboard.localGridPath!)}
  />
) : storyboard.imageUrl ? (
  <img src={storyboard.imageUrl} alt="分镜图" className="w-full h-auto" />
) : null}
```

- [ ] **Step 3: 视频使用 preview:// URL 并支持点击预览**

```tsx
<video
  src={toPreviewUrl(video.localPath) || video.url}
  controls
  className="w-full h-full object-cover cursor-pointer"
  onClick={() => video.localPath && onPreviewMedia?.(video.localPath)}
/>
```

- [ ] **Step 4: index.tsx 中引入 MediaPreviewModal**

```tsx
import { MediaPreviewModal } from '@renderer/components/MediaPreviewModal';

// state
const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);

// JSX
{previewFilePath && (
  <MediaPreviewModal
    filePath={previewFilePath}
    onClose={() => setPreviewFilePath(null)}
  />
)}
```

- [ ] **Step 5: 传 onPreviewMedia 给 CanvasPanel**

```tsx
<CanvasPanel
  ...
  onPreviewMedia={(path) => setPreviewFilePath(path)}
/>
```

- [ ] **Step 6: 更新 CanvasPanelProps 类型**

```typescript
interface CanvasPanelProps {
  ...
  onPreviewMedia?: (localPath: string) => void;
}
```

- [ ] **Step 7: 提交**

```bash
git add src/renderer/pages/ASide/components/DirectorMode/CanvasPanel.tsx
git add src/renderer/pages/ASide/components/DirectorMode/index.tsx
git commit -m "feat: 画板支持点击预览分镜图和最终视频"
```

---

## 验收检查清单

- [ ] `全球通用` 文字已全部替换为 `全国通用`
- [ ] 地区 `region` 数据正确传入工作流（可在 screenplay agent 日志中看到正确地区名称）
- [ ] 新生成的视频分辨率为 720p（日志或文件大小可验证）
- [ ] 艺术总监完成后，画板有场景节点出现
- [ ] 分镜师完成后，大图已下载到 `userData/temp/`，25 帧 base64 已生成
- [ ] 摄像导演使用首帧 i2v 模式（日志无 `r2v` 相关错误）
- [ ] 最终视频文件已下载到 `userData/temp/`
- [ ] 画板中分镜图点击可以打开全屏预览
- [ ] 画板中视频点击可以打开全屏预览
