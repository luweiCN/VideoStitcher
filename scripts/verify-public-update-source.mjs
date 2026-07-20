import { pathToFileURL } from 'node:url';
import {
  extractReleaseNotesFromManifest,
  normalizeReleaseNotes,
  readReleaseNotes,
  readManifestVersion,
} from './update-manifest-release-notes.mjs';

const manifestNames = ['latest.yml', 'latest-mac.yml'];

/**
 * 校验公网更新清单、安装包和 blockmap 是否支持差分下载。
 */
export async function verifyPublicUpdateSource({
  baseUrl,
  expectedVersion,
  expectedReleaseNotes,
  fetchImplementation = fetch,
}) {
  const normalizedBaseUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/`);
  if (normalizedBaseUrl.protocol !== 'https:') throw new Error('公网更新源必须使用 HTTPS');

  const checkedUrls = new Set();
  for (const manifestName of manifestNames) {
    const manifestUrl = new URL(manifestName, normalizedBaseUrl);
    manifestUrl.searchParams.set('verify', Date.now().toString());
    const manifestResponse = await fetchImplementation(manifestUrl, {
      headers: { 'cache-control': 'no-cache' },
    });
    if (!manifestResponse.ok) {
      throw new Error(`${manifestName} 公网访问失败：HTTP ${manifestResponse.status}`);
    }

    const content = await manifestResponse.text();
    const actualVersion = readManifestVersion(content);
    if (actualVersion !== expectedVersion) {
      throw new Error(`${manifestName} 公网版本为 ${actualVersion || '空'}，预期为 ${expectedVersion}`);
    }
    const actualReleaseNotes = extractReleaseNotesFromManifest(content);
    if (actualReleaseNotes !== normalizeReleaseNotes(expectedReleaseNotes)) {
      throw new Error(`${manifestName} 公网更新说明与本次发布不一致`);
    }

    for (const artifactName of readArtifactNames(content)) {
      const artifactUrl = new URL(artifactName, normalizedBaseUrl);
      const blockmapUrl = new URL(artifactUrl);
      blockmapUrl.pathname = `${blockmapUrl.pathname}.blockmap`;
      checkedUrls.add(artifactUrl.href);
      checkedUrls.add(blockmapUrl.href);
    }
  }

  if (checkedUrls.size === 0) throw new Error('公网更新清单没有引用任何安装包');
  for (const url of checkedUrls) await verifyRangeRequest(url, fetchImplementation);

  return { checkedUrlCount: checkedUrls.size };
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const baseUrlEnvironment = readOption(argumentsList, '--base-url-env=');
  const expectedVersion = readOption(argumentsList, '--version=');
  const baseUrl = baseUrlEnvironment ? process.env[baseUrlEnvironment] : undefined;
  const expectedReleaseNotes = await readReleaseNotes(argumentsList);

  if (!baseUrlEnvironment || !baseUrl || !expectedVersion) {
    throw new Error(
      '用法：node scripts/verify-public-update-source.mjs --base-url-env=<环境变量> --version=<版本> --release-notes-file=<文件>',
    );
  }

  const maximumAttempts = 5;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const result = await verifyPublicUpdateSource({ baseUrl, expectedVersion, expectedReleaseNotes });
      console.log(`[更新源检查] 公网清单与差分下载校验通过，共检查 ${result.checkedUrlCount} 个文件`);
      return;
    } catch (error) {
      if (attempt === maximumAttempts) throw error;
      console.warn(`[更新源检查] 第 ${attempt} 次校验失败，5 秒后重试：${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

function readArtifactNames(content) {
  return [...content.matchAll(/^\s*-\s+url:\s*(.+)\s*$/gm)].map((match) => unquote(match[1]));
}

async function verifyRangeRequest(url, fetchImplementation) {
  const response = await fetchImplementation(url, {
    headers: { range: 'bytes=0-0' },
  });
  await response.arrayBuffer();

  if (response.status !== 206) {
    throw new Error(`文件不支持 Range 差分下载：${url}，HTTP ${response.status}`);
  }
  if (!/^bytes 0-0\/\d+$/.test(response.headers.get('content-range') || '')) {
    throw new Error(`文件的 Content-Range 响应无效：${url}`);
  }
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
