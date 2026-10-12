import { describe, expect, it } from 'vitest';
import type { Track } from './project.ts';
import { nextTrackOrder, sortTracksForDisplay, trackLabels } from './track.ts';

const tracks: Track[] = [
  { id: 'v1', kind: 'video', order: 0 },
  { id: 't1', kind: 'text', order: 2 },
  { id: 'v2', kind: 'video', order: 1 },
];

describe('nextTrackOrder', () => {
  it('가장 큰 order 다음 값을 반환한다', () => {
    expect(nextTrackOrder(tracks)).toBe(3);
    expect(nextTrackOrder([])).toBe(0);
  });
});

describe('sortTracksForDisplay', () => {
  it('order가 큰 트랙부터 정렬한다', () => {
    expect(sortTracksForDisplay(tracks).map((track) => track.id)).toEqual(['t1', 'v2', 'v1']);
  });
});

describe('trackLabels', () => {
  it('종류별로 아래 트랙부터 번호를 매긴다', () => {
    expect(Object.fromEntries(trackLabels(tracks))).toEqual({ v1: 'V1', v2: 'V2', t1: 'T1' });
  });
});
