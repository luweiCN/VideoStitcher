import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeAvailableUpdate } from '../src/renderer/features/updateState.ts';
import { buildManualUpdateDownloadUrl } from '../src/shared/update.ts';

const info = {
  version: '2.9.2',
  releaseDate: '2026-07-21T00:00:00.000Z',
  releaseNotes: '修复更新状态',
};

test('下载完成后同一版本不会被定时检查降级为可下载', () => {
  const downloaded = { status: 'downloaded', info };
  const available = { status: 'available', info: { ...info } };

  assert.equal(mergeAvailableUpdate(downloaded, available), downloaded);
});

test('发现更高版本时允许替换已经下载的旧版本', () => {
  const downloaded = { status: 'downloaded', info };
  const next = {
    status: 'available',
    info: { ...info, version: '2.9.3' },
  };

  assert.equal(mergeAvailableUpdate(downloaded, next), next);
});

test('为 macOS 和 Windows 生成对应的完整安装包地址', () => {
  const baseUrl = 'https://updates.example.com/stable/';

  assert.equal(
    buildManualUpdateDownloadUrl({ baseUrl, version: '2.9.4', platform: 'darwin', arch: 'arm64' }),
    'https://updates.example.com/stable/VideoStitcher-2.9.4-arm64.dmg',
  );
  assert.equal(
    buildManualUpdateDownloadUrl({ baseUrl, version: '2.9.4', platform: 'darwin', arch: 'x64' }),
    'https://updates.example.com/stable/VideoStitcher-2.9.4.dmg',
  );
  assert.equal(
    buildManualUpdateDownloadUrl({ baseUrl, version: '2.9.4', platform: 'win32', arch: 'x64' }),
    'https://updates.example.com/stable/VideoStitcher-2.9.4-x64.exe',
  );
});

test('拒绝不安全的更新地址和非法版本号', () => {
  assert.equal(
    buildManualUpdateDownloadUrl({
      baseUrl: 'http://updates.example.com/stable',
      version: '2.9.4',
      platform: 'darwin',
      arch: 'arm64',
    }),
    undefined,
  );
  assert.equal(
    buildManualUpdateDownloadUrl({
      baseUrl: 'https://updates.example.com/stable',
      version: '../2.9.4',
      platform: 'darwin',
      arch: 'arm64',
    }),
    undefined,
  );
});
