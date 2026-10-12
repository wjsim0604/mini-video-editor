import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project, type TextOverlay } from '../project.ts';
import { createAddTrackCommand } from './addTrack.ts';
import { createCompositeCommand } from './composite.ts';
import { buildMoveItemCommand, createMoveItemCommand } from './moveItem.ts';
import { createSetItemSpanCommand } from './setItemSpan.ts';
import { buildSplitCommand } from './splitItem.ts';

const S = 1_000_000;

function makeClip(id: string, trackId: string, start: number, duration = 2 * S): Clip {
  return { id, assetId: 'a', trackId, start, inPoint: 0, outPoint: duration };
}

const text: TextOverlay = {
  id: 'x',
  trackId: 't1',
  start: 0,
  duration: 4 * S,
  text: 'hi',
  style: { fontSize: 72, color: '#fff', x: 960, y: 540 },
};

function makeProject(clips: Clip[], overlays: TextOverlay[] = []): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 'v2', kind: 'video', order: 1 },
      { id: 't1', kind: 'text', order: 2 },
    ],
    assets: [{ id: 'a', type: 'video', name: 'a.mp4', duration: 6 * S }],
    clips,
    overlays,
  };
}

describe('createMoveItemCommand', () => {
  it('같은 트랙 안에서 옮기고 undo하면 되돌린다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);
    const command = createMoveItemCommand(
      'c',
      { trackId: 'v1', start: 0 },
      { trackId: 'v1', start: 3 * S },
    );

    const moved = command.execute(project);

    expect(moved.clips[0]).toMatchObject({
      trackId: 'v1',
      start: 3 * S,
      inPoint: 0,
      outPoint: 2 * S,
    });
    expect(command.undo(moved)).toEqual(project);
  });

  it('다른 트랙으로 옮기고, 자기 자신과 겹치는 위치도 허용한다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);
    const from = { trackId: 'v1', start: 0 };

    expect(
      createMoveItemCommand('c', from, { trackId: 'v2', start: S }).execute(project).clips[0],
    ).toMatchObject({
      trackId: 'v2',
      start: S,
    });
    expect(
      createMoveItemCommand('c', from, { trackId: 'v1', start: S }).execute(project).clips[0]
        ?.start,
    ).toBe(S);
  });

  it('텍스트도 옮긴다', () => {
    const project = makeProject([], [text]);

    const moved = createMoveItemCommand(
      'x',
      { trackId: 't1', start: 0 },
      { trackId: 't1', start: 2 * S },
    ).execute(project);

    expect(moved.overlays[0]).toEqual({ ...text, start: 2 * S });
  });

  it('겹치거나, 없는 트랙이거나, 종류가 다른 트랙이면 에러를 던진다', () => {
    const project = makeProject([makeClip('c', 'v1', 0), makeClip('d', 'v1', 5 * S)], [text]);
    const from = { trackId: 'v1', start: 0 };

    expect(() =>
      createMoveItemCommand('c', from, { trackId: 'v1', start: 4 * S }).execute(project),
    ).toThrow(/overlaps/);
    expect(() =>
      createMoveItemCommand('c', from, { trackId: 'missing', start: 0 }).execute(project),
    ).toThrow(/Track/);
    expect(() =>
      createMoveItemCommand('c', from, { trackId: 't1', start: 10 * S }).execute(project),
    ).toThrow(/Cannot place/);
  });
});

describe('buildMoveItemCommand', () => {
  it('위치가 그대로면 커맨드를 만들지 않는다', () => {
    const project = makeProject([makeClip('c', 'v1', S)]);

    expect(buildMoveItemCommand(project, 'c', { trackId: 'v1', start: S }, () => 'x')).toBeNull();
  });

  it('새 트랙 대상이면 항목 종류에 맞는 트랙을 맨 위에 만들고 옮긴다 (undo 한 번에 되돌림)', () => {
    const project = makeProject([makeClip('c', 'v1', 0)], [text]);

    const clipCommand = buildMoveItemCommand(
      project,
      'c',
      { trackId: null, start: 2 * S },
      () => 'new-v',
    );
    const afterClip = clipCommand?.execute(project);
    expect(afterClip?.tracks.at(-1)).toEqual({ id: 'new-v', kind: 'video', order: 3 });
    expect(afterClip?.clips[0]).toMatchObject({ trackId: 'new-v', start: 2 * S });
    expect(afterClip && clipCommand?.undo(afterClip)).toEqual(project);

    const textCommand = buildMoveItemCommand(
      project,
      'x',
      { trackId: null, start: 0 },
      () => 'new-t',
    );
    expect(textCommand?.execute(project).tracks.at(-1)).toEqual({
      id: 'new-t',
      kind: 'text',
      order: 3,
    });
  });

  it('클립이 남아 있는 트랙은 트랙 추가 undo로 제거하지 않는다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);
    const addTrack = createAddTrackCommand({ id: 'v3', kind: 'video', order: 3 });
    const withClipOnTrack = { ...addTrack.execute(project), clips: [makeClip('c', 'v3', 0)] };

    expect(() => addTrack.undo(withClipOnTrack)).toThrow(/non-empty/);
  });

  it('여러 커맨드 묶음은 undo를 역순으로 적용한다', () => {
    const project = makeProject([makeClip('c', 'v1', 0)]);
    const command = createCompositeCommand('묶음', [
      createAddTrackCommand({ id: 'v3', kind: 'video', order: 3 }),
      createMoveItemCommand('c', { trackId: 'v1', start: 0 }, { trackId: 'v3', start: S }),
    ]);

    expect(command.undo(command.execute(project))).toEqual(project);
  });
});

describe('createSetItemSpanCommand', () => {
  it('클립 구간을 바꾸면 원본 사용 구간도 맞추고, undo하면 되돌린다', () => {
    const project = makeProject([makeClip('c', 'v1', 0, 4 * S)]);
    const command = createSetItemSpanCommand(
      'c',
      { start: 0, end: 4 * S },
      { start: S, end: 4 * S },
    );

    const next = command.execute(project);

    expect(next.clips[0]).toMatchObject({ start: S, inPoint: S, outPoint: 4 * S });
    expect(command.undo(next)).toEqual(project);
  });

  it('텍스트 구간을 바꾼다', () => {
    const project = makeProject([], [text]);

    const next = createSetItemSpanCommand(
      'x',
      { start: 0, end: 4 * S },
      { start: 0, end: 9 * S },
    ).execute(project);

    expect(next.overlays[0]?.duration).toBe(9 * S);
  });

  it('원본 길이를 넘거나 정수가 아니면 에러를 던진다', () => {
    const project = makeProject([makeClip('c', 'v1', 0, 4 * S)]);

    expect(() =>
      createSetItemSpanCommand('c', { start: 0, end: 4 * S }, { start: 0, end: 7 * S }).execute(
        project,
      ),
    ).toThrow(/source/);
    expect(() =>
      createSetItemSpanCommand('c', { start: 0, end: 4 * S }, { start: 0.5, end: 4 * S }).execute(
        project,
      ),
    ).toThrow(RangeError);
  });
});

describe('buildSplitCommand', () => {
  it('플레이헤드 아래 클립을 둘로 나누고 undo하면 합친다', () => {
    const clip = makeClip('c', 'v1', 0, 4 * S);
    const project = makeProject([clip]);
    const command = buildSplitCommand(project, S, null, () => 'right');

    const next = command?.execute(project);

    expect(next?.clips).toEqual([
      { ...clip, outPoint: S },
      { ...clip, id: 'right', start: S, inPoint: S },
    ]);
    expect(next && command?.undo(next)).toEqual(project);
  });

  it('클립과 텍스트를 한 번에 자르고 undo 한 번에 모두 합친다', () => {
    const project = makeProject([makeClip('c', 'v1', 0, 4 * S)], [text]);
    let id = 0;
    const command = buildSplitCommand(project, 2 * S, null, () => `new-${String(++id)}`);

    const next = command?.execute(project);

    expect(next?.clips).toHaveLength(2);
    expect(next?.overlays).toHaveLength(2);
    expect(next && command?.undo(next)).toEqual(project);
  });

  it('선택한 항목만 자르고, 대상이 없으면 null', () => {
    const project = makeProject([makeClip('c', 'v1', 0, 4 * S)], [text]);

    expect(
      buildSplitCommand(project, 2 * S, 'x', () => 'r')
        ?.execute(project)
        .overlays.map((o) => o.id),
    ).toEqual(['x', 'r']);
    expect(buildSplitCommand(project, 5 * S, null, () => 'r')).toBeNull();
  });
});
