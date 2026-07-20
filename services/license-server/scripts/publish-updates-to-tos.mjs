import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { TosClient, TosServerError } from '@volcengine/tos-sdk';

const requiredEnvironment = [
  'TOS_UPDATE_ACCESS_KEY_ID',
  'TOS_UPDATE_SECRET_ACCESS_KEY',
  'TOS_UPDATE_REGION',
  'TOS_UPDATE_ENDPOINT',
  'TOS_UPDATE_BUCKET',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]?.trim()) throw new Error(`缺少环境变量 ${name}`);
}

const bucket = process.env.TOS_UPDATE_BUCKET.trim();
const prefix = (process.env.TOS_UPDATE_PREFIX || 'stable').replace(/^\/+|\/+$/g, '');
const client = new TosClient({
  accessKeyId: process.env.TOS_UPDATE_ACCESS_KEY_ID.trim(),
  accessKeySecret: process.env.TOS_UPDATE_SECRET_ACCESS_KEY.trim(),
  ...(process.env.TOS_UPDATE_SESSION_TOKEN?.trim()
    ? { stsToken: process.env.TOS_UPDATE_SESSION_TOKEN.trim() }
    : {}),
  region: process.env.TOS_UPDATE_REGION.trim(),
  endpoint: process.env.TOS_UPDATE_ENDPOINT.trim(),
});

await client.headBucket({ bucket });
if (process.argv.includes('--check')) {
  console.log('[更新发布] TOS 更新桶访问检查通过');
  process.exit(0);
}

const argumentsList = process.argv.slice(2);
const releaseMetadataPath = readOption(argumentsList, '--release-metadata=');
const releaseVersion = readOption(argumentsList, '--release-version=');
const inputDirectories = argumentsList.filter((argument) => !argument.startsWith('--'));
if (inputDirectories.length === 0) {
  throw new Error('请提供至少一个构建产物目录');
}
if (!releaseMetadataPath || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(releaseVersion || '')) {
  throw new Error('发布更新时必须提供 --release-metadata=<文件> 和 --release-version=<版本>');
}

const releaseMetadata = JSON.parse(await readFile(path.resolve(releaseMetadataPath), 'utf8'));
if (releaseMetadata.version !== releaseVersion || !releaseMetadata.releaseNotes?.trim()) {
  throw new Error('版本历史文件与本次发布版本不一致或缺少更新说明');
}

const allFiles = [];
for (const directory of inputDirectories) {
  allFiles.push(...await collectFiles(path.resolve(directory)));
}

const manifests = allFiles.filter((filePath) => /^latest(?:-mac)?\.yml$/i.test(path.basename(filePath)));
const artifacts = allFiles.filter((filePath) => /\.(?:dmg|zip|exe|blockmap)$/i.test(filePath));
if (manifests.length < 2 || artifacts.length === 0) {
  throw new Error('更新产物不完整，必须同时包含 latest.yml、latest-mac.yml 和安装包');
}

const fileByName = new Map();
for (const filePath of [...artifacts, ...manifests]) {
  const name = path.basename(filePath);
  if (fileByName.has(name)) throw new Error(`发现重名更新产物：${name}`);
  fileByName.set(name, filePath);
}

// 先发布带版本号的不可变安装包和 blockmap，最后才覆盖 channel manifest。
for (const filePath of artifacts) {
  await uploadImmutableArtifact(filePath);
}
await uploadImmutableFile(
  path.resolve(releaseMetadataPath),
  `${prefix}/releases/${releaseVersion}.json`,
  `releases/${releaseVersion}.json`,
  'application/json; charset=utf-8',
);
for (const filePath of manifests) {
  await uploadManifest(filePath);
}

console.log(`[更新发布] 已按 pointer-last 顺序发布 ${artifacts.length} 个产物、版本历史和 ${manifests.length} 个清单`);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function sha256File(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function readExistingMetadata(key) {
  try {
    const response = await client.headObject({ bucket, key });
    return {
      size: Number.parseInt(response.data['content-length'], 10),
      sha256: response.data['x-tos-meta-sha256'],
    };
  } catch (error) {
    if (error instanceof TosServerError && (error.statusCode === 404 || error.code === 'NoSuchKey')) {
      return undefined;
    }
    throw error;
  }
}

async function uploadImmutableArtifact(filePath) {
  const name = path.basename(filePath);
  await uploadImmutableFile(filePath, `${prefix}/${name}`, name, contentTypeFor(name));
}

async function uploadImmutableFile(filePath, key, displayName, contentType) {
  const fileStat = await stat(filePath);
  const sha256 = await sha256File(filePath);
  const existing = await readExistingMetadata(key);

  if (existing) {
    if (existing.size === fileStat.size && existing.sha256 === sha256) {
      console.log(`[更新发布] 已存在相同不可变文件，跳过：${displayName}`);
      return;
    }
    throw new Error(`TOS 已存在同名但内容不同的不可变文件：${displayName}`);
  }

  await client.uploadFile({
    bucket,
    key,
    file: filePath,
    taskNum: 3,
    partSize: 20 * 1024 * 1024,
    cacheControl: 'public, max-age=31536000, immutable',
    contentType,
    meta: { sha256 },
  });
  await assertUploaded(key, fileStat.size, sha256);
  console.log(`[更新发布] 已上传不可变文件：${displayName}`);
}

async function uploadManifest(filePath) {
  const name = path.basename(filePath);
  const key = `${prefix}/${name}`;
  const fileStat = await stat(filePath);
  const sha256 = await sha256File(filePath);
  await client.putObjectFromFile({
    bucket,
    key,
    filePath,
    cacheControl: 'no-store, max-age=0',
    contentType: 'application/yaml; charset=utf-8',
    meta: { sha256 },
  });
  await assertUploaded(key, fileStat.size, sha256);
  console.log(`[更新发布] 已更新 channel 清单：${name}`);
}

async function assertUploaded(key, expectedSize, expectedSha256) {
  const metadata = await readExistingMetadata(key);
  if (!metadata || metadata.size !== expectedSize || metadata.sha256 !== expectedSha256) {
    throw new Error(`TOS 上传后校验失败：${key}`);
  }
}

function contentTypeFor(name) {
  if (name.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (name.endsWith('.zip')) return 'application/zip';
  if (name.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  return 'application/octet-stream';
}

function readOption(argumentsList, prefix) {
  return argumentsList.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}
