/**
 * 视频台词识别服务
 *
 * 流程：
 * 1. 从视频提取音频
 * 2. 音频降噪、人声增强、单声道、统一音量
 * 3. 使用 silencedetect 做轻量 VAD，找出有人声的片段
 * 4. 只把有人声片段送入 Whisper 识别
 * 5. 输出 TXT 与 SRT
 */

import fs from 'fs';
import https from 'https';
import os from 'os';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { app } from 'electron';
import { getFfmpegPath, runFfmpeg } from '@shared/ffmpeg';
import { getFfprobePath } from '@shared/ffmpeg/ffprobe';

export interface SubtitleExtractRequest {
  videos: string[];
  ranges?: SubtitleTimeRange[];
  model?: string;
  language?: string;
  vadThresholdDb?: number;
  minSpeechDuration?: number;
}

export interface SubtitleTimeRange {
  path: string;
  start: number;
  end: number;
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface SubtitleExtractResult {
  success: boolean;
  path: string;
  name: string;
  text: string;
  srt: string;
  segments: SubtitleSegment[];
  duration?: number;
  error?: string;
}

export interface SubtitleModelStatus {
  usable: boolean;
  engineReady: boolean;
  engineType: 'external' | 'whisper.cpp-gpu' | 'whisper.cpp-cpu' | 'missing';
  enginePath?: string;
  models: SubtitleModelItem[];
  message: string;
}

export interface SubtitleModelItem {
  id: 'small' | 'medium' | 'large-v3';
  name: string;
  description: string;
  quality: string;
  speed: string;
  hardware: string;
  sizeLabel: string;
  fileName: string;
  url: string;
  path: string;
  downloaded: boolean;
  recommended?: boolean;
}

export interface SubtitleModelDownloadProgress {
  modelId: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  status: 'downloading' | 'done' | 'error';
}

export interface SubtitleExtractProgress {
  status: 'start' | 'done' | 'error';
  index: number;
  total: number;
  path: string;
  result?: SubtitleExtractResult;
  error?: string;
}

interface SpeechRange {
  start: number;
  end: number;
}

interface SilenceRange {
  start: number;
  end: number;
}

interface CommandSpec {
  command: string;
  args: string[];
}

interface WhisperJsonToken {
  text?: string;
  p?: number;
}

interface WhisperJsonSegment {
  text?: string;
  tokens?: WhisperJsonToken[];
}

interface WhisperJsonOutput {
  transcription?: WhisperJsonSegment[];
}

const DEFAULT_VAD_THRESHOLD_DB = -35;
const DEFAULT_MIN_SPEECH_DURATION = 0.6;
const COMMON_HALLUCINATION_PATTERNS = [
  /请不吝点赞.*订阅.*转发.*打赏.*支持.*明镜.*点点栏目/i,
  /请不吝点赞订阅转发打赏支持明镜与点点栏目/i,
];
const DEFAULT_MODEL_BASE_URL = 'https://modelscope.cn/api/v1/models/iceCream2025/whisper.cpp/repo?Revision=master&FilePath=';
const MODEL_BASE_URL = process.env.WHISPER_MODEL_BASE_URL || DEFAULT_MODEL_BASE_URL;
const MODEL_CONFIGS: Array<Omit<SubtitleModelItem, 'url' | 'path' | 'downloaded'>> = [
  {
    id: 'small',
    name: 'small',
    description: '体积较小，速度快，适合普通电脑和日常短视频。',
    quality: '普通',
    speed: '快',
    hardware: '普通电脑',
    sizeLabel: '约 460MB',
    fileName: 'ggml-small.bin',
    recommended: true,
  },
  {
    id: 'medium',
    name: 'medium',
    description: '识别质量更好，适合对文案准确率要求更高的场景。',
    quality: '较好',
    speed: '中等',
    hardware: '建议独显或较新的 CPU',
    sizeLabel: '约 1.5GB',
    fileName: 'ggml-medium.bin',
  },
  {
    id: 'large-v3',
    name: 'large-v3',
    description: '质量最高，适合配置较高的电脑和高质量识别。',
    quality: '最高',
    speed: '较慢',
    hardware: '建议高性能独显',
    sizeLabel: '约 3GB',
    fileName: 'ggml-large-v3.bin',
  },
];

MODEL_CONFIGS.forEach((model) => {
  if (model.id === 'small') {
    model.description = '体积较小，速度快，适合普通电脑和日常短视频快速识别。';
    model.quality = '普通';
    model.speed = '快';
    model.hardware = '普通电脑';
    model.sizeLabel = '约 460MB';
    model.recommended = false;
  }

  if (model.id === 'medium') {
    model.description = '识别质量更好，适合对文案准确率要求更高的场景。';
    model.quality = '较好';
    model.speed = '中等';
    model.hardware = '建议独显或较新的 CPU';
    model.sizeLabel = '约 1.5GB';
    model.recommended = false;
  }

  if (model.id === 'large-v3') {
    model.description = '推荐模型，识别质量最高，更适合台词、口播和复杂背景音场景。';
    model.quality = '最高';
    model.speed = '较慢';
    model.hardware = '建议高性能独显或较新的多核 CPU';
    model.sizeLabel = '约 3GB';
    model.recommended = true;
  }
});

function parseCommandLine(commandLine: string): CommandSpec {
  const parts = commandLine.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(part => part.replace(/^"|"$/g, '')) || [];
  return {
    command: parts[0] || 'whisper',
    args: parts.slice(1),
  };
}

function getModelDir(): string {
  return path.join(app.getPath('userData'), 'models', 'whisper');
}

function getModelUrl(fileName: string): string {
  if (MODEL_BASE_URL.includes('{fileName}')) {
    return MODEL_BASE_URL.replace('{fileName}', encodeURIComponent(fileName));
  }

  if (MODEL_BASE_URL.endsWith('=') || MODEL_BASE_URL.endsWith('/')) {
    return `${MODEL_BASE_URL}${MODEL_BASE_URL.endsWith('=') ? encodeURIComponent(fileName) : fileName}`;
  }

  return `${MODEL_BASE_URL}/${fileName}`;
}

function getModelPath(fileName: string): string {
  return path.join(getModelDir(), fileName);
}

function getModelConfig(modelId: string): Omit<SubtitleModelItem, 'url' | 'path' | 'downloaded'> {
  return MODEL_CONFIGS.find(model => model.id === modelId) || MODEL_CONFIGS[0];
}

function getModelItems(): SubtitleModelItem[] {
  return MODEL_CONFIGS.map(model => {
    const modelPath = getModelPath(model.fileName);
    return {
      ...model,
      url: getModelUrl(model.fileName),
      path: modelPath,
      downloaded: fs.existsSync(modelPath),
    };
  });
}

function getWhisperCppCandidates(preferGpu = true): Array<{ path: string; type: 'whisper.cpp-gpu' | 'whisper.cpp-cpu' }> {
  const executable = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  const gpuCandidates = [
    path.join(app.getPath('userData'), 'engines', 'whisper.cpp-cuda', executable),
    path.join(process.cwd(), 'bin', 'whisper.cpp-cuda', executable),
    path.join(process.cwd(), '.demo-tools', 'whisper', 'whisper-cublas-12.4.0-bin-x64', 'Release', executable),
  ];
  const cpuCandidates = [
    path.join(app.getPath('userData'), 'engines', 'whisper.cpp', executable),
    path.join(process.cwd(), 'bin', 'whisper.cpp', executable),
  ];

  if (app.isPackaged) {
    gpuCandidates.push(path.join(process.resourcesPath, 'bin', 'whisper.cpp-cuda', executable));
    gpuCandidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'whisper.cpp-cuda', executable));
    cpuCandidates.push(path.join(process.resourcesPath, 'bin', 'whisper.cpp', executable));
    cpuCandidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'whisper.cpp', executable));
  }

  const gpu = gpuCandidates.map(candidate => ({ path: candidate, type: 'whisper.cpp-gpu' as const }));
  const cpu = cpuCandidates.map(candidate => ({ path: candidate, type: 'whisper.cpp-cpu' as const }));
  return preferGpu ? [...gpu, ...cpu] : [...cpu, ...gpu];
}

function getWhisperCppEngine(): { path: string; type: 'whisper.cpp-gpu' | 'whisper.cpp-cpu' } | null {
  return getWhisperCppCandidates().find(candidate => fs.existsSync(candidate.path)) || null;
}

function runCommand(command: string, args: string[], options: { cwd?: string; timeout?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeout ?? 1000 * 60 * 20,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 20,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\n${stderr}`));
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

async function checkWhisperAvailable(command: string): Promise<boolean> {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  try {
    await runCommand(lookupCommand, [command], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function getSubtitleModelStatus(): Promise<SubtitleModelStatus> {
  const externalCommand = parseCommandLine(process.env.WHISPER_COMMAND || 'whisper').command;
  const hasExternalWhisper = await checkWhisperAvailable(externalCommand);
  const whisperCppEngine = getWhisperCppEngine();
  const models = getModelItems();
  const hasDownloadedModel = models.some(model => model.downloaded);

  if (whisperCppEngine && hasDownloadedModel) {
    return {
      usable: true,
      engineReady: true,
      engineType: whisperCppEngine.type,
      enginePath: whisperCppEngine.path,
      models,
      message: `识别引擎已就绪，已下载 ${models.filter(model => model.downloaded).length} 个模型。`,
    };
  }

  if (whisperCppEngine && !hasDownloadedModel) {
    return {
      usable: false,
      engineReady: true,
      engineType: whisperCppEngine.type,
      enginePath: whisperCppEngine.path,
      models,
      message: '已检测到识别引擎，请先选择并下载一个模型。',
    };
  }

  if (hasExternalWhisper && hasDownloadedModel) {
    return {
      usable: true,
      engineReady: true,
      engineType: 'external',
      enginePath: externalCommand,
      models,
      message: '未找到 whisper.cpp 引擎，将使用本机 Whisper 命令兜底。成品包建议内置 whisper.cpp 引擎。',
    };
  }

  if (hasExternalWhisper && !hasDownloadedModel) {
    return {
      usable: false,
      engineReady: true,
      engineType: 'external',
      enginePath: externalCommand,
      models,
      message: '已检测到本机 Whisper 命令，但仍需要先选择并下载一个模型。',
    };
  }

  return {
    usable: false,
    engineReady: false,
    engineType: 'missing',
    models,
    message: hasDownloadedModel
      ? '模型已存在，但未找到识别引擎。成品包需要内置 whisper.cpp 引擎，或设置 WHISPER_COMMAND。'
      : '未找到识别引擎。成品包需要内置 whisper.cpp 引擎，模型由用户按需下载。',
  };
}

function downloadFile(
  url: string,
  targetPath: string,
  onProgress?: (progress: Omit<SubtitleModelDownloadProgress, 'modelId' | 'status'>) => void,
  redirectCount = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('模型下载重定向次数过多'));
      return;
    }

    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) VideoStitcher/1.0 Safari/537.36',
        'Accept': 'application/octet-stream,*/*',
        'Referer': 'https://modelscope.cn/models/iceCream2025/whisper.cpp',
      },
    }, (response) => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        const nextUrl = new URL(location, url).toString();
        downloadFile(nextUrl, targetPath, onProgress, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        if (statusCode === 403) {
          reject(new Error('模型下载被服务器拒绝（403）。请稍后重试，或检查当前网络是否能访问 ModelScope。'));
          return;
        }
        reject(new Error(`模型下载失败，HTTP 状态码：${statusCode}`));
        return;
      }

      const tempPath = `${targetPath}.download`;
      const fileStream = fs.createWriteStream(tempPath);
      const totalBytes = Number(response.headers['content-length'] || 0);
      let downloadedBytes = 0;
      const cleanTempFile = () => {
        fs.rmSync(tempPath, { force: true });
      };

      response.on('data', chunk => {
        downloadedBytes += chunk.length;
        onProgress?.({
          downloadedBytes,
          totalBytes,
          percent: totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0,
        });
      });
      response.on('error', (error) => {
        cleanTempFile();
        reject(error);
      });
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => {
          fs.renameSync(tempPath, targetPath);
          resolve();
        });
      });
      fileStream.on('error', (error) => {
        cleanTempFile();
        reject(error);
      });
    });

    request.on('error', (error) => {
      fs.rmSync(`${targetPath}.download`, { force: true });
      reject(error);
    });
  });
}

export async function downloadSubtitleModel(
  modelId = 'large-v3',
  onProgress?: (progress: SubtitleModelDownloadProgress) => void
): Promise<SubtitleModelStatus> {
  const model = getModelConfig(modelId);
  const modelDir = getModelDir();
  const modelPath = getModelPath(model.fileName);
  fs.mkdirSync(modelDir, { recursive: true });

  if (!fs.existsSync(modelPath)) {
    try {
      await downloadFile(getModelUrl(model.fileName), modelPath, progress => {
        onProgress?.({
          modelId: model.id,
          ...progress,
          status: 'downloading',
        });
      });
    } catch (error) {
      onProgress?.({
        modelId: model.id,
        downloadedBytes: 0,
        totalBytes: 0,
        percent: 0,
        status: 'error',
      });
      throw error;
    }
  }

  onProgress?.({
    modelId: model.id,
    downloadedBytes: fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0,
    totalBytes: fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0,
    percent: 100,
    status: 'done',
  });

  return getSubtitleModelStatus();
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'videostitcher-subtitle-'));
}

async function getMediaDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await runCommand(getFfprobePath(), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { timeout: 10000 });
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

async function prepareAudio(videoPath: string, outputPath: string, range?: Omit<SubtitleTimeRange, 'path'>): Promise<void> {
  const mainFilter = [
    'highpass=f=80',
    'lowpass=f=7600',
    'afftdn=nf=-25',
    'acompressor=threshold=-18dB:ratio=3:attack=5:release=80',
    'dynaudnorm=f=150:g=15',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
  ].join(',');

  const baseArgs = [
    '-y',
    '-i', videoPath,
    ...(range ? ['-ss', range.start.toFixed(3), '-t', (range.end - range.start).toFixed(3)] : []),
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-af', mainFilter,
    outputPath,
  ];

  try {
    await runFfmpeg(baseArgs);
  } catch {
    // 个别 FFmpeg 构建可能缺少某些高级滤镜，降级到稳定的单声道与响度标准化。
    await runFfmpeg([
      '-y',
      '-i', videoPath,
      ...(range ? ['-ss', range.start.toFixed(3), '-t', (range.end - range.start).toFixed(3)] : []),
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      outputPath,
    ]);
  }
}

function runFfmpegWithStderr(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) {
        resolve(stderr);
      } else {
        reject(new Error(`ffmpeg exit code=${code}\n${stderr}`));
      }
    });
  });
}

async function detectSpeechRanges(audioPath: string, duration: number, thresholdDb: number, minSpeechDuration: number): Promise<SpeechRange[]> {
  const stderr = await runFfmpegWithStderr([
    '-i', audioPath,
    '-af', `silencedetect=n=${thresholdDb}dB:d=0.35`,
    '-f', 'null',
    '-',
  ]);

  const silences: SilenceRange[] = [];
  let currentSilenceStart: number | null = null;

  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
    if (startMatch) {
      currentSilenceStart = Number.parseFloat(startMatch[1]);
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([0-9.]+)/);
    if (endMatch && currentSilenceStart !== null) {
      silences.push({
        start: currentSilenceStart,
        end: Number.parseFloat(endMatch[1]),
      });
      currentSilenceStart = null;
    }
  }

  if (currentSilenceStart !== null && duration > currentSilenceStart) {
    silences.push({ start: currentSilenceStart, end: duration });
  }

  const speechRanges: SpeechRange[] = [];
  let cursor = 0;

  for (const silence of silences) {
    if (silence.start > cursor) {
      speechRanges.push({
        start: Math.max(0, cursor - 0.2),
        end: Math.min(duration, silence.start + 0.2),
      });
    }
    cursor = Math.max(cursor, silence.end);
  }

  if (duration > cursor) {
    speechRanges.push({
      start: Math.max(0, cursor - 0.2),
      end: duration,
    });
  }

  const merged = speechRanges
    .filter(range => range.end - range.start >= minSpeechDuration)
    .reduce<SpeechRange[]>((acc, range) => {
      const last = acc[acc.length - 1];
      if (last && range.start - last.end < 0.5) {
        last.end = Math.max(last.end, range.end);
      } else {
        acc.push({ ...range });
      }
      return acc;
    }, []);

  if (merged.length > 0) {
    return merged;
  }

  const totalSilenceDuration = silences.reduce((total, silence) => {
    return total + Math.max(0, Math.min(duration, silence.end) - Math.max(0, silence.start));
  }, 0);

  // 接近全程静音时不送给 Whisper；否则保留较短的疑似人声，避免误删短口播。
  if (duration > 0 && totalSilenceDuration / duration >= 0.95) {
    return [];
  }

  return speechRanges.filter(range => range.end - range.start >= 0.15);
}

async function extractAudioSegment(audioPath: string, segmentPath: string, range: SpeechRange): Promise<void> {
  await runFfmpeg([
    '-y',
    '-ss', range.start.toFixed(3),
    '-t', (range.end - range.start).toFixed(3),
    '-i', audioPath,
    '-ac', '1',
    '-ar', '16000',
    segmentPath,
  ]);
}

async function runWhisper(segmentPath: string, outputDir: string, model: string, language: string): Promise<string> {
  const modelConfig = getModelConfig(model);
  const modelPath = getModelPath(modelConfig.fileName);
  if (!fs.existsSync(modelPath)) {
    throw new Error(`未找到 ${modelConfig.name} 字幕识别模型，请先在页面下载模型。`);
  }

  const engines = getWhisperCppCandidates().filter(candidate => fs.existsSync(candidate.path));
  if (engines.length > 0) {
    const outputBase = path.join(outputDir, path.basename(segmentPath, path.extname(segmentPath)));
    let lastError: Error | null = null;
    for (const engine of engines) {
      try {
        await runCommand(engine.path, [
          '-m', modelPath,
          '-f', segmentPath,
          '-l', language,
          '-nf',
          '-sns',
          '-tp', '0.00',
          '-otxt',
          '-ojf',
          '-of', outputBase,
        ], { timeout: 1000 * 60 * 20 });
        lastError = null;
        break;
      } catch (error) {
        lastError = error as Error;
        if (engine.type === 'whisper.cpp-cpu') {
          throw lastError;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  } else {
    const commandSpec = parseCommandLine(process.env.WHISPER_COMMAND || 'whisper');
    const commandExists = await checkWhisperAvailable(commandSpec.command);
    if (!commandExists) {
      throw new Error('未找到字幕识别引擎。成品包需要内置 whisper.cpp，开发环境可设置 WHISPER_COMMAND。');
    }

    const args = [
      ...commandSpec.args,
      segmentPath,
      '--model', modelConfig.id,
      '--language', language,
      '--task', 'transcribe',
      '--output_format', 'txt',
      '--output_dir', outputDir,
      '--fp16', 'False',
      '--temperature', '0',
      '--condition_on_previous_text', 'False',
    ];

    await runCommand(commandSpec.command, args, { timeout: 1000 * 60 * 20 });
  }

  const baseName = path.basename(segmentPath, path.extname(segmentPath));
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  if (fs.existsSync(jsonPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as WhisperJsonOutput;
      return filterWhisperJson(json);
    } catch {
      // JSON 结果异常时降级读取 TXT，避免影响正常识别。
    }
  }

  const txtPath = path.join(outputDir, `${baseName}.txt`);
  if (fs.existsSync(txtPath)) {
    return filterWhisperText(fs.readFileSync(txtPath, 'utf-8'));
  }

  const txtFile = fs.readdirSync(outputDir).find(file => file.toLowerCase().endsWith('.txt'));
  if (txtFile) {
    return filterWhisperText(fs.readFileSync(path.join(outputDir, txtFile), 'utf-8'));
  }

  return '';
}

function filterWhisperText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const normalizedLines = lines.map(normalizeWhisperText);
  const counts = new Map<string, number>();
  normalizedLines.forEach(line => counts.set(line, (counts.get(line) || 0) + 1));
  const repeatedCount = normalizedLines.filter(line => (counts.get(line) || 0) >= 3).length;

  if (lines.length >= 3 && repeatedCount / lines.length >= 0.5) {
    return '';
  }

  return lines
    .filter(line => !isCommonHallucination(line))
    .join('\n');
}

function filterWhisperJson(json: WhisperJsonOutput): string {
  const segments = (json.transcription || [])
    .map(segment => {
      const text = segment.text?.trim() || '';
      const tokens = (segment.tokens || []).filter(token => token.text && !token.text.startsWith('[') && Number.isFinite(token.p));
      const averageConfidence = tokens.length > 0
        ? tokens.reduce((sum, token) => sum + (token.p || 0), 0) / tokens.length
        : 0;
      return { text, averageConfidence, normalized: normalizeWhisperText(text) };
    })
    .filter(segment => segment.text);

  const counts = new Map<string, number>();
  segments.forEach(segment => counts.set(segment.normalized, (counts.get(segment.normalized) || 0) + 1));
  const repeatedCount = segments.filter(segment => (counts.get(segment.normalized) || 0) >= 3).length;
  if (segments.length >= 3 && repeatedCount / segments.length >= 0.5) {
    return '';
  }

  return segments
    .filter(segment => !isCommonHallucination(segment.text))
    .map(segment => segment.text)
    .join('\n');
}

function normalizeWhisperText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s，。！？、,.!?;；:：'"“”‘’（）()【】[\]]+/g, '');
}

function isCommonHallucination(text: string): boolean {
  const normalized = normalizeWhisperText(text);
  return COMMON_HALLUCINATION_PATTERNS.some(pattern => pattern.test(normalized));
}

function formatSrtTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  const ms = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 1000);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':') + `,${ms.toString().padStart(3, '0')}`;
}

function buildSrt(segments: SubtitleSegment[]): string {
  return segments.map((segment, index) => {
    return [
      String(index + 1),
      `${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}`,
      segment.text,
    ].join('\n');
  }).join('\n\n');
}

async function extractOneVideo(
  videoPath: string,
  options: Required<Pick<SubtitleExtractRequest, 'model' | 'language' | 'vadThresholdDb' | 'minSpeechDuration'>>,
  requestedRange?: SubtitleTimeRange
): Promise<SubtitleExtractResult> {
  const tempDir = createTempDir();
  const name = path.basename(videoPath);

  try {
    const videoDuration = await getMediaDuration(videoPath);
    const durationLimit = videoDuration || requestedRange?.end || 0;
    const rangeStart = Math.max(0, Math.min(requestedRange?.start ?? 0, durationLimit));
    const rangeEnd = Math.max(rangeStart, Math.min(requestedRange?.end ?? durationLimit, durationLimit));
    const range = rangeEnd - rangeStart >= 0.1 && (rangeStart > 0 || (videoDuration > 0 && rangeEnd < videoDuration))
      ? { start: rangeStart, end: rangeEnd }
      : undefined;

    if (requestedRange && rangeEnd - rangeStart < 0.1) {
      throw new Error('识别时间范围过短，请至少选择 0.1 秒');
    }

    const audioPath = path.join(tempDir, 'prepared.wav');
    await prepareAudio(videoPath, audioPath, range);

    const audioDuration = await getMediaDuration(audioPath);
    if (!audioDuration) {
      throw new Error('无法读取音频时长');
    }
    if (range) {
      const expectedDuration = range.end - range.start;
      const durationDifference = Math.abs(audioDuration - expectedDuration);
      if (durationDifference > Math.max(0.5, expectedDuration * 0.1)) {
        throw new Error(`局部音频截取异常：期望 ${expectedDuration.toFixed(1)} 秒，实际 ${audioDuration.toFixed(1)} 秒`);
      }
    }

    const speechRanges = await detectSpeechRanges(audioPath, audioDuration, options.vadThresholdDb, options.minSpeechDuration);
    const segments: SubtitleSegment[] = [];
    const timelineOffset = range?.start ?? 0;

    for (let index = 0; index < speechRanges.length; index += 1) {
      const range = speechRanges[index];
      const segmentPath = path.join(tempDir, `segment-${String(index + 1).padStart(3, '0')}.wav`);
      const whisperOutputDir = path.join(tempDir, `whisper-${String(index + 1).padStart(3, '0')}`);
      fs.mkdirSync(whisperOutputDir, { recursive: true });

      await extractAudioSegment(audioPath, segmentPath, range);
      const text = await runWhisper(segmentPath, whisperOutputDir, options.model, options.language);

      if (text) {
        segments.push({
          start: range.start + timelineOffset,
          end: range.end + timelineOffset,
          text,
        });
      }
    }

    const text = segments.map(segment => segment.text).join('\n');
    const srt = buildSrt(segments);

    return {
      success: true,
      path: videoPath,
      name,
      text,
      srt,
      segments,
      duration: videoDuration || audioDuration + timelineOffset,
    };
  } catch (error) {
    return {
      success: false,
      path: videoPath,
      name,
      text: '',
      srt: '',
      segments: [],
      error: (error as Error).message,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function extractSubtitles(
  request: SubtitleExtractRequest,
  onProgress?: (progress: SubtitleExtractProgress) => void
): Promise<{ success: boolean; results: SubtitleExtractResult[]; error?: string }> {
  const videos = request.videos || [];
  if (videos.length === 0) {
    return { success: false, results: [], error: '没有需要处理的视频' };
  }

  const options = {
    model: request.model || process.env.WHISPER_MODEL || 'large-v3',
    language: request.language || process.env.WHISPER_LANGUAGE || 'zh',
    vadThresholdDb: request.vadThresholdDb ?? DEFAULT_VAD_THRESHOLD_DB,
    minSpeechDuration: request.minSpeechDuration ?? DEFAULT_MIN_SPEECH_DURATION,
  };

  const results: SubtitleExtractResult[] = [];
  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    onProgress?.({
      status: 'start',
      index,
      total: videos.length,
      path: video,
    });

    const range = request.ranges?.find(item => item.path === video);
    const result = await extractOneVideo(video, options, range);
    results.push(result);
    onProgress?.({
      status: result.success ? 'done' : 'error',
      index,
      total: videos.length,
      path: video,
      result,
      error: result.error,
    });
  }

  return {
    success: results.some(result => result.success),
    results,
    error: results.every(result => !result.success) ? '全部视频识别失败' : undefined,
  };
}
