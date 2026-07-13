const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const port = Number(process.env.VIDEO_STITCHER_CDP_PORT || 9352);
const sourcePath = process.env.VIDEO_DEDUP_TEST_SOURCE_PATH;
const libraryRoot = process.env.VIDEO_DEDUP_TEST_LIBRARY_ROOT;
const outputDir = process.env.VIDEO_DEDUP_TEST_OUTPUT_DIR;
const screenshotDir = process.env.VIDEO_STITCHER_SCREENSHOT_DIR
  || path.join(process.env.TEMP, 'videostitcher-timeline-ui-screenshots');

if (!sourcePath || !libraryRoot || !outputDir) {
  throw new Error('缺少时间轴验收所需的测试素材路径');
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', (raw) => {
      const message = JSON.parse(String(raw));
      const handler = this.pending.get(message.id);
      if (!handler) return;
      this.pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 调用超时：${method}`));
      }, 8000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || '页面脚本执行失败');
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

async function waitFor(client, expression, label, timeout = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await client.evaluate(expression)) return;
    await wait(200);
  }
  const bodyText = await client.evaluate(`document.body?.innerText || ''`);
  throw new Error(`等待超时：${label}；当前页面：${bodyText.slice(0, 800).replace(/\s+/g, ' ')}`);
}

async function screenshot(client, fileName) {
  await client.call('Page.bringToFront');
  await wait(500);
  await client.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const result = await client.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  return filePath;
}

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw new Error('没有找到隔离测试页面');

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.call('Runtime.enable');
  await client.call('Page.enable');

  await client.evaluate(`(async () => {
    localStorage.setItem('home-theme', 'dark');
    localStorage.setItem('home-skin', 'airbnb-minimal');
    localStorage.setItem('video-dedup-library-root', ${JSON.stringify(libraryRoot)});
    localStorage.setItem('video-dedup-output-dir', ${JSON.stringify(outputDir)});
    localStorage.removeItem('video-dedup-generation-rules');
    location.hash = '#/videoDedup';
    return true;
  })()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-page"]'))`, '视频降重页面');
  await waitFor(client, `document.body.innerText.includes('已加载 3 个元素')`, '三类元素库扫描', 30000);

  const documentNode = await client.call('DOM.getDocument');
  const fileInputNode = await client.call('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: '[data-testid="videoDedupSources-upload-area"] input[type="file"]',
  });
  if (!fileInputNode.nodeId) throw new Error('没有找到待处理视频输入框');
  await client.call('DOM.setFileInputFiles', {
    nodeId: fileInputNode.nodeId,
    files: [sourcePath],
  });
  await waitFor(client, `document.body.innerText.includes(${JSON.stringify(path.basename(sourcePath))})`, '测试视频导入');

  await client.evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const values = { '出现次数': '1', '最短持续': '0.4', '最长持续': '0.7' };
    for (const [labelText, value] of Object.entries(values)) {
      const field = [...document.querySelectorAll('label')]
        .find((label) => label.innerText.includes(labelText))
        ?.querySelector('input');
      setter.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  })()`);
  await wait(300);
  await client.evaluate(`document.querySelector('[data-testid="video-dedup-generate-preview"]').click()`);
  console.log('[时间轴 UI 验收] 正在生成初始预览');
  await waitFor(client, `Boolean(document.querySelector('video[src]'))`, '初始真实预览', 90000);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-timeline-event-0"]'))`, '时间轴事件');
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-scheme-strip"]'))`, '极速方案条');
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-realtime-canvas"]'))`, '实时图层画布');
  const initialScreenshot = await screenshot(client, '00-极速方案与实时图层.png');

  const colorState = await client.evaluate(`(() => {
    const legend = [...document.querySelectorAll('.video-dedup-type-color')].map((item) => ({
      type: item.dataset.elementType,
      color: getComputedStyle(item).backgroundColor,
    }));
    const event = document.querySelector('[data-testid="video-dedup-timeline-event-0"]');
    return {
      legend,
      eventType: event?.dataset.elementType,
      eventColor: event ? getComputedStyle(event).backgroundColor : '',
    };
  })()`);
  if (new Set(colorState.legend.map((item) => item.color)).size !== 3) {
    throw new Error(`三类变体颜色没有区分：${JSON.stringify(colorState)}`);
  }

  await waitFor(
    client,
    `!document.querySelector('[data-testid="video-dedup-add-timeline-event"]')?.disabled`,
    '增加变体按钮可用',
  );
  await client.evaluate(`document.querySelector('[data-testid="video-dedup-add-timeline-event"]').click()`);
  await waitFor(client, `document.querySelectorAll('.video-dedup-timeline-event').length === 2`, '随机增加变体');
  await wait(350);
  const addAndSelectState = await client.evaluate(`(() => {
    const events = [...document.querySelectorAll('.video-dedup-timeline-event')];
    const selected = document.querySelector('.video-dedup-timeline-event-selected');
    const unselected = events.find((event) => event !== selected);
    const deleteButton = document.querySelector('[data-testid="video-dedup-delete-timeline-event"]');
    return {
      eventCount: events.length,
      selectedColor: selected ? getComputedStyle(selected).backgroundColor : '',
      selectedType: selected?.dataset.elementType || '',
      unselectedColor: unselected ? getComputedStyle(unselected).backgroundColor : '',
      unselectedType: unselected?.dataset.elementType || '',
      deleteDisabled: deleteButton?.disabled,
      deleteActive: deleteButton?.dataset.active,
      deleteColor: deleteButton ? getComputedStyle(deleteButton).backgroundColor : '',
      schedule: events.map((event) => ({
        start: Number(event.dataset.start),
        end: Number(event.dataset.end),
      })),
    };
  })()`);
  if (addAndSelectState.selectedColor !== 'rgb(255, 56, 92)'
    || addAndSelectState.unselectedColor === 'rgb(255, 56, 92)'
    || addAndSelectState.deleteDisabled
    || addAndSelectState.deleteActive !== 'true'
    || addAndSelectState.deleteColor !== 'rgb(255, 56, 92)') {
    throw new Error(`新增或选中状态不正确：${JSON.stringify(addAndSelectState)}`);
  }
  if (addAndSelectState.schedule[1].start + 0.001 < addAndSelectState.schedule[0].end + 0.01) {
    throw new Error(`新增事件没有遵守单轨最小间隔：${JSON.stringify(addAndSelectState.schedule)}`);
  }
  const addScreenshot = await screenshot(client, '00-新增变体与红色选中态.png');

  await client.evaluate(`document.querySelector('[data-testid="video-dedup-delete-timeline-event"]').click()`);
  await waitFor(client, `document.querySelectorAll('.video-dedup-timeline-event').length === 1`, '删除所选变体');
  const deleteState = await client.evaluate(`(() => {
    const deleteButton = document.querySelector('[data-testid="video-dedup-delete-timeline-event"]');
    return {
      eventCount: document.querySelectorAll('.video-dedup-timeline-event').length,
      selectedCount: document.querySelectorAll('.video-dedup-timeline-event-selected').length,
      deleteDisabled: deleteButton?.disabled,
      deleteActive: deleteButton?.dataset.active,
    };
  })()`);
  if (deleteState.eventCount !== 1 || deleteState.selectedCount !== 0
    || !deleteState.deleteDisabled || deleteState.deleteActive !== 'false') {
    throw new Error(`删除所选状态不正确：${JSON.stringify(deleteState)}`);
  }

  const moveState = await client.evaluate(`(async () => {
    const event = document.querySelector('[data-testid="video-dedup-timeline-event-0"]');
    const track = document.querySelector('[data-testid="video-dedup-timeline-track"]');
    const before = { start: Number(event.dataset.start), end: Number(event.dataset.end) };
    const duration = before.end - before.start;
    const videoDuration = Number(track.dataset.duration || 8);
    const maxStart = Math.max(1, videoDuration - 1 - duration);
    const deltaSeconds = before.start + 0.25 <= maxStart ? 0.25 : -0.25;
    const deltaPixels = deltaSeconds / videoDuration * track.getBoundingClientRect().width;
    const rect = event.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    event.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX, clientY, pointerId: 1, button: 0, buttons: 1,
    }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: clientX + deltaPixels, clientY, pointerId: 1, buttons: 1,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, clientX: clientX + deltaPixels, clientY, pointerId: 1, button: 0,
    }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      before,
      after: { start: Number(event.dataset.start), end: Number(event.dataset.end) },
    };
  })()`);
  if (Math.abs(moveState.after.start - moveState.before.start) < 0.05) {
    throw new Error(`拖动素材块后位置没有变化：${JSON.stringify(moveState)}`);
  }

  const resizeState = await client.evaluate(`(async () => {
    const event = document.querySelector('[data-testid="video-dedup-timeline-event-0"]');
    const handle = document.querySelector('[data-testid="video-dedup-timeline-resize-end-0"]');
    const track = document.querySelector('[data-testid="video-dedup-timeline-track"]');
    const before = { start: Number(event.dataset.start), end: Number(event.dataset.end) };
    const duration = before.end - before.start;
    const videoDuration = Number(track.dataset.duration || 8);
    const targetDuration = 1.2;
    const deltaSeconds = targetDuration - duration;
    const deltaPixels = deltaSeconds / videoDuration * track.getBoundingClientRect().width;
    const rect = handle.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX, clientY, pointerId: 2, button: 0, buttons: 1,
    }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: clientX + deltaPixels, clientY, pointerId: 2, buttons: 1,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, clientX: clientX + deltaPixels, clientY, pointerId: 2, button: 0,
    }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      before,
      after: { start: Number(event.dataset.start), end: Number(event.dataset.end) },
    };
  })()`);
  if (Math.abs(
    (resizeState.after.end - resizeState.after.start)
      - (resizeState.before.end - resizeState.before.start),
  ) < 0.05) {
    throw new Error(`拖动边缘后时长没有变化：${JSON.stringify(resizeState)}`);
  }
  if (resizeState.after.end - resizeState.after.start >= 2) {
    throw new Error(`手动时长仍被最短持续 2 秒限制：${JSON.stringify(resizeState)}`);
  }

  await waitFor(client, `document.body.innerText.includes('实时编辑已保存')`, '实时编辑保存状态');
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-scheme-strip"]'))`, '极速方案条');
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-realtime-canvas"]'))`, '实时图层画布');
  const editedScreenshot = await screenshot(client, '01-时间轴已调整.png');

  console.log('[时间轴 UI 验收] 检查实时画布与时间轴编辑保持同步');
  const renderedState = await client.evaluate(`(() => {
    const event = document.querySelector('[data-testid="video-dedup-timeline-event-0"]');
    return {
      start: Number(event.dataset.start),
      end: Number(event.dataset.end),
      buttonText: document.querySelector('[data-testid="video-dedup-generate-preview"]').innerText,
      savedTextVisible: document.body.innerText.includes('实时编辑已保存'),
      schemeCount: document.querySelectorAll('[data-testid^="video-dedup-scheme-"]').length,
      hasRealtimeCanvas: Boolean(document.querySelector('[data-testid="video-dedup-realtime-canvas"]')),
    };
  })()`);
  if (Math.abs(renderedState.start - resizeState.after.start) > 0.01
    || Math.abs(renderedState.end - resizeState.after.end) > 0.01) {
    throw new Error(`实时编排没有保留编辑时间：${JSON.stringify({ resizeState, renderedState })}`);
  }
  if (!renderedState.savedTextVisible || !renderedState.hasRealtimeCanvas || renderedState.schemeCount < 1) {
    throw new Error(`极速方案或实时画布没有正常显示：${JSON.stringify(renderedState)}`);
  }
  await client.evaluate(`(() => {
    const event = document.querySelector('[data-testid="video-dedup-timeline-event-0"]');
    const video = document.querySelector('video[src]');
    video.currentTime = Number(event.dataset.start) + 0.1;
    video.dispatchEvent(new Event('seeked'));
    return true;
  })()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-realtime-layer"]'))`, '当前事件实时图层');
  const canvasMoveState = await client.evaluate(`(async () => {
    const layer = document.querySelector('[data-testid="video-dedup-realtime-layer"]');
    const before = { left: layer.style.left, top: layer.style.top, width: layer.style.width };
    const rect = layer.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    layer.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: x, clientY: y, pointerId: 3, button: 0, buttons: 1,
    }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: x + 24, clientY: y + 16, pointerId: 3, buttons: 1,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, clientX: x + 24, clientY: y + 16, pointerId: 3, button: 0,
    }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { before, after: { left: layer.style.left, top: layer.style.top, width: layer.style.width } };
  })()`);
  if (canvasMoveState.before.left === canvasMoveState.after.left
    && canvasMoveState.before.top === canvasMoveState.after.top) {
    throw new Error(`拖动实时图层后位置没有变化：${JSON.stringify(canvasMoveState)}`);
  }
  const canvasResizeState = await client.evaluate(`(async () => {
    const layer = document.querySelector('[data-testid="video-dedup-realtime-layer"]');
    const handle = document.querySelector('[data-testid="video-dedup-realtime-resize-handle"]');
    const before = layer.style.width;
    const rect = handle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: x, clientY: y, pointerId: 4, button: 0, buttons: 1,
    }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: x + 28, clientY: y + 28, pointerId: 4, buttons: 1,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, clientX: x + 28, clientY: y + 28, pointerId: 4, button: 0,
    }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { before, after: layer.style.width };
  })()`);
  if (canvasResizeState.before === canvasResizeState.after) {
    throw new Error(`拖动实时图层尺寸手柄后宽度没有变化：${JSON.stringify(canvasResizeState)}`);
  }
  const renderedScreenshot = await screenshot(client, '02-调整后实时画布.png');

  console.log(`VIDEO_DEDUP_TIMELINE_UI_TEST_RESULT ${JSON.stringify({
    success: true,
    colorState,
    addAndSelectState,
    deleteState,
    moveState,
    resizeState,
    renderedState,
    canvasMoveState,
    canvasResizeState,
    screenshots: [initialScreenshot, addScreenshot, editedScreenshot, renderedScreenshot],
  })}`);
  client.close();
}

main().catch((error) => {
  console.error(`VIDEO_DEDUP_TIMELINE_UI_TEST_RESULT ${JSON.stringify({ success: false, error: error.message })}`);
  process.exit(1);
});
