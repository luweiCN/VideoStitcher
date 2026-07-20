import { createHash, createPublicKey, verify } from 'node:crypto';
import { ApiError } from './errors.js';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface DeviceRequestProof {
  method: string;
  route: string;
  body: Record<string, unknown>;
  token?: string;
  publicKey?: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(source[key])}`
  )).join(',')}}`;
}

function readRequiredHeader(request: Request, name: string, maxLength: number): string {
  const value = request.headers.get(name)?.trim();
  if (!value || value.length > maxLength) {
    throw new ApiError(401, 'DEVICE_PROOF_REQUIRED', '缺少有效的设备签名');
  }
  return value;
}

export function readDeviceRequestProof(
  request: Request,
  body: Record<string, unknown>,
  token?: string,
): DeviceRequestProof {
  return {
    method: request.method.toUpperCase(),
    route: new URL(request.url).pathname,
    body,
    ...(token === undefined ? {} : { token }),
    ...(request.headers.get('x-vs-device-public-key') === null ? {} : {
      publicKey: readRequiredHeader(request, 'x-vs-device-public-key', 256),
    }),
    timestamp: readRequiredHeader(request, 'x-vs-request-timestamp', 20),
    nonce: readRequiredHeader(request, 'x-vs-request-nonce', 64),
    signature: readRequiredHeader(request, 'x-vs-request-signature', 128),
  };
}

export function assertEd25519PublicKey(publicKey: string): void {
  try {
    if (!/^[A-Za-z0-9_-]{40,160}$/.test(publicKey)) throw new Error('编码无效');
    const key = createPublicKey({
      key: Buffer.from(publicKey, 'base64url'),
      format: 'der',
      type: 'spki',
    });
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('密钥类型无效');
  } catch {
    throw new ApiError(400, 'DEVICE_PUBLIC_KEY_INVALID', '设备公钥格式无效');
  }
}

export function verifyDeviceRequestProof(
  proof: DeviceRequestProof,
  expectedPublicKey: string,
  now: Date,
): void {
  assertEd25519PublicKey(expectedPublicKey);
  if (proof.publicKey !== undefined && proof.publicKey !== expectedPublicKey) {
    throw new ApiError(401, 'DEVICE_PROOF_INVALID', '设备签名与设备公钥不匹配');
  }
  const timestamp = Number.parseInt(proof.timestamp, 10);
  if (
    !Number.isSafeInteger(timestamp)
    || Math.abs(now.getTime() - timestamp) > MAX_CLOCK_SKEW_MS
    || !/^[A-Za-z0-9_-]{16,64}$/.test(proof.nonce)
    || !/^[A-Za-z0-9_-]{80,128}$/.test(proof.signature)
  ) {
    throw new ApiError(401, 'DEVICE_PROOF_INVALID', '设备签名已失效');
  }
  const bodyHash = createHash('sha256').update(stableStringify(proof.body)).digest('hex');
  const tokenHash = createHash('sha256').update(proof.token ?? '').digest('hex');
  const signingInput = [
    'VS-DEVICE-REQUEST-V1',
    proof.method,
    proof.route,
    proof.timestamp,
    proof.nonce,
    bodyHash,
    tokenHash,
  ].join('\n');
  const key = createPublicKey({
    key: Buffer.from(expectedPublicKey, 'base64url'),
    format: 'der',
    type: 'spki',
  });
  const valid = verify(
    null,
    Buffer.from(signingInput),
    key,
    Buffer.from(proof.signature, 'base64url'),
  );
  if (!valid) throw new ApiError(401, 'DEVICE_PROOF_INVALID', '设备签名验证失败');
}
