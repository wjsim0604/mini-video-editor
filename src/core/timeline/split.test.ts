import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project, type TextOverlay } from '../project.ts';
import { findSplitTargets, splitClipAt, splitOverlayAt } from './split.ts';

const S = 1_000_000;

function makeClip(id: string, trackId: string, start: number, duration: number): Clip {
  return { id, assetId: 'a', trackId, start, inPoint: S, outPoint: S + duration };
}

const text: TextOverlay = {
  id: 'x',
  trackId: 't',
  start: 0,
  duration: 4 * S,
  text: 'hi',
  style: { fontSize: 72, color: '#fff', x: 0, y: 0 },
};

function makeProject(clips: Clip[], overlays: TextOverlay[] = []): Project {
  return { ...createEmptyProject('p', 'test'), clips, overlays };
}

describe('splitClipAt', () => {
  it('영상 클립을 원본 구간이 이어지도록 나눈다', () => {
    const clip = makeClip('c', 't', 2 * S, 4 * S); // 타임라인 2s~6s, 원본 1s~5s

    expect(splitClipAt(clip, 3 * S, 'n', false)).toEqual([
      { ...clip, outPoint: 2 * S },
      { ...clip, id: 'n', start: 3 * S, inPoint: 2 * S },
    ]);
  });

  it('이미지 클립은 inPoint 0으로 정규화한다', () => {
    const clip: Clip = {
      id: 'c',
      assetId: 'i',
      trackId: 't',
      start: 0,
      inPoint: 0,
      outPoint: 5 * S,
    };

    expect(splitClipAt(clip, 2 * S, 'n', true)).toEqual([
      { ...clip, outPoint: 2 * S },
      { ...clip, id: 'n', start: 2 * S, inPoint: 0, outPoint: 3 * S },
    ]);
  });
});

describe('splitOverlayAt', () => {
  it('텍스트를 나누고 내용·스타일을 복사한다', () => {
    expect(splitOverlayAt(text, S, 'n')).toEqual([
      { ...text, duration: S },
      { ...text, id: 'n', start: S, duration: 3 * S },
    ]);
  });
});

describe('findSplitTargets', () => {
  const lower = makeClip('lower', 'v1', 0, 4 * S);
  const upper = makeClip('upper', 'v2', S, 4 * S);
  const project = makeProject([lower, upper], [text]);
  const ids = (time: number, selected: string | null) =>
    findSplitTargets(project, time, selected).map((item) => item.id);

  it('선택이 없으면 플레이헤드 아래의 모든 항목 (텍스트 포함)', () => {
    expect(ids(2 * S, null)).toEqual(['lower', 'upper', 'x']);
  });

  it('선택한 항목 위에 플레이헤드가 있으면 그 항목만', () => {
    expect(ids(2 * S, 'upper')).toEqual(['upper']);
  });

  it('선택한 항목이 플레이헤드 밖이면 플레이헤드 아래의 모든 항목', () => {
    expect(ids(0.5 * S, 'upper')).toEqual(['lower', 'x']);
  });

  it('경계에서 1프레임 이내면 자르지 않는다', () => {
    expect(ids(10_000, null)).toEqual([]);
    expect(ids(S + 10_000, 'upper')).toEqual([]);
  });
});
