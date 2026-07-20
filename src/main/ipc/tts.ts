/**
 * 本地文本配音 IPC 处理器
 * 先接入高拟真配音的本机原型环境，后续再替换为正式的按需安装目录。
 */

import { app, shell } from 'electron';
import { trustedIpcMain as ipcMain } from './security';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { withLicenseAccess } from '@main/services/LicenseGate';

interface TtsEngineStatus {
  installed: boolean;
  engineName: string;
  message: string;
  outputDir?: string;
}

interface TtsGenerateRequest {
  text: string;
  voicePackageId: 'cosyvoice';
}

interface TtsGenerateResult {
  success: boolean;
  outputPath?: string;
  fileUrl?: string;
  duration?: number;
  message?: string;
  error?: string;
}

const ENGINE_NAME = '高拟真配音';

function getProjectRoot(): string {
  if (!app.isPackaged) {
    return path.resolve(__dirname, '../..');
  }

  return path.dirname(app.getPath('exe'));
}

function getPrototypePaths() {
  const projectRoot = getProjectRoot();
  const rootDir = path.join(projectRoot, '.demo-tools', 'cosyvoice-prototype');
  const pythonPath = path.join(rootDir, '.venv', 'Scripts', 'python.exe');
  const scriptPath = path.join(rootDir, 'run_cosyvoice2_demo.py');
  const modelPath = path.join(rootDir, 'CosyVoice', 'pretrained_models', 'CosyVoice2-0.5B');
  const outputDir = path.join(rootDir, 'output');

  return {
    rootDir,
    pythonPath,
    scriptPath,
    modelPath,
    outputDir,
  };
}

function getEngineStatus(): TtsEngineStatus {
  const paths = getPrototypePaths();
  const installed =
    fs.existsSync(paths.pythonPath) &&
    fs.existsSync(paths.scriptPath) &&
    fs.existsSync(path.join(paths.modelPath, 'llm.pt')) &&
    fs.existsSync(path.join(paths.modelPath, 'flow.pt')) &&
    fs.existsSync(path.join(paths.modelPath, 'hift.pt'));

  return {
    installed,
    engineName: ENGINE_NAME,
    message: installed ? '高拟真配音已就绪，可以生成试听。' : '高拟真配音尚未安装完整。',
    outputDir: paths.outputDir,
  };
}

async function handleGetTtsStatus(): Promise<TtsEngineStatus> {
  return getEngineStatus();
}

function extractJsonResult(output: string): Partial<TtsGenerateResult> | null {
  const line = output
    .split(/\r?\n/)
    .reverse()
    .find(item => item.startsWith('RESULT_JSON='));

  if (!line) return null;

  try {
    return JSON.parse(line.replace('RESULT_JSON=', ''));
  } catch {
    return null;
  }
}

async function handleGenerateTts(_event: Electron.IpcMainInvokeEvent, request: TtsGenerateRequest): Promise<TtsGenerateResult> {
  const text = request.text?.trim();

  if (!text) {
    return { success: false, error: '请输入需要生成配音的文本。' };
  }

  if (request.voicePackageId !== 'cosyvoice') {
    return { success: false, error: '当前版本先开放高拟真配音试听。' };
  }

  const status = getEngineStatus();
  const paths = getPrototypePaths();
  if (!status.installed) {
    return { success: false, error: status.message };
  }

  return new Promise((resolve) => {
    const child = spawn(paths.pythonPath, [paths.scriptPath, '--text', text], {
      cwd: path.dirname(paths.scriptPath),
      env: {
        ...process.env,
        PYTHONUTF8: '1',
      },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      resolve({ success: false, error: `启动配音进程失败：${error.message}` });
    });

    child.on('close', code => {
      const parsed = extractJsonResult(stdout);

      if (code === 0 && parsed?.outputPath) {
        resolve({
          success: true,
          outputPath: parsed.outputPath,
          fileUrl: `preview://${encodeURIComponent(parsed.outputPath)}`,
          duration: parsed.duration,
          message: '配音生成完成。',
        });
        return;
      }

      const finalError = stderr.trim() || stdout.trim() || `配音进程异常退出，退出码：${code}`;
      resolve({ success: false, error: finalError.slice(-1200) });
    });
  });
}

async function handleOpenTtsOutput(_event: Electron.IpcMainInvokeEvent, filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: '音频文件不存在。' };
    }

    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function registerTtsHandlers(): void {
  ipcMain.handle('tts:get-status', handleGetTtsStatus);
  ipcMain.handle('tts:generate', withLicenseAccess(handleGenerateTts));
  ipcMain.handle('tts:open-output', handleOpenTtsOutput);
}
