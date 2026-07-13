const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const port = Number(process.env.VIDEO_STITCHER_CDP_PORT || 9349);
const homeSkin = process.env.VIDEO_STITCHER_HOME_SKIN || 'airbnb-minimal';
const screenshotDir = process.env.VIDEO_STITCHER_SCREENSHOT_DIR
  || path.join(process.env.TEMP, 'videostitcher-scale-ui-screenshots');

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

async function screenshot(client, fileName) {
  await client.call('Page.bringToFront');
  await wait(500);
  await client.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
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
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw new Error('没有找到隔离测试页面');

  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  console.log('[元素尺寸 UI 验收] 已连接隔离页面');
  await client.call('Runtime.enable');
  await client.call('Page.enable');

  await client.evaluate(`(async () => {
    localStorage.setItem('home-theme', 'dark');
    localStorage.setItem('home-skin', ${JSON.stringify(homeSkin)});
    localStorage.removeItem('video-dedup-element-scale');
    location.hash = '#/';
    await new Promise((resolve) => setTimeout(resolve, 100));
    location.hash = '#/videoDedup';
    return true;
  })()`);
  console.log('[元素尺寸 UI 验收] 已进入视频降重页面');

  for (let index = 0; index < 40; index += 1) {
    const ready = await client.evaluate(`Boolean(document.querySelector('[data-testid="video-dedup-element-scale"]'))`);
    if (ready) break;
    await wait(250);
  }

  const defaultState = await client.evaluate(`(() => {
    const slider = document.querySelector('[data-testid="video-dedup-element-scale"]');
    if (!slider) return null;
    slider.closest('.metal-control').scrollIntoView({ block: 'center' });
    const selected = slider.closest('.metal-control').querySelector('[data-selected="true"]');
    const style = getComputedStyle(selected);
    const positionButtons = [...document.querySelectorAll('.video-dedup-position-button')].map((button) => {
      const buttonStyle = getComputedStyle(button);
      return {
        selected: button.dataset.selected,
        pressed: button.getAttribute('aria-pressed'),
        background: buttonStyle.backgroundColor,
        radius: buttonStyle.borderRadius,
      };
    });
    return {
      value: slider.value,
      selectedText: selected.textContent.trim(),
      selectedBackground: style.backgroundColor,
      selectedRadius: style.borderRadius,
      positionButtons,
    };
  })()`);
  console.log('[元素尺寸 UI 验收] 已读取默认状态');
  await wait(800);
  const defaultScreenshot = await screenshot(client, '01-元素尺寸-默认中.png');

  const customState = await client.evaluate(`(() => {
    const slider = document.querySelector('[data-testid="video-dedup-element-scale"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(slider, '41');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!customState) throw new Error('自定义尺寸交互失败');
  await wait(800);

  const customResult = await client.evaluate(`(() => {
    const slider = document.querySelector('[data-testid="video-dedup-element-scale"]');
    const panel = slider.closest('.metal-control');
    return {
      value: slider.value,
      savedValue: localStorage.getItem('video-dedup-element-scale'),
      selectedText: panel.querySelector('[data-selected="true"]')?.textContent.trim(),
      visibleValue: [...panel.querySelectorAll('span')].some((item) => item.textContent.trim() === '41%'),
    };
  })()`);
  const customScreenshot = await screenshot(client, '02-元素尺寸-自定义41.png');

  if (defaultState?.value !== '22' || defaultState?.selectedText !== '中') {
    throw new Error(`默认尺寸状态不正确：${JSON.stringify(defaultState)}`);
  }
  if (defaultState.selectedBackground !== 'rgb(255, 56, 92)' || defaultState.selectedRadius !== '8px') {
    throw new Error(`默认选中样式不正确：${JSON.stringify(defaultState)}`);
  }
  if (defaultState.positionButtons.length !== 4 || defaultState.positionButtons.some((button) => (
    button.selected !== 'true'
    || button.pressed !== 'true'
    || button.background !== 'rgb(255, 56, 92)'
    || button.radius !== '8px'
  ))) {
    throw new Error(`随机位置选中样式不正确：${JSON.stringify(defaultState.positionButtons)}`);
  }
  if (customResult.value !== '41' || customResult.savedValue !== '41'
    || customResult.selectedText !== '自定义' || !customResult.visibleValue) {
    throw new Error(`自定义尺寸状态不正确：${JSON.stringify(customResult)}`);
  }

  console.log(JSON.stringify({ defaultState, customResult, defaultScreenshot, customScreenshot }, null, 2));
  client.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(`[元素尺寸 UI 验收失败] ${error.message}`);
  process.exit(1);
});
