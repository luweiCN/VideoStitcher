import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeReleaseNotes } from './update-manifest-release-notes.mjs';

const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const maximumCommitCount = 80;
const maximumReleaseNoteLines = 10;
const maximumReleaseNoteLength = 1_600;

/**
 * 从 Conventional Commit 标题中提取类型和面向用户的描述。
 */
export function parseCommitSubject(subject) {
  const normalized = normalizeSingleLine(subject);
  const match = normalized.match(/^([a-z]+)(?:\([^)]+\))?(!)?:\s*(.+)$/i);
  if (!match) return { type: 'other', breaking: false, description: normalized };

  return {
    type: match[1].toLowerCase(),
    breaking: Boolean(match[2]),
    description: normalizeSingleLine(match[3]),
  };
}

/**
 * 在 AI 不可用时，根据提交标题生成稳定、可读的更新说明。
 */
export function createFallbackReleaseNotes(commits, { allowEmpty = false } = {}) {
  const ignoredTypes = new Set(['build', 'chore', 'ci', 'docs', 'style', 'test']);
  const preferredTypes = new Set(['feat', 'fix', 'perf', 'security']);
  const parsed = commits
    .map((commit) => parseCommitSubject(commit.subject))
    .filter(({ description }) => description && !isVersionOnlyCommit(description));

  const preferred = parsed.filter(({ type }) => preferredTypes.has(type));
  const candidates = preferred.length > 0
    ? preferred
    : parsed.filter(({ type }) => !ignoredTypes.has(type));
  const finalCandidates = candidates.length > 0 ? candidates : parsed;
  const uniqueDescriptions = [...new Set(finalCandidates.map(({ description }) => description))]
    .slice(0, 8);

  if (uniqueDescriptions.length === 0) {
    if (allowEmpty) return '';
    throw new Error('上一个版本之后没有可用于生成更新说明的提交');
  }

  return uniqueDescriptions.map((description) => `• ${description}`).join('\n');
}

/**
 * 校验 AI 输出，只接受简短的纯文本项目符号列表。
 */
export function normalizeAiReleaseNotes(value) {
  const normalized = normalizeReleaseNotes(value);
  if (normalized.length > maximumReleaseNoteLength) throw new Error('AI 更新说明过长');
  if (/```|^#{1,6}\s|\[[^\]]+\]\([^)]+\)/m.test(normalized)) {
    throw new Error('AI 更新说明包含不支持的 Markdown 格式');
  }
  if (/\b[0-9a-f]{7,40}\b/i.test(normalized)) throw new Error('AI 更新说明不应包含提交哈希');

  const lines = normalized.split('\n').filter((line) => line.trim());
  if (lines.length === 0 || lines.length > maximumReleaseNoteLines) {
    throw new Error(`AI 更新说明必须包含 1 到 ${maximumReleaseNoteLines} 条内容`);
  }

  return lines.map((line) => {
    const match = line.trim().match(/^(?:[-*•])\s+(.+)$/);
    if (!match) throw new Error('AI 更新说明必须全部使用项目符号');
    const description = normalizeSingleLine(match[1]);
    if (!description) throw new Error('AI 更新说明包含空项目');
    return `• ${description}`;
  }).join('\n');
}

/**
 * 将人工覆盖内容统一成客户端可直接展示的纯文本列表。
 */
export function normalizeOverrideReleaseNotes(value) {
  const normalized = normalizeReleaseNotes(value);
  if (normalized.length > maximumReleaseNoteLength) throw new Error('人工更新说明过长');

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length > maximumReleaseNoteLines) {
    throw new Error(`人工更新说明不能超过 ${maximumReleaseNoteLines} 条`);
  }
  return lines.map((line) => `• ${line.replace(/^(?:[-*•])\s*/, '')}`).join('\n');
}

/**
 * 按“人工覆盖、AI、提交摘要”的优先级选出最终更新说明。
 */
export function selectReleaseNotes({ override, aiResponse, fallback }) {
  if (override?.trim()) {
    return { releaseNotes: normalizeOverrideReleaseNotes(override), source: 'override' };
  }

  if (aiResponse?.trim()) {
    try {
      return { releaseNotes: normalizeAiReleaseNotes(aiResponse), source: 'ai' };
    } catch (error) {
      console.warn(`[更新说明] AI 输出无效，已使用提交摘要：${error.message}`);
    }
  }

  return { releaseNotes: normalizeAiReleaseNotes(fallback), source: 'commits' };
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const mode = readOption(argumentsList, '--mode=');
  const version = readOption(argumentsList, '--version=');
  const headRef = readOption(argumentsList, '--head-ref=') || 'HEAD';
  const outputDirectory = path.resolve(readOption(argumentsList, '--output-directory=') || '.release');

  if (!semanticVersionPattern.test(version || '')) {
    throw new Error('必须通过 --version 提供有效的语义化版本号');
  }

  if (mode === 'collect') {
    const overrideEnvironment = readOption(argumentsList, '--override-env=');
    const allowEmptyFallback = Boolean(
      overrideEnvironment && process.env[overrideEnvironment]?.trim(),
    );
    await collectReleaseNoteInputs({ version, outputDirectory, allowEmptyFallback, headRef });
    return;
  }
  if (mode === 'finalize') {
    await finalizeReleaseNotes({ argumentsList, version, outputDirectory });
    return;
  }
  throw new Error('必须通过 --mode=collect 或 --mode=finalize 指定运行模式');
}

async function collectReleaseNoteInputs({ version, outputDirectory, allowEmptyFallback, headRef }) {
  const resolvedHead = runGit(['rev-parse', '--verify', `${headRef}^{commit}`]);
  const tagName = `v${version}`;
  if (gitRefExists(`refs/tags/${tagName}`)) {
    throw new Error(`版本标签 ${tagName} 已存在，禁止重复发布`);
  }

  const previousTag = findPreviousReleaseTag(resolvedHead);
  const range = previousTag ? `${previousTag}..${resolvedHead}` : resolvedHead;
  const commits = readCommits(range);
  const fallback = createFallbackReleaseNotes(commits, { allowEmpty: allowEmptyFallback });
  const commitDate = new Date(runGit(['show', '-s', '--format=%cI', resolvedHead])).toISOString();
  const selectedCommits = commits.slice(0, maximumCommitCount);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, 'release-notes-source.txt'),
    createAiPrompt({ version, previousTag, commits: selectedCommits, totalCommitCount: commits.length }),
    'utf8',
  );
  await writeFile(path.join(outputDirectory, 'release-notes-fallback.txt'), `${fallback}\n`, 'utf8');
  await writeFile(
    path.join(outputDirectory, 'release-context.json'),
    `${JSON.stringify({ version, previousTag, commitDate, commitCount: commits.length }, null, 2)}\n`,
    'utf8',
  );

  console.log(`[更新说明] 已收集 ${commits.length} 条提交，比较基线：${previousTag || '首次发布'}`);
}

async function finalizeReleaseNotes({ argumentsList, version, outputDirectory }) {
  const context = JSON.parse(await readFile(path.join(outputDirectory, 'release-context.json'), 'utf8'));
  if (context.version !== version) throw new Error('更新说明上下文版本与本次发布不一致');

  const fallback = await readFile(path.join(outputDirectory, 'release-notes-fallback.txt'), 'utf8');
  const overrideEnvironment = readOption(argumentsList, '--override-env=');
  const aiFileEnvironment = readOption(argumentsList, '--ai-response-file-env=');
  const aiResponsePath = aiFileEnvironment ? process.env[aiFileEnvironment]?.trim() : '';
  const aiResponse = aiResponsePath ? await readOptionalFile(aiResponsePath) : '';
  const result = selectReleaseNotes({
    override: overrideEnvironment ? process.env[overrideEnvironment] : '',
    aiResponse,
    fallback,
  });
  const metadata = {
    schemaVersion: 1,
    version,
    releaseDate: context.commitDate,
    releaseNotes: result.releaseNotes,
  };

  await writeFile(path.join(outputDirectory, 'release-notes.txt'), `${result.releaseNotes}\n`, 'utf8');
  await writeFile(
    path.join(outputDirectory, 'release-notes.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8',
  );
  console.log(`[更新说明] 已生成最终内容，来源：${result.source}`);
}

function createAiPrompt({ version, previousTag, commits, totalCommitCount }) {
  const commitBlocks = commits.map((commit, index) => {
    const body = normalizePromptText(commit.body) || '无';
    return `提交 ${index + 1}\n标题：${normalizePromptText(commit.subject)}\n正文：${body}`;
  });
  const truncation = totalCommitCount > commits.length
    ? `\n仅提供最近 ${commits.length} 条，共 ${totalCommitCount} 条提交。`
    : '';

  return `请根据以下提交数据生成版本 ${version} 的用户更新说明。\n上一个版本：${previousTag || '无'}。${truncation}\n\n<commit-data>\n${commitBlocks.join('\n\n')}\n</commit-data>\n`;
}

function readCommits(range) {
  const output = runGit([
    'log',
    range,
    '--no-merges',
    '--format=%H%x1f%s%x1f%b%x1e',
  ]);
  if (!output) return [];

  return output.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const [hash, subject = '', body = ''] = record.split('\x1f');
    return {
      hash: hash.trim(),
      subject: normalizeSingleLine(subject),
      body: body.trim().slice(0, 1_200),
    };
  });
}

function findPreviousReleaseTag(headRef = 'HEAD') {
  try {
    const tag = runGit(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', headRef]);
    return /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag) ? tag : undefined;
  } catch {
    return undefined;
  }
}

function gitRefExists(reference) {
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', reference], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runGit(argumentsList) {
  return execFileSync('git', argumentsList, { encoding: 'utf8' }).trim();
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(path.resolve(filePath), 'utf8');
  } catch (error) {
    console.warn(`[更新说明] 无法读取 AI 输出，已准备使用提交摘要：${error.message}`);
    return '';
  }
}

function normalizePromptText(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeSingleLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isVersionOnlyCommit(description) {
  return /^(?:(?:升级|更新|发布)\s*)?(?:版本|version)?\s*(?:到|至|为)?\s*v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/i.test(description);
}

function readOption(argumentsList, prefix) {
  return argumentsList.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
