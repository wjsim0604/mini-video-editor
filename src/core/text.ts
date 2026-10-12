import type { Command } from './commands/command.ts';
import { createAddTrackCommand } from './commands/addTrack.ts';
import { createCompositeCommand } from './commands/composite.ts';
import { createAddOverlayCommand } from './commands/overlay.ts';
import type { Project, TextOverlay } from './project.ts';
import { itemsOnTrack, spansOverlap } from './timelineItem.ts';
import type { Microseconds } from './time.ts';
import { nextTrackOrder } from './track.ts';

export const DEFAULT_TEXT_DURATION: Microseconds = 3_000_000;
/** 출력 해상도 기준 px (1080p에서 약 1/15 높이) */
export const DEFAULT_FONT_SIZE = 72;

/**
 * 새 텍스트. x, y는 텍스트 중심의 위치(출력 해상도 기준 px), fontSize도 출력 기준 px다.
 */
export function createTextOverlay(
  project: Project,
  params: { id: string; trackId: string; start: Microseconds },
): TextOverlay {
  return {
    id: params.id,
    trackId: params.trackId,
    start: params.start,
    duration: DEFAULT_TEXT_DURATION,
    text: '텍스트',
    style: {
      fontSize: DEFAULT_FONT_SIZE,
      color: '#ffffff',
      x: Math.round(project.width / 2),
      y: Math.round(project.height / 2),
    },
  };
}

/** [start, start + duration)이 비어 있는 가장 위의 텍스트 트랙. 없으면 null */
export function findTextTrackForInsert(
  project: Project,
  start: Microseconds,
  duration: Microseconds,
): string | null {
  const span = { start, end: start + duration };
  const candidates = project.tracks
    .filter((track) => track.kind === 'text')
    .sort((a, b) => b.order - a.order);
  const free = candidates.find((track) =>
    itemsOnTrack(project, track.id).every((item) => !spansOverlap(item, span)),
  );
  return free?.id ?? null;
}

/**
 * time에 기본 텍스트를 추가하는 커맨드. 빈자리가 있는 텍스트 트랙이 없으면 맨 위에 새로 만든다
 * (트랙 추가와 텍스트 추가는 undo 한 번에 함께 되돌아간다).
 */
export function buildAddTextCommand(
  project: Project,
  time: Microseconds,
  ids: { overlayId: string; trackId: string },
): Command {
  const existingTrackId = findTextTrackForInsert(project, time, DEFAULT_TEXT_DURATION);
  const trackId = existingTrackId ?? ids.trackId;
  const add = createAddOverlayCommand(
    createTextOverlay(project, { id: ids.overlayId, trackId, start: time }),
  );
  if (existingTrackId) {
    return add;
  }
  return createCompositeCommand('텍스트 추가', [
    createAddTrackCommand({ id: trackId, kind: 'text', order: nextTrackOrder(project.tracks) }),
    add,
  ]);
}
