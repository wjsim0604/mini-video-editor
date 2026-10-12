import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project, type TextOverlay } from './project.ts';
import {
  clipItem,
  findItem,
  itemsOnTrack,
  spansOverlap,
  timelineItems,
  trackKindFor,
  withItemSpan,
} from './timelineItem.ts';

const S = 1_000_000;

const video: Clip = {
  id: 'v',
  assetId: 'va',
  trackId: 't1',
  start: 2 * S,
  inPoint: S,
  outPoint: 4 * S,
};
const image: Clip = {
  id: 'i',
  assetId: 'ia',
  trackId: 't1',
  start: 6 * S,
  inPoint: 0,
  outPoint: 2 * S,
};
const text: TextOverlay = {
  id: 'x',
  trackId: 'tt',
  start: S,
  duration: 3 * S,
  text: 'hi',
  style: { fontSize: 72, color: '#fff', x: 960, y: 540 },
};

function makeProject(): Project {
  return {
    ...createEmptyProject('p', 'test'),
    assets: [
      { id: 'va', type: 'video', name: 'v.mp4', duration: 10 * S },
      { id: 'ia', type: 'image', name: 'i.png', duration: 5 * S },
    ],
    clips: [video, image],
    overlays: [text],
  };
}

describe('timelineItems', () => {
  it('클립과 텍스트를 공통 구간 형태로 모은다', () => {
    expect(
      timelineItems(makeProject()).map(({ kind, id, start, end }) => ({ kind, id, start, end })),
    ).toEqual([
      { kind: 'clip', id: 'v', start: 2 * S, end: 5 * S },
      { kind: 'clip', id: 'i', start: 6 * S, end: 8 * S },
      { kind: 'text', id: 'x', start: S, end: 4 * S },
    ]);
  });

  it('같은 객체에는 같은 item을 돌려준다 (memo 비교 유지)', () => {
    expect(clipItem(video)).toBe(clipItem(video));
  });

  it('id로 찾고, 트랙별로 모은다', () => {
    const project = makeProject();

    expect(findItem(project, 'x')?.kind).toBe('text');
    expect(findItem(project, 'missing')).toBeUndefined();
    expect(itemsOnTrack(project, 't1', 'v').map((item) => item.id)).toEqual(['i']);
  });
});

describe('spansOverlap / trackKindFor', () => {
  it('맞닿는 구간은 겹치지 않는다', () => {
    expect(spansOverlap({ start: 0, end: 2 }, { start: 1, end: 3 })).toBe(true);
    expect(spansOverlap({ start: 0, end: 2 }, { start: 2, end: 3 })).toBe(false);
  });

  it('클립은 비디오 트랙, 텍스트는 텍스트 트랙', () => {
    expect(trackKindFor({ kind: 'clip' })).toBe('video');
    expect(trackKindFor({ kind: 'text' })).toBe('text');
  });
});

describe('withItemSpan', () => {
  it('영상 클립은 시작이 움직인 만큼 inPoint도 옮긴다', () => {
    const project = makeProject();
    const next = withItemSpan(project, clipItem(video), { start: 3 * S, end: 5 * S });

    expect(next.clips[0]).toEqual({ ...video, start: 3 * S, inPoint: 2 * S, outPoint: 4 * S });
  });

  it('이미지 클립은 inPoint 0으로 정규화한다', () => {
    const project = makeProject();
    const next = withItemSpan(project, clipItem(image), { start: 5 * S, end: 9 * S });

    expect(next.clips[1]).toEqual({ ...image, start: 5 * S, inPoint: 0, outPoint: 4 * S });
  });

  it('텍스트는 start와 duration을 바꾼다', () => {
    const project = makeProject();
    const item = findItem(project, 'x');
    const next = item ? withItemSpan(project, item, { start: 0, end: 2 * S }) : project;

    expect(next.overlays[0]).toEqual({ ...text, start: 0, duration: 2 * S });
  });
});
