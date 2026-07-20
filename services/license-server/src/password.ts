import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

interface ScryptProfile {
  version: string;
  cost: number;
  blockSize: number;
  parallelization: number;
  maxMemory: number;
}

const LEGACY_PROFILE: ScryptProfile = {
  version: 'scrypt-v1',
  cost: 16_384,
  blockSize: 8,
  parallelization: 1,
  maxMemory: 64 * 1024 * 1024,
};

// 与 OWASP 推荐的等价 scrypt 参数档位一致，同时控制函数实例的峰值内存。
const CURRENT_PROFILE: ScryptProfile = {
  version: 'scrypt-v2',
  cost: 32_768,
  blockSize: 8,
  parallelization: 3,
  maxMemory: 64 * 1024 * 1024,
};

const SCRYPT_KEY_LENGTH = 64;

function derivePassword(password: string, salt: Buffer, profile: ScryptProfile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEY_LENGTH, {
      N: profile.cost,
      r: profile.blockSize,
      p: profile.parallelization,
      maxmem: profile.maxMemory,
    }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function readProfile(
  version: string,
  cost: number,
  blockSize: number,
  parallelization: number,
): ScryptProfile | undefined {
  return [CURRENT_PROFILE, LEGACY_PROFILE].find((profile) => (
    profile.version === version
    && profile.cost === cost
    && profile.blockSize === blockSize
    && profile.parallelization === parallelization
  ));
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await derivePassword(password, salt, CURRENT_PROFILE);
  return [
    CURRENT_PROFILE.version,
    CURRENT_PROFILE.cost,
    CURRENT_PROFILE.blockSize,
    CURRENT_PROFILE.parallelization,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifyAdminPassword(password: string, encodedHash: string): Promise<boolean> {
  const [version, rawCost, rawBlockSize, rawParallelization, rawSalt, rawHash] = encodedHash.split('$');
  if (!version || !rawCost || !rawBlockSize || !rawParallelization || !rawSalt || !rawHash) {
    return false;
  }

  const cost = Number.parseInt(rawCost, 10);
  const blockSize = Number.parseInt(rawBlockSize, 10);
  const parallelization = Number.parseInt(rawParallelization, 10);
  const profile = readProfile(version, cost, blockSize, parallelization);
  if (profile === undefined) return false;

  try {
    const expected = Buffer.from(rawHash, 'base64url');
    const salt = Buffer.from(rawSalt, 'base64url');
    if (expected.length !== SCRYPT_KEY_LENGTH || salt.length !== 16) return false;
    const actual = await derivePassword(password, salt, profile);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function adminPasswordNeedsRehash(encodedHash: string): boolean {
  return !encodedHash.startsWith(`${CURRENT_PROFILE.version}$${CURRENT_PROFILE.cost}$${CURRENT_PROFILE.blockSize}$${CURRENT_PROFILE.parallelization}$`);
}
