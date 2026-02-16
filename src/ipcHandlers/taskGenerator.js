/**
 * 任务生成器 IPC 处理器
 * 在主进程中生成任务，减轻渲染进程负担
 */

const { ipcMain } = require("electron");

/**
 * 排序配置
 */
/**
 * 生成完整的笛卡尔积
 */
function generateCartesianProduct(sources) {
  if (sources.length === 0) return [];

  const results = [];

  function backtrack(depth, current) {
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
function selectEvenlyDistributed(combinations, count) {
  if (combinations.length <= count) {
    return combinations;
  }

  // 记录每个素材已使用的次数
  const usageCount = [];
  const maxIdx = combinations[0].length;
  for (let i = 0; i < maxIdx; i++) {
    const uniqueValues = [...new Set(combinations.map((c) => c[i]))];
    usageCount.push(new Array(Math.max(...uniqueValues) + 1).fill(0));
  }

  const results = [];
  const usedCombinations = new Set();

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
function sortCombinations(combinations, config) {
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
function generateBalancedCombinations(sources, count, sortConfig) {
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
function generateStitchTasks(event, params) {
  const { aPaths, bPaths, count, outputDir, concurrency, orientation } = params;

  if (!aPaths?.length || !bPaths?.length || count <= 0) {
    return { success: true, tasks: [] };
  }

  const timestamp = Date.now();
  const sources = [aPaths, bPaths];
  const combinations = generateBalancedCombinations(sources, count, {
    priority: [0, 1],
  });

  const tasks = combinations.map((indices, taskIndex) => {
    return {
      id: `stitch-${timestamp}-${taskIndex}`,
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
function generateMergeTasks(event, params) {
  const {
    bVideos,
    aVideos,
    covers,
    bgImages,
    count,
    outputDir,
    concurrency,
    orientation,
  } = params;

  if (!bVideos?.length) {
    return { success: true, tasks: [] };
  }

  const timestamp = Date.now();
  const sources = [];
  let priorityOffset = 0;

  // 添加封面（可选）
  if (covers?.length > 0) {
    sources.push(covers);
    priorityOffset++;
  }
  // 添加 A 视频（可选）
  if (aVideos?.length > 0) {
    sources.push(aVideos);
    priorityOffset++;
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

  const tasks = combinations.map((indices, taskIndex) => {
    const files = [];
    let idx = 0;

    if (covers?.length > 0) {
      files.push({
        path: covers[indices[idx]],
        index: indices[idx] + 1,
        category: "cover",
        category_name: "封面",
      });
      idx++;
    }

    if (aVideos?.length > 0) {
      files.push({
        path: aVideos[indices[idx]],
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
    if (bgImages?.length > 0) {
      files.push({
        path: bgImages[0],
        index: 1,
        category: "bg",
        category_name: "背景",
      });
    }

    return {
      id: `merge-${timestamp}-${taskIndex}`,
      status: "pending",
      files,
      config: { orientation },
      outputDir,
      concurrency,
    };
  });

  return { success: true, tasks };
}

/**
 * 注册任务生成器 IPC 处理器
 */
function registerTaskGeneratorHandlers() {
  // 生成 A+B 前后拼接任务
  ipcMain.handle("task:generate-stitch", generateStitchTasks);
  console.log("[主进程] 任务生成器已注册: task:generate-stitch");

  // 生成视频合成任务
  ipcMain.handle("task:generate-merge", generateMergeTasks);
  console.log("[主进程] 任务生成器已注册: task:generate-merge");
}

module.exports = {
  registerTaskGeneratorHandlers,
  generateBalancedCombinations,
  generateStitchTasks,
  generateMergeTasks,
};
