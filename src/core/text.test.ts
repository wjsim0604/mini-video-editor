import { describe, expect, it } from 'vitest';
import { buildUpdateOverlayCommand, createAddOverlayCommand } from './commands/overlay.ts';
import { createEmptyProject, type Project, type TextOverlay } from './project.ts';
import { buildAddTextCommand, findTextTrackForInsert } from './text.ts';

const S = 1_000_000;

function makeText(id: string, trackId: string, start: number): TextOverlay {
  return {
    id,
    trackId,
    start,
    duration: 3 * S,
    text: id,
    style: { fontSize: 72, color: '#fff', x: 0, y: 0 },
  };
}

function withTextTracks(overlays: TextOverlay[]): Project {
  const base = createEmptyProject('p', 'test');
  return {
    ...base,
    tracks: [
      ...base.tracks,
      { id: 't1', kind: 'text', order: 1 },
      { id: 't2', kind: 'text', order: 2 },
    ],
    overlays,
  };
}

describe('findTextTrackForInsert', () => {
  it('빈자리가 있는 가장 위의 텍스트 트랙', () => {
    expect(findTextTrackForInsert(withTextTracks([]), 0, 3 * S)).toBe('t2');
    expect(findTextTrackForInsert(withTextTracks([makeText('a', 't2', S)]), 0, 3 * S)).toBe('t1');
  });

  it('모든 텍스트 트랙이 차 있거나 텍스트 트랙이 없으면 null', () => {
    const project = withTextTracks([makeText('a', 't1', 0), makeText('b', 't2', 0)]);

    expect(findTextTrackForInsert(project, S, 3 * S)).toBeNull();
    expect(findTextTrackForInsert(createEmptyProject('p', 'test'), 0, 3 * S)).toBeNull();
  });
});

describe('buildAddTextCommand', () => {
  it('텍스트 트랙이 없으면 맨 위에 만들고 화면 가운데에 기본 텍스트를 추가한다', () => {
    const project = createEmptyProject('p', 'test');
    const command = buildAddTextCommand(project, 2 * S, { overlayId: 'x', trackId: 'new' });

    const next = command.execute(project);

    expect(next.tracks.at(-1)).toEqual({ id: 'new', kind: 'text', order: 1 });
    expect(next.overlays).toEqual([
      {
        id: 'x',
        trackId: 'new',
        start: 2 * S,
        duration: 3 * S,
        text: '텍스트',
        style: { fontSize: 72, color: '#ffffff', x: 960, y: 540 },
      },
    ]);
    expect(command.undo(next)).toEqual(project);
  });

  it('빈자리가 있는 텍스트 트랙이 있으면 그 트랙에 추가한다', () => {
    const project = withTextTracks([]);

    const next = buildAddTextCommand(project, 0, { overlayId: 'x', trackId: 'unused' }).execute(
      project,
    );

    expect(next.tracks).toHaveLength(3);
    expect(next.overlays[0]?.trackId).toBe('t2');
  });
});

describe('buildUpdateOverlayCommand', () => {
  const project = withTextTracks([makeText('a', 't1', 0)]);

  it('내용과 스타일을 바꾸고 undo하면 이전 값으로 돌아간다', () => {
    const command = buildUpdateOverlayCommand(project, 'a', {
      text: '안녕',
      style: { color: '#ff0000' },
    });
    const next = command?.execute(project);

    expect(next?.overlays[0]).toMatchObject({
      text: '안녕',
      style: { color: '#ff0000', fontSize: 72 },
    });
    expect(next && command?.undo(next)).toEqual(project);
  });

  it('바꾸는 필드에 따라 mergeKey가 정해진다', () => {
    expect(buildUpdateOverlayCommand(project, 'a', { text: 'b' })?.mergeKey).toBe('overlay:a:text');
    expect(buildUpdateOverlayCommand(project, 'a', { style: { y: 1, x: 2 } })?.mergeKey).toBe(
      'overlay:a:x,y',
    );
  });

  it('잘못된 스타일은 거부하고, 없는 텍스트면 null', () => {
    expect(() =>
      buildUpdateOverlayCommand(project, 'a', { style: { fontSize: 0 } })?.execute(project),
    ).toThrow(RangeError);
    expect(buildUpdateOverlayCommand(project, 'missing', { text: 'x' })).toBeNull();
  });

  it('비디오 트랙에는 텍스트를 놓을 수 없다', () => {
    const base = createEmptyProject('p', 'test');
    const videoTrackId = base.tracks[0]?.id ?? '';

    expect(() => createAddOverlayCommand(makeText('bad', videoTrackId, 0)).execute(base)).toThrow(
      /Cannot place/,
    );
  });
});
