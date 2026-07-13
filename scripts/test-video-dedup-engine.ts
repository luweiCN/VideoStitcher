import { app } from 'electron';
import assert from 'node:assert';
import path from 'path';
import { executeVideoDedupTask } from '../src/main/services/VideoDedupEngine';
import {
  deleteVideoDedupPreview,
  generateVideoDedupPreview,
  previewGreenScreenElement,
  scanVideoDedupLibrary,
} from '../src/main/ipc/videoDedup';
import type { Task } from '../src/shared/types/task';
import {
  buildVideoDedupSchedule,
  validateVideoDedupSchedule,
  type VideoDedupTaskConfig,
} from '../src/shared/videoDedup';

async function run(): Promise<void> {
  const testDir = process.argv[2];
  if (!testDir) throw new Error('缺少测试目录参数');

  const sourcePath = path.join(testDir, 'source.mp4');
  const imagePath = path.join(testDir, 'sticker.png');
  const gifPath = path.join(testDir, 'animated.gif');
  const greenPath = path.join(testDir, 'green.mp4');
  const config: VideoDedupTaskConfig = {
    eventCount: 3,
    minDuration: 1,
    maxDuration: 1.5,
    skipHead: 0.5,
    skipTail: 0.5,
    minimumGap: 0.5,
    scheduleMode: 'slots',
    positions: ['top_left', 'top_right', 'bottom_right'],
    randomSeed: 20260710,
    variantIndex: 1,
    elementScale: 0.24,
    elements: [
      { path: imagePath, name: 'sticker.png', type: 'image', size: 0, modifiedAt: 0 },
      { path: gifPath, name: 'animated.gif', type: 'gif', size: 0, modifiedAt: 0 },
      {
        path: greenPath,
        name: 'green.mp4',
        type: 'green_video',
        size: 0,
        modifiedAt: 0,
        recipe: { keyColor: '#00FF00', similarity: 42, edgeSoftness: 18, spillSuppression: 35 },
      },
    ],
    events: [
      { index: 0, elementPath: imagePath, elementType: 'image', start: 0.8, duration: 1.2, end: 2, position: 'top_left' },
      { index: 1, elementPath: gifPath, elementType: 'gif', start: 2.8, duration: 1.4, end: 4.2, position: 'top_right' },
      {
        index: 2,
        elementPath: greenPath,
        elementType: 'green_video',
        start: 5,
        duration: 1.5,
        end: 6.5,
        position: 'bottom_right',
        recipe: { keyColor: '#00FF00', similarity: 42, edgeSoftness: 18, spillSuppression: 35 },
      },
    ],
  };
  const task: Task = {
    id: 900001,
    type: 'video_dedup',
    status: 'running',
    files: [{ path: sourcePath, category: 'source', category_name: '原视频' }],
    config: config as unknown as Record<string, unknown>,
    outputDir: testDir,
  };

  const scanResult = scanVideoDedupLibrary(testDir);
  assert.equal(scanResult.success, true);
  assert.equal(scanResult.counts.image >= 1, true);
  assert.equal(scanResult.counts.gif >= 1, true);
  assert.equal(scanResult.counts.green_video >= 1, true);
  console.log(`[测试元素库] 扫描到 ${scanResult.elements.length} 个元素`);

  const greenPreview = await previewGreenScreenElement(greenPath, {
    keyColor: '#00FF00',
    similarity: 42,
    edgeSoftness: 18,
    spillSuppression: 35,
  });
  assert.equal(greenPreview.success, true, greenPreview.error || '绿幕预览生成失败');
  assert.equal(greenPreview.preview?.startsWith('data:image/png;base64,'), true);
  console.log('[测试绿幕] 抠色预览生成成功');

  for (const scheduleMode of ['slots', 'random'] as const) {
    const scheduledEvents = buildVideoDedupSchedule(8, config.elements, {
      eventCount: 3,
      minDuration: 1,
      maxDuration: 1.5,
      skipHead: 0.5,
      skipTail: 0.5,
      minimumGap: 0.5,
      scheduleMode,
      positions: config.positions,
      randomSeed: 20260710,
    });
    assert.equal(validateVideoDedupSchedule(scheduledEvents, 0.5), true);
    assert.equal(scheduledEvents.every((event) => event.start >= 0.5 && event.end <= 7.5), true);
    console.log(`[测试排程] ${scheduleMode} 模式通过单轨校验`);
  }

  const previewResult = await generateVideoDedupPreview(sourcePath, config);
  assert.equal(previewResult.success, true);
  assert.equal(Boolean(previewResult.previewPath), true);
  console.log('[测试效果预览] 真实视频预览生成成功');
  if (previewResult.previewPath) {
    assert.equal(deleteVideoDedupPreview(previewResult.previewPath).success, true);
    console.log('[测试效果预览] 预览临时文件清理成功');
  }

  const result = await executeVideoDedupTask(
    task,
    (message) => {
      if (message.startsWith('已生成') || message.startsWith('元素 ')) {
        console.log(`[测试日志] ${message}`);
      }
    },
    (pid) => console.log(`[测试日志] FFmpeg PID: ${pid}`),
    (progress, step) => {
      if (progress === 5 || progress >= 98) console.log(`[测试进度] ${progress}% ${step}`);
    },
    2,
  );

  console.log(`VIDEO_DEDUP_TEST_RESULT=${JSON.stringify(result)}`);
  if (!result.success) process.exitCode = 1;
}

app.whenReady()
  .then(run)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => app.quit());
