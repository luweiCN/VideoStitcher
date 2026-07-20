import { readFile } from 'node:fs/promises';

const output = await readFile(new URL('../out/main/index.js', import.meta.url), 'utf8');
const builderConfig = await readFile(new URL('../electron-builder.yml', import.meta.url), 'utf8');
const packageMetadata = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const forbiddenValues = [
  'VS-MASTER-2024-KEY01',
  'VS-MASTER-2024-KEY02',
  'VS-MASTER-2024-KEY03',
  '/releases/download/licenses/licenses.json',
];
for (const forbiddenValue of forbiddenValues) {
  if (output.includes(forbiddenValue)) {
    throw new Error(`正式主进程产物仍包含已退役授权内容：${forbiddenValue}`);
  }
}
if (/\bprovider:\s*github\b/i.test(builderConfig) || packageMetadata.publish?.provider === 'github') {
  throw new Error('正式构建仍配置为从 GitHub Release 更新');
}
const apiBaseUrl = process.env.VIDEO_STITCHER_LICENSE_API_URL?.trim();
if (apiBaseUrl && !output.includes(apiBaseUrl)) {
  throw new Error('正式主进程产物没有写入指定授权服务地址');
}
const updateBaseUrl = process.env.VIDEO_STITCHER_UPDATE_BASE_URL?.trim();
if (updateBaseUrl && !output.includes(updateBaseUrl.replace(/\/+$/, ''))) {
  throw new Error('正式主进程产物没有写入指定更新服务地址');
}

console.log('[构建检查] 已确认正式产物不含旧授权回退，更新源仅使用火山云');
