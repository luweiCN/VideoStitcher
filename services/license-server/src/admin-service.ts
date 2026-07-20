import { createHash, randomUUID } from 'node:crypto';
import {
  addAuditEvent,
  normalizeAdminUsername,
  safeCompareHex,
  toPublicAdmin,
  type AdminRecord,
  type AdminRole,
  type AdminStatus,
  type PublicAdminRecord,
} from './domain.js';
import { ApiError } from './errors.js';
import { adminPasswordNeedsRehash, hashAdminPassword, verifyAdminPassword } from './password.js';
import { mutateDatabase, type LicenseStorage } from './storage.js';
import { signAdminSessionToken, verifyAdminSessionToken } from './token.js';

const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_SECONDS = 15 * 60;

interface AdminServiceOptions {
  storage: LicenseStorage;
  signingPrivateKey: string;
  signingPublicKey: string;
  bootstrapUsername?: string;
  bootstrapPasswordHash: string;
  allowBootstrap?: boolean;
  now?: () => Date;
}

export interface CreateAdminInput {
  username: string;
  displayName: string;
  password: string;
  role: AdminRole;
}

export interface UpdateAdminInput {
  displayName?: string;
  role?: AdminRole;
  status?: AdminStatus;
  password?: string;
}

interface LoginSuccess {
  admin: PublicAdminRecord;
  sessionToken: string;
  sessionExpiresAt: string;
  bootstrapped: boolean;
}

type LoginMutationResult =
  | { status: 'success'; admin: AdminRecord }
  | { status: 'invalid' };

export class AdminService {
  private readonly now: () => Date;
  private readonly bootstrapUsername: string;
  private readonly dummyPasswordHash: Promise<string>;

  public constructor(private readonly options: AdminServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.bootstrapUsername = normalizeAdminUsername(options.bootstrapUsername ?? 'owner');
    this.assertUsername(this.bootstrapUsername);
    this.dummyPasswordHash = hashAdminPassword(randomUUID());
  }

  public async login(username: string, password: string): Promise<LoginSuccess> {
    const normalizedUsername = normalizeAdminUsername(username);
    this.assertUsername(normalizedUsername);
    this.assertPassword(password);
    const { database } = await this.options.storage.read();
    if (database.admins.length === 0) {
      if (
        this.options.allowBootstrap === false
        || await this.options.storage.hasBootstrapMarker?.() === true
      ) {
        throw new ApiError(503, 'ADMIN_BOOTSTRAP_DISABLED', '管理员初始化已关闭，请联系服务维护人员');
      }
      return this.bootstrapOwner(normalizedUsername, password);
    }

    const knownAdmin = database.admins.find((admin) => admin.username === normalizedUsername);
    if (knownAdmin === undefined || knownAdmin.status !== 'active') {
      await verifyAdminPassword(password, await this.dummyPasswordHash);
      throw new ApiError(401, 'ADMIN_LOGIN_INVALID', '用户名或密码错误');
    }

    const now = this.now();
    const result = await mutateDatabase<LoginMutationResult>(this.options.storage, async (currentDatabase) => {
      const admin = currentDatabase.admins.find((candidate) => candidate.id === knownAdmin.id);
      if (admin === undefined || admin.status !== 'active') {
        return { status: 'invalid' };
      }
      if (admin.lockedUntil !== undefined && new Date(admin.lockedUntil).getTime() > now.getTime()) {
        throw new ApiError(429, 'ADMIN_ACCOUNT_LOCKED', '登录失败次数过多，请 15 分钟后重试');
      }
      const passwordValid = await verifyAdminPassword(password, admin.passwordHash);
      if (!passwordValid) {
        admin.failedLoginAttempts += 1;
        if (admin.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
          admin.lockedUntil = new Date(now.getTime() + ACCOUNT_LOCK_SECONDS * 1000).toISOString();
          admin.failedLoginAttempts = 0;
        }
        admin.updatedAt = now.toISOString();
        addAuditEvent(currentDatabase, {
          actorType: 'system',
          actorId: 'admin-login',
          action: 'admin.login_failed',
          targetType: 'admin',
          targetId: admin.id,
        }, now);
        return { status: 'invalid' };
      }

      if (adminPasswordNeedsRehash(admin.passwordHash)) {
        admin.passwordHash = await hashAdminPassword(password);
      }
      admin.failedLoginAttempts = 0;
      delete admin.lockedUntil;
      admin.lastLoginAt = now.toISOString();
      admin.updatedAt = now.toISOString();
      addAuditEvent(currentDatabase, {
        actorType: 'admin',
        actorId: admin.id,
        action: 'admin.login_succeeded',
        targetType: 'admin',
        targetId: admin.id,
      }, now);
      return { status: 'success', admin: structuredClone(admin) };
    });

    if (result.status !== 'success') {
      throw new ApiError(401, 'ADMIN_LOGIN_INVALID', '用户名或密码错误');
    }
    await this.options.storage.writeBootstrapMarker?.();
    return this.createLoginSuccess(result.admin, false, now);
  }

  public async authenticate(sessionToken: string): Promise<PublicAdminRecord> {
    const now = this.now();
    const claims = verifyAdminSessionToken(
      sessionToken,
      this.options.signingPublicKey,
      Math.floor(now.getTime() / 1000),
    );
    if (claims === null) {
      throw new ApiError(401, 'ADMIN_AUTH_INVALID', '登录已失效，请重新登录');
    }
    const { database } = await this.options.storage.read();
    const admin = database.admins.find((candidate) => candidate.id === claims.subject);
    if (
      admin === undefined
      || admin.status !== 'active'
      || admin.sessionVersion !== claims.sessionVersion
      || admin.username !== claims.username
      || admin.role !== claims.role
    ) {
      throw new ApiError(401, 'ADMIN_AUTH_INVALID', '登录已失效，请重新登录');
    }
    return toPublicAdmin(admin);
  }

  public async logout(actor: PublicAdminRecord): Promise<{ loggedOut: true }> {
    const now = this.now();
    return mutateDatabase(this.options.storage, (database) => {
      const admin = database.admins.find((candidate) => candidate.id === actor.id);
      if (admin === undefined || admin.status !== 'active') {
        throw new ApiError(401, 'ADMIN_AUTH_INVALID', '登录已失效，请重新登录');
      }
      admin.sessionVersion += 1;
      admin.updatedAt = now.toISOString();
      addAuditEvent(database, {
        actorType: 'admin',
        actorId: actor.id,
        action: 'admin.logged_out',
        targetType: 'admin',
        targetId: actor.id,
      }, now);
      return { loggedOut: true };
    });
  }

  public async listAccounts(actor: PublicAdminRecord): Promise<{ admins: PublicAdminRecord[] }> {
    this.assertOwner(actor);
    const { database } = await this.options.storage.read();
    return {
      admins: database.admins
        .map(toPublicAdmin)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    };
  }

  public async changeOwnPassword(
    actor: PublicAdminRecord,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changed: true }> {
    this.assertPassword(currentPassword);
    this.assertPassword(newPassword);
    if (currentPassword === newPassword) {
      throw new ApiError(409, 'ADMIN_PASSWORD_UNCHANGED', '新密码不能与当前密码相同');
    }
    const now = this.now();

    return mutateDatabase(this.options.storage, async (database) => {
      const admin = database.admins.find((candidate) => candidate.id === actor.id);
      if (admin === undefined || admin.status !== 'active') {
        throw new ApiError(401, 'ADMIN_AUTH_INVALID', '登录已失效，请重新登录');
      }
      const passwordValid = await verifyAdminPassword(currentPassword, admin.passwordHash);
      if (!passwordValid) {
        throw new ApiError(401, 'ADMIN_CURRENT_PASSWORD_INVALID', '当前密码错误');
      }

      admin.passwordHash = await hashAdminPassword(newPassword);
      admin.sessionVersion += 1;
      admin.failedLoginAttempts = 0;
      delete admin.lockedUntil;
      admin.updatedAt = now.toISOString();
      addAuditEvent(database, {
        actorType: 'admin',
        actorId: actor.id,
        action: 'admin.password_changed',
        targetType: 'admin',
        targetId: actor.id,
      }, now);
      return { changed: true };
    });
  }

  public async createAccount(
    actor: PublicAdminRecord,
    input: CreateAdminInput,
  ): Promise<{ admin: PublicAdminRecord }> {
    this.assertOwner(actor);
    const username = normalizeAdminUsername(input.username);
    this.assertUsername(username);
    this.assertDisplayName(input.displayName);
    this.assertPassword(input.password);
    const passwordHash = await hashAdminPassword(input.password);
    const now = this.now();

    return mutateDatabase(this.options.storage, (database) => {
      if (database.admins.some((admin) => admin.username === username)) {
        throw new ApiError(409, 'ADMIN_USERNAME_EXISTS', '该管理员用户名已存在');
      }
      const admin: AdminRecord = {
        id: randomUUID(),
        username,
        displayName: input.displayName,
        role: input.role,
        status: 'active',
        passwordHash,
        sessionVersion: 1,
        failedLoginAttempts: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: actor.id,
      };
      database.admins.push(admin);
      addAuditEvent(database, {
        actorType: 'admin',
        actorId: actor.id,
        action: 'admin.created',
        targetType: 'admin',
        targetId: admin.id,
        metadata: { username, role: admin.role },
      }, now);
      return { admin: toPublicAdmin(admin) };
    });
  }

  public async updateAccount(
    actor: PublicAdminRecord,
    adminId: string,
    input: UpdateAdminInput,
  ): Promise<{ admin: PublicAdminRecord }> {
    this.assertOwner(actor);
    if (input.displayName !== undefined) this.assertDisplayName(input.displayName);
    if (input.password !== undefined) this.assertPassword(input.password);
    const passwordHash = input.password === undefined
      ? undefined
      : await hashAdminPassword(input.password);
    const now = this.now();

    return mutateDatabase(this.options.storage, (database) => {
      const admin = database.admins.find((candidate) => candidate.id === adminId);
      if (admin === undefined) {
        throw new ApiError(404, 'ADMIN_NOT_FOUND', '管理员账号不存在');
      }
      const nextRole = input.role ?? admin.role;
      const nextStatus = input.status ?? admin.status;
      if (admin.id === actor.id && (nextRole !== 'owner' || nextStatus !== 'active')) {
        throw new ApiError(409, 'ADMIN_SELF_LOCKOUT', '不能停用自己或移除自己的所有者权限');
      }
      const activeOwnerCount = database.admins.filter((candidate) => {
        if (candidate.id === admin.id) return nextRole === 'owner' && nextStatus === 'active';
        return candidate.role === 'owner' && candidate.status === 'active';
      }).length;
      if (activeOwnerCount === 0) {
        throw new ApiError(409, 'ADMIN_LAST_OWNER', '必须至少保留一个启用中的所有者账号');
      }

      const invalidatesSession = nextRole !== admin.role
        || nextStatus !== admin.status
        || passwordHash !== undefined;
      if (input.displayName !== undefined) admin.displayName = input.displayName;
      admin.role = nextRole;
      admin.status = nextStatus;
      if (passwordHash !== undefined) admin.passwordHash = passwordHash;
      if (invalidatesSession) admin.sessionVersion += 1;
      admin.failedLoginAttempts = 0;
      delete admin.lockedUntil;
      admin.updatedAt = now.toISOString();
      addAuditEvent(database, {
        actorType: 'admin',
        actorId: actor.id,
        action: 'admin.updated',
        targetType: 'admin',
        targetId: admin.id,
        metadata: {
          role: admin.role,
          status: admin.status,
          passwordReset: passwordHash !== undefined,
        },
      }, now);
      return { admin: toPublicAdmin(admin) };
    });
  }

  private async bootstrapOwner(username: string, password: string): Promise<LoginSuccess> {
    const passwordHash = createHash('sha256').update(password).digest('hex');
    if (
      username !== this.bootstrapUsername
      || !safeCompareHex(passwordHash, this.options.bootstrapPasswordHash)
    ) {
      throw new ApiError(401, 'ADMIN_LOGIN_INVALID', '用户名或密码错误');
    }
    const securePasswordHash = await hashAdminPassword(password);
    const now = this.now();
    const admin = await mutateDatabase(this.options.storage, (database) => {
      if (database.admins.length > 0) {
        throw new ApiError(409, 'ADMIN_BOOTSTRAP_COMPLETE', '所有者账号已经创建，请重新登录');
      }
      const record: AdminRecord = {
        id: randomUUID(),
        username,
        displayName: '系统所有者',
        role: 'owner',
        status: 'active',
        passwordHash: securePasswordHash,
        sessionVersion: 1,
        failedLoginAttempts: 0,
        lastLoginAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      database.admins.push(record);
      addAuditEvent(database, {
        actorType: 'system',
        actorId: 'bootstrap',
        action: 'admin.bootstrapped',
        targetType: 'admin',
        targetId: record.id,
        metadata: { username },
      }, now);
      return structuredClone(record);
    });
    await this.options.storage.writeBootstrapMarker?.();
    return this.createLoginSuccess(admin, true, now);
  }

  private createLoginSuccess(admin: AdminRecord, bootstrapped: boolean, now: Date): LoginSuccess {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const expiresAt = issuedAt + ADMIN_SESSION_TTL_SECONDS;
    return {
      admin: toPublicAdmin(admin),
      sessionToken: signAdminSessionToken({
        issuer: 'videostitcher-admin',
        subject: admin.id,
        username: admin.username,
        role: admin.role,
        sessionVersion: admin.sessionVersion,
        issuedAt,
        expiresAt,
      }, this.options.signingPrivateKey),
      sessionExpiresAt: new Date(expiresAt * 1000).toISOString(),
      bootstrapped,
    };
  }

  private assertOwner(admin: PublicAdminRecord): void {
    if (admin.role !== 'owner') {
      throw new ApiError(403, 'ADMIN_OWNER_REQUIRED', '只有所有者可以管理管理员账号');
    }
  }

  private assertUsername(username: string): void {
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      throw new ApiError(400, 'ADMIN_USERNAME_INVALID', '用户名需为 3 到 32 位小写字母、数字、点、下划线或连字符');
    }
  }

  private assertDisplayName(displayName: string): void {
    if (displayName.length < 1 || displayName.length > 40) {
      throw new ApiError(400, 'ADMIN_DISPLAY_NAME_INVALID', '管理员名称需为 1 到 40 个字符');
    }
  }

  private assertPassword(password: string): void {
    if (password.length < 10 || password.length > 128) {
      throw new ApiError(400, 'ADMIN_PASSWORD_INVALID', '密码需为 10 到 128 个字符');
    }
  }
}
