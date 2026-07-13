const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const cdpPort = Number(process.env.VIDEO_STITCHER_CDP_PORT || 9223);
const testRoot = path.join(os.tmpdir(), 'videostitcher-dedup-ui');
const sourcePath = process.env.VIDEO_DEDUP_TEST_SOURCE_PATH || path.join(testRoot, 'source.mp4');
const sourceFileName = path.basename(sourcePath);
const libraryRoot = process.env.VIDEO_DEDUP_TEST_LIBRARY_ROOT || path.join(testRoot, 'library');
const outputDir = process.env.VIDEO_DEDUP_TEST_OUTPUT_DIR || path.join(testRoot, 'output');
const expectedElementCount = Number(process.env.VIDEO_DEDUP_EXPECTED_ELEMENTS || 3);
const screenshotDir = path.join(testRoot, 'screenshots');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getPageTarget() {
  const response = await fetch(`http://127.0.0.1:${cdpPort}/json`);
  const targets = await response.json();
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw new Error('没有找到可测试的渲染页面');
  return target;
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    this.socket.on('message', (raw) => {
      const message = JSON.parse(String(raw));
      if (!message.id) return;
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

async function waitFor(client, expression, label, timeout = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await client.evaluate(expression)) return;
    await wait(200);
  }
  const bodyText = await client.evaluate(`document.body?.innerText || ''`);
  throw new Error(`等待超时：${label}；当前页面：${bodyText.slice(0, 1200).replace(/\s+/g, ' ')}`);
}

async function screenshot(client, fileName) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const result = await client.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const filePath = path.join(screenshotDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  return filePath;
}

async function main() {
  const target = await getPageTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.call('Runtime.enable');
  await client.call('Page.enable');

  await client.evaluate(`(() => {
    localStorage.setItem('video-dedup-library-root', ${JSON.stringify(libraryRoot)});
    localStorage.setItem('video-dedup-output-dir', ${JSON.stringify(outputDir)});
    localStorage.removeItem('video-dedup-generation-rules');
    return true;
  })()`);
  await client.evaluate(`location.hash = '#/'`);
  console.log('[UI验收] 检查首页入口');
  await waitFor(client, `Boolean(document.querySelector('[data-testid="home-feature-videoDedup"]'))`, '首页视频降重入口');
  const homeScreenshot = await screenshot(client, '01-首页入口.png');

  await client.evaluate(`document.querySelector('[data-testid="home-feature-videoDedup"]').click()`);
  console.log('[UI验收] 进入批量处理入口');
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-page"]'))`, '视频降重二级页面');
  const processScreenshot = await screenshot(client, '02-批量处理入口.png');

  console.log('[UI验收] 载入隔离元素库与输出目录');
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-page"]'))`, '重新载入视频降重页面');
  await waitFor(client, `document.body.innerText.includes('已加载 ${expectedElementCount} 个元素')`, '元素库自动扫描');

  await client.evaluate(`document.querySelector('[data-testid="video-dedup-mode-library"]').click()`);
  console.log('[UI验收] 切换变体元素库');
  await waitFor(client, `document.body.innerText.includes('扫描摘要') && document.body.innerText.includes('可用元素')`, '变体元素库入口');
  const libraryScreenshot = await screenshot(client, '03-变体元素库.png');

  await client.evaluate(`document.querySelector('[data-testid="video-dedup-mode-process"]').click()`);
  console.log('[UI验收] 切回批量处理');
  await waitFor(client, `document.body.innerText.includes('变体编排预览')`, '返回批量处理入口');
  const defaultGenerationRules = await client.evaluate(`(() => {
    const readValue = (labelText) => Number([...document.querySelectorAll('label')]
      .find((label) => label.innerText.includes(labelText))
      ?.querySelector('input')?.value || 0);
    return {
      overlaysPerVideo: readValue('出现次数'),
      minDuration: readValue('最短持续'),
      maxDuration: readValue('最长持续'),
    };
  })()`);
  if (defaultGenerationRules.overlaysPerVideo !== 3
    || defaultGenerationRules.minDuration !== 4
    || defaultGenerationRules.maxDuration !== 5) {
    throw new Error(`生成规则默认值不正确：${JSON.stringify(defaultGenerationRules)}`);
  }

  const documentNode = await client.call('DOM.getDocument');
  const fileInputNode = await client.call('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: '[data-testid="videoDedupSources-upload-area"] input[type="file"]',
  });
  if (!fileInputNode.nodeId) throw new Error('没有找到待处理视频文件输入框');
  await client.call('DOM.setFileInputFiles', {
    nodeId: fileInputNode.nodeId,
    files: [sourcePath],
  });
  console.log('[UI验收] 导入待处理视频');
  await waitFor(client, `document.body.innerText.includes(${JSON.stringify(sourceFileName)})`, '导入待处理视频');
  await client.evaluate(`(() => {
    const field = [...document.querySelectorAll('label')]
      .find((label) => label.innerText.includes('出现次数'))
      ?.querySelector('input');
    if (!field) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(field, '1');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await wait(300);
  const selectedScalePercent = Number(await client.evaluate(
    `document.querySelector('[data-testid="video-dedup-element-scale"]')?.value || 0`,
  ));
  await client.evaluate(`document.querySelector('[data-testid="video-dedup-generate-preview"]').click()`);
  console.log('[UI验收] 生成真实效果预览');
  await waitFor(client, `Boolean(document.querySelector('video[src]'))`, '真实效果预览', 60000);
  await client.evaluate(`(async () => {
    const video = document.querySelector('video[src]');
    if (!video) return false;
    const eventTitle = [...document.querySelectorAll('[title]')]
      .map((element) => element.getAttribute('title') || '')
      .find((title) => /\\d+(?:\\.\\d+)?-\\d+(?:\\.\\d+)?\\s*秒/.test(title));
    const timeMatch = eventTitle?.match(/(\\d+(?:\\.\\d+)?)-(\\d+(?:\\.\\d+)?)\\s*秒/);
    const eventMiddle = timeMatch ? (Number(timeMatch[1]) + Number(timeMatch[2])) / 2 : 3;
    const targetTime = Math.min(eventMiddle, Math.max(0, (video.duration || 4) - 0.2));
    video.currentTime = targetTime;
    await new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
    await video.play().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 250));
    video.pause();
    return true;
  })()`);
  const previewScreenshot = await screenshot(client, '04-真实效果预览.png');

  await client.evaluate(`document.querySelector('[data-testid="video-dedup-add-tasks"]').click()`);
  console.log('[UI验收] 添加任务中心');
  await waitFor(client, `document.body.innerText.includes('任务已添加')`, '任务创建确认', 20000);
  const taskAddedScreenshot = await screenshot(client, '05-任务已添加.png');

  const latestTaskId = await client.evaluate(`(async () => {
    const result = await window.api.getTasks({
      filter: { type: ['video_dedup'] },
      sort: { field: 'id', order: 'desc' },
      page: 1,
      pageSize: 1,
      withOutputs: true,
    });
    return result.tasks?.[0]?.id || 0;
  })()`);
  if (!latestTaskId) throw new Error('任务弹窗已出现，但任务数据库中没有视频降重任务');
  await waitFor(client, `(async () => (await window.api.getTask(${Number(latestTaskId)}))?.status === 'completed')()`, '视频降重任务完成状态', 60000);
  const completedTaskScale = Number(await client.evaluate(`(async () => {
    const task = await window.api.getTask(${Number(latestTaskId)});
    const config = typeof task?.config === 'string' ? JSON.parse(task.config) : task?.config;
    return config?.elementScale || 0;
  })()`));
  if (Math.abs(completedTaskScale - selectedScalePercent / 100) > 0.0001) {
    throw new Error(`元素尺寸未正确写入正式任务：界面 ${selectedScalePercent}%，任务 ${completedTaskScale}`);
  }

  await client.evaluate(`location.hash = '#/tasks?type=video_dedup'`);
  console.log('[UI验收] 检查任务中心成品');
  await waitFor(client, `document.body.innerText.includes('视频降重处理') && document.body.innerText.includes('已完成')`, '任务中心完成记录', 20000);
  const taskCenterScreenshot = await screenshot(client, '06-任务中心已完成.png');
  const outputFiles = fs.readdirSync(outputDir).filter((fileName) => fileName.toLowerCase().endsWith('.mp4'));
  if (outputFiles.length === 0) throw new Error('任务中心显示完成，但输出目录没有 MP4 成品');

  await client.evaluate(`location.hash = '#/videoDedup'`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-page"]'))`, '返回视频降重页面');
  for (let index = 0; index < 4; index += 1) {
    await client.evaluate(`document.querySelector('[data-testid="video-dedup-mode-library"]').click()`);
    await client.evaluate(`document.querySelector('[data-testid="video-dedup-mode-process"]').click()`);
  }
  await client.evaluate(`document.querySelector('header .lucide-arrow-left')?.closest('button')?.click()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="home-feature-videoDedup"]'))`, '一次返回首页');
  const backScreenshot = await screenshot(client, '07-一次返回首页.png');

  await client.evaluate(`document.querySelector('[data-testid="home-feature-videoDedup"]').click()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-page"]'))`, '进入规则持久化测试页面');
  await client.evaluate(`(() => {
    const values = {
      '每条生成': '2',
      '出现次数': '6',
      '最短持续': '7',
      '最长持续': '8',
    };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [labelText, value] of Object.entries(values)) {
      const input = [...document.querySelectorAll('label')]
        .find((label) => label.innerText.includes(labelText))
        ?.querySelector('input');
      if (!input) return false;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  })()`);
  await wait(300);
  await client.evaluate(`document.querySelector('header .lucide-arrow-left')?.closest('button')?.click()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="home-feature-videoDedup"]'))`, '规则修改后返回首页');
  await client.evaluate(`document.querySelector('[data-testid="home-feature-videoDedup"]').click()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-page"]'))`, '重新打开视频降重页面');
  const persistedGenerationRules = await client.evaluate(`(() => {
    const readValue = (labelText) => Number([...document.querySelectorAll('label')]
      .find((label) => label.innerText.includes(labelText))
      ?.querySelector('input')?.value || 0);
    return {
      copies: readValue('每条生成'),
      overlaysPerVideo: readValue('出现次数'),
      minDuration: readValue('最短持续'),
      maxDuration: readValue('最长持续'),
      stored: JSON.parse(localStorage.getItem('video-dedup-generation-rules') || '{}'),
    };
  })()`);
  if (persistedGenerationRules.copies !== 2
    || persistedGenerationRules.overlaysPerVideo !== 6
    || persistedGenerationRules.minDuration !== 7
    || persistedGenerationRules.maxDuration !== 8) {
    throw new Error(`生成规则未在重新打开后恢复：${JSON.stringify(persistedGenerationRules)}`);
  }
  const persistedRulesScreenshot = await screenshot(client, '08-生成规则持久化.png');
  await client.evaluate(`document.querySelector('header .lucide-arrow-left')?.closest('button')?.click()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="home-feature-videoDedup"]'))`, '持久化验收后返回首页');

  const bodyText = await client.evaluate(`document.body.innerText`);
  const result = {
    success: true,
    route: await client.evaluate(`location.hash`),
    libraryLoaded: true,
    sourceLoaded: true,
    previewReady: true,
    outputFiles,
    completedTaskId: latestTaskId,
    defaultGenerationRules,
    selectedScalePercent,
    completedTaskScale,
    persistedGenerationRules,
    oneClickBackToHome: bodyText.includes('选择一个入口开始处理'),
    screenshots: [homeScreenshot, processScreenshot, libraryScreenshot, previewScreenshot, taskAddedScreenshot, taskCenterScreenshot, backScreenshot, persistedRulesScreenshot],
  };
  console.log(`VIDEO_DEDUP_UI_TEST_RESULT ${JSON.stringify(result)}`);
  client.close();
}

main().catch((error) => {
  console.error(`VIDEO_DEDUP_UI_TEST_RESULT ${JSON.stringify({ success: false, error: error.message })}`);
  process.exit(1);
});
