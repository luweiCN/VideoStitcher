import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default function applyMacosAdhocRequirement(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const requirementsPath = path.resolve('build/macos.requirements');

  execFileSync(
    'codesign',
    [
      '--force',
      '--sign',
      '-',
      '--timestamp=none',
      '--preserve-metadata=identifier,entitlements,flags',
      '--requirements',
      requirementsPath,
      appPath,
    ],
    { stdio: 'inherit' },
  );
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    stdio: 'inherit',
  });

  console.log('[发布签名] 已固定 macOS 临时签名的自动更新要求');
}
