import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';

function isTrustedRendererUrl(value: string): boolean {
  try {
    const target = new URL(value);
    if (!app.isPackaged) {
      const developmentUrl = process.env['ELECTRON_RENDERER_URL'];
      return developmentUrl === undefined || target.origin === new URL(developmentUrl).origin;
    }

    const rendererUrl = pathToFileURL(join(__dirname, '../renderer/index.html'));
    return target.protocol === 'file:' && target.pathname === rendererUrl.pathname;
  } catch {
    return false;
  }
}

export function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url || event.sender.getURL();
  if (!isTrustedRendererUrl(senderUrl)) {
    console.warn('[IPC 安全] 已拒绝非受信任页面调用主进程能力');
    throw new Error('不允许当前页面调用该功能');
  }
}

/**
 * 所有 invoke 型 IPC 都先验证 sender，避免导航或子 frame 获得本地高权限能力。
 */
export const trustedIpcMain: Pick<typeof ipcMain, 'handle'> = {
  handle(channel, listener) {
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrustedIpcSender(event);
      return listener(event, ...args);
    });
  },
};
