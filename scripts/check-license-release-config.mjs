import { createPublicKey } from 'node:crypto';

const apiBaseUrl = process.env.VIDEO_STITCHER_LICENSE_API_URL?.trim() ?? '';
const publicKeyBase64 = process.env.VIDEO_STITCHER_LICENSE_SIGNING_PUBLIC_KEY_BASE64?.trim() ?? '';
const updateBaseUrl = process.env.VIDEO_STITCHER_UPDATE_BASE_URL?.trim() ?? '';

if (!apiBaseUrl) {
  throw new Error('缺少 VIDEO_STITCHER_LICENSE_API_URL，禁止生成无法联网授权的正式安装包');
}
const parsedUrl = new URL(apiBaseUrl);
if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
  throw new Error('VIDEO_STITCHER_LICENSE_API_URL 必须是无账号信息的 HTTPS 地址');
}
if (!publicKeyBase64) {
  throw new Error('缺少 VIDEO_STITCHER_LICENSE_SIGNING_PUBLIC_KEY_BASE64，禁止生成无法验签的正式安装包');
}
const publicKey = createPublicKey(Buffer.from(publicKeyBase64, 'base64').toString('utf8'));
if (publicKey.asymmetricKeyType !== 'ed25519') {
  throw new Error('授权签名公钥必须是 Ed25519 公钥');
}
if (!updateBaseUrl) {
  throw new Error('缺少 VIDEO_STITCHER_UPDATE_BASE_URL，禁止生成无法从火山云更新的正式安装包');
}
const parsedUpdateUrl = new URL(updateBaseUrl);
if (parsedUpdateUrl.protocol !== 'https:' || parsedUpdateUrl.username || parsedUpdateUrl.password) {
  throw new Error('VIDEO_STITCHER_UPDATE_BASE_URL 必须是无账号信息的 HTTPS 地址');
}

console.log('[发布检查] 授权服务、签名公钥和更新地址有效');
