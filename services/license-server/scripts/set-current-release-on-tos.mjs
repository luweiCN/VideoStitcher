import { createPublicKey, verify } from 'node:crypto';
import { TosClient } from '@volcengine/tos-sdk';
import {
  assertReleaseVersion,
  compareReleaseVersions,
  readManifestVersion,
} from './release-catalog.mjs';

const requiredEnvironment = [
  'TOS_UPDATE_ACCESS_KEY_ID',
  'TOS_UPDATE_SECRET_ACCESS_KEY',
  'TOS_UPDATE_REGION',
  'TOS_UPDATE_ENDPOINT',
  'TOS_UPDATE_BUCKET',
  'VIDEO_STITCHER_UPDATE_BASE_URL',
  'VIDEO_STITCHER_LICENSE_SIGNING_PUBLIC_KEY_BASE64',
];
for (const name of requiredEnvironment) {
  if (!process.env[name]?.trim()) throw new Error(`缺少环境变量 ${name}`);
}

const argumentsList = process.argv.slice(2);
const targetVersion = assertReleaseVersion(readOption('--target-version=') ?? '', '目标版本');
const signedDirective = readOption('--signed-directive=') ?? '';
const prefix = (process.env.TOS_UPDATE_PREFIX || 'stable').replace(/^\/+|\/+$/g, '');
const bucket = process.env.TOS_UPDATE_BUCKET.trim();
const updateBaseUrl = process.env.VIDEO_STITCHER_UPDATE_BASE_URL.trim().replace(/\/+$/, '');
const parsedUpdateBaseUrl = new URL(`${updateBaseUrl}/`);
if (parsedUpdateBaseUrl.protocol !== 'https:' || parsedUpdateBaseUrl.username || parsedUpdateBaseUrl.password) {
  throw new Error('公网更新源必须是无账号信息的 HTTPS 地址');
}
const publicKeyPem = Buffer.from(
  process.env.VIDEO_STITCHER_LICENSE_SIGNING_PUBLIC_KEY_BASE64.trim(),
  'base64',
).toString('utf8');
const client = new TosClient({
  accessKeyId: process.env.TOS_UPDATE_ACCESS_KEY_ID.trim(),
  accessKeySecret: process.env.TOS_UPDATE_SECRET_ACCESS_KEY.trim(),
  ...(process.env.TOS_UPDATE_SESSION_TOKEN?.trim()
    ? { stsToken: process.env.TOS_UPDATE_SESSION_TOKEN.trim() }
    : {}),
  region: process.env.TOS_UPDATE_REGION.trim(),
  endpoint: process.env.TOS_UPDATE_ENDPOINT.trim(),
});

await client.headBucket(bucket);
const catalog = await readJson(`${prefix}/releases/index.json`);
if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.releases)) {
  throw new Error('TOS 版本目录不存在或格式无效，必须先使用新版发布流水线发布一个版本');
}
const release = catalog.releases.find((item) => item?.version === targetVersion);
if (!release?.manifests?.windows || !release.manifests.macos) {
  throw new Error(`版本 ${targetVersion} 的归档清单不完整，不能设为当前版本`);
}

const comparison = compareReleaseVersions(targetVersion, catalog.currentVersion);
const now = new Date();
const channel = {
  schemaVersion: 1,
  targetVersion,
  updatedAt: now.toISOString(),
};
if (comparison < 0) {
  const claims = verifyRollbackDirective(signedDirective, publicKeyPem, now);
  if (claims.targetVersion !== targetVersion) throw new Error('回退指令与目标版本不一致');
  if (!claims.allowedFromVersions.includes(catalog.currentVersion)) {
    throw new Error(`回退指令不允许从当前版本 ${catalog.currentVersion} 回退`);
  }
  channel.directive = signedDirective;
} else if (signedDirective) {
  throw new Error('升级或保持当前版本时不能携带回退指令');
}

const archivedManifests = new Map();
for (const [platform, manifestName] of [['windows', 'latest.yml'], ['macos', 'latest-mac.yml']]) {
  const archivedKey = release.manifests[platform];
  const content = await readBuffer(archivedKey);
  if (readManifestVersion(content.toString('utf8')) !== targetVersion) {
    throw new Error(`归档清单 ${archivedKey} 的版本与目标版本不一致`);
  }
  archivedManifests.set(manifestName, content);
}

// 回退时先发布签名指令，确保客户端看到旧清单前已经获得明确授权。
await putJson(`${prefix}/channel.json`, channel);
for (const manifestName of ['latest.yml', 'latest-mac.yml']) {
  const content = archivedManifests.get(manifestName);
  if (!content) throw new Error(`归档清单 ${manifestName} 未加载`);
  await client.putObject({
    bucket,
    key: `${prefix}/${manifestName}`,
    body: content,
    cacheControl: 'no-store, max-age=0',
    contentType: 'application/yaml; charset=utf-8',
  });
  console.log(`[版本切换] 已更新 ${manifestName} 到 ${targetVersion}`);
}

catalog.currentVersion = targetVersion;
catalog.updatedAt = now.toISOString();
await putJson(`${prefix}/releases/index.json`, catalog);
await verifyPublicChannel(targetVersion);
console.log(`[版本切换] 当前版本已切换为 ${targetVersion}`);

async function readBuffer(key) {
  const response = await client.getObjectV2({ bucket, key, dataType: 'buffer' });
  return response.data.content;
}

async function readJson(key) {
  return JSON.parse((await readBuffer(key)).toString('utf8'));
}

async function putJson(key, value) {
  await client.putObject({
    bucket,
    key,
    body: Buffer.from(`${JSON.stringify(value, null, 2)}\n`),
    cacheControl: 'no-store, max-age=0',
    contentType: 'application/json; charset=utf-8',
  });
}

function verifyRollbackDirective(token, publicKey, nowDate) {
  const segments = token.split('.');
  if (segments.length !== 3 || token.length > 16_384) throw new Error('缺少有效的签名回退指令');
  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new Error('签名回退指令格式无效');
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));
  const valid = verify(
    null,
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    createPublicKey(publicKey),
    Buffer.from(encodedSignature, 'base64url'),
  );
  const nowSeconds = Math.floor(nowDate.getTime() / 1000);
  if (
    !valid
    || header.algorithm !== 'EdDSA'
    || header.type !== 'VS-RELEASE-ROLLBACK'
    || header.version !== 1
    || claims.issuer !== 'videostitcher-release'
    || !Array.isArray(claims.allowedFromVersions)
    || typeof claims.targetVersion !== 'string'
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(claims.targetVersion)
    || claims.allowedFromVersions.some((version) => (
      typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)
    ))
    || typeof claims.generation !== 'string'
    || claims.generation.length < 16
    || !Number.isInteger(claims.issuedAt)
    || !Number.isInteger(claims.expiresAt)
    || claims.issuedAt > nowSeconds + 300
    || claims.expiresAt <= claims.issuedAt
    || claims.expiresAt <= nowSeconds
  ) {
    throw new Error('签名回退指令无效或已过期');
  }
  return claims;
}

async function verifyPublicChannel(expectedVersion) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      for (const name of ['latest.yml', 'latest-mac.yml']) {
        const url = `${updateBaseUrl}/${name}?verify=${Date.now()}`;
        const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
        if (!response.ok) throw new Error(`${name} 返回 HTTP ${response.status}`);
        const actual = readManifestVersion(await response.text());
        if (actual !== expectedVersion) throw new Error(`${name} 当前为 ${actual ?? '未知版本'}`);
      }
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      console.warn(`[版本切换] 公网校验第 ${attempt} 次失败，稍后重试：${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
}

function readOption(optionPrefix) {
  return argumentsList.find((argument) => argument.startsWith(optionPrefix))?.slice(optionPrefix.length);
}
