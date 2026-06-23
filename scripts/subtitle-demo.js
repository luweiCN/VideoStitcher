/**
 * 字幕提取方案验证 Demo
 *
 * 用法：
 * node scripts/subtitle-demo.js "C:\path\test.mp4" --engine whisper --model small
 * node scripts/subtitle-demo.js "C:\path\test.mp4" --engine whispercpp --modelPath "C:\path\ggml-small.bin" --whisperCpp "C:\path\whisper-cli.exe"
 *
 * 输出：
 * - 音频预处理后的 wav
 * - VAD 检测到的人声片段
 * - TXT / SRT
 * - 耗时、CPU、内存、GPU 采样报告
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const pidusage = require('pidusage');
const ffmpegPath = require('ffmpeg-static');
const { path: ffprobePath } = require('@ffprobe-installer/ffprobe');

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

const inputVideo = args.find(arg => !arg.startsWith('--'));
const engine = readArg('--engine', 'whisper');
const model = readArg('--model', 'small');
const modelPath = readArg('--modelPath', '');
const whisperCommand = readArg('--whisper', 'whisper');
const whisperCppPath = readArg('--whisperCpp', 'whisper-cli');
const language = readArg('--language', 'zh');
const vadThreshold = Number(readArg('--vadThreshold', '-35'));
const outputRoot = readArg('--out', path.join(process.cwd(), 'subtitle-demo-output'));
const keepTemp = hasFlag('--keepTemp');

if (!inputVideo) {
  console.error('请提供测试视频路径，例如：node scripts/subtitle-demo.js "C:\\test\\demo.mp4" --engine whisper --model small');
  process.exit(1);
}

if (!fs.existsSync(inputVideo)) {
  console.error(`测试视频不存在：${inputVideo}`);
  process.exit(1);
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join(outputRoot, runId);
const segmentDir = path.join(outputDir, 'segments');
fs.mkdirSync(segmentDir, { recursive: true });

const samples = [];
const childPids = new Set();
const processCpuLast = new Map();
let gpuTimer = null;
let pidTimer = null;

function nowSeconds() {
  return Number(process.hrtime.bigint()) / 1e9;
}

function runCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, commandArgs, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
    });

    if (child.pid) childPids.add(child.pid);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
      if (options.pipeOutput) process.stdout.write(data);
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
      if (options.pipeOutput) process.stderr.write(data);
    });

    child.on('error', reject);
    child.on('close', code => {
      childPids.delete(child.pid);
      if (code === 0) {
        resolve({ stdout, stderr, elapsedMs: Date.now() - startedAt });
      } else {
        reject(new Error(`${command} 退出码 ${code}\n${stderr}`));
      }
    });
  });
}

function execCommand(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, commandArgs, {
      timeout: options.timeout || 30000,
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

function execPowerShell(command, options = {}) {
  return execCommand('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command', command,
  ], options);
}

async function commandExists(command) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execCommand(lookup, [command], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function getDuration(filePath) {
  const { stdout } = await execCommand(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return Number.parseFloat(stdout.trim()) || 0;
}

async function pollGpu() {
  const hasNvidiaSmi = await commandExists('nvidia-smi');
  if (!hasNvidiaSmi) return;

  gpuTimer = setInterval(async () => {
    try {
      const { stdout } = await execCommand('nvidia-smi', [
        '--query-gpu=utilization.gpu,memory.used,memory.total,power.draw',
        '--format=csv,noheader,nounits',
      ], { timeout: 5000 });

      const firstLine = stdout.trim().split(/\r?\n/)[0];
      if (!firstLine) return;
      const [gpuUtil, gpuMemUsed, gpuMemTotal, powerDraw] = firstLine.split(',').map(item => Number.parseFloat(item.trim()));
      samples.push({
        time: Date.now(),
        gpuUtil,
        gpuMemUsed,
        gpuMemTotal,
        powerDraw,
      });
    } catch {
      // GPU 采样失败不影响识别流程。
    }
  }, 1000);
}

function pollProcessStats() {
  pidTimer = setInterval(async () => {
    const pids = Array.from(childPids);
    if (pids.length === 0) return;

    try {
      const psCommand = `$ids=@(${pids.join(',')}); Get-Process -Id $ids -ErrorAction SilentlyContinue | Select-Object Id,CPU,WorkingSet64 | ConvertTo-Json -Compress`;
      const { stdout } = await execPowerShell(psCommand, { timeout: 5000 });
      if (!stdout.trim()) return;

      const parsed = JSON.parse(stdout.trim());
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const timestamp = Date.now();
      let cpu = 0;
      let memory = 0;

      for (const row of rows) {
        const pid = Number(row.Id);
        const cpuSeconds = Number(row.CPU || 0);
        const workingSet = Number(row.WorkingSet64 || 0);
        const last = processCpuLast.get(pid);

        if (last) {
          const elapsedSeconds = (timestamp - last.timestamp) / 1000;
          const cpuDelta = Math.max(0, cpuSeconds - last.cpuSeconds);
          if (elapsedSeconds > 0) {
            cpu += (cpuDelta / elapsedSeconds) * 100;
          }
        }

        memory += workingSet;
        processCpuLast.set(pid, { cpuSeconds, timestamp });
      }

      samples.push({
        time: timestamp,
        cpu,
        memory,
      });
    } catch {
      try {
        const stats = await Promise.all(pids.map(pid => pidusage(pid).catch(() => null)));
        const validStats = stats.filter(Boolean);
        if (validStats.length === 0) return;
        samples.push({
          time: Date.now(),
          cpu: validStats.reduce((sum, item) => sum + item.cpu, 0),
          memory: validStats.reduce((sum, item) => sum + item.memory, 0),
        });
      } catch {
        // 进程采样失败不影响识别流程。
      }
    }
  }, 500);
}

async function prepareAudio() {
  const audioPath = path.join(outputDir, 'prepared.wav');
  const filters = [
    'highpass=f=80',
    'lowpass=f=7600',
    'afftdn=nf=-25',
    'acompressor=threshold=-18dB:ratio=3:attack=5:release=80',
    'dynaudnorm=f=150:g=15',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
  ].join(',');

  console.log('1. 提取并预处理音频...');
  await runCommand(ffmpegPath, [
    '-y',
    '-i', inputVideo,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-af', filters,
    audioPath,
  ]);

  return audioPath;
}

async function detectSpeech(audioPath, duration) {
  console.log('2. VAD 检测说话片段...');
  const { stderr } = await runCommand(ffmpegPath, [
    '-i', audioPath,
    '-af', `silencedetect=n=${vadThreshold}dB:d=0.35`,
    '-f', 'null',
    '-',
  ]);

  const silences = [];
  let silenceStart = null;
  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
    if (startMatch) {
      silenceStart = Number.parseFloat(startMatch[1]);
      continue;
    }
    const endMatch = line.match(/silence_end:\s*([0-9.]+)/);
    if (endMatch && silenceStart !== null) {
      silences.push({ start: silenceStart, end: Number.parseFloat(endMatch[1]) });
      silenceStart = null;
    }
  }
  if (silenceStart !== null && duration > silenceStart) {
    silences.push({ start: silenceStart, end: duration });
  }

  const ranges = [];
  let cursor = 0;
  for (const silence of silences) {
    if (silence.start > cursor) {
      ranges.push({ start: Math.max(0, cursor - 0.2), end: Math.min(duration, silence.start + 0.2) });
    }
    cursor = Math.max(cursor, silence.end);
  }
  if (duration > cursor) {
    ranges.push({ start: Math.max(0, cursor - 0.2), end: duration });
  }

  const merged = ranges
    .filter(range => range.end - range.start >= 0.6)
    .reduce((acc, range) => {
      const last = acc[acc.length - 1];
      if (last && range.start - last.end < 0.5) {
        last.end = Math.max(last.end, range.end);
      } else {
        acc.push({ ...range });
      }
      return acc;
    }, []);

  return merged.length > 0 ? merged : [{ start: 0, end: duration }];
}

async function cutSegments(audioPath, ranges) {
  console.log(`3. 切分 ${ranges.length} 段有人声的音频...`);
  const segmentPaths = [];

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    const segmentPath = path.join(segmentDir, `segment-${String(index + 1).padStart(3, '0')}.wav`);
    await runCommand(ffmpegPath, [
      '-y',
      '-ss', range.start.toFixed(3),
      '-t', (range.end - range.start).toFixed(3),
      '-i', audioPath,
      '-ac', '1',
      '-ar', '16000',
      segmentPath,
    ]);
    segmentPaths.push(segmentPath);
  }

  return segmentPaths;
}

async function recognizeSegment(segmentPath, index) {
  const whisperOutDir = path.join(outputDir, `whisper-${String(index + 1).padStart(3, '0')}`);
  fs.mkdirSync(whisperOutDir, { recursive: true });

  if (engine === 'whisper') {
    if (!(await commandExists(whisperCommand))) {
      throw new Error(`未找到 whisper 命令：${whisperCommand}`);
    }

    await runCommand(whisperCommand, [
      segmentPath,
      '--model', model,
      '--language', language,
      '--task', 'transcribe',
      '--output_format', 'txt',
      '--output_dir', whisperOutDir,
      '--fp16', 'False',
    ], { pipeOutput: false });
  } else if (engine === 'whispercpp') {
    if (!fs.existsSync(whisperCppPath) && !(await commandExists(whisperCppPath))) {
      throw new Error(`未找到 whisper.cpp 可执行文件：${whisperCppPath}`);
    }
    if (!modelPath || !fs.existsSync(modelPath)) {
      throw new Error(`未找到模型文件：${modelPath}`);
    }

    const outputBase = path.join(whisperOutDir, path.basename(segmentPath, path.extname(segmentPath)));
    await runCommand(whisperCppPath, [
      '-m', modelPath,
      '-f', segmentPath,
      '-l', language,
      '-otxt',
      '-of', outputBase,
    ], { pipeOutput: false });
  } else {
    throw new Error(`未知识别引擎：${engine}`);
  }

  const txtFile = fs.readdirSync(whisperOutDir).find(file => file.toLowerCase().endsWith('.txt'));
  if (!txtFile) return '';
  return fs.readFileSync(path.join(whisperOutDir, txtFile), 'utf8').trim();
}

function srtTime(seconds) {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function summarize(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (nums.length === 0) return { avg: 0, max: 0 };
  return {
    avg: nums.reduce((sum, value) => sum + value, 0) / nums.length,
    max: Math.max(...nums),
  };
}

function buildQualityNotes(transcript, ranges, duration) {
  const speechDuration = ranges.reduce((sum, range) => sum + (range.end - range.start), 0);
  const chars = transcript.replace(/\s/g, '').length;
  const notes = [];

  if (chars === 0) {
    notes.push('没有识别出文本，可能是模型/语言配置不匹配，或视频人声太弱。');
  } else {
    notes.push(`识别出约 ${chars} 个非空白字符。`);
  }
  notes.push(`VAD 保留人声 ${speechDuration.toFixed(1)} 秒，占视频时长 ${duration ? ((speechDuration / duration) * 100).toFixed(1) : '0'}%。`);
  notes.push('没有人工标准答案，本 demo 只能做可读性检查；如果提供人工文案，可以继续计算准确率。');

  return notes;
}

async function main() {
  console.log('字幕提取 Demo 开始');
  console.log(`测试视频：${inputVideo}`);
  console.log(`识别引擎：${engine}`);
  console.log(`模型：${engine === 'whisper' ? model : modelPath}`);
  console.log(`输出目录：${outputDir}`);

  await pollGpu();
  pollProcessStats();

  const started = nowSeconds();
  const audioPath = await prepareAudio();
  const duration = await getDuration(audioPath);
  const ranges = await detectSpeech(audioPath, duration);
  const segmentPaths = await cutSegments(audioPath, ranges);

  console.log(`4. 使用 ${engine === 'whisper' ? model : path.basename(modelPath)} 模型识别...`);
  const segments = [];
  for (let index = 0; index < segmentPaths.length; index += 1) {
    const text = await recognizeSegment(segmentPaths[index], index);
    segments.push({
      start: ranges[index].start,
      end: ranges[index].end,
      text,
    });
    console.log(`  段 ${index + 1}/${segmentPaths.length} 完成：${text.slice(0, 40)}`);
  }

  const transcript = segments.map(segment => segment.text).filter(Boolean).join('\n');
  const srt = segments.map((segment, index) => [
    String(index + 1),
    `${srtTime(segment.start)} --> ${srtTime(segment.end)}`,
    segment.text,
  ].join('\n')).join('\n\n');

  const txtPath = path.join(outputDir, 'result.txt');
  const srtPath = path.join(outputDir, 'result.srt');
  const reportPath = path.join(outputDir, 'report.json');
  fs.writeFileSync(txtPath, transcript, 'utf8');
  fs.writeFileSync(srtPath, srt, 'utf8');

  const elapsedSeconds = nowSeconds() - started;
  const cpu = summarize(samples.map(sample => sample.cpu));
  const memory = summarize(samples.map(sample => sample.memory).map(bytes => bytes / 1024 / 1024));
  const gpu = summarize(samples.map(sample => sample.gpuUtil));
  const gpuMemory = summarize(samples.map(sample => sample.gpuMemUsed));
  const power = summarize(samples.map(sample => sample.powerDraw));
  const qualityNotes = buildQualityNotes(transcript, ranges, duration);

  const report = {
    inputVideo,
    engine,
    model: engine === 'whisper' ? model : modelPath,
    language,
    durationSeconds: duration,
    elapsedSeconds,
    speechRanges: ranges,
    segmentCount: ranges.length,
    resources: {
      cpuPercentAvg: cpu.avg,
      cpuPercentMax: cpu.max,
      memoryMbAvg: memory.avg,
      memoryMbMax: memory.max,
      gpuPercentAvg: gpu.avg,
      gpuPercentMax: gpu.max,
      gpuMemoryMbAvg: gpuMemory.avg,
      gpuMemoryMbMax: gpuMemory.max,
      gpuPowerWAvg: power.avg,
      gpuPowerWMax: power.max,
    },
    transcriptPreview: transcript.slice(0, 1000),
    qualityNotes,
    outputs: {
      txtPath,
      srtPath,
      reportPath,
    },
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  if (!keepTemp) {
    // 保留输出文本和报告，清理中间片段目录。
    fs.rmSync(segmentDir, { recursive: true, force: true });
  }

  console.log('\n===== Demo 报告 =====');
  console.log(`耗时：${elapsedSeconds.toFixed(2)} 秒`);
  console.log(`CPU：平均 ${cpu.avg.toFixed(1)}%，峰值 ${cpu.max.toFixed(1)}%`);
  console.log(`内存：平均 ${memory.avg.toFixed(1)} MB，峰值 ${memory.max.toFixed(1)} MB`);
  console.log(`GPU：平均 ${gpu.avg.toFixed(1)}%，峰值 ${gpu.max.toFixed(1)}%`);
  console.log(`显存：平均 ${gpuMemory.avg.toFixed(1)} MB，峰值 ${gpuMemory.max.toFixed(1)} MB`);
  console.log(`输出 TXT：${txtPath}`);
  console.log(`输出 SRT：${srtPath}`);
  console.log(`报告 JSON：${reportPath}`);
  console.log('\n质量观察：');
  qualityNotes.forEach(note => console.log(`- ${note}`));
  console.log('\n识别预览：');
  console.log(transcript.slice(0, 1200) || '无文本');
}

main()
  .catch(error => {
    console.error(`Demo 失败：${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    if (gpuTimer) clearInterval(gpuTimer);
    if (pidTimer) clearInterval(pidTimer);
  });
