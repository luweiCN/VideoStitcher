import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TosClient, TosServerError } from '@volcengine/tos-sdk';
import {
  assertLicenseDatabaseIntegrity,
  createEmptyDatabase,
  migrateLicenseDatabase,
  type DeviceActivityRecord,
  type LicenseDatabase,
} from './domain.js';

const STATE_SIZE_WARNING_BYTES = 5 * 1024 * 1024;

function serializeDatabase(database: LicenseDatabase, pretty = false): string {
  assertLicenseDatabaseIntegrity(database);
  const content = JSON.stringify(database, null, pretty ? 2 : undefined);
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  if (sizeBytes >= STATE_SIZE_WARNING_BYTES) {
    console.warn(`[授权存储] 主状态已达到 ${(sizeBytes / 1024 / 1024).toFixed(2)} MiB，建议评估迁移数据库`);
  }
  return content;
}

export class StorageConflictError extends Error {
  public constructor() {
    super('授权数据已被其他请求修改，请重试');
  }
}

export interface VersionedDatabase {
  database: LicenseDatabase;
  version: string;
}

export interface VersionedDeviceActivity {
  activity?: DeviceActivityRecord;
  version: string;
}

export interface LicenseStorage {
  read(): Promise<VersionedDatabase>;
  write(database: LicenseDatabase, expectedVersion: string): Promise<string>;
  readDeviceActivity(deviceId: string): Promise<VersionedDeviceActivity>;
  writeDeviceActivity(activity: DeviceActivityRecord, expectedVersion: string): Promise<string>;
  hasBootstrapMarker?(): Promise<boolean>;
  writeBootstrapMarker?(): Promise<void>;
}

export class FileLicenseStorage implements LicenseStorage {
  public constructor(private readonly filePath: string) {}

  public async read(): Promise<VersionedDatabase> {
    try {
      const content = await readFile(this.filePath, 'utf8');
      const database = migrateLicenseDatabase(JSON.parse(content) as unknown);
      return { database, version: String(database.revision) };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { database: createEmptyDatabase(), version: '0' };
      }
      throw error;
    }
  }

  public async write(database: LicenseDatabase, expectedVersion: string): Promise<string> {
    const current = await this.read();
    if (current.version !== expectedVersion) {
      throw new StorageConflictError();
    }

    const nextRevision = current.database.revision + 1;
    const nextDatabase: LicenseDatabase = { ...database, revision: nextRevision };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, serializeDatabase(nextDatabase, true), { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.filePath);
    return String(nextRevision);
  }

  public async readDeviceActivity(deviceId: string): Promise<VersionedDeviceActivity> {
    try {
      const content = await readFile(this.getActivityPath(deviceId), 'utf8');
      const activity = parseDeviceActivity(JSON.parse(content) as unknown);
      return { activity, version: String(activity.revision) };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { version: '0' };
      }
      throw error;
    }
  }

  public async writeDeviceActivity(
    activity: DeviceActivityRecord,
    expectedVersion: string,
  ): Promise<string> {
    const current = await this.readDeviceActivity(activity.deviceId);
    if (current.version !== expectedVersion) throw new StorageConflictError();
    const nextActivity = { ...activity, revision: (current.activity?.revision ?? 0) + 1 };
    const activityPath = this.getActivityPath(activity.deviceId);
    await mkdir(path.dirname(activityPath), { recursive: true });
    const temporaryPath = `${activityPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(nextActivity, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, activityPath);
    return String(nextActivity.revision);
  }

  public async hasBootstrapMarker(): Promise<boolean> {
    try {
      await readFile(this.getBootstrapMarkerPath(), 'utf8');
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  public async writeBootstrapMarker(): Promise<void> {
    const markerPath = this.getBootstrapMarkerPath();
    await mkdir(path.dirname(markerPath), { recursive: true });
    try {
      await writeFile(markerPath, '管理员初始化已完成\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return;
      throw error;
    }
  }

  private getActivityPath(deviceId: string): string {
    return path.join(path.dirname(this.filePath), 'activity', `${deviceId}.json`);
  }

  private getBootstrapMarkerPath(): string {
    return path.join(path.dirname(this.filePath), 'admin-bootstrap-complete');
  }
}

interface TosStorageOptions {
  accessKeyId: string;
  accessKeySecret: string;
  stsToken?: string;
  region: string;
  endpoint: string;
  bucket: string;
  objectKey: string;
}

export class TosLicenseStorage implements LicenseStorage {
  private readonly client: TosClient;
  private readonly latestRevisionByEtag = new Map<string, number>();
  private readonly latestActivityRevisionByEtag = new Map<string, number>();

  public constructor(private readonly options: TosStorageOptions) {
    this.client = new TosClient({
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      ...(options.stsToken === undefined ? {} : { stsToken: options.stsToken }),
      region: options.region,
      endpoint: options.endpoint,
    });
  }

  public async read(): Promise<VersionedDatabase> {
    try {
      const response = await this.client.getObjectV2({
        bucket: this.options.bucket,
        key: this.options.objectKey,
      });
      const content = await this.readBody(response.data.content);
      const database = migrateLicenseDatabase(JSON.parse(content) as unknown);
      const version = String(response.data.etag || database.revision);
      this.latestRevisionByEtag.set(version, database.revision);
      return { database, version };
    } catch (error: unknown) {
      if (error instanceof TosServerError && (error.statusCode === 404 || error.code === 'NoSuchKey')) {
        return { database: createEmptyDatabase(), version: '0' };
      }
      throw error;
    }
  }

  public async write(database: LicenseDatabase, expectedVersion: string): Promise<string> {
    const nextDatabase: LicenseDatabase = {
      ...database,
      revision: (this.latestRevisionByEtag.get(expectedVersion) ?? database.revision) + 1,
    };
    try {
      const result = await this.client.putObject({
        bucket: this.options.bucket,
        key: this.options.objectKey,
        body: Buffer.from(serializeDatabase(nextDatabase)),
        ...(expectedVersion === '0' ? { forbidOverwrite: true } : { ifMatch: expectedVersion }),
      });
      const nextVersion = String(result.headers.etag || nextDatabase.revision);
      this.latestRevisionByEtag.set(nextVersion, nextDatabase.revision);
      return nextVersion;
    } catch (error: unknown) {
      if (error instanceof TosServerError && [409, 412].includes(error.statusCode)) {
        throw new StorageConflictError();
      }
      throw error;
    }
  }

  public async readDeviceActivity(deviceId: string): Promise<VersionedDeviceActivity> {
    try {
      const response = await this.client.getObjectV2({
        bucket: this.options.bucket,
        key: this.getActivityObjectKey(deviceId),
      });
      const content = await this.readBody(response.data.content);
      const activity = parseDeviceActivity(JSON.parse(content) as unknown);
      const version = String(response.data.etag || activity.revision);
      this.latestActivityRevisionByEtag.set(version, activity.revision);
      return { activity, version };
    } catch (error: unknown) {
      if (error instanceof TosServerError && (error.statusCode === 404 || error.code === 'NoSuchKey')) {
        return { version: '0' };
      }
      throw error;
    }
  }

  public async writeDeviceActivity(
    activity: DeviceActivityRecord,
    expectedVersion: string,
  ): Promise<string> {
    const nextActivity = {
      ...activity,
      revision: (this.latestActivityRevisionByEtag.get(expectedVersion) ?? activity.revision) + 1,
    };
    try {
      const result = await this.client.putObject({
        bucket: this.options.bucket,
        key: this.getActivityObjectKey(activity.deviceId),
        body: Buffer.from(JSON.stringify(nextActivity)),
        ...(expectedVersion === '0' ? { forbidOverwrite: true } : { ifMatch: expectedVersion }),
      });
      const nextVersion = String(result.headers.etag || nextActivity.revision);
      this.latestActivityRevisionByEtag.set(nextVersion, nextActivity.revision);
      return nextVersion;
    } catch (error: unknown) {
      if (error instanceof TosServerError && [409, 412].includes(error.statusCode)) {
        throw new StorageConflictError();
      }
      throw error;
    }
  }

  public async hasBootstrapMarker(): Promise<boolean> {
    try {
      await this.client.getObjectV2({
        bucket: this.options.bucket,
        key: this.getBootstrapMarkerObjectKey(),
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof TosServerError && (error.statusCode === 404 || error.code === 'NoSuchKey')) {
        return false;
      }
      throw error;
    }
  }

  public async writeBootstrapMarker(): Promise<void> {
    try {
      await this.client.putObject({
        bucket: this.options.bucket,
        key: this.getBootstrapMarkerObjectKey(),
        body: Buffer.from('管理员初始化已完成\n'),
        forbidOverwrite: true,
      });
    } catch (error: unknown) {
      if (error instanceof TosServerError && [409, 412].includes(error.statusCode)) return;
      throw error;
    }
  }

  private getActivityObjectKey(deviceId: string): string {
    const separatorIndex = this.options.objectKey.lastIndexOf('/');
    const prefix = separatorIndex === -1 ? '' : this.options.objectKey.slice(0, separatorIndex + 1);
    return `${prefix}activity/${deviceId}.json`;
  }

  private getBootstrapMarkerObjectKey(): string {
    const separatorIndex = this.options.objectKey.lastIndexOf('/');
    const prefix = separatorIndex === -1 ? '' : this.options.objectKey.slice(0, separatorIndex + 1);
    return `${prefix}admin-bootstrap-complete`;
  }

  private async readBody(content: unknown): Promise<string> {
    if (typeof content === 'string') {
      return content;
    }
    if (content instanceof Uint8Array) {
      return Buffer.from(content).toString('utf8');
    }
    if (content && typeof content === 'object' && Symbol.asyncIterator in content) {
      const chunks: Buffer[] = [];
      for await (const chunk of content as AsyncIterable<Buffer | Uint8Array | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString('utf8');
    }
    throw new Error('无法读取 TOS 授权数据');
  }
}

export async function mutateDatabase<T>(
  storage: LicenseStorage,
  mutation: (database: LicenseDatabase) => T | Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const current = await storage.read();
    const database = structuredClone(current.database);
    const result = await mutation(database);
    try {
      await storage.write(database, current.version);
      return result;
    } catch (error: unknown) {
      if (!(error instanceof StorageConflictError) || attempt === maxAttempts) {
        throw error;
      }
      console.warn(`[授权存储] 主状态发生写入冲突，正在进行第 ${attempt + 1} 次尝试`);
    }
  }
  throw new StorageConflictError();
}

export async function mutateDeviceActivity<T>(
  storage: LicenseStorage,
  deviceId: string,
  createActivity: () => DeviceActivityRecord,
  mutation: (activity: DeviceActivityRecord) => T | Promise<T>,
  maxAttempts = 4,
): Promise<{ activity: DeviceActivityRecord; result: T }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const current = await storage.readDeviceActivity(deviceId);
    const activity = current.activity === undefined
      ? createActivity()
      : structuredClone(current.activity);
    const result = await mutation(activity);
    try {
      await storage.writeDeviceActivity(activity, current.version);
      activity.revision += 1;
      return { activity, result };
    } catch (error: unknown) {
      if (!(error instanceof StorageConflictError) || attempt === maxAttempts) throw error;
    }
  }
  throw new StorageConflictError();
}

function parseDeviceActivity(value: unknown): DeviceActivityRecord {
  if (value === null || typeof value !== 'object') throw new Error('设备活动数据格式无效');
  const activity = value as DeviceActivityRecord;
  if (
    activity.schemaVersion !== 1
    || typeof activity.deviceId !== 'string'
    || typeof activity.licenseId !== 'string'
    || !Array.isArray(activity.dailyUsage)
  ) {
    throw new Error('设备活动数据缺少必要字段');
  }
  return structuredClone(activity);
}
