import { createApplication } from './app.js';
import { loadConfig, type LicenseServerConfig } from './config.js';

interface ApiGatewayEvent {
  httpMethod?: string;
  path?: string;
  rawPath?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: { method?: string; sourceIp?: string };
    identity?: { sourceIp?: string };
  };
}

interface ApiGatewayResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: false;
}

export interface VeFaaSContext {
  requestId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

let application: ReturnType<typeof createApplication> | undefined;
let credentialIdentity = '';

export async function handler(event: ApiGatewayEvent, context: VeFaaSContext = {}): Promise<ApiGatewayResult> {
  const config = createRuntimeConfig(context);
  const nextCredentialIdentity = context.sessionToken || context.accessKeyId || 'environment';
  // STS 最长有效期有限，平台轮换凭据后重新创建 TOS 客户端，避免复用过期凭据。
  if (application === undefined || credentialIdentity !== nextCredentialIdentity) {
    application = createApplication(config);
    credentialIdentity = nextCredentialIdentity;
  }
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  const pathName = event.rawPath || event.path || '/';
  const headers = new Headers(event.headers as HeadersInit | undefined);
  const sourceIp = event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp;
  // 不信任客户端自报的代理头，只接受网关 requestContext 提供的来源地址。
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  if (sourceIp) {
    headers.set('x-real-ip', sourceIp);
  }
  const rawBody = event.body
    ? event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body
    : undefined;
  const request = new Request(`https://license.videostitcher.invalid${pathName}`, {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' || rawBody === undefined ? {} : { body: rawBody }),
  });
  const response = await application.handle(request);
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: await response.text(),
    isBase64Encoded: false,
  };
}

export function createRuntimeConfig(
  context: VeFaaSContext,
  environment: NodeJS.ProcessEnv = process.env,
): LicenseServerConfig {
  const config = loadConfig(environment);
  if (config.storage.driver !== 'tos') {
    throw new Error('veFaaS 生产环境必须使用 TOS 存储');
  }
  if (!context.accessKeyId || !context.secretAccessKey) {
    return config;
  }
  return {
    ...config,
    storage: {
      ...config.storage,
      accessKeyId: context.accessKeyId,
      accessKeySecret: context.secretAccessKey,
      ...(context.sessionToken === undefined ? {} : { stsToken: context.sessionToken }),
    },
  };
}
