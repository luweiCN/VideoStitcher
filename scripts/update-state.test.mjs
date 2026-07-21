import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('../src/renderer/features/updateState.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const { mergeAvailableUpdate } = await import(moduleUrl);

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
