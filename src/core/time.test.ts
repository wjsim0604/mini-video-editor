import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatTimecode,
  frameToUs,
  quantizeToFrame,
  secondsToUs,
  usToFrame,
  usToSeconds,
} from './time.ts';

describe('secondsToUs / usToSeconds', () => {
  it('초를 마이크로초 정수로 변환한다', () => {
    expect(secondsToUs(1)).toBe(1_000_000);
    expect(secondsToUs(1.5)).toBe(1_500_000);
  });

  it('부동소수점 오차를 정수로 반올림한다', () => {
    // 0.1 + 0.2 = 0.30000000000000004
    expect(secondsToUs(0.1 + 0.2)).toBe(300_000);
    expect(Number.isInteger(secondsToUs(1 / 3))).toBe(true);
  });

  it('마이크로초를 초로 변환한다', () => {
    expect(usToSeconds(2_500_000)).toBe(2.5);
  });
});

describe('frameToUs', () => {
  it('나누어떨어지는 fps에서 정확한 시각을 반환한다', () => {
    expect(frameToUs(1, 25)).toBe(40_000);
    expect(frameToUs(30, 30)).toBe(1_000_000);
  });

  it('나누어떨어지지 않는 fps에서 정수로 반올림한다', () => {
    expect(frameToUs(1, 30)).toBe(33_333);
    expect(frameToUs(2, 30)).toBe(66_667);
  });
});

describe('usToFrame', () => {
  it.each([24, 25, 30, 60, 29.97])('%s fps에서 frameToUs와 왕복 변환이 일치한다', (fps) => {
    for (let frame = 0; frame <= 10_000; frame++) {
      const start = frameToUs(frame, fps);
      expect(usToFrame(start, fps)).toBe(frame);
      expect(usToFrame(frameToUs(frame + 1, fps) - 1, fps)).toBe(frame);
    }
  });
});

describe('formatTimecode', () => {
  it('HH:MM:SS:FF 형식으로 표시한다', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00:00');
    expect(formatTimecode(frameToUs(1, 30), 30)).toBe('00:00:00:01');
    expect(formatTimecode(secondsToUs(3661) + frameToUs(29, 30), 30)).toBe('01:01:01:29');
  });

  it('음수나 정수가 아닌 값은 거부한다', () => {
    expect(() => formatTimecode(-1, 30)).toThrow(RangeError);
    expect(() => formatTimecode(0.5, 30)).toThrow(RangeError);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [3_000_000, '0:03'],
    [65_000_000, '1:05'],
    [599_400_000, '9:59'],
    [599_600_000, '10:00'],
    [3_661_000_000, '1:01:01'],
  ])('%i us → %s', (us, expected) => {
    expect(formatDuration(us)).toBe(expected);
  });

  it('음수나 유한하지 않은 값은 거부한다', () => {
    expect(() => formatDuration(-1)).toThrow(RangeError);
    expect(() => formatDuration(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('quantizeToFrame', () => {
  it('가장 가까운 프레임 경계로 반올림한다', () => {
    expect(quantizeToFrame(2_020_000, 30)).toBe(2_033_333);
    expect(quantizeToFrame(2_010_000, 30)).toBe(2_000_000);
    expect(quantizeToFrame(-10_000, 30)).toBe(0);
  });

  it.each([24, 25, 30, 60, 29.97])('%s fps에서 이미 프레임 경계인 값은 그대로 둔다', (fps) => {
    for (let frame = 0; frame <= 3_000; frame++) {
      const boundary = frameToUs(frame, fps);
      expect(quantizeToFrame(boundary, fps)).toBe(boundary);
    }
  });
});
