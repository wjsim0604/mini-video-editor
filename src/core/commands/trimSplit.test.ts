import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project } from '../project.ts';
import { createSetClipTimingCommand } from './setClipTiming.ts';
import { buildSplitCommand } from './splitClip.ts';

const S = 1_000_000;

const clip: Clip = { id: 'c', assetId: 'a', trackId: 'v1', start: 0, inPoint: 0, outPoint: 4 * S };
const upper: Clip = { id: 'u', assetId: 'a', trackId: 'v2', start: S, inPoint: 0, outPoint: 4 * S };

function makeProject(clips: Clip[]): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 'v2', kind: 'video', order: 1 },
    ],
    assets: [{ id: 'a', type: 'video', name: 'a.mp4', duration: 6 * S }],
    clips,
  };
}

describe('createSetClipTimingCommand', () => {
  it('타이밍을 바꾸고 undo하면 되돌린다', () => {
    const project = makeProject([clip]);
    const command = createSetClipTimingCommand(
      'c',
      { start: 0, inPoint: 0, outPoint: 4 * S },
      { start: S, inPoint: S, outPoint: 4 * S },
    );

    const next = command.execute(project);

    expect(next.clips[0]).toMatchObject({ start: S, inPoint: S, outPoint: 4 * S });
    expect(command.undo(next)).toEqual(project);
  });

  it('원본 길이를 넘으면 에러를 던진다', () => {
    const command = createSetClipTimingCommand(
      'c',
      { start: 0, inPoint: 0, outPoint: 4 * S },
      { start: 0, inPoint: 0, outPoint: 7 * S },
    );

    expect(() => command.execute(makeProject([clip]))).toThrow(/source/);
  });
});

describe('buildSplitCommand', () => {
  it('플레이헤드 아래 클립을 둘로 나누고 undo하면 합친다', () => {
    const project = makeProject([clip]);
    const command = buildSplitCommand(project, S, null, () => 'right');

    const next = command?.execute(project);

    expect(next?.clips).toEqual([
      { ...clip, outPoint: S },
      { ...clip, id: 'right', start: S, inPoint: S },
    ]);
    expect(next && command?.undo(next)).toEqual(project);
  });

  it('여러 트랙을 한 번에 자르고 undo 한 번에 모두 합친다', () => {
    const project = makeProject([clip, upper]);
    let id = 0;
    const command = buildSplitCommand(project, 2 * S, null, () => `new-${String(++id)}`);

    const next = command?.execute(project);

    expect(next?.clips).toHaveLength(4);
    expect(next && command?.undo(next)).toEqual(project);
  });

  it('선택한 클립만 자른다', () => {
    const project = makeProject([clip, upper]);

    const next = buildSplitCommand(project, 2 * S, 'u', () => 'right')?.execute(project);

    expect(next?.clips.map((c) => c.id)).toEqual(['c', 'u', 'right']);
  });

  it('자를 대상이 없으면 null', () => {
    expect(buildSplitCommand(makeProject([clip]), 5 * S, null, () => 'x')).toBeNull();
  });
});
