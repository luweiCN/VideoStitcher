import type {
  VideoDedupElement,
  VideoDedupEvent,
  VideoDedupPosition,
  VideoDedupScheduleConfig,
} from './types';

const roundTime = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * 可复现的伪随机数生成器。
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function distributeSlack(slack: number, count: number, random: () => number, randomMode: boolean): number[] {
  if (slack <= 0) return Array.from({ length: count }, () => 0);

  const weights = Array.from({ length: count }, () => {
    if (randomMode) {
      return -Math.log(Math.max(0.000001, random()));
    }

    return 0.7 + random() * 0.6;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => slack * (weight / totalWeight));
}

export function buildVideoDedupSchedule(
  videoDuration: number,
  elements: VideoDedupElement[],
  config: VideoDedupScheduleConfig,
): VideoDedupEvent[] {
  if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
    throw new Error('无法获取原视频时长');
  }
  if (elements.length === 0) {
    throw new Error('变体元素库中没有可用元素');
  }

  const eventCount = Math.max(1, Math.floor(config.eventCount));
  const minDuration = Math.max(0.1, config.minDuration);
  const maxDuration = Math.max(minDuration, config.maxDuration);
  const minimumGap = Math.max(0, config.minimumGap);
  const rangeStart = Math.max(0, config.skipHead);
  const rangeEnd = Math.max(rangeStart, videoDuration - Math.max(0, config.skipTail));
  const availableDuration = rangeEnd - rangeStart;
  const minimumRequired = eventCount * minDuration + Math.max(0, eventCount - 1) * minimumGap;

  if (availableDuration < minimumRequired) {
    throw new Error(
      `有效时间仅 ${availableDuration.toFixed(1)} 秒，至少需要 ${minimumRequired.toFixed(1)} 秒；请减少出现次数、持续时间或元素间隔`,
    );
  }

  const positions: VideoDedupPosition[] = config.positions.length > 0 ? config.positions : ['top_left'];
  const random = createSeededRandom(config.randomSeed);
  const rawExtras = Array.from(
    { length: eventCount },
    () => random() * (maxDuration - minDuration),
  );
  const extraBudget = availableDuration
    - eventCount * minDuration
    - Math.max(0, eventCount - 1) * minimumGap;
  const rawExtraTotal = rawExtras.reduce((sum, value) => sum + value, 0);
  const extraScale = rawExtraTotal > extraBudget && rawExtraTotal > 0
    ? extraBudget / rawExtraTotal
    : 1;
  const durations = rawExtras.map((extra) => roundTime(minDuration + extra * extraScale));
  const occupiedDuration = durations.reduce((sum, duration) => sum + duration, 0)
    + Math.max(0, eventCount - 1) * minimumGap;
  const slack = Math.max(0, availableDuration - occupiedDuration);
  const extraGaps = distributeSlack(
    slack,
    eventCount + 1,
    random,
    config.scheduleMode === 'random',
  );

  let cursor = rangeStart + extraGaps[0];
  return durations.map((duration, index) => {
    if (index > 0) {
      cursor += minimumGap + extraGaps[index];
    }

    const element = elements[Math.floor(random() * elements.length) % elements.length];
    const position = positions[Math.floor(random() * positions.length) % positions.length];
    const start = roundTime(cursor);
    const end = roundTime(Math.min(rangeEnd, start + duration));
    const event: VideoDedupEvent = {
      index,
      elementPath: element.path,
      elementType: element.type,
      start,
      duration: roundTime(end - start),
      end,
      position,
      recipe: element.recipe,
    };

    cursor = end;
    return event;
  });
}

export function validateVideoDedupSchedule(events: VideoDedupEvent[], minimumGap: number): boolean {
  for (let index = 1; index < events.length; index += 1) {
    if (events[index].start + 0.001 < events[index - 1].end + minimumGap) {
      return false;
    }
  }

  return true;
}
