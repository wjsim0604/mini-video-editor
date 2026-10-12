import { describe, expect, it } from 'vitest';
import { autoScrollSpeed, renderTimeRange, spanInRange, UNBOUNDED_RANGE } from './viewport.ts';

const S = 1_000_000;

describe('renderTimeRange', () => {
  it('보이는 영역 양쪽으로 화면 1개 폭의 여유를 둔다', () => {
    // 50px/s, 화면 1000px, 스크롤 2000px → 보이는 범위 40s~60s, 여유 포함 20s~80s
    expect(renderTimeRange({ scrollLeft: 2000, viewportWidth: 1000, pxPerSecond: 50 })).toEqual({
      start: 20 * S,
      end: 80 * S,
    });
  });

  it('스크롤이 조금 움직여도 같은 범위를 유지한다', () => {
    const a = renderTimeRange({ scrollLeft: 2000, viewportWidth: 1000, pxPerSecond: 50 });
    const b = renderTimeRange({ scrollLeft: 2100, viewportWidth: 1000, pxPerSecond: 50 });
    const c = renderTimeRange({ scrollLeft: 2600, viewportWidth: 1000, pxPerSecond: 50 });

    expect(b).toEqual({ start: 20 * S, end: 90 * S });
    expect(a.start).toBe(b.start);
    expect(c).toEqual({ start: 30 * S, end: 100 * S });
  });

  it('시작은 0보다 작아지지 않는다', () => {
    expect(renderTimeRange({ scrollLeft: 0, viewportWidth: 1000, pxPerSecond: 50 }).start).toBe(0);
  });

  it('화면 크기를 모르면 전체 범위', () => {
    expect(renderTimeRange({ scrollLeft: 0, viewportWidth: 0, pxPerSecond: 50 })).toBe(
      UNBOUNDED_RANGE,
    );
  });
});

describe('spanInRange', () => {
  const clip = { start: 10 * S, end: 15 * S };

  it('범위와 겹치면 true, 맞닿기만 하면 false', () => {
    expect(spanInRange(clip, { start: 0, end: 11 * S })).toBe(true);
    expect(spanInRange(clip, { start: 14 * S, end: 20 * S })).toBe(true);
    expect(spanInRange(clip, { start: 0, end: 10 * S })).toBe(false);
    expect(spanInRange(clip, { start: 15 * S, end: 20 * S })).toBe(false);
  });
});

describe('autoScrollSpeed', () => {
  it('가장자리 밖에서는 0, 가까울수록 빠르다', () => {
    expect(autoScrollSpeed(500, 1000)).toBe(0);
    expect(autoScrollSpeed(980, 1000)).toBe(10);
    expect(autoScrollSpeed(1000, 1000)).toBe(20);
    expect(autoScrollSpeed(1200, 1000)).toBe(20);
    expect(autoScrollSpeed(20, 1000)).toBe(-10);
    expect(autoScrollSpeed(-50, 1000)).toBe(-20);
  });
});
