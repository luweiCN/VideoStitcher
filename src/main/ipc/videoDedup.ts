import { app } from 'electron';
import { trustedIpcMain as ipcMain } from './security';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { getFfmpegPath } from '@shared/ffmpeg';
import { executeVideoDedupTask } from '../services/VideoDedupEngine';
import { withLicenseAccess } from '@main/services/LicenseGate';
import type { Task } from '@shared/types/task';
import {
  DEFAULT_GREEN_SCREEN_RECIPE,
  type GreenScreenRecipe,
  type VideoDedupElement,
  type VideoDedupElementType,
  type VideoDedupLibraryScanResult,
  type VideoDedupTaskConfig,
} from '@shared/videoDedup';

interface RecipeStore {
  version: 1;
  recipes: Record<string, GreenScreenRecipe>;
}

const STATIC_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.bmp', '.avif']);
const GIF_EXTENSIONS = new Set(['.gif']);
const GREEN_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v']);
const MAX_LIBRARY_FILES = 10000;
const getPreviewDir = (): string => path.join(os.tmpdir(), 'videostitcher-dedup-preview');
const LEGACY_GREEN_SCREEN_RECIPE: GreenScreenRecipe = {
  keyColor: '#00FF00',
  similarity: 42,
  edgeSoftness: 18,
  spillSuppression: 35,
};

const getRecipeStorePath = (): string => path.join(app.getPath('userData'), 'video-dedup-recipes.json');

const normalizeRecipeKey = (filePath: string): string => {
  const normalized = path.normalize(filePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

function readRecipeStore(): RecipeStore {
  const storePath = getRecipeStorePath();
  if (!fs.existsSync(storePath)) {
    return { version: 1, recipes: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as Partial<RecipeStore>;
    return {
      version: 1,
      recipes: parsed.recipes && typeof parsed.recipes === 'object' ? parsed.recipes : {},
    };
  } catch (error) {
    console.error('[视频降重] 读取绿幕配方失败:', error);
    return { version: 1, recipes: {} };
  }
}

function writeRecipeStore(store: RecipeStore): void {
  const storePath = getRecipeStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  if (fs.existsSync(storePath)) {
    fs.unlinkSync(storePath);
  }
  fs.renameSync(tempPath, storePath);
}

function getElementType(filePath: string): VideoDedupElementType | null {
  const extension = path.extname(filePath).toLowerCase();
  if (GIF_EXTENSIONS.has(extension)) return 'gif';
  if (GREEN_VIDEO_EXTENSIONS.has(extension)) return 'green_video';
  if (STATIC_EXTENSIONS.has(extension)) return 'image';
  return null;
}

function getEffectiveRecipe(recipe?: GreenScreenRecipe): GreenScreenRecipe | undefined {
  if (!recipe) return undefined;
  const isLegacyDefault = recipe.keyColor.toUpperCase() === LEGACY_GREEN_SCREEN_RECIPE.keyColor
    && recipe.similarity === LEGACY_GREEN_SCREEN_RECIPE.similarity
    && recipe.edgeSoftness === LEGACY_GREEN_SCREEN_RECIPE.edgeSoftness
    && recipe.spillSuppression === LEGACY_GREEN_SCREEN_RECIPE.spillSuppression;
  return isLegacyDefault ? { ...DEFAULT_GREEN_SCREEN_RECIPE } : recipe;
}

function collectLibraryFiles(rootDir: string): { files: string[]; errors: Array<{ path: string; error: string }> } {
  const files: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const pendingDirs = [rootDir];

  while (pendingDirs.length > 0 && files.length < MAX_LIBRARY_FILES) {
    const currentDir = pendingDirs.pop()!;
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          pendingDirs.push(entryPath);
        } else if (entry.isFile() && getElementType(entryPath)) {
          files.push(entryPath);
          if (files.length >= MAX_LIBRARY_FILES) break;
        }
      }
    } catch (error) {
      errors.push({ path: currentDir, error: (error as Error).message });
    }
  }

  return { files, errors };
}

export function scanVideoDedupLibrary(rootDir: string): VideoDedupLibraryScanResult {
  if (!rootDir || !fs.existsSync(rootDir)) {
    return {
      success: false,
      rootDir,
      elements: [],
      counts: { image: 0, gif: 0, green_video: 0 },
      missingRecipes: 0,
      errors: [],
      error: '元素库根目录不存在',
    };
  }

  const rootStat = fs.statSync(rootDir);
  if (!rootStat.isDirectory()) {
    return {
      success: false,
      rootDir,
      elements: [],
      counts: { image: 0, gif: 0, green_video: 0 },
      missingRecipes: 0,
      errors: [],
      error: '元素库根路径不是文件夹',
    };
  }

  const recipeStore = readRecipeStore();
  const collected = collectLibraryFiles(rootDir);
  const elements: VideoDedupElement[] = [];

  for (const filePath of collected.files) {
    try {
      const type = getElementType(filePath);
      if (!type) continue;
      const stat = fs.statSync(filePath);
      const recipe = type === 'green_video'
        ? getEffectiveRecipe(recipeStore.recipes[normalizeRecipeKey(filePath)])
        : undefined;
      elements.push({
        path: filePath,
        name: path.basename(filePath),
        type,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        recipe,
      });
    } catch (error) {
      collected.errors.push({ path: filePath, error: (error as Error).message });
    }
  }

  elements.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  const counts = elements.reduce<Record<VideoDedupElementType, number>>(
    (result, element) => {
      result[element.type] += 1;
      return result;
    },
    { image: 0, gif: 0, green_video: 0 },
  );

  return {
    success: true,
    rootDir,
    elements,
    counts,
    missingRecipes: elements.filter((element) => element.type === 'green_video' && !element.recipe).length,
    errors: collected.errors,
  };
}

function normalizeRecipe(recipe: GreenScreenRecipe): GreenScreenRecipe {
  const keyColor = /^#[0-9a-fA-F]{6}$/.test(recipe.keyColor)
    ? recipe.keyColor.toUpperCase()
    : DEFAULT_GREEN_SCREEN_RECIPE.keyColor;
  const clampPercent = (value: number): number => Math.min(100, Math.max(0, Number(value) || 0));
  return {
    keyColor,
    similarity: clampPercent(recipe.similarity),
    edgeSoftness: clampPercent(recipe.edgeSoftness),
    spillSuppression: clampPercent(recipe.spillSuppression),
  };
}

export async function previewGreenScreenElement(
  filePath: string,
  recipe: GreenScreenRecipe,
): Promise<{ success: boolean; preview?: string; error?: string }> {
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: '绿幕元素文件不存在' };
  }

  const normalizedRecipe = normalizeRecipe(recipe);
  const previewPath = path.join(
    os.tmpdir(),
    `videostitcher-green-preview-${process.pid}-${Date.now()}.png`,
  );
  const keyColor = `0x${normalizedRecipe.keyColor.replace('#', '')}`;
  const similarity = Math.max(0.00001, normalizedRecipe.similarity / 100);
  const blend = normalizedRecipe.edgeSoftness / 100;
  const spill = normalizedRecipe.spillSuppression / 100;
  const filter = `chromakey=${keyColor}:${similarity}:${blend},despill=green:mix=${spill},format=rgba,scale=480:-2:force_original_aspect_ratio=decrease`;

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        getFfmpegPath(),
        ['-y', '-ss', '0.2', '-i', filePath, '-frames:v', '1', '-vf', filter, previewPath],
        { timeout: 15000, windowsHide: true },
        (error, _stdout, stderr) => {
          if (error) reject(new Error(stderr || error.message));
          else resolve();
        },
      );
    });
    const buffer = fs.readFileSync(previewPath);
    const stats = await sharp(buffer).ensureAlpha().stats();
    const alphaChannel = stats.channels[3];
    if (!alphaChannel || alphaChannel.max <= 1) {
      return {
        success: false,
        error: '当前抠色参数会把整段主体一起扣掉，请降低相似度和边缘柔化',
      };
    }
    return { success: true, preview: `data:image/png;base64,${buffer.toString('base64')}` };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    if (fs.existsSync(previewPath)) {
      try {
        fs.unlinkSync(previewPath);
      } catch {
        // 临时预览清理失败不影响本次返回。
      }
    }
  }
}

export async function generateVideoDedupPreview(
  sourcePath: string,
  config: VideoDedupTaskConfig,
  onProgress?: (progress: number, step: string) => void,
): Promise<{ success: boolean; previewPath?: string; events?: VideoDedupTaskConfig['events']; error?: string }> {
  const previewDir = getPreviewDir();
  fs.mkdirSync(previewDir, { recursive: true });
  const previewTask: Task = {
    id: Date.now(),
    type: 'video_dedup',
    status: 'running',
    files: [{ path: sourcePath, category: 'source', category_name: '原视频' }],
    config: { ...config, previewMode: true } as unknown as Record<string, unknown>,
    outputDir: previewDir,
  };
  const result = await executeVideoDedupTask(
    previewTask,
    undefined,
    undefined,
    onProgress,
    2,
  );
  return {
    success: result.success,
    previewPath: result.outputPath,
    events: result.events,
    error: result.error,
  };
}

export function deleteVideoDedupPreview(previewPath: string): { success: boolean; error?: string } {
  try {
    const previewRoot = path.resolve(getPreviewDir());
    const targetPath = path.resolve(previewPath);
    const isInsidePreviewDir = targetPath.startsWith(`${previewRoot}${path.sep}`);
    if (!isInsidePreviewDir) {
      return { success: false, error: '拒绝删除元素预览目录之外的文件' };
    }
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function registerVideoDedupHandlers(): void {
  ipcMain.handle('video-dedup:scan-library', async (_event, rootDir: string) => {
    try {
      return scanVideoDedupLibrary(rootDir);
    } catch (error) {
      return {
        success: false,
        rootDir,
        elements: [],
        counts: { image: 0, gif: 0, green_video: 0 },
        missingRecipes: 0,
        errors: [],
        error: (error as Error).message,
      } satisfies VideoDedupLibraryScanResult;
    }
  });

  ipcMain.handle(
    'video-dedup:save-green-recipe',
    async (_event, filePath: string, recipe: GreenScreenRecipe) => {
      try {
        if (!filePath || !fs.existsSync(filePath)) {
          return { success: false, error: '绿幕元素文件不存在' };
        }
        if (getElementType(filePath) !== 'green_video') {
          return { success: false, error: '只有绿幕视频可以保存抠色配方' };
        }

        const normalizedRecipe = normalizeRecipe(recipe);
        const store = readRecipeStore();
        store.recipes[normalizeRecipeKey(filePath)] = normalizedRecipe;
        writeRecipeStore(store);
        return { success: true, recipe: normalizedRecipe };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  ipcMain.handle('video-dedup:get-green-recipe', async (_event, filePath: string) => {
    const store = readRecipeStore();
    return {
      success: true,
      recipe: getEffectiveRecipe(store.recipes[normalizeRecipeKey(filePath)]) || DEFAULT_GREEN_SCREEN_RECIPE,
    };
  });

  ipcMain.handle(
    'video-dedup:preview-green',
    withLicenseAccess(async (_event, filePath: string, recipe: GreenScreenRecipe) => (
      previewGreenScreenElement(filePath, recipe)
    )),
  );

  ipcMain.handle(
    'video-dedup:generate-preview',
    withLicenseAccess(async (event, sourcePath: string, config: VideoDedupTaskConfig) => generateVideoDedupPreview(
      sourcePath,
      config,
      (progress, step) => event.sender.send('video-dedup:preview-progress', { progress, step }),
    )),
  );

  ipcMain.handle(
    'video-dedup:delete-preview',
    async (_event, previewPath: string) => deleteVideoDedupPreview(previewPath),
  );

  console.log('[主进程] 视频降重元素库处理器已注册');
}
