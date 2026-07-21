import path from 'node:path';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ARTIFACT_PATTERN = /\.(?:dmg|zip|exe|blockmap)$/i;

export function assertReleaseVersion(value, label = '版本号') {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new Error(`${label}格式无效：${String(value)}`);
  }
  return value;
}

export function compareReleaseVersions(left, right) {
  const [leftCore, leftPreRelease] = assertReleaseVersion(left).split('-', 2);
  const [rightCore, rightPreRelease] = assertReleaseVersion(right).split('-', 2);
  const leftParts = leftCore.split('.').map(Number);
  const rightParts = rightCore.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (leftPreRelease === undefined && rightPreRelease !== undefined) return 1;
  if (leftPreRelease !== undefined && rightPreRelease === undefined) return -1;
  return (leftPreRelease ?? '').localeCompare(rightPreRelease ?? '');
}

export function readManifestVersion(content) {
  const value = unquote(content.match(/^version:\s*(.+)$/m)?.[1] ?? '');
  return VERSION_PATTERN.test(value) ? value : undefined;
}

export function readManifestArtifactNames(content) {
  return [...content.matchAll(/^\s*-\s+url:\s*(.+)\s*$/gm)]
    .map((match) => unquote(match[1] ?? ''))
    .filter(Boolean)
    .map((value) => {
      const pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value.split(/[?#]/, 1)[0];
      return decodeURIComponent(path.basename(pathname));
    });
}

export function createReleaseRecord({
  version,
  metadata,
  manifestNames,
  objects,
  prefix,
  baseUrl,
  supportsManagedRollback,
}) {
  assertReleaseVersion(version);
  if (
    metadata?.version !== version
    || typeof metadata.releaseNotes !== 'string'
    || typeof metadata.releaseDate !== 'string'
    || !Number.isFinite(Date.parse(metadata.releaseDate))
  ) {
    throw new Error(`版本 ${version} 缺少有效的发布元数据`);
  }
  const normalizedBaseUrl = new URL(`${baseUrl.replace(/\/+$/, '')}/`);
  if (normalizedBaseUrl.protocol !== 'https:') throw new Error('更新源必须使用 HTTPS');

  const uniqueNames = [...new Set(manifestNames)];
  const artifacts = objects
    .filter((object) => uniqueNames.includes(path.basename(object.key)))
    .filter((object) => ARTIFACT_PATTERN.test(object.key))
    .map((object) => ({
      name: path.basename(object.key),
      size: object.size,
      url: new URL(path.basename(object.key), normalizedBaseUrl).toString(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const downloads = artifacts
    .filter((artifact) => /\.(?:dmg|exe)$/i.test(artifact.name))
    .map((artifact) => ({
      ...artifact,
      platform: artifact.name.toLowerCase().endsWith('.exe') ? 'windows' : 'macos',
      arch: /arm64/i.test(artifact.name) ? 'arm64' : 'x64',
    }));

  return {
    version,
    releaseDate: metadata.releaseDate,
    releaseNotes: metadata.releaseNotes.trim(),
    supportsManagedRollback: Boolean(supportsManagedRollback),
    totalSizeBytes: artifacts.reduce((total, artifact) => total + artifact.size, 0),
    manifests: {
      windows: `${prefix}/versions/${version}/latest.yml`,
      macos: `${prefix}/versions/${version}/latest-mac.yml`,
    },
    artifacts,
    downloads,
  };
}

export function mergeReleaseCatalog({ existing, releases, currentVersion, updatedAt }) {
  assertReleaseVersion(currentVersion, '当前版本');
  const records = new Map();
  if (existing?.schemaVersion === 1 && Array.isArray(existing.releases)) {
    for (const release of existing.releases) {
      if (release && typeof release.version === 'string' && VERSION_PATTERN.test(release.version)) {
        records.set(release.version, release);
      }
    }
  }
  for (const release of releases) {
    const version = assertReleaseVersion(release.version);
    const previous = records.get(version);
    if (previous) {
      // 已进入目录的版本记录保持不可变，历史回填不能用不完整数据覆盖它。
      continue;
    }
    records.set(version, release);
  }
  if (!records.has(currentVersion)) throw new Error(`版本目录中不存在当前版本 ${currentVersion}`);

  return {
    schemaVersion: 1,
    currentVersion,
    updatedAt,
    releases: [...records.values()].sort((left, right) => (
      compareReleaseVersions(right.version, left.version)
    )),
  };
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
