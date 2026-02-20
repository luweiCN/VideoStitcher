/**
 * 任务生成器 IPC 处理器
 * 在主进程中生成任务，减轻渲染进程负担
 */

import { ipcMain } from 'electron';

interface SortConfig {
  priority: number[];
  ascending?: boolean | boolean[];
}

interface StitchTaskParams {
  aPaths: string[];
  bPaths: string[];
  count: number;
  outputDir: string;
  concurrency: number;
  orientation: string;
}

interface MergeTaskParams {
  bVideos: string[];
  aVideos?: string[];
  covers?: string[];
  bgImages?: string[];
  count: number;
  outputDir: string;
  orientation: string;
}

interface ResizeTaskParams {
  videos: string[];
  mode: string;
  blurAmount: number;
  outputDir: string;
}

interface TaskFile {
  path: string;
  index: number;
  category: string;
  category_name: string;
}

interface Task {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  files: TaskFile[];
  config: Record<string, unknown>;
  outputDir: string;
}

/**
 * 生成随机数字 ID
 */
function generateTempId(): number {
  return Math.floor(Math.random() * 1000000000);
}

/**
 * 生成完整的笛卡尔积
 */
function generateCartesianProduct(sources: string[][]): number[][] {
  if (sources.length === 0) return [];

  const results: number[][] = [];

  function backtrack(depth: number, current: number[]): void {
    if (depth === sources.length) {
      results.push([...current]);
      return;
    }
    for (let i = 0; i < sources[depth].length; i++) {
      current.push(i);
      backtrack(depth + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return results;
}

/**
 * 均匀选择组合，确保尽量使用所有素材
 */
function selectEvenlyDistributed(combinations: number[][], count: number): number[][] {
  if (combinations.length <= count) {
    return combinations;
  }

  // 记录每个素材已使用的次数
  const usageCount: number[][] = [];
  const maxIdx = combinations[0].length;
  for (let i = 0; i < maxIdx; i++) {
    const uniqueValues = [...new Set(combinations.map((c) => c[i]))];
    usageCount.push(new Array(Math.max(...uniqueValues) + 1).fill(0));
  }

  const results: number[][] = [];
  const usedCombinations = new Set<string>();

  for (let i = 0; i < count; i++) {
    let bestIdx = -1;
    let bestScore = Infinity;

    // 找到使用次数最少的组合
    for (let j = 0; j < combinations.length; j++) {
      if (usedCombinations.has(combinations[j].join(","))) continue;

      const combo = combinations[j];
      // 计算这个组合的"负载"：所有素材使用次数的总和
      let load = 0;
      for (let k = 0; k < combo.length; k++) {
        load += usageCount[k][combo[k]] || 0;
      }

      if (load < bestScore) {
        bestScore = load;
        bestIdx = j;
      }
    }

    if (bestIdx >= 0) {
      results.push(combinations[bestIdx]);
      usedCombinations.add(combinations[bestIdx].join(","));

      // 更新使用次数
      for (let k = 0; k < combinations[bestIdx].length; k++) {
        const val = combinations[bestIdx][k];
        if (usageCount[k][val] !== undefined) {
          usageCount[k][val]++;
        }
      }
    }
  }

  return results;
}

/**
 * 对组合数组进行排序
 */
function sortCombinations(combinations: number[][], config: SortConfig): void {
  const { priority, ascending = true } = config;

  // 处理排序方向配置
  const ascendingArr = Array.isArray(ascending)
    ? ascending
    : priority.map(() => ascending);

  combinations.sort((a, b) => {
    for (let i = 0; i < priority.length; i++) {
      const sourceIdx = priority[i];
      const asc = ascendingArr[i] ?? true;

      const valA = a[sourceIdx];
      const valB = b[sourceIdx];

      if (valA !== valB) {
        return asc ? valA - valB : valB - valA;
      }
    }
    return 0;
  });
}

/**
 * 生成均匀的多源组合
 */
export function generateBalancedCombinations(sources: string[][], count: number, sortConfig: SortConfig): number[][] {
  // 边界检查
  if (count <= 0 || sources.length === 0) {
    return [];
  }

  // 检查是否有空源
  if (sources.some((s) => s.length === 0)) {
    return [];
  }

  // 计算最大可能组合数
  const maxCombinations = sources.reduce((acc, s) => acc * s.length, 1);

  // 如果请求的数量 >= 最大组合数，生成完整的笛卡尔积
  if (count >= maxCombinations) {
    const allCombinations = generateCartesianProduct(sources);
    return allCombinations;
  }

  // 如果请求数量小于最大组合数，先生成所有可能的组合，再均匀选择
  const allCombinations = generateCartesianProduct(sources);
  const results = selectEvenlyDistributed(allCombinations, count);

  // 如果有排序配置，进行排序
  if (sortConfig && sortConfig.priority.length > 0) {
    sortCombinations(results, sortConfig);
  }

  return results;
}

/**
 * 生成 A+B 前后拼接任务
 */
function generateStitchTasks(_event: Electron.IpcMainInvokeEvent, params: StitchTaskParams): { success: boolean; tasks: Task[] } {
  const { aPaths, bPaths, count, outputDir, concurrency, orientation } = params;

  if (!aPaths?.length || !bPaths?.length || count <= 0) {
    return { success: true, tasks: [] };
  }

  const timestamp = Date.now();
  const sources = [aPaths, bPaths];
  const combinations = generateBalancedCombinations(sources, count, {
    priority: [0, 1],
  });

  const tasks: Task[] = combinations.map((indices) => {
    return {
      id: generateTempId(),
      status: "pending",
      files: [
        {
          path: aPaths[indices[0]],
          index: indices[0] + 1,
          category: "A",
          category_name: "A",
        },
        {
          path: bPaths[indices[1]],
          index: indices[1] + 1,
          category: "B",
          category_name: "B",
        },
      ],
      config: { orientation },
      outputDir,
      concurrency,
    };
  });

  return { success: true, tasks };
}

/**
 * 生成视频合成任务
 */
function generateMergeTasks(_event: Electron.IpcMainInvokeEvent, params: MergeTaskParams): { success: boolean; tasks: Task[] } {
  const {
    bVideos,
    aVideos,
    covers,
    bgImages,
    count,
    outputDir,
    orientation,
  } = params;

  if (!bVideos?.length) {
    return { success: true, tasks: [] };
  }

  const timestamp = Date.now();
  const sources: string[][] = [];

  // 添加封面（可选）
  const validCovers = covers && covers.length > 0 ? covers : null;
  const validAVideos = aVideos && aVideos.length > 0 ? aVideos : null;
  const validBgImages = bgImages && bgImages.length > 0 ? bgImages : null;

  if (validCovers) {
    sources.push(validCovers);
  }
  // 添加 A 视频（可选）
  if (validAVideos) {
    sources.push(validAVideos);
  }
  // 添加 B 视频（必需）
  sources.push(bVideos);

  // 计算实际任务数量
  const actualCount = Math.min(count, sources.reduce((acc, s) => acc * s.length, 1));

  // 排序优先级：封面 > A > B
  const priority = Array.from({ length: sources.length }, (_, i) => i);
  const combinations = generateBalancedCombinations(sources, actualCount, {
    priority,
  });

  const tasks: Task[] = combinations.map((indices) => {
    const files: TaskFile[] = [];
    let idx = 0;

    if (validCovers) {
      files.push({
        path: validCovers[indices[idx]],
        index: indices[idx] + 1,
        category: "cover",
        category_name: "封面",
      });
      idx++;
    }

    if (validAVideos) {
      files.push({
        path: validAVideos[indices[idx]],
        index: indices[idx] + 1,
        category: "A",
        category_name: "A",
      });
      idx++;
    }

    files.push({
      path: bVideos[indices[idx]],
      index: indices[idx] + 1,
      category: "B",
      category_name: "B",
    });

    // 背景图（固定）
    if (validBgImages) {
      files.push({
        path: validBgImages[0],
        index: 1,
        category: "bg",
        category_name: "背景",
      });
    }

    return {
      id: generateTempId(),
      status: "pending",
      files,
      config: { orientation },
      outputDir,
    };
  });

  return { success: true, tasks };
}

/**
 * 生成智能改尺寸任务
 */
function generateResizeTasks(_event: Electron.IpcMainInvokeEvent, params: ResizeTaskParams): { success: boolean; tasks: Task[] } {
  const { videos, mode, blurAmount, outputDir } = params;

  if (!videos?.length) {
    return { success: true, tasks: [] };
  }

  const tasks: Task[] = videos.map((path, index) => ({
    id: generateTempId(),
    status: 'pending',
    files: [{
      path,
      index: index + 1,
      category: 'V',
      category_name: '视频',
    }],
    config: {
      mode,
      blurAmount,
    },
    outputDir,
  }));

  return { success: true, tasks };
}

/**
 * 注册任务生成器 IPC 处理器
 */
export function registerTaskGeneratorHandlers(): void {
  // 生成 A+B 前后拼接任务
  ipcMain.handle("task:generate-stitch", generateStitchTasks);
  console.log("[主进程] 任务生成器已注册: task:generate-stitch");

  // 生成视频合成任务
  ipcMain.handle("task:generate-merge", generateMergeTasks);
  console.log("[主进程] 任务生成器已注册: task:generate-merge");

  // 生成智能改尺寸任务
  ipcMain.handle("task:generate-resize", generateResizeTasks);
  console.log("[主进程] 任务生成器已注册: task:generate-resize");
}

export {
  generateStitchTasks,
  generateMergeTasks,
  generateResizeTasks,
};
