import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project } from '../project.ts';
import { createAddTrackCommand } from './addTrack.ts';
import { createCompositeCommand } from './composite.ts';
import { buildMoveClipCommand, createMoveClipCommand } from './moveClip.ts';

const S = 1_000_000;

function makeClip(id: string, trackId: string, start: number): Clip {
  return { id, assetId: 'a', trackId, start, inPoint: 0, outPoint: 2 * S };
}

function makeProject(clips: Clip[]): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 'v2', kind: 'video', order: 1 },
    ],
    assets: [{ id: 'a', type: 'video', name: 'a.mp4', duration: 10 * S }],
    clips,
  };
}

describe('createMoveClipCommand', () => {
  it('같은 트랙 안에서 옮기고 undo하면 되돌린다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);
    const command = createMoveClipCommand(
      'c',
      { trackId: 'v1', start: 0 },
      { trackId: 'v1', start: 3 * S },
    );

    const moved = command.execute(project);

    expect(moved.clips[0]).toMatchObject({ trackId: 'v1', start: 3 * S });
    expect(command.undo(moved)).toEqual(project);
  });

  it('다른 트랙으로 옮긴다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);

    const moved = createMoveClipCommand(
      'c',
      { trackId: 'v1', start: 0 },
      { trackId: 'v2', start: S },
    ).execute(project);

    expect(moved.clips[0]).toMatchObject({ trackId: 'v2', start: S });
  });

  it('자기 자신과 겹치는 위치로도 옮길 수 있다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);

    const moved = createMoveClipCommand(
      'c',
      { trackId: 'v1', start: 0 },
      { trackId: 'v1', start: S },
    ).execute(project);

    expect(moved.clips[0]?.start).toBe(S);
  });

  it('다른 클립과 겹치거나 없는 트랙이면 에러를 던진다', () => {
    const project = makeProject([makeClip('c', 'v1', 0), makeClip('d', 'v1', 5 * S)]);
    const from = { trackId: 'v1', start: 0 };

    expect(() =>
      createMoveClipCommand('c', from, { trackId: 'v1', start: 4 * S }).execute(project),
    ).toThrow(/overlaps/);
    expect(() =>
      createMoveClipCommand('c', from, { trackId: 'missing', start: 0 }).execute(project),
    ).toThrow(/Track/);
  });
});

describe('트랙 추가 + 이동 묶음', () => {
  it('새 트랙으로 옮기고 undo 한 번에 트랙까지 제거한다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);
    const command = createCompositeCommand('새 트랙으로 이동', [
      createAddTrackCommand({ id: 'v3', kind: 'video', order: 2 }),
      createMoveClipCommand('c', { trackId: 'v1', start: 0 }, { trackId: 'v3', start: S }),
    ]);

    const next = command.execute(project);

    expect(next.tracks.map((track) => track.id)).toEqual(['v1', 'v2', 'v3']);
    expect(next.clips[0]).toMatchObject({ trackId: 'v3', start: S });
    expect(command.undo(next)).toEqual(project);
  });

  it('클립이 남아 있는 트랙은 제거하지 않는다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);
    const addTrack = createAddTrackCommand({ id: 'v3', kind: 'video', order: 2 });
    const withTrack = addTrack.execute(project);
    const withClipOnTrack = { ...withTrack, clips: [makeClip('c', 'v3', 0)] };

    expect(() => addTrack.undo(withClipOnTrack)).toThrow(/non-empty/);
  });
});

describe('buildMoveClipCommand', () => {
  it('위치가 그대로면 커맨드를 만들지 않는다', () => {
    const project = makeProject([makeClip('c', 'v1', S)]);

    expect(buildMoveClipCommand(project, 'c', { trackId: 'v1', start: S }, () => 'x')).toBeNull();
  });

  it('새 트랙 대상이면 가장 위에 트랙을 만들고 옮긴다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);

    const command = buildMoveClipCommand(
      project,
      'c',
      { trackId: null, start: 2 * S },
      () => 'new',
    );
    const next = command?.execute(project);

    expect(next?.tracks.at(-1)).toEqual({ id: 'new', kind: 'video', order: 2 });
    expect(next?.clips[0]).toMatchObject({ trackId: 'new', start: 2 * S });
  });

  it('기존 트랙 대상이면 이동 커맨드를 만든다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);

    const next = buildMoveClipCommand(
      project,
      'c',
      { trackId: 'v2', start: S },
      () => 'x',
    )?.execute(project);

    expect(next?.clips[0]).toMatchObject({ trackId: 'v2', start: S });
  });
});
