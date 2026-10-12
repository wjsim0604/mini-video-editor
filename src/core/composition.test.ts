import { describe, expect, it } from 'vitest';
import { findUpcomingClips, projectDuration, resolveLayers } from './composition.ts';
import { createEmptyProject, type Clip, type Project } from './project.ts';

const S = 1_000_000;

function makeClip(
  id: string,
  trackId: string,
  start: number,
  inPoint: number,
  outPoint: number,
): Clip {
  return { id, assetId: `asset-${id}`, trackId, start, inPoint, outPoint };
}

function makeProject(clips: Clip[]): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 'v2', kind: 'video', order: 1 },
      { id: 'a1', kind: 'audio', order: 2 },
    ],
    clips,
  };
}

describe('resolveLayers', () => {
  it('활성 클립의 원본 기준 시각을 계산한다', () => {
    const project = makeProject([makeClip('a', 'v1', 2 * S, 10 * S, 15 * S)]);

    expect(resolveLayers(project, 3 * S)).toEqual([
      { clipId: 'a', assetId: 'asset-a', trackId: 'v1', sourceTime: 11 * S },
    ]);
  });

  it('클립 구간은 [start, end)이다', () => {
    const project = makeProject([
      makeClip('a', 'v1', 0, 0, 2 * S),
      makeClip('b', 'v1', 2 * S, 0, 2 * S),
    ]);

    expect(resolveLayers(project, 2 * S - 1).map((layer) => layer.clipId)).toEqual(['a']);
    expect(resolveLayers(project, 2 * S).map((layer) => layer.clipId)).toEqual(['b']);
    expect(resolveLayers(project, 4 * S)).toEqual([]);
  });

  it('아래 트랙부터 위 트랙 순서로 반환하고 비디오가 아닌 트랙은 제외한다', () => {
    const project = makeProject([
      makeClip('top', 'v2', 0, 0, 5 * S),
      makeClip('audio', 'a1', 0, 0, 5 * S),
      makeClip('bottom', 'v1', 0, 0, 5 * S),
    ]);

    expect(resolveLayers(project, S).map((layer) => layer.clipId)).toEqual(['bottom', 'top']);
  });
});

describe('findUpcomingClips', () => {
  it('lookahead 안에서 시작하는 클립만 찾는다', () => {
    const project = makeProject([
      makeClip('now', 'v1', 0, 0, 2 * S),
      makeClip('soon', 'v1', 2 * S, 0, 2 * S),
      makeClip('later', 'v1', 4 * S, 0, 2 * S),
    ]);

    expect(findUpcomingClips(project, 1.5 * S, S).map((clip) => clip.id)).toEqual(['soon']);
  });
});

describe('projectDuration', () => {
  it('빈 프로젝트는 0', () => {
    expect(projectDuration(makeProject([]))).toBe(0);
  });

  it('가장 늦게 끝나는 클립이나 텍스트의 끝', () => {
    const project = makeProject([makeClip('a', 'v1', S, 0, 3 * S)]);
    expect(projectDuration(project)).toBe(4 * S);

    const withOverlay: Project = {
      ...project,
      overlays: [
        {
          id: 't',
          trackId: 't1',
          start: 3 * S,
          duration: 5 * S,
          text: 'hi',
          style: { fontSize: 32, color: '#fff', x: 0, y: 0 },
        },
      ],
    };
    expect(projectDuration(withOverlay)).toBe(8 * S);
  });
});
