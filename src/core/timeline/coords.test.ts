import { describe, expect, it } from 'vitest';
import { pxToUs, usToPx } from './coords.ts';

describe('usToPx / pxToUs', () => {
  it('배율에 맞춰 시간과 좌표를 변환한다', () => {
    expect(usToPx(2_000_000, 50)).toBe(100);
    expect(pxToUs(100, 50)).toBe(2_000_000);
  });

  it('pxToUs는 항상 정수 마이크로초를 반환한다', () => {
    expect(pxToUs(1, 30)).toBe(33_333);
    expect(Number.isInteger(pxToUs(0.37, 7))).toBe(true);
  });

  it('왕복 변환 오차가 1us 이내다', () => {
    for (const us of [0, 1, 33_333, 1_234_567, 3_600_000_000]) {
      expect(Math.abs(pxToUs(usToPx(us, 37), 37) - us)).toBeLessThanOrEqual(1);
    }
  });
});
