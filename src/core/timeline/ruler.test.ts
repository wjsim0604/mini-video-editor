import { describe, expect, it } from 'vitest';
import { formatRulerLabel, pickRulerStep } from './ruler.ts';

describe('pickRulerStep', () => {
  it.each([
    [50, 2_000_000],
    [80, 1_000_000],
    [200, 500_000],
    [1000, 100_000],
    [5, 30_000_000],
  ])('%s px/s → %i us', (pxPerSecond, expected) => {
    expect(pickRulerStep(pxPerSecond)).toBe(expected);
  });

  it('너무 축소되면 가장 큰 간격을 사용한다', () => {
    expect(pickRulerStep(0.0001)).toBe(3_600_000_000);
  });
});

describe('formatRulerLabel', () => {
  it.each([
    [0, '0:00'],
    [2_000_000, '0:02'],
    [90_000_000, '1:30'],
    [1_500_000, '0:01.5'],
    [200_000, '0:00.2'],
  ])('%i us → %s', (us, expected) => {
    expect(formatRulerLabel(us)).toBe(expected);
  });
});
