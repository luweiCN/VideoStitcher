import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rendererHtmlUrl = new URL('../src/renderer/index.html', import.meta.url);

function readDirective(policy, directiveName) {
  const value = policy.match(new RegExp(`(?:^|;)\\s*${directiveName}\\s+([^;]+)`))?.[1];
  return value?.trim().split(/\s+/) ?? [];
}

test('渲染进程 CSP 允许应用使用的本地预览协议', async () => {
  const html = await readFile(rendererHtmlUrl, 'utf8');
  const policy = html.match(
    /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]*)"/i,
  )?.[1];

  assert.ok(policy, '渲染进程必须配置 Content Security Policy');
  assert.ok(readDirective(policy, 'img-src').includes('preview:'), 'img-src 必须允许 preview:');
  assert.ok(readDirective(policy, 'media-src').includes('preview:'), 'media-src 必须允许 preview:');
});
