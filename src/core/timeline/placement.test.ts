import { describe, expect, it } from 'vitest';
import type { Span } from '../timelineItem.ts';
import { findFreePlacement } from './placement.ts';

const S = 1_000_000;

function makeClip(start: number, duration: number): Span {
  return { start, end: start + duration };
}

describe('findFreePlacement', () => {
  it('빈 트랙에서는 원하는 위치를 그대로 사용한다', () => {
    expect(findFreePlacement([], 3 * S, 2 * S)).toBe(3 * S);
  });

  it('음수 위치는 0으로 보정한다', () => {
    expect(findFreePlacement([], -5 * S, 2 * S)).toBe(0);
  });

  it('겹치지 않으면 원하는 위치를 그대로 사용한다', () => {
    const clips = [makeClip(0, 2 * S)];

    expect(findFreePlacement(clips, 5 * S, 2 * S)).toBe(5 * S);
  });

  it('클립 뒤쪽 절반에 놓으면 그 클립 바로 뒤에 붙인다', () => {
    const clips = [makeClip(0, 4 * S)];

    expect(findFreePlacement(clips, 3 * S, 2 * S)).toBe(4 * S);
  });

  it('클립 앞쪽에 공간이 있으면 앞쪽 빈자리로 붙인다', () => {
    const clips = [makeClip(10 * S, 4 * S)];

    expect(findFreePlacement(clips, 9 * S, 2 * S)).toBe(8 * S);
  });

  it('거리가 같으면 뒤쪽을 택한다', () => {
    const clips = [makeClip(10 * S, 4 * S)];

    // 앞쪽 후보 8s, 뒤쪽 후보 14s → 원하는 위치 11s에서 각각 3s
    expect(findFreePlacement(clips, 11 * S, 2 * S)).toBe(14 * S);
  });

  it('길이가 부족한 틈은 건너뛴다', () => {
    const clips = [makeClip(0, 2 * S), makeClip(3 * S, 2 * S)];

    // 2s~3s 틈은 1s뿐이라 2s 클립이 들어가지 않는다
    expect(findFreePlacement(clips, 2 * S, 2 * S)).toBe(5 * S);
  });

  it('길이가 딱 맞는 틈에는 들어간다', () => {
    const clips = [makeClip(0, 2 * S), makeClip(4 * S, 2 * S)];

    expect(findFreePlacement(clips, 2.5 * S, 2 * S)).toBe(2 * S);
  });

  it('정렬되지 않은 입력도 처리한다', () => {
    const clips = [makeClip(4 * S, 2 * S), makeClip(0, 2 * S)];

    expect(findFreePlacement(clips, 1 * S, 2 * S)).toBe(2 * S);
  });

  it('결과는 기존 클립 어느 것과도 겹치지 않는다', () => {
    const clips = [makeClip(1 * S, 3 * S), makeClip(5 * S, 1 * S), makeClip(8 * S, 4 * S)];
    const duration = 2 * S;

    for (let desired = 0; desired <= 15 * S; desired += S / 4) {
      const start = findFreePlacement(clips, desired, duration);
      for (const clip of clips) {
        expect(start < clip.end && clip.start < start + duration).toBe(false);
      }
    }
  });
});
