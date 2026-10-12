import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Clip, type Project } from '../project.ts';
import { createAddClipCommand } from './addClip.ts';

function setup(): { project: Project; trackId: string } {
  const base = createEmptyProject('p', 'test');
  const project: Project = {
    ...base,
    assets: [{ id: 'a', type: 'video', name: 'a.mp4', duration: 4_000_000 }],
  };
  const track = project.tracks[0];
  if (!track) {
    throw new Error('default track missing');
  }
  return { project, trackId: track.id };
}

function makeClip(id: string, trackId: string, start: number): Clip {
  return { id, assetId: 'a', trackId, start, inPoint: 0, outPoint: 2_000_000 };
}

describe('createAddClipCommand', () => {
  it('클립을 추가하고 undo하면 제거한다', () => {
    const { project, trackId } = setup();
    const command = createAddClipCommand(makeClip('c1', trackId, 0));

    const next = command.execute(project);

    expect(next.clips.map((clip) => clip.id)).toEqual(['c1']);
    expect(command.undo(next)).toEqual(project);
  });

  it('맞닿은 위치에는 추가할 수 있다', () => {
    const { project, trackId } = setup();
    const withFirst = createAddClipCommand(makeClip('c1', trackId, 0)).execute(project);

    const next = createAddClipCommand(makeClip('c2', trackId, 2_000_000)).execute(withFirst);

    expect(next.clips).toHaveLength(2);
  });

  it('같은 트랙의 클립과 겹치면 에러를 던진다', () => {
    const { project, trackId } = setup();
    const withFirst = createAddClipCommand(makeClip('c1', trackId, 0)).execute(project);

    expect(() =>
      createAddClipCommand(makeClip('c2', trackId, 1_000_000)).execute(withFirst),
    ).toThrow(/overlaps/);
  });

  it('존재하지 않는 트랙이나 에셋이면 에러를 던진다', () => {
    const { project, trackId } = setup();

    expect(() => createAddClipCommand(makeClip('c1', 'missing', 0)).execute(project)).toThrow(
      /Track/,
    );
    expect(() =>
      createAddClipCommand({ ...makeClip('c1', trackId, 0), assetId: 'missing' }).execute(project),
    ).toThrow(/Asset/);
  });

  it.each([
    ['NaN 시작', { start: Number.NaN }],
    ['소수 시작', { start: 0.5 }],
    ['음수 시작', { start: -1 }],
    ['빈 구간', { inPoint: 1_000_000, outPoint: 1_000_000 }],
  ])('잘못된 시간 값(%s)은 거부한다', (_, override) => {
    const { project, trackId } = setup();

    expect(() =>
      createAddClipCommand({ ...makeClip('c1', trackId, 0), ...override }).execute(project),
    ).toThrow(RangeError);
  });
});
