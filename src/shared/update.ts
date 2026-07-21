export interface ClientUpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  manualDownloadUrl?: string;
}

interface ManualUpdateDownloadOptions {
  baseUrl: string;
  version: string;
  platform: string;
  arch: string;
}

const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * 根据受信任的更新源和当前平台生成完整安装包地址。
 */
export function buildManualUpdateDownloadUrl({
  baseUrl,
  version,
  platform,
  arch,
}: ManualUpdateDownloadOptions): string | undefined {
  if (!RELEASE_VERSION_PATTERN.test(version)) return undefined;

  let fileName: string;
  if (platform === 'darwin') {
    if (arch !== 'arm64' && arch !== 'x64') return undefined;
    fileName = arch === 'arm64'
      ? `VideoStitcher-${version}-arm64.dmg`
      : `VideoStitcher-${version}.dmg`;
  } else if (platform === 'win32') {
    if (arch !== 'arm64' && arch !== 'x64') return undefined;
    fileName = `VideoStitcher-${version}-x64.exe`;
  } else {
    return undefined;
  }

  try {
    const url = new URL(baseUrl.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      return undefined;
    }

    url.pathname = `${url.pathname.replace(/\/+$/, '')}/${fileName}`;
    return url.toString();
  } catch {
    return undefined;
  }
}
