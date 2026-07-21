import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { getManagedRollbackTarget } from '../src/main/releaseDirective.ts';
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

test('只有签名目标明确包含当前版本时才允许受控回退', async () => {
  const keyPair = generateKeyPairSync('ed25519');
  const publicKey = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const now = new Date('2026-07-21T08:00:00.000Z');
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const directive = signRollbackDirective(keyPair.privateKey, {
    issuer: 'videostitcher-release',
    targetVersion: '2.9.4',
    allowedFromVersions: ['2.9.5'],
    generation: '018f5810-4f46-7c92-bb85-7c0695c39ea1',
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + 60 * 60,
  });
  const fetchImplementation = async () => Response.json({
    schemaVersion: 1,
    targetVersion: '2.9.4',
    directive,
  });

  assert.equal(await getManagedRollbackTarget({
    updateBaseUrl: 'https://updates.example.com/stable',
    currentVersion: '2.9.5',
    signingPublicKey: publicKey,
    fetchImplementation,
    now,
  }), '2.9.4');
  await assert.rejects(getManagedRollbackTarget({
    updateBaseUrl: 'https://updates.example.com/stable',
    currentVersion: '2.9.6',
    signingPublicKey: publicKey,
    fetchImplementation,
    now,
  }), /不适用于当前客户端/);
});

test('篡改或过期的回退指令不能打开客户端降级开关', async () => {
  const keyPair = generateKeyPairSync('ed25519');
  const publicKey = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const now = new Date('2026-07-21T08:00:00.000Z');
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const expired = signRollbackDirective(keyPair.privateKey, {
    issuer: 'videostitcher-release',
    targetVersion: '2.9.4',
    allowedFromVersions: ['2.9.5'],
    generation: '018f5810-4f46-7c92-bb85-7c0695c39ea1',
    issuedAt: nowSeconds - 7200,
    expiresAt: nowSeconds - 3600,
  });

  await assert.rejects(getManagedRollbackTarget({
    updateBaseUrl: 'https://updates.example.com/stable',
    currentVersion: '2.9.5',
    signingPublicKey: publicKey,
    fetchImplementation: async () => Response.json({
      schemaVersion: 1,
      targetVersion: '2.9.4',
      directive: expired,
    }),
    now,
  }), /已经过期/);
});

function signRollbackDirective(privateKey, claims) {
  const header = {
    algorithm: 'EdDSA',
    type: 'VS-RELEASE-ROLLBACK',
    version: 1,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  return `${signingInput}.${sign(null, Buffer.from(signingInput), privateKey).toString('base64url')}`;
}
