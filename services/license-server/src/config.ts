import path from 'node:path';

export interface LicenseServerConfig {
  adminTokenHash: string;
  bootstrapAdminUsername?: string;
  allowAdminBootstrap?: boolean;
  licenseKeyPepper: string;
  signingPrivateKey: string;
  trialDays?: number;
  storage:
    | { driver: 'file'; filePath: string }
    | {
        driver: 'tos';
        accessKeyId?: string;
        accessKeySecret?: string;
        stsToken?: string;
        region: string;
        endpoint: string;
        bucket: string;
        objectKey: string;
      };
}

function requireEnvironment(name: string, environment: NodeJS.ProcessEnv): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
  workingDirectory = process.cwd(),
): LicenseServerConfig {
  const storageDriver = requireEnvironment('LICENSE_STORAGE_DRIVER', environment);
  const sharedConfig = {
    adminTokenHash: requireEnvironment('LICENSE_ADMIN_TOKEN_HASH', environment),
    bootstrapAdminUsername: environment.LICENSE_BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase() || 'owner',
    allowAdminBootstrap: parseBoolean(
      environment.LICENSE_ALLOW_ADMIN_BOOTSTRAP,
      storageDriver === 'file',
      'LICENSE_ALLOW_ADMIN_BOOTSTRAP',
    ),
    licenseKeyPepper: requireEnvironment('LICENSE_KEY_PEPPER', environment),
    signingPrivateKey: requireEnvironment('LICENSE_SIGNING_PRIVATE_KEY', environment),
    trialDays: parseTrialDays(environment.LICENSE_TRIAL_DAYS),
  };

  if (storageDriver === 'file') {
    const configuredPath = environment.LICENSE_DATA_FILE?.trim() || '.data/licenses.json';
    return {
      ...sharedConfig,
      storage: {
        driver: 'file',
        filePath: path.resolve(workingDirectory, configuredPath),
      },
    };
  }

  if (storageDriver !== 'tos') {
    throw new Error(`不支持的存储驱动: ${storageDriver}`);
  }

  return {
    ...sharedConfig,
    storage: {
      driver: 'tos',
      ...(environment.TOS_ACCESS_KEY?.trim() ? { accessKeyId: environment.TOS_ACCESS_KEY.trim() } : {}),
      ...(environment.TOS_SECRET_KEY?.trim() ? { accessKeySecret: environment.TOS_SECRET_KEY.trim() } : {}),
      ...(environment.TOS_STS_TOKEN?.trim() ? { stsToken: environment.TOS_STS_TOKEN.trim() } : {}),
      region: requireEnvironment('TOS_REGION', environment),
      endpoint: requireEnvironment('TOS_ENDPOINT', environment),
      bucket: requireEnvironment('TOS_BUCKET', environment),
      objectKey: environment.TOS_OBJECT_KEY?.trim() || 'license-platform/state.json',
    },
  };
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value.trim().toLowerCase() === 'true') return true;
  if (value.trim().toLowerCase() === 'false') return false;
  throw new Error(`${name} 必须是 true 或 false`);
}

function parseTrialDays(value: string | undefined): number {
  const trialDays = Number.parseInt(value?.trim() || '7', 10);
  if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 30) {
    throw new Error('LICENSE_TRIAL_DAYS 必须是 1 到 30 的整数');
  }
  return trialDays;
}
