const platform = process.argv.find((argument) => argument.startsWith('--platform='))?.split('=')[1];
if (platform !== 'darwin' && platform !== 'win32') {
  throw new Error('必须通过 --platform=darwin 或 --platform=win32 指定签名平台');
}

const required = platform === 'darwin'
  ? ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
  : ['CSC_LINK', 'CSC_KEY_PASSWORD'];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(`缺少正式代码签名配置：${missing.join(', ')}`);
}

console.log(`[发布检查] ${platform === 'darwin' ? 'macOS' : 'Windows'} 代码签名配置已提供`);
