import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project, type TextOverlay } from '../project.ts';
import { resolveItemMove } from './moveItem.ts';

const S = 1_000_000;

function makeClip(id: string, trackId: string, start: number, duration: number): Clip {
  return { id, assetId: 'a', trackId, start, inPoint: 0, outPoint: duration };
}

function makeText(id: string, trackId: string, start: number, duration: number): TextOverlay {
  return {
    id,
    trackId,
    start,
    duration,
    text: id,
    style: { fontSize: 72, color: '#fff', x: 0, y: 0 },
  };
}

function makeProject(clips: Clip[], overlays: TextOverlay[] = []): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 'v2', kind: 'video', order: 1 },
      { id: 't1', kind: 'text', order: 2 },
    ],
    clips,
    overlays,
  };
}

describe('resolveItemMove', () => {
  it('자기 자신과는 겹침을 검사하지 않는다', () => {
    const project = makeProject([makeClip('a', 'v1', 0, 4 * S)]);

    expect(resolveItemMove(project, 'a', 1 * S, 'v1')).toEqual({ trackId: 'v1', start: 1 * S });
  });

  it('같은 트랙의 다른 항목과 겹치면 가장 가까운 빈자리로 옮긴다', () => {
    const project = makeProject([makeClip('a', 'v1', 0, 2 * S), makeClip('b', 'v1', 5 * S, 2 * S)]);

    expect(resolveItemMove(project, 'a', 6 * S, 'v1')).toEqual({ trackId: 'v1', start: 7 * S });
  });

  it('다른 트랙으로 옮길 때는 그 트랙의 항목만 고려한다', () => {
    const project = makeProject([makeClip('a', 'v1', 0, 2 * S), makeClip('b', 'v2', 0, 3 * S)]);

    expect(resolveItemMove(project, 'a', 1 * S, 'v2')).toEqual({ trackId: 'v2', start: 3 * S });
  });

  it('새 트랙으로 옮기면 원하는 위치를 그대로 쓴다 (음수는 0)', () => {
    const project = makeProject([makeClip('a', 'v1', 0, 2 * S)]);

    expect(resolveItemMove(project, 'a', 3 * S, null)).toEqual({ trackId: null, start: 3 * S });
    expect(resolveItemMove(project, 'a', -1 * S, null)).toEqual({ trackId: null, start: 0 });
  });

  it('종류가 맞지 않는 트랙이면 원래 트랙에서 가로로만 옮긴다', () => {
    const project = makeProject([makeClip('a', 'v1', 0, 2 * S)], [makeText('x', 't1', 0, 2 * S)]);

    expect(resolveItemMove(project, 'a', 3 * S, 't1')).toEqual({ trackId: 'v1', start: 3 * S });
    expect(resolveItemMove(project, 'x', 3 * S, 'v2')).toEqual({ trackId: 't1', start: 3 * S });
  });

  it('없는 항목이면 null', () => {
    expect(resolveItemMove(makeProject([]), 'missing', 0, 'v1')).toBeNull();
  });
});
