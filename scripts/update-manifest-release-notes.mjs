import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const releaseNotesMarker = '\nreleaseNotes: |-\n';

/**
 * 统一更新说明的换行与首尾空白。
 */
export function normalizeReleaseNotes(value) {
  if (typeof value !== 'string') throw new Error('更新说明必须是字符串');
  if (value.includes('\0')) throw new Error('更新说明不能包含空字符');

  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new Error('更新说明不能为空');
  return normalized;
}

/**
 * 从文件或环境变量读取更新说明，文件优先用于跨 Job 传递多行内容。
 */
export async function readReleaseNotes(argumentsList, environment = process.env) {
  const filePath = readOption(argumentsList, '--release-notes-file=');
  const environmentName = readOption(argumentsList, '--release-notes-env=');
  if (filePath && environmentName) throw new Error('更新说明文件和环境变量只能选择一种');

  if (filePath) return normalizeReleaseNotes(await readFile(path.resolve(filePath), 'utf8'));
  return normalizeReleaseNotes(environment[environmentName || 'RELEASE_NOTES']);
}

/**
 * 将更新说明追加到 electron-builder 生成的 channel manifest。
 */
export function addReleaseNotesToManifest(content, releaseNotes, expectedVersion) {
  const actualVersion = readManifestVersion(content);
  if (actualVersion !== expectedVersion) {
    throw new Error(`更新清单版本为 ${actualVersion || '空'}，预期为 ${expectedVersion}`);
  }
  if (/^releaseNotes:\s*/m.test(content)) {
    throw new Error('更新清单已经包含 releaseNotes，拒绝重复写入');
  }

  const normalized = normalizeReleaseNotes(releaseNotes);
  const indentedNotes = normalized
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  const separator = content.endsWith('\n') ? '' : '\n';
  return `${content}${separator}releaseNotes: |-\n${indentedNotes}\n`;
}

/**
 * 读取由本脚本追加在清单末尾的更新说明。
 */
export function extractReleaseNotesFromManifest(content) {
  const markerIndex = content.lastIndexOf(releaseNotesMarker);
  if (markerIndex === -1) throw new Error('更新清单缺少 releaseNotes');

  const block = content.slice(markerIndex + releaseNotesMarker.length);
  const lines = block.endsWith('\n') ? block.slice(0, -1).split('\n') : block.split('\n');
  if (lines.length === 0 || lines.some((line) => !line.startsWith('  '))) {
    throw new Error('更新清单中的 releaseNotes 格式无效');
  }
  return normalizeReleaseNotes(lines.map((line) => line.slice(2)).join('\n'));
}

/**
 * 读取更新清单版本。
 */
export function readManifestVersion(content) {
  return unquote(content.match(/^version:\s*(.+)$/m)?.[1] || '');
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const version = readOption(argumentsList, '--version=');
  const releaseNotes = await readReleaseNotes(argumentsList);

  if (argumentsList.includes('--check-notes')) {
    console.log(`[更新说明] 校验通过，共 ${releaseNotes.length} 个字符`);
    return;
  }

  const directories = argumentsList.filter((argument) => !argument.startsWith('--'));
  if (!version || directories.length === 0) {
    throw new Error(
      '用法：node scripts/update-manifest-release-notes.mjs --version=<版本> --release-notes-file=<文件> <产物目录...>',
    );
  }

  const manifestPaths = [];
  for (const directory of directories) {
    manifestPaths.push(...await collectManifestPaths(path.resolve(directory)));
  }

  const names = manifestPaths.map((filePath) => path.basename(filePath)).sort();
  if (names.length !== 2 || names[0] !== 'latest-mac.yml' || names[1] !== 'latest.yml') {
    throw new Error('必须且只能找到 latest.yml 和 latest-mac.yml 两份更新清单');
  }

  for (const manifestPath of manifestPaths) {
    const content = await readFile(manifestPath, 'utf8');
    const updatedContent = addReleaseNotesToManifest(content, releaseNotes, version);
    await writeFile(manifestPath, updatedContent, 'utf8');
    console.log(`[更新说明] 已写入 ${path.basename(manifestPath)}`);
  }
}

async function collectManifestPaths(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectManifestPaths(entryPath));
    else if (entry.isFile() && /^latest(?:-mac)?\.yml$/.test(entry.name)) result.push(entryPath);
  }
  return result;
}

function readOption(argumentsList, prefix) {
  return argumentsList.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2
    && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
