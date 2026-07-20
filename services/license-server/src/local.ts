import { createServer, type IncomingMessage } from 'node:http';
import { createApplication } from './app.js';

const application = createApplication();
const port = Number.parseInt(process.env.PORT || '8787', 10);

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const method = request.method || 'GET';
  const url = `http://${request.headers.host || `127.0.0.1:${port}`}${request.url || '/'}`;
  const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks);
  return new Request(url, {
    method,
    headers: request.headers as HeadersInit,
    ...(body === undefined ? {} : { body }),
  });
}

const server = createServer(async (request, response) => {
  try {
    const webResponse = await application.handle(await toWebRequest(request));
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => response.setHeader(key, value));
    response.end(Buffer.from(await webResponse.arrayBuffer()));
  } catch (error: unknown) {
    console.error('[授权服务] 本地服务器请求失败:', error);
    response.statusCode = 500;
    response.end('授权服务暂时不可用');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[授权服务] 本地控制台已启动：http://127.0.0.1:${port}`);
});
