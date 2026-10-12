import type { Project, Track } from '../project.ts';
import { findItem, trackKindFor } from '../timelineItem.ts';
import type { Microseconds } from '../time.ts';
import { nextTrackOrder } from '../track.ts';
import { createAddTrackCommand } from './addTrack.ts';
import { assertItemPlaceable, assertValidSpan } from './clipValidation.ts';
import type { Command } from './command.ts';
import { createCompositeCommand } from './composite.ts';

export interface ItemPosition {
  trackId: string;
  start: Microseconds;
}

/** 이동은 위치(트랙·시작)만 바꾼다. 원본 사용 구간(inPoint/outPoint)과 길이는 그대로다. */
function moveTo(project: Project, itemId: string, position: ItemPosition): Project {
  const item = findItem(project, itemId);
  if (!item) {
    throw new Error(`Item not found: ${itemId}`);
  }
  const moved = { ...item, ...position, end: position.start + (item.end - item.start) };
  assertValidSpan(moved);
  assertItemPlaceable(project, moved);
  return item.kind === 'clip'
    ? {
        ...project,
        clips: project.clips.map((clip) => (clip.id === itemId ? { ...clip, ...position } : clip)),
      }
    : {
        ...project,
        overlays: project.overlays.map((overlay) =>
          overlay.id === itemId ? { ...overlay, ...position } : overlay,
        ),
      };
}

/** 항목(클립·텍스트)의 트랙과 시작 위치를 바꾼다. from은 undo에 쓰이므로 생성 시점의 위치를 넘긴다. */
export function createMoveItemCommand(
  itemId: string,
  from: ItemPosition,
  to: ItemPosition,
): Command {
  return {
    label: '이동',
    execute: (project) => moveTo(project, itemId, to),
    undo: (project) => moveTo(project, itemId, from),
  };
}

/**
 * 드래그 결과(resolveItemMove)를 커맨드로 만든다. 새 트랙이면 항목 종류에 맞는 트랙 추가와 이동을 하나로 묶는다.
 * 위치가 바뀌지 않았으면 null (히스토리에 의미 없는 항목을 남기지 않는다).
 */
export function buildMoveItemCommand(
  project: Project,
  itemId: string,
  target: { trackId: string | null; start: Microseconds },
  createTrackId: () => string,
): Command | null {
  const item = findItem(project, itemId);
  if (!item) {
    return null;
  }
  const from: ItemPosition = { trackId: item.trackId, start: item.start };

  if (target.trackId === null) {
    const track: Track = {
      id: createTrackId(),
      kind: trackKindFor(item),
      order: nextTrackOrder(project.tracks),
    };
    return createCompositeCommand('새 트랙으로 이동', [
      createAddTrackCommand(track),
      createMoveItemCommand(itemId, from, { trackId: track.id, start: target.start }),
    ]);
  }
  if (target.trackId === from.trackId && target.start === from.start) {
    return null;
  }
  return createMoveItemCommand(itemId, from, { trackId: target.trackId, start: target.start });
}
