import type { Span } from '../timelineItem.ts';
import type { Microseconds } from '../time.ts';
import { pxToUs } from './coords.ts';

export interface TimeRange {
  start: Microseconds;
  end: Microseconds;
}

/** 화면 크기를 알 수 없을 때(측정 전, 테스트 환경) 모든 것을 그리기 위한 범위 */
export const UNBOUNDED_RANGE: TimeRange = { start: 0, end: Number.POSITIVE_INFINITY };

/**
 * 렌더링할 시간 범위 = 보이는 영역 + 양쪽으로 화면 1개 폭의 여유.
 * 경계를 화면 폭 절반 단위로 맞춰, 스크롤이 조금 움직일 때마다 범위가 바뀌어 다시 그려지지 않게 한다.
 */
export function renderTimeRange(params: {
  scrollLeft: number;
  viewportWidth: number;
  pxPerSecond: number;
}): TimeRange {
  const { scrollLeft, viewportWidth, pxPerSecond } = params;
  if (viewportWidth <= 0) {
    return UNBOUNDED_RANGE;
  }
  const chunk = viewportWidth / 2;
  const startPx = Math.floor((scrollLeft - viewportWidth) / chunk) * chunk;
  const endPx = Math.ceil((scrollLeft + viewportWidth * 2) / chunk) * chunk;
  return {
    start: Math.max(0, pxToUs(startPx, pxPerSecond)),
    end: pxToUs(endPx, pxPerSecond),
  };
}

export function sameRange(a: TimeRange, b: TimeRange): boolean {
  return a.start === b.start && a.end === b.end;
}

/** 항목 구간 [start, end)가 범위와 겹치는지 */
export function spanInRange(span: Span, range: TimeRange): boolean {
  return span.start < range.end && span.end > range.start;
}

/**
 * 드래그 중 포인터가 스크롤 영역 가장자리에 가까울 때의 자동 스크롤 속도(px/프레임).
 * 가장자리에 가까울수록 빠르며, 왼쪽은 음수다.
 */
export function autoScrollSpeed(
  pointerX: number,
  viewportWidth: number,
  edge = 40,
  maxSpeed = 20,
): number {
  if (pointerX < edge) {
    return -Math.ceil(maxSpeed * Math.min(1, (edge - pointerX) / edge));
  }
  if (pointerX > viewportWidth - edge) {
    return Math.ceil(maxSpeed * Math.min(1, (pointerX - (viewportWidth - edge)) / edge));
  }
  return 0;
}
