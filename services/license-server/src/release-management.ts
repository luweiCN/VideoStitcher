import { randomUUID } from 'node:crypto';
import { addAuditEvent } from './domain.js';
import { ApiError } from './errors.js';
import { mutateDatabase, type LicenseStorage } from './storage.js';
import { signReleaseRollbackDirective } from './token.js';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_SEARCH_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export interface ReleaseDownload {
  name: string;
  size: number;
  url: string;
  platform: 'windows' | 'macos';
  arch: 'x64' | 'arm64';
}

export interface DesktopReleaseRecord {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  supportsManagedRollback: boolean;
  totalSizeBytes: number;
  manifests: { windows: string; macos: string };
  downloads: ReleaseDownload[];
}

export interface DesktopReleaseCatalog {
  schemaVersion: 1;
  currentVersion: string;
  updatedAt: string;
  releases: DesktopReleaseRecord[];
}

export type ReleaseOperationKind = 'publish' | 'deploy-admin' | 'set-current';
export type ReleaseOperationStatus = 'waiting' | 'queued' | 'in_progress' | 'completed';

export interface ReleaseOperation {
  requestId: string;
  kind: ReleaseOperationKind;
  version?: string;
  status: ReleaseOperationStatus;
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'neutral' | 'startup_failure' | 'stale';
  url?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ReleaseDashboardBase {
  tosCurrentSwitchEnabled: boolean;
  tosCurrentVersion?: string;
  tosCurrentVersionUpdatedAt?: string;
  catalog?: DesktopReleaseCatalog;
  operations: ReleaseOperation[];
}

export type ReleaseDashboard = ReleaseDashboardBase & (
  | {
      github: { status: 'connected' };
      sourceVersion: string;
      sourceVersionPublished: boolean;
    }
  | {
      github: {
        status: 'unavailable';
        code: string;
        message: string;
      };
    }
);

export interface ReleaseManagement {
  getDashboard(): Promise<ReleaseDashboard>;
  publish(version: string, releaseNotes: string): Promise<ReleaseOperation>;
  deployAdmin(): Promise<ReleaseOperation>;
  setCurrent(targetVersion: string, actorId?: string): Promise<ReleaseOperation>;
  getOperation(requestId: string): Promise<ReleaseOperation>;
}

export interface ReleaseChannelSwitchInput {
  requestId: string;
  expectedCurrentVersion: string;
  targetVersion: string;
  signedDirective: string;
}

export interface ReleaseChannelSwitchResult {
  previousVersion: string;
  currentVersion: string;
  updatedAt: string;
}

export interface ReleaseChannel {
  switchCurrent(input: ReleaseChannelSwitchInput): Promise<ReleaseChannelSwitchResult>;
}

interface ReleaseManagementOptions {
  githubToken?: string;
  githubRepository: string;
  githubRef: string;
  releaseWorkflow: string;
  deployWorkflow: string;
  updateBaseUrl: string;
  signingPrivateKey: string;
  releaseChannel?: ReleaseChannel;
  storage?: LicenseStorage;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
}

interface GithubRun {
  id: number;
  display_title: string;
  head_sha: string;
  status: string;
  conclusion: ReleaseOperation['conclusion'] | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface GithubRunsResponse {
  workflow_runs: GithubRun[];
}

export class ReleaseManagementService implements ReleaseManagement {
  private readonly fetchImplementation: typeof fetch;
  private readonly now: () => Date;

  public constructor(private readonly options: ReleaseManagementOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.now = options.now ?? (() => new Date());
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.githubRepository)) {
      throw new Error('GitHub 仓库名称格式无效');
    }
    const updateUrl = new URL(`${options.updateBaseUrl.replace(/\/+$/, '')}/`);
    if (updateUrl.protocol !== 'https:' || updateUrl.username || updateUrl.password) {
      throw new Error('版本管理更新源必须是无账号信息的 HTTPS 地址');
    }
  }

  public async getDashboard(): Promise<ReleaseDashboard> {
    const [catalogResult, githubResult, setCurrentOperationsResult] = await Promise.allSettled([
      this.readCatalog(),
      this.readGithubDashboard(),
      this.listSetCurrentOperations(),
    ]);
    if (catalogResult.status === 'rejected') throw catalogResult.reason;
    if (setCurrentOperationsResult.status === 'rejected') throw setCurrentOperationsResult.reason;
    const catalog = catalogResult.value;
    const setCurrentOperations = setCurrentOperationsResult.value;
    const currentRelease = catalog === undefined
      ? await this.readCurrentManifest()
      : { version: catalog.currentVersion, updatedAt: catalog.updatedAt };
    const tosDashboard = {
      tosCurrentSwitchEnabled: this.options.releaseChannel !== undefined,
      ...(currentRelease === undefined ? {} : {
        tosCurrentVersion: currentRelease.version,
        ...(currentRelease.updatedAt === undefined ? {} : {
          tosCurrentVersionUpdatedAt: currentRelease.updatedAt,
        }),
      }),
      ...(catalog === undefined ? {} : { catalog }),
    };
    if (githubResult.status === 'rejected') {
      const error: unknown = githubResult.reason;
      if (!isGithubReleaseError(error)) throw error;
      return {
        ...tosDashboard,
        github: { status: 'unavailable', code: error.code, message: error.message },
        operations: setCurrentOperations,
      };
    }
    return {
      ...tosDashboard,
      github: { status: 'connected' },
      sourceVersion: githubResult.value.sourceVersion,
      sourceVersionPublished: githubResult.value.sourceVersionPublished,
      operations: sortOperations([
        ...githubResult.value.operations,
        ...setCurrentOperations,
      ]),
    };
  }

  public async publish(version: string, releaseNotes: string): Promise<ReleaseOperation> {
    this.requireGithubToken();
    assertStableVersion(version);
    const sourceVersion = await this.readSourceVersion();
    if (compareVersions(version, sourceVersion) < 0) {
      throw new ApiError(
        409,
        'RELEASE_VERSION_BEHIND_SOURCE',
        `目标版本 ${version} 不能低于代码当前版本 ${sourceVersion}`,
      );
    }
    const [targetVersionPublished, catalog, activeRuns] = await Promise.all([
      this.releaseTagExists(version),
      this.readCatalog(),
      this.listActiveRuns(this.options.releaseWorkflow),
    ]);
    if (targetVersionPublished || catalog?.releases.some((release) => release.version === version)) {
      throw new ApiError(409, 'RELEASE_VERSION_EXISTS', `版本 ${version} 已经发布，版本号不能重复使用`);
    }
    const latestPublishedVersion = catalog?.releases.reduce<string | undefined>(
      (latest, release) => latest === undefined || compareVersions(release.version, latest) > 0
        ? release.version
        : latest,
      undefined,
    );
    if (latestPublishedVersion && compareVersions(version, latestPublishedVersion) <= 0) {
      throw new ApiError(
        409,
        'RELEASE_VERSION_NOT_NEWER',
        `目标版本 ${version} 必须高于最新发布版本 ${latestPublishedVersion}`,
      );
    }
    this.assertNoActiveOperation(activeRuns);
    const requestId = randomUUID();
    await this.dispatchWorkflow(this.options.releaseWorkflow, {
      version,
      release_notes_override: releaseNotes,
      release_request_id: requestId,
    });
    return { requestId, kind: 'publish', version, status: 'waiting' };
  }

  public async deployAdmin(): Promise<ReleaseOperation> {
    this.requireGithubToken();
    const activeRuns = await this.listActiveRuns(this.options.deployWorkflow);
    this.assertNoActiveOperation(activeRuns, '已有管理后台部署任务正在执行，请等待完成');
    const requestId = randomUUID();
    await this.dispatchWorkflow(this.options.deployWorkflow, {
      deployment_request_id: requestId,
    });
    return { requestId, kind: 'deploy-admin', status: 'waiting' };
  }

  public async setCurrent(targetVersion: string, actorId = 'admin'): Promise<ReleaseOperation> {
    assertVersion(targetVersion);
    if (!this.options.releaseChannel) {
      throw new ApiError(503, 'RELEASE_TOS_WRITE_NOT_CONFIGURED', 'TOS 当前版本写入尚未配置');
    }
    const catalog = await this.readCatalog();
    if (!catalog) throw new ApiError(409, 'RELEASE_CATALOG_MISSING', '版本目录尚未建立，请先发布一个新版客户端');
    const target = catalog.releases.find((release) => release.version === targetVersion);
    if (!target?.manifests.windows || !target.manifests.macos) {
      throw new ApiError(404, 'RELEASE_NOT_COMPLETE', `版本 ${targetVersion} 的发布产物不完整`);
    }
    if (catalog.currentVersion === targetVersion) {
      throw new ApiError(409, 'RELEASE_ALREADY_CURRENT', `版本 ${targetVersion} 已经是当前版本`);
    }
    const requestId = randomUUID();
    const current = catalog.releases.find((release) => release.version === catalog.currentVersion);
    let signedDirective = '';
    if (compareVersions(targetVersion, catalog.currentVersion) < 0) {
      if (!current?.supportsManagedRollback) {
        throw new ApiError(
          409,
          'CURRENT_RELEASE_CANNOT_ROLLBACK',
          `当前版本 ${catalog.currentVersion} 尚不支持受控回退，请先发布包含版本管理能力的新版本`,
        );
      }
      const allowedFromVersions = catalog.releases
        .filter((release) => release.supportsManagedRollback && compareVersions(release.version, targetVersion) > 0)
        .map((release) => release.version);
      const nowSeconds = Math.floor(this.now().getTime() / 1000);
      signedDirective = signReleaseRollbackDirective({
        issuer: 'videostitcher-release',
        targetVersion,
        allowedFromVersions,
        generation: requestId,
        issuedAt: nowSeconds,
        expiresAt: nowSeconds + 180 * 24 * 60 * 60,
      }, this.options.signingPrivateKey);
    }

    const result = await this.options.releaseChannel.switchCurrent({
      requestId,
      expectedCurrentVersion: catalog.currentVersion,
      targetVersion,
      signedDirective,
    });
    const operation: ReleaseOperation = {
      requestId,
      kind: 'set-current',
      version: targetVersion,
      status: 'completed',
      conclusion: 'success',
      createdAt: result.updatedAt,
      updatedAt: result.updatedAt,
    };
    await this.recordSetCurrentOperation(operation, result.previousVersion, actorId);
    return operation;
  }

  public async getOperation(requestId: string): Promise<ReleaseOperation> {
    const manualRunId = requestId.match(/^github-(\d+)$/)?.[1];
    if (!REQUEST_ID_PATTERN.test(requestId) && manualRunId === undefined) {
      throw new ApiError(400, 'INVALID_RELEASE_REQUEST_ID', '版本操作编号格式无效');
    }
    const setCurrentOperation = (await this.listSetCurrentOperations(50))
      .find((operation) => operation.requestId === requestId);
    if (setCurrentOperation) return setCurrentOperation;
    this.requireGithubToken();
    const [publishRuns, deployRuns] = await Promise.all([
      this.listWorkflowRuns(this.options.releaseWorkflow),
      this.listWorkflowRuns(this.options.deployWorkflow),
    ]);
    const publishRun = publishRuns.find((run) => (
      manualRunId === undefined ? run.display_title.includes(requestId) : String(run.id) === manualRunId
    ));
    if (publishRun) return await this.toOperation(publishRun, 'publish', requestId);
    const deployRun = deployRuns.find((run) => (
      manualRunId === undefined ? run.display_title.includes(requestId) : String(run.id) === manualRunId
    ));
    if (deployRun) return await this.toOperation(deployRun, 'deploy-admin', requestId);
    return { requestId, kind: 'publish', status: 'waiting' };
  }

  private async readSourceVersion(ref = this.options.githubRef): Promise<string> {
    const response = await this.githubFetch(
      `/repos/${this.options.githubRepository}/contents/package.json?ref=${encodeURIComponent(ref)}`,
      { headers: { Accept: 'application/vnd.github.raw+json' } },
    );
    const packageJson = JSON.parse(await response.text()) as { version?: unknown };
    return assertVersion(packageJson.version);
  }

  private async releaseTagExists(version: string): Promise<boolean> {
    const response = await this.githubFetch(
      `/repos/${this.options.githubRepository}/git/ref/tags/v${encodeURIComponent(version)}`,
      {},
      [404],
    );
    return response.status !== 404;
  }

  private async readCatalog(): Promise<DesktopReleaseCatalog | undefined> {
    const url = new URL('releases/index.json', `${this.options.updateBaseUrl.replace(/\/+$/, '')}/`);
    url.searchParams.set('admin', Date.now().toString());
    const response = await this.fetchImplementation(url, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new ApiError(502, 'RELEASE_CATALOG_UNAVAILABLE', '暂时无法读取 TOS 版本目录');
    return parseCatalog(await response.json(), this.options.updateBaseUrl);
  }

  private async readCurrentManifest(): Promise<{ version: string; updatedAt?: string } | undefined> {
    const url = new URL('latest.yml', `${this.options.updateBaseUrl.replace(/\/+$/, '')}/`);
    url.searchParams.set('admin', Date.now().toString());
    const response = await this.fetchImplementation(url, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new ApiError(502, 'RELEASE_MANIFEST_UNAVAILABLE', '暂时无法读取 TOS 当前更新清单');
    return parseCurrentManifest(await response.text());
  }

  private async readGithubDashboard(): Promise<{
    sourceVersion: string;
    sourceVersionPublished: boolean;
    operations: ReleaseOperation[];
  }> {
    this.requireGithubToken();
    const sourceVersion = await this.readSourceVersion();
    const [sourceVersionPublished, publishRuns, deployRuns] = await Promise.all([
      this.releaseTagExists(sourceVersion),
      this.listWorkflowRuns(this.options.releaseWorkflow),
      this.listWorkflowRuns(this.options.deployWorkflow),
    ]);
    const operations = await Promise.all(
      [
        ...publishRuns.map((run) => ({ run, kind: 'publish' as const })),
        ...deployRuns.map((run) => ({ run, kind: 'deploy-admin' as const })),
      ]
        .sort((left, right) => right.run.created_at.localeCompare(left.run.created_at))
        .slice(0, 20)
        .map(({ run, kind }) => this.toOperation(run, kind)),
    );
    return { sourceVersion, sourceVersionPublished, operations };
  }

  private async listActiveRuns(workflow: string): Promise<GithubRun[]> {
    return (await this.listWorkflowRuns(workflow))
      .filter((run) => run.status !== 'completed');
  }

  private assertNoActiveOperation(
    runs: GithubRun[],
    message = '已有版本发布任务正在执行，请等待完成',
  ): void {
    if (runs.length > 0) {
      throw new ApiError(409, 'RELEASE_OPERATION_ACTIVE', message);
    }
  }

  private requireGithubToken(): string {
    const token = this.options.githubToken;
    if (!token) {
      throw new ApiError(503, 'GITHUB_RELEASE_NOT_CONFIGURED', 'GitHub 新版本发布尚未配置');
    }
    return token;
  }

  private async listSetCurrentOperations(limit = 20): Promise<ReleaseOperation[]> {
    if (!this.options.storage) return [];
    const { database } = await this.options.storage.read();
    return database.auditEvents.flatMap((event): ReleaseOperation[] => {
      if (event.action !== 'release.current_changed') return [];
      const requestId = event.metadata?.requestId;
      const targetVersion = event.metadata?.targetVersion;
      if (
        typeof requestId !== 'string'
        || !REQUEST_ID_PATTERN.test(requestId)
        || typeof targetVersion !== 'string'
        || !VERSION_PATTERN.test(targetVersion)
      ) {
        return [];
      }
      return [{
        requestId,
        kind: 'set-current',
        version: targetVersion,
        status: 'completed',
        conclusion: 'success',
        createdAt: event.occurredAt,
        updatedAt: event.occurredAt,
      }];
    }).slice(0, limit);
  }

  private async recordSetCurrentOperation(
    operation: ReleaseOperation,
    previousVersion: string,
    actorId: string,
  ): Promise<void> {
    const storage = this.options.storage;
    const targetVersion = operation.version;
    const updatedAt = operation.updatedAt;
    if (!storage || !targetVersion || !updatedAt) return;
    try {
      await mutateDatabase(storage, (database) => {
        addAuditEvent(database, {
          actorType: 'admin',
          actorId,
          action: 'release.current_changed',
          targetType: 'system',
          targetId: targetVersion,
          reason: `从 ${previousVersion} 切换到 ${targetVersion}`,
          metadata: {
            requestId: operation.requestId,
            previousVersion,
            targetVersion,
          },
        }, new Date(updatedAt));
      });
    } catch (error: unknown) {
      console.error('[版本切换] 已完成 TOS 切换，但写入审计日志失败:', error);
    }
  }

  private async listWorkflowRuns(workflow: string): Promise<GithubRun[]> {
    const result = await this.githubJson<GithubRunsResponse>(
      `/repos/${this.options.githubRepository}/actions/workflows/${encodeURIComponent(workflow)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(this.options.githubRef)}&per_page=20`,
    );
    return Array.isArray(result.workflow_runs) ? result.workflow_runs : [];
  }

  private async dispatchWorkflow(workflow: string, inputs: Record<string, string>): Promise<void> {
    await this.githubFetch(
      `/repos/${this.options.githubRepository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: this.options.githubRef, inputs }),
      },
    );
  }

  private async githubJson<T>(path: string): Promise<T> {
    const response = await this.githubFetch(path);
    return await response.json() as T;
  }

  private async githubFetch(
    path: string,
    init: RequestInit = {},
    acceptedStatuses: number[] = [],
  ): Promise<Response> {
    const githubToken = this.requireGithubToken();
    const headers = new Headers(init.headers);
    if (!headers.has('Accept')) headers.set('Accept', 'application/vnd.github+json');
    headers.set('Authorization', `Bearer ${githubToken}`);
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    headers.set('User-Agent', 'VideoStitcher-License-Server');
    const response = await this.fetchImplementation(`https://api.github.com${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      console.error(`[版本管理] GitHub API 请求失败：${response.status} ${path}`);
      if (
        response.status === 429
        || response.headers.get('x-ratelimit-remaining') === '0'
        || response.headers.has('retry-after')
      ) {
        throw new ApiError(503, 'GITHUB_RELEASE_RATE_LIMITED', 'GitHub API 请求过于频繁，请稍后重新检测');
      }
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(503, 'GITHUB_RELEASE_AUTH_FAILED', '版本发布凭据无效或权限不足');
      }
      if (response.status === 404) {
        throw new ApiError(
          503,
          'GITHUB_RELEASE_RESOURCE_NOT_FOUND',
          `GitHub 仓库或发布 Workflow 不存在或无权访问，请检查 ${this.options.githubRepository}、${this.options.githubRef}、${this.options.releaseWorkflow} 和 ${this.options.deployWorkflow}`,
        );
      }
      if (response.status === 422) {
        throw new ApiError(503, 'GITHUB_RELEASE_CONFIG_INVALID', 'GitHub 发布分支或工作流配置无效');
      }
      throw new ApiError(502, 'GITHUB_RELEASE_UNAVAILABLE', 'GitHub 发布服务暂时不可用');
    }
    return response;
  }

  private async toOperation(
    run: GithubRun,
    kind: ReleaseOperationKind,
    requestId?: string,
  ): Promise<ReleaseOperation> {
    const parsedRequestId = requestId ?? run.display_title.match(REQUEST_ID_SEARCH_PATTERN)?.[0] ?? `github-${run.id}`;
    let version = run.display_title.match(/v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/)?.[1];
    if (version === undefined && kind === 'publish' && /^[0-9a-f]{40}$/i.test(run.head_sha)) {
      try {
        version = await this.readSourceVersion(run.head_sha);
      } catch {
        console.warn(`[版本管理] 无法读取发布任务 ${run.id} 对应的版本号`);
      }
    }
    return {
      requestId: parsedRequestId,
      kind,
      ...(version === undefined ? {} : { version }),
      status: normalizeRunStatus(run.status),
      ...(run.conclusion === null ? {} : { conclusion: run.conclusion }),
      url: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    };
  }
}

function isGithubReleaseError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code.startsWith('GITHUB_RELEASE_');
}

function assertStableVersion(value: string): string {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new ApiError(400, 'INVALID_RELEASE_VERSION', '发布版本必须是稳定语义化版本，例如 2.9.7');
  }
  return value;
}

export function parseCurrentManifest(value: string): { version: string; updatedAt?: string } {
  if (value.length > 100_000) {
    throw new ApiError(502, 'RELEASE_MANIFEST_INVALID', 'TOS 当前更新清单格式无效');
  }
  const version = value.match(/^version:[ \t]*['"]?([0-9A-Za-z.-]+)['"]?[ \t]*\r?$/m)?.[1];
  if (version === undefined || !VERSION_PATTERN.test(version)) {
    throw new ApiError(502, 'RELEASE_MANIFEST_INVALID', 'TOS 当前更新清单格式无效');
  }
  const releaseDate = value.match(/^releaseDate:[ \t]*['"]?([^'"\r\n]+)['"]?[ \t]*\r?$/m)?.[1]?.trim();
  if (releaseDate !== undefined && Number.isNaN(Date.parse(releaseDate))) {
    throw new ApiError(502, 'RELEASE_MANIFEST_INVALID', 'TOS 当前更新清单格式无效');
  }
  return {
    version,
    ...(releaseDate === undefined ? {} : { updatedAt: releaseDate }),
  };
}

function normalizeRunStatus(value: string): ReleaseOperationStatus {
  if (value === 'completed') return 'completed';
  if (value === 'in_progress') return 'in_progress';
  return 'queued';
}

export function parseCatalog(value: unknown, updateBaseUrl: string): DesktopReleaseCatalog {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本目录格式无效');
  const catalog = value as Partial<DesktopReleaseCatalog>;
  if (
    catalog.schemaVersion !== 1
    || typeof catalog.currentVersion !== 'string'
    || !VERSION_PATTERN.test(catalog.currentVersion)
    || typeof catalog.updatedAt !== 'string'
    || !Array.isArray(catalog.releases)
  ) {
    throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本目录格式无效');
  }
  const baseUrl = new URL(`${updateBaseUrl.replace(/\/+$/, '')}/`);
  const versions = new Set<string>();
  for (const release of catalog.releases) {
    if (
      !release
      || typeof release.version !== 'string'
      || !VERSION_PATTERN.test(release.version)
      || typeof release.releaseDate !== 'string'
      || typeof release.releaseNotes !== 'string'
      || release.releaseNotes.length > 20_000
      || typeof release.supportsManagedRollback !== 'boolean'
      || typeof release.totalSizeBytes !== 'number'
      || !Number.isFinite(release.totalSizeBytes)
      || release.totalSizeBytes < 0
      || !release.manifests
      || typeof release.manifests.windows !== 'string'
      || typeof release.manifests.macos !== 'string'
      || !Array.isArray(release.downloads)
    ) {
      throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本记录格式无效');
    }
    if (versions.has(release.version)) {
      throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本目录包含重复版本');
    }
    versions.add(release.version);
    for (const manifest of [release.manifests.windows, release.manifests.macos]) {
      if (manifest.includes('..') || manifest.startsWith('/') || !/latest(?:-mac)?\.yml$/.test(manifest)) {
        throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本清单路径无效');
      }
    }
    for (const download of release.downloads) {
      if (
        !download
        || typeof download.name !== 'string'
        || !/^[A-Za-z0-9._-]{1,200}$/.test(download.name)
        || typeof download.size !== 'number'
        || !Number.isFinite(download.size)
        || download.size <= 0
        || !['windows', 'macos'].includes(download.platform)
        || !['x64', 'arm64'].includes(download.arch)
        || typeof download.url !== 'string'
      ) {
        throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本下载记录格式无效');
      }
      let downloadUrl: URL;
      try {
        downloadUrl = new URL(download.url);
      } catch {
        throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本下载地址无效');
      }
      let decodedName: string;
      try {
        decodedName = decodeURIComponent(downloadUrl.pathname.split('/').at(-1) ?? '');
      } catch {
        throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本下载地址无效');
      }
      if (
        downloadUrl.protocol !== 'https:'
        || downloadUrl.origin !== baseUrl.origin
        || downloadUrl.username
        || downloadUrl.password
        || downloadUrl.search
        || downloadUrl.hash
        || !downloadUrl.pathname.startsWith(baseUrl.pathname)
        || decodedName !== download.name
      ) {
        throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 版本下载地址无效');
      }
    }
  }
  if (!versions.has(catalog.currentVersion)) {
    throw new ApiError(502, 'RELEASE_CATALOG_INVALID', 'TOS 当前版本不在版本目录中');
  }
  return catalog as DesktopReleaseCatalog;
}

function assertVersion(value: unknown): string {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    throw new ApiError(400, 'INVALID_RELEASE_VERSION', '版本号格式无效');
  }
  return value;
}

export function compareVersions(left: string, right: string): number {
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

function sortOperations(operations: ReleaseOperation[]): ReleaseOperation[] {
  return [...operations]
    .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
    .slice(0, 20);
}
