import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  addReleaseNotesToManifest,
  extractReleaseNotesFromManifest,
  normalizeReleaseNotes,
} from './update-manifest-release-notes.mjs';
import {
  createFallbackReleaseNotes,
  normalizeAiReleaseNotes,
  selectReleaseNotes,
} from './prepare-release-notes.mjs';
import { verifyPublicUpdateSource } from './verify-public-update-source.mjs';

const baseManifest = `version: 2.9.0
files:
  - url: VideoStitcher-2.9.0-x64.exe
    sha512: example
    size: 10
path: VideoStitcher-2.9.0-x64.exe
sha512: example
releaseDate: '2026-07-20T00:00:00.000Z'
`;

test('将中文多行更新说明安全写入并读回更新清单', () => {
  const releaseNotes = '新增软件授权中心\n\n- 修复“检查更新”提示\n- 支持冒号：正常显示';
  const updatedManifest = addReleaseNotesToManifest(baseManifest, releaseNotes, '2.9.0');

  assert.match(updatedManifest, /releaseNotes: \|-\n/);
  assert.equal(extractReleaseNotesFromManifest(updatedManifest), releaseNotes);
});

test('拒绝空更新说明、版本不一致和重复写入', () => {
  assert.throws(() => normalizeReleaseNotes('  \n  '), /更新说明不能为空/);
  assert.throws(
    () => addReleaseNotesToManifest(baseManifest, '修复问题', '3.0.0'),
    /更新清单版本为 2\.9\.0/,
  );

  const updatedManifest = addReleaseNotesToManifest(baseManifest, '修复问题', '2.9.0');
  assert.throws(
    () => addReleaseNotesToManifest(updatedManifest, '再次写入', '2.9.0'),
    /拒绝重复写入/,
  );
});

test('提交摘要优先保留用户可感知变化并忽略内部维护', () => {
  const releaseNotes = createFallbackReleaseNotes([
    { subject: 'chore: 调整发布脚本' },
    { subject: 'feat(auth): 新增软件授权中心' },
    { subject: 'fix: 修复套餐刷新后不显示的问题' },
    { subject: 'docs: 更新开发文档' },
  ]);

  assert.equal(releaseNotes, '• 新增软件授权中心\n• 修复套餐刷新后不显示的问题');
});

test('AI 输出必须是简短项目列表，异常时自动使用提交摘要', () => {
  assert.equal(
    normalizeAiReleaseNotes('- 新增授权中心\n* 修复更新提示'),
    '• 新增授权中心\n• 修复更新提示',
  );
  assert.throws(() => normalizeAiReleaseNotes('## 更新内容\n- 修复问题'), /Markdown/);

  const fallbackResult = selectReleaseNotes({
    aiResponse: '我已完成任务，请查看以下说明',
    fallback: '• 修复授权状态刷新问题',
  });
  assert.deepEqual(fallbackResult, {
    releaseNotes: '• 修复授权状态刷新问题',
    source: 'commits',
  });

  const overrideResult = selectReleaseNotes({
    override: '紧急修复授权问题',
    aiResponse: '• 不应采用这条内容',
    fallback: '• 也不应采用这条内容',
  });
  assert.deepEqual(overrideResult, {
    releaseNotes: '• 紧急修复授权问题',
    source: 'override',
  });
});

test('最终版本说明同时生成纯文本和不可变历史元数据', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'videostitcher-notes-'));
  const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const aiResponsePath = path.join(temporaryRoot, 'ai-response.txt');

  try {
    await writeFile(
      path.join(temporaryRoot, 'release-context.json'),
      JSON.stringify({
        version: '2.9.0',
        previousTag: 'v2.8.0',
        commitDate: '2026-07-20T00:00:00.000Z',
        commitCount: 3,
      }),
      'utf8',
    );
    await writeFile(path.join(temporaryRoot, 'release-notes-fallback.txt'), '• 提交摘要\n', 'utf8');
    await writeFile(aiResponsePath, '• 新增软件授权中心\n• 修复更新提示\n', 'utf8');

    const result = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, 'prepare-release-notes.mjs'),
        '--mode=finalize',
        '--version=2.9.0',
        `--output-directory=${temporaryRoot}`,
        '--ai-response-file-env=AI_RESPONSE_FILE',
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, AI_RESPONSE_FILE: aiResponsePath },
      },
    );
    assert.equal(result.status, 0, result.stderr);

    const releaseNotes = await readFile(path.join(temporaryRoot, 'release-notes.txt'), 'utf8');
    const metadata = JSON.parse(await readFile(path.join(temporaryRoot, 'release-notes.json'), 'utf8'));
    assert.equal(releaseNotes, '• 新增软件授权中心\n• 修复更新提示\n');
    assert.equal(metadata.version, '2.9.0');
    assert.equal(metadata.releaseDate, '2026-07-20T00:00:00.000Z');
    assert.equal(metadata.releaseNotes, releaseNotes.trim());
    assert.deepEqual(Object.keys(metadata), ['schemaVersion', 'version', 'releaseDate', 'releaseNotes']);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('提交采集以最近的私有版本标签作为比较基线', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'videostitcher-git-notes-'));
  const outputDirectory = path.join(temporaryRoot, '.release');
  const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
  const scriptPath = path.join(scriptsDirectory, 'prepare-release-notes.mjs');

  try {
    runCommand('git', ['init'], temporaryRoot);
    runCommand('git', ['config', 'user.name', '发布测试'], temporaryRoot);
    runCommand('git', ['config', 'user.email', 'release-test@example.com'], temporaryRoot);
    runCommand('git', ['config', 'commit.gpgsign', 'false'], temporaryRoot);
    await writeFile(path.join(temporaryRoot, 'change.txt'), '初始内容\n', 'utf8');
    runCommand('git', ['add', 'change.txt'], temporaryRoot);
    runCommand('git', ['commit', '-m', 'chore: 初始提交'], temporaryRoot);
    runCommand('git', ['tag', 'v1.0.0'], temporaryRoot);
    await writeFile(path.join(temporaryRoot, 'change.txt'), '新增授权中心\n', 'utf8');
    runCommand('git', ['add', 'change.txt'], temporaryRoot);
    runCommand('git', ['commit', '-m', 'feat: 新增软件授权中心'], temporaryRoot);

    runCommand(
      process.execPath,
      [scriptPath, '--mode=collect', '--version=1.1.0', `--output-directory=${outputDirectory}`],
      temporaryRoot,
    );
    runCommand(
      process.execPath,
      [scriptPath, '--mode=finalize', '--version=1.1.0', `--output-directory=${outputDirectory}`],
      temporaryRoot,
    );

    const context = JSON.parse(await readFile(path.join(outputDirectory, 'release-context.json'), 'utf8'));
    const releaseNotes = await readFile(path.join(outputDirectory, 'release-notes.txt'), 'utf8');
    assert.equal(context.previousTag, 'v1.0.0');
    assert.equal(context.commitCount, 1);
    assert.equal(releaseNotes, '• 新增软件授权中心\n');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('公网更新源必须同时提供清单、安装包和 blockmap 的 Range 响应', async () => {
  const releaseNotes = '修复授权状态刷新问题';
  const manifest = addReleaseNotesToManifest(baseManifest, releaseNotes, '2.9.0');
  const requestedPaths = [];
  const fetchImplementation = async (input, options = {}) => {
    const url = new URL(input);
    requestedPaths.push(url.pathname);
    if (url.pathname.endsWith('.yml')) return new Response(manifest);

    assert.equal(new Headers(options.headers).get('range'), 'bytes=0-0');
    return new Response(new Uint8Array([1]), {
      status: 206,
      headers: { 'content-range': 'bytes 0-0/10' },
    });
  };

  const result = await verifyPublicUpdateSource({
    baseUrl: 'https://updates.example.com/stable',
    expectedVersion: '2.9.0',
    expectedReleaseNotes: releaseNotes,
    fetchImplementation,
  });

  assert.equal(result.checkedUrlCount, 2);
  assert.ok(requestedPaths.includes('/stable/VideoStitcher-2.9.0-x64.exe'));
  assert.ok(requestedPaths.includes('/stable/VideoStitcher-2.9.0-x64.exe.blockmap'));
});

test('公网文件返回完整下载时拒绝发布成功', async () => {
  const releaseNotes = '修复授权状态刷新问题';
  const manifest = addReleaseNotesToManifest(baseManifest, releaseNotes, '2.9.0');
  const fetchImplementation = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('.yml')) return new Response(manifest);
    return new Response(new Uint8Array([1]), { status: 200 });
  };

  await assert.rejects(
    verifyPublicUpdateSource({
      baseUrl: 'https://updates.example.com/stable',
      expectedVersion: '2.9.0',
      expectedReleaseNotes: releaseNotes,
      fetchImplementation,
    }),
    /不支持 Range 差分下载/,
  );
});

test('命令行流程能写入更新说明并通过完整产物校验', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'videostitcher-release-'));
  const macDirectory = path.join(temporaryRoot, 'macos');
  const windowsDirectory = path.join(temporaryRoot, 'windows');
  const releaseNotes = '新增授权中心\n- 修复套餐显示问题';
  const releaseNotesPath = path.join(temporaryRoot, 'release-notes.txt');

  try {
    await mkdir(macDirectory);
    await mkdir(windowsDirectory);
    await writeFile(releaseNotesPath, releaseNotes, 'utf8');

    const windowsName = 'VideoStitcher-2.9.0-x64.exe';
    const macX64Name = 'VideoStitcher-2.9.0-mac.zip';
    const macArm64Name = 'VideoStitcher-2.9.0-arm64-mac.zip';
    const windowsEntry = await writeArtifact(windowsDirectory, windowsName, 'windows-installer');
    const macX64Entry = await writeArtifact(macDirectory, macX64Name, 'macos-x64');
    const macArm64Entry = await writeArtifact(macDirectory, macArm64Name, 'macos-arm64');

    await writeFile(path.join(windowsDirectory, 'latest.yml'), createManifest([windowsEntry]), 'utf8');
    await writeFile(
      path.join(macDirectory, 'latest-mac.yml'),
      createManifest([macX64Entry, macArm64Entry]),
      'utf8',
    );

    const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
    const updateResult = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, 'update-manifest-release-notes.mjs'),
        '--version=2.9.0',
        `--release-notes-file=${releaseNotesPath}`,
        macDirectory,
        windowsDirectory,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(updateResult.status, 0, updateResult.stderr);

    const verifyResult = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, 'verify-update-artifacts.mjs'),
        '--version=2.9.0',
        `--release-notes-file=${releaseNotesPath}`,
        macDirectory,
        windowsDirectory,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(verifyResult.status, 0, verifyResult.stderr);

    const windowsManifest = await readFile(path.join(windowsDirectory, 'latest.yml'), 'utf8');
    assert.equal(extractReleaseNotesFromManifest(windowsManifest), releaseNotes);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

async function writeArtifact(directory, name, content) {
  const artifact = Buffer.from(content);
  await writeFile(path.join(directory, name), artifact);
  await writeFile(path.join(directory, `${name}.blockmap`), `blockmap:${content}`, 'utf8');
  return {
    name,
    sha512: createHash('sha512').update(artifact).digest('base64'),
    size: artifact.length,
  };
}

function createManifest(entries) {
  const files = entries
    .map((entry) => `  - url: ${entry.name}\n    sha512: ${entry.sha512}\n    size: ${entry.size}`)
    .join('\n');
  return `version: 2.9.0\nfiles:\n${files}\nreleaseDate: '2026-07-20T00:00:00.000Z'\n`;
}

function runCommand(command, argumentsList, cwd) {
  const result = spawnSync(command, argumentsList, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
