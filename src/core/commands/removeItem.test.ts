import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from '../project.ts';
import { canRemoveTrack, createRemoveItemCommand, createRemoveTrackCommand } from './removeItem.ts';

const S = 1_000_000;

function makeProject(): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 'v2', kind: 'video', order: 1 },
      { id: 't1', kind: 'text', order: 2 },
      { id: 't2', kind: 'text', order: 3 },
    ],
    clips: [
      { id: 'a', assetId: 'x', trackId: 'v1', start: 0, inPoint: 0, outPoint: S },
      { id: 'b', assetId: 'x', trackId: 'v1', start: S, inPoint: 0, outPoint: S },
    ],
    overlays: [
      {
        id: 'text',
        trackId: 't1',
        start: 0,
        duration: S,
        text: 'hi',
        style: { fontSize: 72, color: '#fff', x: 0, y: 0 },
      },
    ],
  };
}

describe('createRemoveItemCommand', () => {
  it('클립을 지우고, undo하면 원래 배열 위치에 되돌린다', () => {
    const project = makeProject();
    const command = createRemoveItemCommand(project, 'a');

    const next = command?.execute(project);

    expect(next?.clips.map((clip) => clip.id)).toEqual(['b']);
    expect(next && command?.undo(next)).toEqual(project);
    expect(command?.label).toBe('클립 삭제');
  });

  it('텍스트를 지운다', () => {
    const project = makeProject();
    const command = createRemoveItemCommand(project, 'text');

    expect(command?.execute(project).overlays).toEqual([]);
    expect(command?.label).toBe('텍스트 삭제');
  });

  it('없는 항목이면 null', () => {
    expect(createRemoveItemCommand(makeProject(), 'missing')).toBeNull();
  });
});

describe('canRemoveTrack / createRemoveTrackCommand', () => {
  it('빈 트랙만 지울 수 있다', () => {
    const project = makeProject();

    expect(canRemoveTrack(project, 'v2')).toBe(true);
    expect(canRemoveTrack(project, 't2')).toBe(true);
    expect(canRemoveTrack(project, 'v1')).toBe(false);
    expect(canRemoveTrack(project, 't1')).toBe(false);
    expect(canRemoveTrack(project, 'missing')).toBe(false);
  });

  it('마지막 남은 비디오 트랙은 지울 수 없다', () => {
    const base = createEmptyProject('p', 'test');
    const onlyTrack = base.tracks[0]?.id ?? '';

    expect(canRemoveTrack(base, onlyTrack)).toBe(false);
    expect(createRemoveTrackCommand(base, onlyTrack)).toBeNull();
  });

  it('트랙을 지우고, undo하면 원래 위치에 되돌린다', () => {
    const project = makeProject();
    const command = createRemoveTrackCommand(project, 'v2');

    const next = command?.execute(project);

    expect(next?.tracks.map((track) => track.id)).toEqual(['v1', 't1', 't2']);
    expect(next && command?.undo(next)).toEqual(project);
  });
});
