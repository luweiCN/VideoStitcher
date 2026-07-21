import { createPublicKey, verify } from 'node:crypto';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

interface ReleaseChannel {
  schemaVersion: 1;
  targetVersion: string;
  directive?: string;
}

interface ReleaseRollbackDirectiveClaims {
  issuer: 'videostitcher-release';
  targetVersion: string;
  allowedFromVersions: string[];
  generation: string;
  issuedAt: number;
  expiresAt: number;
}

interface ManagedRollbackOptions {
  updateBaseUrl: string;
  currentVersion: string;
  signingPublicKey: string;
  fetchImplementation?: typeof fetch;
  now?: Date;
}

/**
 * 读取并验证 TOS 上的签名回退指令。任何异常都必须由调用方按“不允许降级”处理。
 */
export async function getManagedRollbackTarget({
  updateBaseUrl,
  currentVersion,
  signingPublicKey,
  fetchImplementation = fetch,
  now = new Date(),
}: ManagedRollbackOptions): Promise<string | undefined> {
  if (!VERSION_PATTERN.test(currentVersion) || !signingPublicKey.trim()) return undefined;
  const baseUrl = new URL(`${updateBaseUrl.replace(/\/+$/, '')}/`);
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password) return undefined;
  const channelUrl = new URL('channel.json', baseUrl);
  channelUrl.searchParams.set('client', Date.now().toString());
  const response = await fetchImplementation(channelUrl, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`回退指令返回 HTTP ${response.status}`);
  const content = await response.text();
  if (Buffer.byteLength(content, 'utf8') > 16 * 1024) throw new Error('回退指令响应过大');
  const channel = JSON.parse(content) as Partial<ReleaseChannel>;
  if (
    channel.schemaVersion !== 1
    || typeof channel.targetVersion !== 'string'
    || !VERSION_PATTERN.test(channel.targetVersion)
  ) {
    throw new Error('回退指令响应格式无效');
  }
  if (!channel.directive) return undefined;

  const claims = verifyDirective(channel.directive, signingPublicKey, now);
  if (
    claims.targetVersion !== channel.targetVersion
    || !claims.allowedFromVersions.includes(currentVersion)
    || compareVersions(currentVersion, claims.targetVersion) <= 0
  ) {
    throw new Error('回退指令不适用于当前客户端');
  }
  return claims.targetVersion;
}

function verifyDirective(
  token: string,
  signingPublicKey: string,
  now: Date,
): ReleaseRollbackDirectiveClaims {
  const segments = token.split('.');
  if (segments.length !== 3 || token.length > 16_384) throw new Error('回退指令格式无效');
  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new Error('回退指令格式无效');
  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      algorithm?: unknown;
      type?: unknown;
      version?: unknown;
    };
    const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8')) as Partial<ReleaseRollbackDirectiveClaims>;
    const valid = verify(
      null,
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      createPublicKey(signingPublicKey),
      Buffer.from(encodedSignature, 'base64url'),
    );
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      !valid
      || header.algorithm !== 'EdDSA'
      || header.type !== 'VS-RELEASE-ROLLBACK'
      || header.version !== 1
      || claims.issuer !== 'videostitcher-release'
      || typeof claims.targetVersion !== 'string'
      || !VERSION_PATTERN.test(claims.targetVersion)
      || !Array.isArray(claims.allowedFromVersions)
      || claims.allowedFromVersions.some((version) => typeof version !== 'string' || !VERSION_PATTERN.test(version))
      || typeof claims.generation !== 'string'
      || claims.generation.length < 16
      || !Number.isInteger(claims.issuedAt)
      || !Number.isInteger(claims.expiresAt)
      || (claims.issuedAt as number) > nowSeconds + 5 * 60
      || (claims.expiresAt as number) <= nowSeconds
    ) {
      throw new Error('回退指令签名无效或已经过期');
    }
    return claims as ReleaseRollbackDirectiveClaims;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('回退指令')) throw error;
    throw new Error('回退指令解析失败');
  }
}

function compareVersions(left: string, right: string): number {
  const [leftCore, leftPreRelease] = left.split('-', 2);
  const [rightCore, rightPreRelease] = right.split('-', 2);
  const leftParts = (leftCore ?? '').split('.').map(Number);
  const rightParts = (rightCore ?? '').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  if (leftPreRelease === undefined && rightPreRelease !== undefined) return 1;
  if (leftPreRelease !== undefined && rightPreRelease === undefined) return -1;
  return (leftPreRelease ?? '').localeCompare(rightPreRelease ?? '');
}
