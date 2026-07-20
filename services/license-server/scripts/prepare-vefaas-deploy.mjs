import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deployRoot = resolve(serviceRoot, '.deploy');

const handlerSource = `let handlerModulePromise;

exports.handler = async (event, context) => {
  handlerModulePromise ??= import('./dist/src/vefaas.js');
  const handlerModule = await handlerModulePromise;
  return handlerModule.handler(event, context);
};
`;

async function run(command, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`命令执行失败：${command}，退出码 ${code ?? '无'}，信号 ${signal ?? '无'}`));
    });
  });
}

await rm(deployRoot, { recursive: true, force: true });
await mkdir(deployRoot, { recursive: true });
await cp(resolve(serviceRoot, 'dist'), resolve(deployRoot, 'dist'), { recursive: true });
await cp(resolve(serviceRoot, 'package-lock.json'), resolve(deployRoot, 'package-lock.json'));

const packageJson = JSON.parse(await readFile(resolve(serviceRoot, 'package.json'), 'utf8'));
packageJson.type = 'commonjs';
packageJson.main = 'index.js';
await writeFile(resolve(deployRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(resolve(deployRoot, 'index.js'), handlerSource);
await writeFile(resolve(deployRoot, 'dist/package.json'), '{\n  "type": "module"\n}\n');

console.log('正在安装授权服务生产依赖……');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
await run(npmCommand, ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], deployRoot);
await run(process.execPath, ['-e', "const entry = require('./index.js'); if (typeof entry.handler !== 'function') process.exit(1);"], deployRoot);
await run(process.execPath, ['--input-type=module', '-e', "const entry = await import('./dist/src/vefaas.js'); if (typeof entry.handler !== 'function') process.exit(1);"], deployRoot);
console.log('veFaaS 部署目录已生成并验证。');
