import type { Span } from '../timelineItem.ts';
import type { Microseconds } from '../time.ts';

/**
 * 같은 트랙의 기존 항목 구간과 겹치지 않으면서 원하는 위치에 가장 가까운 시작 시각을 찾는다.
 * 빈 구간 중 길이가 충분한 곳에서 후보를 고르고, 거리가 같으면 뒤쪽을 택한다
 * (항목 한가운데에 놓으면 그 항목 뒤에 붙는 편이 자연스럽다).
 */
export function findFreePlacement(
  occupied: readonly Span[],
  desiredStart: Microseconds,
  duration: Microseconds,
): Microseconds {
  const desired = Math.max(0, desiredStart);
  const sorted = [...occupied].sort((a, b) => a.start - b.start);

  // 기존 항목 사이의 빈 구간 [gapStart, gapEnd). 마지막 구간은 끝이 없다
  const gaps: [Microseconds, Microseconds][] = [];
  let cursor: Microseconds = 0;
  for (const span of sorted) {
    gaps.push([cursor, span.start]);
    cursor = Math.max(cursor, span.end);
  }
  gaps.push([cursor, Number.POSITIVE_INFINITY]);

  // 마지막 빈 구간에는 항상 들어가므로 그 시작점을 초기값으로 둔다
  let best: Microseconds = Math.max(desired, cursor);
  for (const [gapStart, gapEnd] of gaps) {
    if (gapEnd - gapStart < duration) {
      continue;
    }
    const candidate = Math.min(Math.max(desired, gapStart), gapEnd - duration);
    if (Math.abs(candidate - desired) <= Math.abs(best - desired)) {
      best = candidate;
    }
  }
  return best;
}
