import { describe, expect, it } from 'vitest';
import { collectBoxSnapTargets, snapBox } from './snapBox.ts';

const output = { width: 1920, height: 1080 };

describe('collectBoxSnapTargets', () => {
  it('화면 가장자리·중앙선과 다른 상자의 가장자리·중심을 정렬해 모은다', () => {
    const targets = collectBoxSnapTargets(output, [{ x: 100, y: 960, width: 200, height: 120 }]);

    expect(targets.x).toEqual([0, 100, 200, 300, 960, 1920]);
    expect(targets.y).toEqual([0, 540, 960, 1020, 1080]);
  });
});

describe('snapBox', () => {
  const targets = collectBoxSnapTargets(output, []);

  it('상자 중심을 화면 중앙선에 붙인다', () => {
    // 중심 (955, 546)
    const result = snapBox({ x: 855, y: 496, width: 200, height: 100 }, targets, 10);

    expect(result).toEqual({ dx: 5, dy: -6, guideX: 960, guideY: 540 });
  });

  it('상자 가장자리를 화면 가장자리에 붙인다', () => {
    const result = snapBox({ x: 1712, y: -4, width: 200, height: 100 }, targets, 10);

    expect(result).toEqual({ dx: 8, dy: 4, guideX: 1920, guideY: 0 });
  });

  it('축마다 따로 판단하고, 멀면 붙지 않는다', () => {
    const result = snapBox({ x: 300, y: 3, width: 200, height: 100 }, targets, 10);

    expect(result).toEqual({ dx: 0, dy: -3, guideX: null, guideY: 0 });
  });

  it('다른 상자의 가장자리에 정렬한다', () => {
    const withOther = collectBoxSnapTargets(output, [{ x: 100, y: 800, width: 400, height: 100 }]);

    // 왼쪽 끝 103 → 다른 상자 왼쪽 100
    const result = snapBox({ x: 103, y: 300, width: 250, height: 100 }, withOther, 10);

    expect(result.dx).toBe(-3);
    expect(result.guideX).toBe(100);
  });
});
