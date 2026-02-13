/**
 * 均匀组合生成算法
 *
 * 核心思想：使用贪心算法，优先选择使用次数最少的素材
 * 确保每个素材都能尽量均匀地被使用
 */

/**
 * 排序配置
 */
export interface SortConfig {
  /**
   * 排序优先级，数组中的数字是源的索引
   * 例如 [0, 2, 1] 表示优先按第0个源排序，其次第2个，最后第1个
   */
  priority: number[];
  /**
   * 每个源的排序方向，true=升序（默认），false=降序
   * 可以是布尔值（应用于所有）或数组（按优先级对应）
   */
  ascending?: boolean | boolean[];
}

/**
 * 生成均匀的多源组合
 *
 * @param sources 多个素材源的数组，如 [[a1, a2, a3], [b1, b2], [c1, c2, c3, c4]]
 * @param count 需要生成的组合数量
 * @param sortConfig 可选的排序配置
 * @returns 索引组合数组，每个元素是各源的索引，如 [[0,0,0], [1,1,1], [2,0,2], ...]
 *
 * @example
 * // 2个源，各3个元素，生成5个组合
 * const result = generateBalancedCombinations([[1,2,3], ['a','b','c']], 5);
 * // 可能返回: [[0,0], [1,1], [2,2], [0,1], [1,2]]
 * // 解释: 每个元素尽量只用一次，不够时才重复
 */
export function generateBalancedCombinations(
  sources: unknown[][],
  count: number,
  sortConfig?: SortConfig
): number[][] {
  // 边界检查
  if (count <= 0 || sources.length === 0) {
    return [];
  }

  // 检查是否有空源
  if (sources.some(s => s.length === 0)) {
    return [];
  }

  // 计算最大可能组合数
  const maxCombinations = sources.reduce((acc, s) => acc * s.length, 1);
  const actualCount = Math.min(count, maxCombinations);

  const results: number[][] = [];

  // 记录每个素材的使用次数
  // usageCounts[i][j] = 第i个源的第j个元素的使用次数
  const usageCounts: number[][] = sources.map(s => new Array(s.length).fill(0));

  // 记录每个组合已使用过（避免重复）
  const usedCombinations = new Set<string>();

  for (let i = 0; i < actualCount; i++) {
    const combination = selectNextCombination(sources, usageCounts, usedCombinations);
    if (combination) {
      results.push(combination);

      // 更新使用次数
      combination.forEach((idx, sourceIdx) => {
        usageCounts[sourceIdx][idx]++;
      });

      // 记录已使用的组合
      usedCombinations.add(combination.join(','));
    }
  }

  // 如果有排序配置，进行排序
  if (sortConfig && sortConfig.priority.length > 0) {
    sortCombinations(results, sortConfig);
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
 * 选择下一个组合（贪心：优先选择使用次数最少的）
 */
function selectNextCombination(
  sources: unknown[][],
  usageCounts: number[][],
  usedCombinations: Set<string>
): number[] | null {
  const numSources = sources.length;

  // 为每个源按使用次数排序所有元素的索引
  // 格式: [[{idx, count}, ...], ...]
  const sortedIndicesBySource: Array<Array<{ idx: number; count: number }>> = [];

  for (let sourceIdx = 0; sourceIdx < numSources; sourceIdx++) {
    const counts = usageCounts[sourceIdx];
    const sorted = counts
      .map((count, idx) => ({ idx, count }))
      .sort((a, b) => {
        // 使用次数少者优先，次数相同时索引小者优先（保证稳定性）
        return a.count !== b.count ? a.count - b.count : a.idx - b.idx;
      });
    sortedIndicesBySource.push(sorted);
  }

  // 使用回溯法找到最佳组合（优先使用次数少的元素）
  const result: number[] = [];
  const found = backtrackFindBestFull(
    sortedIndicesBySource,
    0,
    result,
    usedCombinations
  );
  return found ? result : null;
}

/**
 * 回溯法找最佳组合（遍历所有元素，按使用次数优先）
 */
function backtrackFindBestFull(
  sortedIndicesBySource: Array<Array<{ idx: number; count: number }>>,
  depth: number,
  current: number[],
  usedCombinations: Set<string>
): boolean {
  if (depth === sortedIndicesBySource.length) {
    // 检查是否已使用
    const key = current.join(',');
    if (!usedCombinations.has(key)) {
      return true;
    }
    return false;
  }

  // 遍历当前源的所有元素（已按使用次数排序）
  for (const { idx } of sortedIndicesBySource[depth]) {
    current.push(idx);
    if (backtrackFindBestFull(sortedIndicesBySource, depth + 1, current, usedCombinations)) {
      return true;
    }
    current.pop();
  }

  return false;
}

/**
 * 获取组合的实际元素
 *
 * @param sources 原始素材源
 * @param indices 索引组合
 * @returns 实际元素的组合
 *
 * @example
 * getCombinationElements([[1,2,3], ['a','b']], [[0,0], [1,1]])
 * // 返回: [[1,'a'], [2,'b']]
 */
export function getCombinationElements<T>(
  sources: T[][],
  indices: number[][]
): T[][] {
  return indices.map(combo =>
    combo.map((idx, sourceIdx) => sources[sourceIdx][idx])
  );
}

/**
 * 计算最大组合数（笛卡尔积大小）
 */
export function getMaxCombinations(sources: unknown[][]): number {
  if (sources.length === 0) return 0;
  return sources.reduce((acc, s) => {
    if (s.length === 0) return 0;
    return acc * s.length;
  }, 1);
}

/**
 * 生成任务数据结构
 *
 * @param sources 素材源数组
 * @param count 需要的任务数量
 * @param buildTask 任务构建函数
 * @param sortConfig 可选的排序配置
 * @returns 任务数组
 *
 * @example
 * interface MyTask { a: string; b: string; c: string; }
 *
 * // 基本用法
 * const tasks = generateTasks(
 *   [['a1', 'a2'], ['b1', 'b2'], ['c1', 'c2']],
 *   3,
 *   (elements, indices, taskIndex) => ({
 *     a: elements[0],
 *     b: elements[1],
 *     c: elements[2],
 *     aIndex: indices[0] + 1,
 *     bIndex: indices[1] + 1,
 *     cIndex: indices[2] + 1,
 *   })
 * );
 *
 * // 带排序：优先按A排序，其次按B排序
 * const sortedTasks = generateTasks(
 *   [aList, bList, cList],
 *   10,
 *   buildTask,
 *   { priority: [0, 1, 2] }  // A > B > C
 * );
 */
export function generateTasks<T, R>(
  sources: T[][],
  count: number,
  buildTask: (elements: T[], indices: number[], taskIndex: number) => R,
  sortConfig?: SortConfig
): R[] {
  const combinations = generateBalancedCombinations(sources, count, sortConfig);

  return combinations.map((indices, taskIndex) => {
    const elements = indices.map((idx, sourceIdx) => sources[sourceIdx][idx]);
    return buildTask(elements, indices, taskIndex);
  });
}

export default {
  generateBalancedCombinations,
  getCombinationElements,
  getMaxCombinations,
  generateTasks,
};
