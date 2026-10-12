import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from '../project.ts';
import {
  createImportSubtitlesCommand,
  planSubtitleImport,
  subtitleCuesFromProject,
  subtitleStyle,
} from './subtitles.ts';

const S = 1_000_000;

function project(): Project {
  return {
    ...createEmptyProject('p', 'test'),
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 't1', kind: 'text', order: 1 },
    ],
  };
}

function idFactory() {
  let next = 0;
  return () => `id${String(++next)}`;
}

describe('subtitleStyle', () => {
  it('출력 해상도 기준 아래 가운데, 높이에 비례한 글자 크기', () => {
    expect(subtitleStyle({ width: 1920, height: 1080 })).toEqual({
      fontSize: 59,
      color: '#ffffff',
      x: 960,
      y: 950,
    });
    expect(subtitleStyle({ width: 1280, height: 720 })).toMatchObject({ x: 640, y: 634 });
  });
});

describe('planSubtitleImport', () => {
  it('겹치지 않는 자막은 기존 트랙 위의 새 텍스트 트랙 하나에 놓는다', () => {
    const plan = planSubtitleImport(
      project(),
      [
        { start: 0, end: S, text: '하나' },
        { start: S, end: 2 * S, text: '둘' },
      ],
      idFactory(),
    );

    expect(plan.tracks).toEqual([{ id: 'id1', kind: 'text', order: 2 }]);
    expect(
      plan.overlays.map(({ trackId, start, duration, text }) => [trackId, start, duration, text]),
    ).toEqual([
      ['id1', 0, S, '하나'],
      ['id1', S, S, '둘'],
    ]);
  });

  it('겹치는 자막은 위 트랙으로 나누고, 빈 트랙은 다시 쓴다', () => {
    const plan = planSubtitleImport(
      project(),
      [
        { start: 0, end: 3 * S, text: 'A' },
        { start: S, end: 2 * S, text: 'B' },
        { start: 1.5 * S, end: 4 * S, text: 'C' },
        { start: 3 * S, end: 5 * S, text: 'D' },
      ],
      idFactory(),
    );

    expect(plan.tracks.map((track) => track.order)).toEqual([2, 3, 4]);
    const laneOf = (text: string) =>
      plan.overlays.find((overlay) => overlay.text === text)?.trackId;
    expect([laneOf('A'), laneOf('B'), laneOf('C'), laneOf('D')]).toEqual([
      plan.tracks[0]?.id,
      plan.tracks[1]?.id,
      plan.tracks[2]?.id,
      plan.tracks[0]?.id,
    ]);
    // 화면에서도 겹치지 않게 위 트랙일수록 위에 놓는다 (59px 글자 × 2.5 ≈ 148px 간격)
    expect(plan.overlays.map((overlay) => overlay.style.y)).toEqual([950, 802, 654, 950]);
  });

  it('시각을 프레임 경계로 맞추고, 1프레임보다 짧은 자막은 1프레임으로 늘린다', () => {
    const plan = planSubtitleImport(
      project(),
      [
        { start: 1_010_000, end: 2_020_000, text: '반올림' },
        { start: 5_000_000, end: 5_001_000, text: '짧음' },
      ],
      idFactory(),
    );

    expect(plan.overlays.map(({ start, duration }) => [start, duration])).toEqual([
      [1_000_000, 1_033_333],
      [5_000_000, 33_333],
    ]);
  });

  it('자막마다 스타일 객체를 따로 갖는다', () => {
    const plan = planSubtitleImport(
      project(),
      [
        { start: 0, end: S, text: 'a' },
        { start: S, end: 2 * S, text: 'b' },
      ],
      idFactory(),
    );

    expect(plan.overlays[0]?.style).not.toBe(plan.overlays[1]?.style);
  });

  it('자막이 없으면 트랙도 만들지 않는다', () => {
    expect(planSubtitleImport(project(), [], idFactory())).toEqual({ tracks: [], overlays: [] });
  });
});

describe('createImportSubtitlesCommand', () => {
  const cues = [
    { start: 0, end: 2 * S, text: 'A' },
    { start: S, end: 3 * S, text: 'B' },
  ];

  it('트랙과 자막을 한 번에 추가하고, undo로 모두 되돌린다', () => {
    const before = project();
    const command = createImportSubtitlesCommand(planSubtitleImport(before, cues, idFactory()));

    const after = command.execute(before);
    expect(after.tracks).toHaveLength(4);
    expect(after.overlays).toHaveLength(2);
    expect(command.undo(after)).toEqual(before);
  });

  it('이미 있는 id면 실행하지 않는다', () => {
    const before = project();
    const command = createImportSubtitlesCommand(planSubtitleImport(before, cues, idFactory()));
    const after = command.execute(before);

    expect(() => command.execute(after)).toThrow(/already exists/);
  });

  it('같은 트랙에서 겹치는 계획은 거부한다', () => {
    const command = createImportSubtitlesCommand({
      tracks: [{ id: 'n', kind: 'text', order: 5 }],
      overlays: cues.map((cue, index) => ({
        id: `o${String(index)}`,
        trackId: 'n',
        start: cue.start,
        duration: cue.end - cue.start,
        text: cue.text,
        style: subtitleStyle(project()),
      })),
    });

    expect(() => command.execute(project())).toThrow(/overlaps/);
  });
});

describe('subtitleCuesFromProject', () => {
  it('모든 텍스트 트랙의 텍스트를 시작 순으로 모으고, 빈 텍스트는 뺀다', () => {
    const style = subtitleStyle(project());
    const source: Project = {
      ...project(),
      overlays: [
        { id: 'b', trackId: 't1', start: 2 * S, duration: S, text: '둘', style },
        { id: 'a', trackId: 't1', start: 0, duration: S, text: '하나\n줄', style },
        { id: 'e', trackId: 't1', start: 4 * S, duration: S, text: '  ', style },
      ],
    };

    expect(subtitleCuesFromProject(source)).toEqual([
      { start: 0, end: S, text: '하나\n줄' },
      { start: 2 * S, end: 3 * S, text: '둘' },
    ]);
  });
});
