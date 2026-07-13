const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const port = Number(process.env.VIDEO_STITCHER_CDP_PORT || 9351);
const libraryRoot = process.env.VIDEO_DEDUP_TEST_LIBRARY_ROOT;
const screenshotDir = process.env.VIDEO_STITCHER_SCREENSHOT_DIR
  || path.join(process.env.TEMP, 'videostitcher-library-group-ui-screenshots');

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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || '页面脚本执行失败');
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
    await wait(250);
  }
  throw new Error(`等待超时：${label}`);
}

async function captureScreenshot(client, fileName) {
  await client.call('Page.bringToFront');
  await wait(600);
  await client.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const result = await client.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  fs.mkdirSync(screenshotDir, { recursive: true });
  const filePath = path.join(screenshotDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  return filePath;
}

async function main() {
  if (!libraryRoot) throw new Error('未设置测试元素库目录');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw new Error('没有找到隔离测试页面');

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.call('Runtime.enable');
  await client.call('Page.enable');

  await client.evaluate(`(async () => {
    localStorage.setItem('home-theme', 'dark');
    localStorage.setItem('video-dedup-library-root', ${JSON.stringify(libraryRoot)});
    location.hash = '#/';
    await new Promise((resolve) => setTimeout(resolve, 100));
    location.hash = '#/videoDedup';
    return true;
  })()`);
  await waitFor(client, `Boolean(document.querySelector('[data-testid="video-dedup-mode-library"]'))`, '视频降重页面');
  await client.evaluate(`document.querySelector('[data-testid="video-dedup-mode-library"]').click()`);
  await waitFor(
    client,
    `Boolean(document.querySelector('[data-testid="video-dedup-library-group-gif"]'))
      && Boolean(document.querySelector('[data-testid="video-dedup-library-group-green_video"]'))`,
    '分类分组',
  );

  const result = await client.evaluate(`(() => {
    const gifGroup = document.querySelector('[data-testid="video-dedup-library-group-gif"]');
    const videoGroup = document.querySelector('[data-testid="video-dedup-library-group-green_video"]');
    const imageGroup = document.querySelector('[data-testid="video-dedup-library-group-image"]');
    const gifNames = [...gifGroup.querySelectorAll('button')].map((button) => button.innerText.trim());
    const videoNames = [...videoGroup.querySelectorAll('button')].map((button) => button.innerText.trim());
    return {
      gifNames,
      videoNames,
      hasImageGroup: Boolean(imageGroup),
      gifContainsMp4: gifNames.some((name) => /\.mp4\b/i.test(name)),
      videoContainsGif: videoNames.some((name) => /\.gif\b/i.test(name)),
    };
  })()`);

  if (result.gifNames.length !== 3 || result.videoNames.length !== 1 || result.hasImageGroup
    || result.gifContainsMp4 || result.videoContainsGif) {
    throw new Error(`分类结果不正确：${JSON.stringify(result)}`);
  }
  if (!result.gifNames.every((name) => /\.gif\b/i.test(name)) || !/\.mp4\b/i.test(result.videoNames[0])) {
    throw new Error(`文件扩展名与分组不一致：${JSON.stringify(result)}`);
  }

  const screenshot = await captureScreenshot(client, '元素库-按扩展名分组.png');
  console.log(JSON.stringify({ success: true, result, screenshot }, null, 2));
  client.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(`[元素库分类 UI 验收失败] ${error.message}`);
  process.exit(1);
});
