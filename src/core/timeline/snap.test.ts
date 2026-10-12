import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project } from '../project.ts';
import { collectSnapTargets, createEditPositioner, findSnap } from './snap.ts';

const S = 1_000_000;

function makeClip(id: string, trackId: string, start: number, duration: number): Clip {
  return { id, assetId: 'a', trackId, start, inPoint: 0, outPoint: duration };
}

function makeProject(clips: Clip[]): Project {
  return { ...createEmptyProject('p', 'test'), clips };
}

describe('collectSnapTargets', () => {
  it('모든 트랙의 클립 경계, 플레이헤드, 0을 정렬·중복 제거해 모은다', () => {
    const project = makeProject([
      makeClip('a', 'v1', 2 * S, 3 * S),
      makeClip('b', 'v2', 5 * S, 1 * S),
    ]);

    expect(collectSnapTargets(project, { playhead: 4 * S })).toEqual([
      0,
      2 * S,
      4 * S,
      5 * S,
      6 * S,
    ]);
  });

  it('편집 중인 클립의 경계는 제외한다', () => {
    const project = makeProject([makeClip('a', 'v1', 2 * S, 3 * S)]);

    expect(collectSnapTargets(project, { playhead: 0, excludeItemId: 'a' })).toEqual([0]);
  });
});

describe('findSnap', () => {
  const targets = [0, 2 * S, 5 * S];
  const threshold = 160_000;

  it('허용 거리 안의 가장 가까운 기준점으로 보정한다', () => {
    expect(findSnap([2.1 * S], targets, threshold)).toEqual({ delta: -100_000, target: 2 * S });
  });

  it('허용 거리 밖이면 null', () => {
    expect(findSnap([3 * S], targets, threshold)).toBeNull();
  });

  it('여러 끝점 중 더 가까운 쪽으로 붙는다', () => {
    // 시작 1.85s는 2s까지 0.15s, 끝 4.95s는 5s까지 0.05s → 끝이 붙는다
    expect(findSnap([1.85 * S, 4.95 * S], targets, threshold)).toEqual({
      delta: 50_000,
      target: 5 * S,
    });
  });

  it('배열 양 끝 밖의 값도 처리한다', () => {
    expect(findSnap([-0.1 * S], targets, threshold)).toEqual({ delta: 100_000, target: 0 });
    expect(findSnap([5.1 * S], targets, threshold)).toEqual({ delta: -100_000, target: 5 * S });
    expect(findSnap([S], [], threshold)).toBeNull();
  });
});

describe('createEditPositioner', () => {
  const base = { targets: [0, 2 * S], threshold: 160_000, fps: 30 };

  it('스냅되면 기준점을 알려준다', () => {
    const position = createEditPositioner({ ...base, snapEnabled: true });

    expect(position([2.1 * S])).toEqual({ delta: -100_000, snappedTo: 2 * S });
  });

  it('스냅되지 않으면 프레임 경계로 맞춘다', () => {
    const position = createEditPositioner({ ...base, snapEnabled: true });

    // 3.02s → 가장 가까운 프레임 경계 3.033333s
    expect(position([3_020_000])).toEqual({ delta: 13_333, snappedTo: null });
  });

  it('스냅이 꺼져 있거나 일시 해제하면 프레임 정렬만 한다', () => {
    expect(createEditPositioner({ ...base, snapEnabled: false })([2.1 * S])).toEqual({
      delta: 0,
      snappedTo: null,
    });
    expect(createEditPositioner({ ...base, snapEnabled: true })([2.1 * S], true)).toEqual({
      delta: 0,
      snappedTo: null,
    });
  });
});
