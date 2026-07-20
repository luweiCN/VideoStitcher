import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  extractReleaseNotesFromManifest,
  readReleaseNotes,
} from './update-manifest-release-notes.mjs';

const argumentsList = process.argv.slice(2);
const version = argumentsList.find((argument) => argument.startsWith('--version='))?.split('=')[1];
const directories = argumentsList.filter((argument) => !argument.startsWith('--'));
if (!version || directories.length === 0) {
  throw new Error(
    '用法：node scripts/verify-update-artifacts.mjs --version=<版本> --release-notes-file=<文件> <产物目录...>',
  );
}
const expectedReleaseNotes = await readReleaseNotes(argumentsList);

const files = [];
for (const directory of directories) files.push(...await collectFiles(path.resolve(directory)));
const filesByName = new Map();
for (const filePath of files) {
  const name = path.basename(filePath);
  if (filesByName.has(name)) throw new Error(`发现重名构建产物：${name}`);
  filesByName.set(name, filePath);
}

const manifestNames = ['latest.yml', 'latest-mac.yml'];
let hasWindowsInstaller = false;
const macZipNames = new Set();
const automaticUpdateNames = new Set();

for (const manifestName of manifestNames) {
  const manifestPath = filesByName.get(manifestName);
  if (!manifestPath) throw new Error(`缺少更新清单：${manifestName}`);
  const content = await readFile(manifestPath, 'utf8');
  const manifestVersion = unquote(content.match(/^version:\s*(.+)$/m)?.[1] || '');
  if (manifestVersion !== version) {
    throw new Error(`${manifestName} 版本为 ${manifestVersion || '空'}，预期为 ${version}`);
  }
  if (extractReleaseNotesFromManifest(content) !== expectedReleaseNotes) {
    throw new Error(`${manifestName} 的更新说明与本次发布不一致`);
  }

  const entries = parseFileEntries(content);
  if (entries.length === 0) throw new Error(`${manifestName} 没有可校验的 files 条目`);
  for (const entry of entries) {
    const name = fileNameFromManifestUrl(entry.url);
    const artifactPath = filesByName.get(name);
    if (!artifactPath) throw new Error(`${manifestName} 引用了不存在的产物：${name}`);
    if (!name.includes(version)) throw new Error(`产物文件名没有包含版本号：${name}`);

    const fileStat = await stat(artifactPath);
    if (entry.size !== undefined && entry.size !== fileStat.size) {
      throw new Error(`${name} 的文件大小与 manifest 不一致`);
    }
    const actualSha512 = await hashFile(artifactPath, 'sha512', 'base64');
    if (actualSha512 !== entry.sha512) throw new Error(`${name} 的 SHA-512 与 manifest 不一致`);

    if (name.toLowerCase().endsWith('.exe')) {
      hasWindowsInstaller = true;
      automaticUpdateNames.add(name);
    }
    if (name.toLowerCase().endsWith('.zip')) {
      macZipNames.add(name);
      automaticUpdateNames.add(name);
    }
  }
}

const hasMacX64Zip = [...macZipNames].some((name) => /-mac\.zip$/i.test(name) && !/-arm64-mac\.zip$/i.test(name));
const hasMacArm64Zip = [...macZipNames].some((name) => /-arm64-mac\.zip$/i.test(name));
if (!hasWindowsInstaller || !hasMacX64Zip || !hasMacArm64Zip) {
  throw new Error('更新清单必须覆盖 Windows x64、macOS Intel 和 macOS Apple Silicon');
}

for (const name of automaticUpdateNames) {
  if (!filesByName.has(`${name}.blockmap`)) {
    throw new Error(`自动更新产物缺少 blockmap：${name}.blockmap`);
  }
}

console.log('[更新产物检查] 两个平台架构、更新说明、blockmap、文件大小和 SHA-512 均一致');

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(entryPath));
    else if (entry.isFile()) result.push(entryPath);
  }
  return result;
}

function parseFileEntries(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  let current;
  for (const line of lines) {
    const urlMatch = line.match(/^\s*-\s+url:\s*(.+)\s*$/);
    if (urlMatch) {
      if (current) entries.push(assertCompleteEntry(current));
      current = { url: unquote(urlMatch[1]) };
      continue;
    }
    if (!current) continue;
    const shaMatch = line.match(/^\s+sha512:\s*(.+)\s*$/);
    if (shaMatch) current.sha512 = unquote(shaMatch[1]);
    const sizeMatch = line.match(/^\s+size:\s*(\d+)\s*$/);
    if (sizeMatch) current.size = Number.parseInt(sizeMatch[1], 10);
  }
  if (current) entries.push(assertCompleteEntry(current));
  return entries;
}

function assertCompleteEntry(entry) {
  if (!entry.url || !entry.sha512) throw new Error('更新清单 files 条目缺少 url 或 sha512');
  return entry;
}

function fileNameFromManifestUrl(value) {
  const pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value.split(/[?#]/, 1)[0];
  return decodeURIComponent(path.basename(pathname));
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function hashFile(filePath, algorithm, encoding) {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest(encoding);
}
