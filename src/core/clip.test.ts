import { describe, expect, it } from 'vitest';
import { clipDuration, clipEnd, createClipFromAsset } from './clip.ts';
import type { Asset, Clip } from './project.ts';

function makeClip(start: number, duration: number, inPoint = 0): Clip {
  return {
    id: `clip-${String(start)}`,
    assetId: 'a',
    trackId: 't',
    start,
    inPoint,
    outPoint: inPoint + duration,
  };
}

describe('clipDuration / clipEnd', () => {
  it('inPoint~outPoint 구간으로 길이와 끝 시각을 계산한다', () => {
    const clip = makeClip(1_000_000, 2_000_000, 500_000);

    expect(clipDuration(clip)).toBe(2_000_000);
    expect(clipEnd(clip)).toBe(3_000_000);
  });
});

describe('createClipFromAsset', () => {
  it('에셋 전체 길이를 사용하는 클립을 만든다', () => {
    const asset: Asset = { id: 'a', type: 'video', name: 'a.mp4', duration: 4_000_000 };

    expect(createClipFromAsset(asset, { id: 'c', trackId: 't', start: 1_000_000 })).toEqual({
      id: 'c',
      assetId: 'a',
      trackId: 't',
      start: 1_000_000,
      inPoint: 0,
      outPoint: 4_000_000,
    });
  });
});
