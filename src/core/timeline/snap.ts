import type { Project } from '../project.ts';
import { timelineItems } from '../timelineItem.ts';
import { quantizeToFrame, type Microseconds } from '../time.ts';

/**
 * 스냅 기준점: 모든 트랙의 항목(클립·텍스트) 경계 + 플레이헤드 + 타임라인 시작(0). 정렬·중복 제거된 배열.
 * 드래그 시작 시 한 번만 만들고, 이동 중에는 findSnap의 이진 탐색으로 재사용한다.
 */
export function collectSnapTargets(
  project: Project,
  options: { playhead: Microseconds; excludeItemId?: string | null },
): Microseconds[] {
  const times = new Set<Microseconds>([0, options.playhead]);
  for (const item of timelineItems(project)) {
    if (item.id !== options.excludeItemId) {
      times.add(item.start);
      times.add(item.end);
    }
  }
  return [...times].sort((a, b) => a - b);
}

export interface SnapMatch {
  /** 편집 위치에 더해야 할 보정값 */
  delta: Microseconds;
  /** 붙은 기준점 */
  target: Microseconds;
}

/**
 * 편집 중인 끝점들(예: 이동 시 [시작, 끝]) 중 기준점에 가장 가까운 것을 찾는다.
 * 거리가 threshold 이하일 때만 스냅하며, 거리가 같으면 앞쪽 끝점을 우선한다.
 */
export function findSnap(
  edges: readonly Microseconds[],
  targets: readonly Microseconds[],
  threshold: Microseconds,
): SnapMatch | null {
  let best: SnapMatch | null = null;
  for (const edge of edges) {
    const target = nearest(targets, edge);
    if (target === undefined) {
      continue;
    }
    const delta = target - edge;
    if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
      best = { delta, target };
    }
  }
  return best;
}

/** 정렬된 배열에서 value에 가장 가까운 값 (이진 탐색) */
function nearest(sorted: readonly Microseconds[], value: Microseconds): Microseconds | undefined {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((sorted[mid] ?? 0) < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const after = sorted[low];
  const before = sorted[low - 1];
  if (before === undefined) {
    return after;
  }
  if (after === undefined) {
    return before;
  }
  return value - before <= after - value ? before : after;
}

export interface EditPosition {
  delta: Microseconds;
  /** 스냅된 기준점 (안내선 표시용). 프레임 정렬만 했으면 null */
  snappedTo: Microseconds | null;
}

/**
 * 편집 위치 보정기. 스냅이 켜져 있고 기준점에 가까우면 스냅하고,
 * 아니면 첫 끝점을 가장 가까운 프레임 경계로 맞춘다.
 */
export function createEditPositioner(options: {
  targets: readonly Microseconds[];
  threshold: Microseconds;
  fps: number;
  snapEnabled: boolean;
}): (edges: readonly [Microseconds, ...Microseconds[]], bypassSnap?: boolean) => EditPosition {
  return (edges, bypassSnap = false) => {
    if (options.snapEnabled && !bypassSnap) {
      const match = findSnap(edges, options.targets, options.threshold);
      if (match) {
        return { delta: match.delta, snappedTo: match.target };
      }
    }
    const [first] = edges;
    return { delta: quantizeToFrame(first, options.fps) - first, snappedTo: null };
  };
}
