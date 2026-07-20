import type { AdminAccount } from './types';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export class ApiClientError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || !payload.success) {
    const error = payload.success
      ? { code: 'REQUEST_FAILED', message: '请求失败，请稍后重试' }
      : payload.error;
    throw new ApiClientError(error.message, error.code, response.status);
  }
  return payload.data;
}

export interface LoginResult {
  admin: AdminAccount;
  sessionToken: string;
  sessionExpiresAt: string;
  bootstrapped: boolean;
}

export function login(username: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>('/v1/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
