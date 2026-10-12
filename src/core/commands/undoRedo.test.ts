import { describe, expect, it } from 'vitest';
import { createEmptyProject, type Project } from '../project.ts';
import { buildAddTextCommand } from '../text.ts';
import { createAddAssetCommand } from './addAsset.ts';
import { createAddClipCommand } from './addClip.ts';
import { mergeCommands, type Command } from './command.ts';
import { buildSetClipTransformCommand } from './clipTransform.ts';
import { createAddOverlayCommand, buildUpdateOverlayCommand } from './overlay.ts';
import { buildMoveItemCommand } from './moveItem.ts';
import { createRemoveItemCommand, createRemoveTrackCommand } from './removeItem.ts';
import { createSetItemSpanCommand } from './setItemSpan.ts';
import { buildSplitCommand } from './splitItem.ts';
import { createImportSubtitlesCommand, planSubtitleImport } from '../subtitles/subtitles.ts';

/**
 * 3주차 완료 기준 "모든 편집 동작이 undo/redo 가능하다"를 확인하는 표.
 * 새 편집 커맨드를 만들면 여기에 한 줄 추가한다.
 */
const S = 1_000_000;

/** 영상(6s)·이미지 에셋, V1·V2·T1 트랙, 영상 클립 2개, 이미지 클립 1개, 텍스트 1개가 있는 프로젝트 */
function baseProject(): Project {
  const empty = createEmptyProject('p', 'test');
  return {
    ...empty,
    tracks: [
      { id: 'v1', kind: 'video', order: 0 },
      { id: 'v2', kind: 'video', order: 1 },
      { id: 't1', kind: 'text', order: 2 },
    ],
    assets: [
      { id: 'video', type: 'video', name: 'v.mp4', duration: 6 * S, width: 1920, height: 1080 },
      { id: 'image', type: 'image', name: 'i.png', duration: 5 * S, width: 800, height: 600 },
    ],
    clips: [
      { id: 'c1', assetId: 'video', trackId: 'v1', start: 0, inPoint: S, outPoint: 4 * S },
      { id: 'c2', assetId: 'video', trackId: 'v1', start: 5 * S, inPoint: 0, outPoint: 2 * S },
      { id: 'img', assetId: 'image', trackId: 'v2', start: S, inPoint: 0, outPoint: 3 * S },
    ],
    overlays: [
      {
        id: 'x',
        trackId: 't1',
        start: 0,
        duration: 4 * S,
        text: '텍스트',
        style: { fontSize: 72, color: '#ffffff', x: 960, y: 540 },
      },
    ],
  };
}

function required(command: Command | null): Command {
  if (!command) {
    throw new Error('command expected');
  }
  return command;
}

let nextId = 0;
const createId = () => `new-${String(++nextId)}`;

/** [이름, 커맨드 만들기, (선택) 실행 전 상태 준비] */
type Case = [string, (project: Project) => Command, ((project: Project) => Project)?];

const cases: Case[] = [
  [
    '에셋 추가',
    () => createAddAssetCommand({ id: 'a2', type: 'image', name: 'b.png', duration: 5 * S }),
  ],
  [
    '클립 추가',
    () =>
      createAddClipCommand({
        id: 'c3',
        assetId: 'video',
        trackId: 'v1',
        start: 8 * S,
        inPoint: 0,
        outPoint: S,
      }),
  ],
  [
    '같은 트랙 이동',
    (p) => required(buildMoveItemCommand(p, 'c2', { trackId: 'v1', start: 9 * S }, createId)),
  ],
  [
    '다른 트랙 이동',
    (p) => required(buildMoveItemCommand(p, 'c2', { trackId: 'v2', start: 5 * S }, createId)),
  ],
  [
    '새 트랙으로 이동',
    (p) => required(buildMoveItemCommand(p, 'c1', { trackId: null, start: S }, createId)),
  ],
  [
    '텍스트 이동',
    (p) => required(buildMoveItemCommand(p, 'x', { trackId: 't1', start: 2 * S }, createId)),
  ],
  [
    '영상 트리밍(시작)',
    () => createSetItemSpanCommand('c1', { start: 0, end: 3 * S }, { start: S, end: 3 * S }),
  ],
  [
    '이미지 트리밍(끝)',
    () => createSetItemSpanCommand('img', { start: S, end: 4 * S }, { start: S, end: 9 * S }),
  ],
  [
    '텍스트 트리밍',
    () => createSetItemSpanCommand('x', { start: 0, end: 4 * S }, { start: 0, end: 7 * S }),
  ],
  ['영상 자르기', (p) => required(buildSplitCommand(p, 6 * S, null, createId))],
  ['여러 트랙 자르기', (p) => required(buildSplitCommand(p, 2 * S, null, createId))],
  ['텍스트 자르기', (p) => required(buildSplitCommand(p, 3 * S, 'x', createId))],
  [
    '텍스트 추가(기존 트랙)',
    (p) => buildAddTextCommand(p, 5 * S, { overlayId: 'y', trackId: 'unused' }),
  ],
  ['텍스트 추가(새 트랙)', (p) => buildAddTextCommand(p, 0, { overlayId: 'y', trackId: 't2' })],
  [
    '텍스트 직접 추가',
    () =>
      createAddOverlayCommand({
        id: 'z',
        trackId: 't1',
        start: 6 * S,
        duration: S,
        text: 'z',
        style: { fontSize: 40, color: '#000000', x: 0, y: 0 },
      }),
  ],
  [
    '텍스트 내용·스타일 수정',
    (p) =>
      required(
        buildUpdateOverlayCommand(p, 'x', {
          text: '안녕',
          style: { fontSize: 120, color: '#ff0000' },
        }),
      ),
  ],
  [
    '프리뷰 위치 이동',
    (p) => required(buildUpdateOverlayCommand(p, 'x', { style: { x: 1200, y: 300 } })),
  ],
  [
    '클립 위치·크기 수정',
    (p) => required(buildSetClipTransformCommand(p, 'img', { x: 400, y: 300, scale: 0.5 })),
  ],
  [
    '클립 배치 초기화',
    (p) => required(buildSetClipTransformCommand(p, 'img', null)),
    (p) => required(buildSetClipTransformCommand(p, 'img', { x: 100 })).execute(p),
  ],
  ['클립 삭제', (p) => required(createRemoveItemCommand(p, 'c1'))],
  ['텍스트 삭제', (p) => required(createRemoveItemCommand(p, 'x'))],
  [
    '빈 트랙 삭제',
    (p) => required(createRemoveTrackCommand(p, 'v2')),
    (p) => required(createRemoveItemCommand(p, 'img')).execute(p),
  ],
  [
    '연속 입력(합쳐진 커맨드)',
    (p) => {
      const first = required(buildUpdateOverlayCommand(p, 'x', { text: '안' }));
      const second = required(buildUpdateOverlayCommand(first.execute(p), 'x', { text: '안녕' }));
      return mergeCommands(first, second);
    },
  ],
  [
    '자막 가져오기(겹치는 자막은 여러 트랙)',
    (p) =>
      createImportSubtitlesCommand(
        planSubtitleImport(
          p,
          [
            { start: 0, end: 2 * S, text: '하나' },
            { start: S, end: 3 * S, text: '둘' },
          ],
          createId,
        ),
      ),
  ],
];

describe('모든 편집 커맨드 undo/redo 왕복', () => {
  it.each(cases)('%s', (_, build, prepare) => {
    const before = prepare ? prepare(baseProject()) : baseProject();
    const command = build(before);

    const executed = command.execute(before);
    expect(executed).not.toEqual(before);

    const undone = command.undo(executed);
    expect(undone).toEqual(before);

    const redone = command.execute(undone);
    expect(redone).toEqual(executed);
  });
});
