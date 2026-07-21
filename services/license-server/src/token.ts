import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { ADMIN_ROLES, type AdminRole } from './domain.js';

export interface SessionTokenClaims {
  issuer: 'videostitcher-license';
  subject: string;
  licenseId: string;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
}

interface TokenHeader {
  algorithm: 'EdDSA';
  type: 'VS-LICENSE' | 'VS-ADMIN' | 'VS-ENTITLEMENT';
  version: 1;
}

const TOKEN_HEADER: TokenHeader = {
  algorithm: 'EdDSA',
  type: 'VS-LICENSE',
  version: 1,
};

const ADMIN_TOKEN_HEADER: TokenHeader = {
  algorithm: 'EdDSA',
  type: 'VS-ADMIN',
  version: 1,
};

const ENTITLEMENT_TOKEN_HEADER: TokenHeader = {
  algorithm: 'EdDSA',
  type: 'VS-ENTITLEMENT',
  version: 1,
};

export interface EntitlementReceiptClaims {
  issuer: 'videostitcher-entitlement';
  subject: string;
  licenseId: string;
  sessionVersion: number;
  authorized: boolean;
  plan: string;
  planId?: string;
  accessSource: 'none' | 'trial' | 'complimentary' | 'paid' | 'legacy';
  accessMode: 'package' | 'default' | 'trial' | 'legacy' | 'none';
  status: 'active' | 'suspended' | 'revoked' | 'expired';
  expiresAt?: string;
  issuedAt: number;
  validUntil: number;
  offlineGraceSeconds: number;
  policyVersion: 1;
}

export interface AdminSessionTokenClaims {
  issuer: 'videostitcher-admin';
  subject: string;
  username: string;
  role: AdminRole;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
}

export function signSessionToken(claims: SessionTokenClaims, privateKeyPem: string): string {
  const signingInput = `${encodeJson(TOKEN_HEADER)}.${encodeJson(claims)}`;
  const signature = sign(null, Buffer.from(signingInput), createPrivateKey(privateKeyPem));
  return `${signingInput}.${signature.toString('base64url')}`;
}

export function signAdminSessionToken(
  claims: AdminSessionTokenClaims,
  privateKeyPem: string,
): string {
  const signingInput = `${encodeJson(ADMIN_TOKEN_HEADER)}.${encodeJson(claims)}`;
  const signature = sign(null, Buffer.from(signingInput), createPrivateKey(privateKeyPem));
  return `${signingInput}.${signature.toString('base64url')}`;
}

export function signEntitlementReceipt(
  claims: EntitlementReceiptClaims,
  privateKeyPem: string,
): string {
  const signingInput = `${encodeJson(ENTITLEMENT_TOKEN_HEADER)}.${encodeJson(claims)}`;
  const signature = sign(null, Buffer.from(signingInput), createPrivateKey(privateKeyPem));
  return `${signingInput}.${signature.toString('base64url')}`;
}

export function verifySessionToken(
  token: string,
  publicKeyPem: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SessionTokenClaims | null {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }
  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  if (!encodedHeader || !encodedClaims || !encodedSignature) {
    return null;
  }

  try {
    const header = decodeJson(encodedHeader) as Partial<TokenHeader>;
    if (header.algorithm !== 'EdDSA' || header.type !== 'VS-LICENSE' || header.version !== 1) {
      return null;
    }
    const signingInput = `${encodedHeader}.${encodedClaims}`;
    const valid = verify(
      null,
      Buffer.from(signingInput),
      createPublicKey(publicKeyPem),
      Buffer.from(encodedSignature, 'base64url'),
    );
    if (!valid) {
      return null;
    }
    const claims = decodeJson(encodedClaims) as Partial<SessionTokenClaims>;
    if (
      claims.issuer !== 'videostitcher-license'
      || typeof claims.subject !== 'string'
      || typeof claims.licenseId !== 'string'
      || !Number.isInteger(claims.sessionVersion)
      || !Number.isInteger(claims.issuedAt)
      || !Number.isInteger(claims.expiresAt)
      || (claims.expiresAt as number) <= nowSeconds
    ) {
      return null;
    }
    return claims as SessionTokenClaims;
  } catch {
    return null;
  }
}

export function verifyAdminSessionToken(
  token: string,
  publicKeyPem: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): AdminSessionTokenClaims | null {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }
  const [encodedHeader, encodedClaims, encodedSignature] = segments;
  if (!encodedHeader || !encodedClaims || !encodedSignature) {
    return null;
  }

  try {
    const header = decodeJson(encodedHeader) as Partial<TokenHeader>;
    if (header.algorithm !== 'EdDSA' || header.type !== 'VS-ADMIN' || header.version !== 1) {
      return null;
    }
    const signingInput = `${encodedHeader}.${encodedClaims}`;
    const valid = verify(
      null,
      Buffer.from(signingInput),
      createPublicKey(publicKeyPem),
      Buffer.from(encodedSignature, 'base64url'),
    );
    if (!valid) {
      return null;
    }
    const claims = decodeJson(encodedClaims) as Partial<AdminSessionTokenClaims>;
    if (
      claims.issuer !== 'videostitcher-admin'
      || typeof claims.subject !== 'string'
      || typeof claims.username !== 'string'
      || !ADMIN_ROLES.includes(claims.role as AdminRole)
      || !Number.isInteger(claims.sessionVersion)
      || !Number.isInteger(claims.issuedAt)
      || !Number.isInteger(claims.expiresAt)
      || (claims.expiresAt as number) <= nowSeconds
    ) {
      return null;
    }
    return claims as AdminSessionTokenClaims;
  } catch {
    return null;
  }
}

export function getPublicKeyPem(privateKeyPem: string): string {
  return createPublicKey(createPrivateKey(privateKeyPem))
    .export({ format: 'pem', type: 'spki' })
    .toString();
}
