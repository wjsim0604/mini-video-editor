import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project } from '../project.ts';
import { findSplitTargets, splitClipAt } from './split.ts';

const S = 1_000_000;

function makeClip(id: string, trackId: string, start: number, duration: number): Clip {
  return { id, assetId: 'a', trackId, start, inPoint: S, outPoint: S + duration };
}

function makeProject(clips: Clip[]): Project {
  return { ...createEmptyProject('p', 'test'), clips };
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

describe('findSplitTargets', () => {
  const lower = makeClip('lower', 'v1', 0, 4 * S);
  const upper = makeClip('upper', 'v2', S, 4 * S);
  const project = makeProject([lower, upper]);

  it('선택이 없으면 플레이헤드 아래의 모든 클립', () => {
    expect(findSplitTargets(project, 2 * S, null).map((clip) => clip.id)).toEqual([
      'lower',
      'upper',
    ]);
  });

  it('선택한 클립 위에 플레이헤드가 있으면 그 클립만', () => {
    expect(findSplitTargets(project, 2 * S, 'upper').map((clip) => clip.id)).toEqual(['upper']);
  });

  it('선택한 클립이 플레이헤드 밖이면 플레이헤드 아래의 모든 클립', () => {
    expect(findSplitTargets(project, 0.5 * S, 'upper').map((clip) => clip.id)).toEqual(['lower']);
  });

  it('경계에서 1프레임 이내면 자르지 않는다', () => {
    expect(findSplitTargets(project, 10_000, null)).toEqual([]);
    expect(findSplitTargets(project, S + 10_000, 'upper')).toEqual([]);
  });
});
