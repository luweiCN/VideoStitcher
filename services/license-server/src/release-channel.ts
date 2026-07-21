import { TosClient, TosServerError } from '@volcengine/tos-sdk';
import { ApiError } from './errors.js';
import {
  compareVersions,
  parseCatalog,
  parseCurrentManifest,
  type ReleaseChannel,
  type ReleaseChannelSwitchInput,
  type ReleaseChannelSwitchResult,
} from './release-management.js';

const MAX_MANIFEST_BYTES = 100_000;
const SWITCH_LOCK_TTL_MS = 2 * 60_000;

export interface ReleaseObject {
  content: Buffer;
}

export interface ReleaseObjectPutOptions {
  cacheControl?: string;
  contentType?: string;
  forbidOverwrite?: boolean;
}

export interface ReleaseObjectStore {
  read(key: string): Promise<ReleaseObject>;
  put(key: string, content: Buffer, options?: ReleaseObjectPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

interface SharedReleaseChannelOptions {
  bucket: string;
  prefix?: string;
  updateBaseUrl: string;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
}

type TosReleaseChannelOptions = SharedReleaseChannelOptions & (
  | {
      objectStore: ReleaseObjectStore;
      accessKeyId?: never;
      accessKeySecret?: never;
      stsToken?: never;
      region?: never;
      endpoint?: never;
    }
  | {
      objectStore?: never;
      accessKeyId: string;
      accessKeySecret: string;
      stsToken?: string;
      region: string;
      endpoint: string;
    }
);

class ReleaseObjectNotFoundError extends Error {}
class ReleaseObjectConflictError extends Error {}

class TosSdkReleaseObjectStore implements ReleaseObjectStore {
  private readonly client: TosClient;

  public constructor(
    private readonly bucket: string,
    options: {
      accessKeyId: string;
      accessKeySecret: string;
      stsToken?: string;
      region: string;
      endpoint: string;
    },
  ) {
    this.client = new TosClient({
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      ...(options.stsToken === undefined ? {} : { stsToken: options.stsToken }),
      region: options.region,
      endpoint: options.endpoint,
    });
  }

  public async read(key: string): Promise<ReleaseObject> {
    try {
      const response = await this.client.getObjectV2({
        bucket: this.bucket,
        key,
        dataType: 'buffer',
      });
      return { content: await readObjectBody(response.data.content) };
    } catch (error: unknown) {
      if (isTosNotFound(error)) throw new ReleaseObjectNotFoundError(key);
      throw error;
    }
  }

  public async put(
    key: string,
    content: Buffer,
    options: ReleaseObjectPutOptions = {},
  ): Promise<void> {
    try {
      await this.client.putObject({
        bucket: this.bucket,
        key,
        body: content,
        ...(options.cacheControl === undefined ? {} : { cacheControl: options.cacheControl }),
        ...(options.contentType === undefined ? {} : { contentType: options.contentType }),
        ...(options.forbidOverwrite === undefined ? {} : { forbidOverwrite: options.forbidOverwrite }),
      });
    } catch (error: unknown) {
      if (isTosConflict(error)) throw new ReleaseObjectConflictError(key);
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    await this.client.deleteObject({ bucket: this.bucket, key });
  }
}

export class TosReleaseChannel implements ReleaseChannel {
  private readonly objectStore: ReleaseObjectStore;
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => Date;
  private readonly prefix: string;
  private readonly updateBaseUrl: string;

  public constructor(options: TosReleaseChannelOptions) {
    this.prefix = (options.prefix ?? 'stable').replace(/^\/+|\/+$/g, '');
    if (!this.prefix || this.prefix.includes('..')) throw new Error('TOS 更新目录前缀无效');
    this.updateBaseUrl = options.updateBaseUrl.trim().replace(/\/+$/, '');
    const parsedUpdateBaseUrl = new URL(`${this.updateBaseUrl}/`);
    if (parsedUpdateBaseUrl.protocol !== 'https:' || parsedUpdateBaseUrl.username || parsedUpdateBaseUrl.password) {
      throw new Error('版本更新源必须是无账号信息的 HTTPS 地址');
    }
    this.objectStore = options.objectStore ?? new TosSdkReleaseObjectStore(options.bucket, {
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      ...(options.stsToken === undefined ? {} : { stsToken: options.stsToken }),
      region: options.region,
      endpoint: options.endpoint,
    });
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  public async switchCurrent(input: ReleaseChannelSwitchInput): Promise<ReleaseChannelSwitchResult> {
    const lockKey = `${this.prefix}/releases/switch.lock`;
    let lockAcquired = false;
    try {
      await this.acquireLock(lockKey, input.requestId);
      lockAcquired = true;
      return await this.switchCurrentWithLock(input);
    } catch (error: unknown) {
      if (error instanceof ApiError) throw error;
      console.error('[版本切换] 直接更新 TOS 失败:', error);
      throw new ApiError(502, 'RELEASE_TOS_UPDATE_FAILED', '暂时无法更新 TOS 当前版本，请稍后重试');
    } finally {
      if (lockAcquired) {
        try {
          await this.objectStore.delete(lockKey);
        } catch (error: unknown) {
          console.warn('[版本切换] 清理 TOS 切换锁失败，锁过期后会自动恢复:', error);
        }
      }
    }
  }

  private async switchCurrentWithLock(
    input: ReleaseChannelSwitchInput,
  ): Promise<ReleaseChannelSwitchResult> {
    const catalogKey = `${this.prefix}/releases/index.json`;
    let catalogObject: ReleaseObject;
    try {
      catalogObject = await this.objectStore.read(catalogKey);
    } catch (error: unknown) {
      if (error instanceof ReleaseObjectNotFoundError) {
        throw new ApiError(409, 'RELEASE_CATALOG_MISSING', '版本目录尚未建立，请先发布一个新版客户端');
      }
      throw error;
    }
    let rawCatalog: unknown;
    try {
      rawCatalog = JSON.parse(catalogObject.content.toString('utf8')) as unknown;
    } catch {
      throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本目录格式无效');
    }
    const catalog = parseCatalog(rawCatalog, this.updateBaseUrl);
    if (catalog.currentVersion !== input.expectedCurrentVersion) {
      throw new ApiError(409, 'RELEASE_CURRENT_CHANGED', '当前版本已经发生变化，请刷新页面后重试');
    }
    const target = catalog.releases.find((release) => release.version === input.targetVersion);
    if (!target?.manifests.windows || !target.manifests.macos) {
      throw new ApiError(404, 'RELEASE_NOT_COMPLETE', `版本 ${input.targetVersion} 的发布产物不完整`);
    }

    const comparison = compareVersions(input.targetVersion, catalog.currentVersion);
    if (comparison < 0 && !input.signedDirective) {
      throw new ApiError(400, 'RELEASE_ROLLBACK_DIRECTIVE_MISSING', '降低当前版本时缺少签名回退指令');
    }
    if (comparison >= 0 && input.signedDirective) {
      throw new ApiError(400, 'RELEASE_ROLLBACK_DIRECTIVE_UNEXPECTED', '升级当前版本时不能携带回退指令');
    }

    const expectedManifestPrefix = `${this.prefix}/versions/${input.targetVersion}/`;
    for (const manifestKey of [target.manifests.windows, target.manifests.macos]) {
      if (!manifestKey.startsWith(expectedManifestPrefix)) {
        throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本清单路径无效');
      }
    }
    const [windowsManifest, macManifest] = await Promise.all([
      this.readManifest(target.manifests.windows, input.targetVersion),
      this.readManifest(target.manifests.macos, input.targetVersion),
    ]);

    const now = this.now();
    const updatedAt = now.toISOString();
    const channel = {
      schemaVersion: 1,
      targetVersion: input.targetVersion,
      updatedAt,
      ...(input.signedDirective ? { directive: input.signedDirective } : {}),
    };
    await this.objectStore.put(
      `${this.prefix}/channel.json`,
      Buffer.from(`${JSON.stringify(channel, null, 2)}\n`),
      { cacheControl: 'no-store, max-age=0', contentType: 'application/json; charset=utf-8' },
    );
    await Promise.all([
      this.objectStore.put(`${this.prefix}/latest.yml`, windowsManifest, {
        cacheControl: 'no-store, max-age=0',
        contentType: 'application/yaml; charset=utf-8',
      }),
      this.objectStore.put(`${this.prefix}/latest-mac.yml`, macManifest, {
        cacheControl: 'no-store, max-age=0',
        contentType: 'application/yaml; charset=utf-8',
      }),
    ]);

    catalog.currentVersion = input.targetVersion;
    catalog.updatedAt = updatedAt;
    await this.objectStore.put(
      catalogKey,
      Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`),
      { cacheControl: 'no-store, max-age=0', contentType: 'application/json; charset=utf-8' },
    );
    await this.verifyPublicChannel(input.targetVersion);
    console.log(`[版本切换] TOS 当前版本已切换为 ${input.targetVersion}`);
    return {
      previousVersion: input.expectedCurrentVersion,
      currentVersion: input.targetVersion,
      updatedAt,
    };
  }

  private async readManifest(key: string, expectedVersion: string): Promise<Buffer> {
    let object: ReleaseObject;
    try {
      object = await this.objectStore.read(key);
    } catch (error: unknown) {
      if (error instanceof ReleaseObjectNotFoundError) {
        throw new ApiError(404, 'RELEASE_NOT_COMPLETE', `版本 ${expectedVersion} 的归档清单不完整`);
      }
      throw error;
    }
    if (object.content.byteLength > MAX_MANIFEST_BYTES) {
      throw new ApiError(502, 'RELEASE_MANIFEST_INVALID', `归档清单 ${key} 内容过大`);
    }
    const actualVersion = parseCurrentManifest(object.content.toString('utf8')).version;
    if (actualVersion !== expectedVersion) {
      throw new ApiError(502, 'RELEASE_MANIFEST_INVALID', `归档清单 ${key} 的版本不一致`);
    }
    return object.content;
  }

  private async acquireLock(key: string, requestId: string): Promise<void> {
    const now = this.now();
    const content = Buffer.from(`${JSON.stringify({
      requestId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SWITCH_LOCK_TTL_MS).toISOString(),
    })}\n`);
    try {
      await this.objectStore.put(key, content, {
        forbidOverwrite: true,
        cacheControl: 'no-store, max-age=0',
        contentType: 'application/json; charset=utf-8',
      });
      return;
    } catch (error: unknown) {
      if (!(error instanceof ReleaseObjectConflictError)) throw error;
    }

    const existing = await this.readLockExpiration(key);
    if (existing > now.getTime()) {
      throw new ApiError(409, 'RELEASE_OPERATION_ACTIVE', '已有版本切换正在执行，请稍后重试');
    }
    await this.objectStore.delete(key);
    try {
      await this.objectStore.put(key, content, {
        forbidOverwrite: true,
        cacheControl: 'no-store, max-age=0',
        contentType: 'application/json; charset=utf-8',
      });
    } catch (error: unknown) {
      if (error instanceof ReleaseObjectConflictError) {
        throw new ApiError(409, 'RELEASE_OPERATION_ACTIVE', '已有版本切换正在执行，请稍后重试');
      }
      throw error;
    }
  }

  private async readLockExpiration(key: string): Promise<number> {
    try {
      const value = JSON.parse((await this.objectStore.read(key)).content.toString('utf8')) as { expiresAt?: unknown };
      if (typeof value.expiresAt === 'string') {
        const expiresAt = Date.parse(value.expiresAt);
        if (Number.isFinite(expiresAt)) return expiresAt;
      }
    } catch (error: unknown) {
      if (!(error instanceof ReleaseObjectNotFoundError)) {
        console.warn('[版本切换] 读取现有 TOS 切换锁失败，将按过期锁处理:', error);
      }
    }
    return 0;
  }

  private async verifyPublicChannel(expectedVersion: string): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const manifests = await Promise.all(['latest.yml', 'latest-mac.yml'].map(async (name) => {
          const url = `${this.updateBaseUrl}/${name}?verify=${Date.now()}`;
          const response = await this.fetchImplementation(url, {
            headers: { 'cache-control': 'no-cache' },
            signal: AbortSignal.timeout(5_000),
          });
          if (!response.ok) throw new Error(`${name} 返回 HTTP ${response.status}`);
          return { name, version: parseCurrentManifest(await response.text()).version };
        }));
        for (const manifest of manifests) {
          if (manifest.version !== expectedVersion) {
            throw new Error(`${manifest.name} 当前为 ${manifest.version}`);
          }
        }
        return;
      } catch (error: unknown) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }
    console.error('[版本切换] TOS 公网清单验证失败:', lastError);
    throw new ApiError(502, 'RELEASE_PUBLIC_VERIFY_FAILED', 'TOS 已写入，但公网更新清单验证失败，请立即检查更新源');
  }
}

async function readObjectBody(content: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(content)) return Buffer.from(content);
  if (typeof content === 'string' || content instanceof Uint8Array) return Buffer.from(content);
  if (content && typeof content === 'object' && Symbol.asyncIterator in content) {
    const chunks: Buffer[] = [];
    for await (const chunk of content as AsyncIterable<Buffer | Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('无法读取 TOS 版本对象');
}

function isTosNotFound(error: unknown): boolean {
  return error instanceof TosServerError && (error.statusCode === 404 || error.code === 'NoSuchKey');
}

function isTosConflict(error: unknown): boolean {
  return error instanceof TosServerError && [409, 412].includes(error.statusCode);
}
