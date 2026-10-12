import { findItem, itemsOnTrack, spanDuration } from '../timelineItem.ts';
import type { Project } from '../project.ts';
import type { Microseconds } from '../time.ts';
import { findFreePlacement } from './placement.ts';

export interface ItemMoveTarget {
  /** null이면 새 트랙 */
  trackId: string | null;
  start: Microseconds;
}

/**
 * 항목을 desiredStart, targetTrackId로 옮길 때 실제로 놓일 위치.
 * 옮기는 항목 자신을 제외한 같은 트랙 항목과 겹치지 않는 가장 가까운 자리를 고른다.
 * 대상 트랙의 종류가 맞지 않으면(예: 클립을 텍스트 트랙으로) 원래 트랙에서 가로로만 옮긴다.
 */
export function resolveItemMove(
  project: Project,
  itemId: string,
  desiredStart: Microseconds,
  targetTrackId: string | null,
): ItemMoveTarget | null {
  const item = findItem(project, itemId);
  if (!item) {
    return null;
  }
  if (targetTrackId === null) {
    return { trackId: null, start: Math.max(0, desiredStart) };
  }
  const target = project.tracks.find((track) => track.id === targetTrackId);
  const expectedKind = item.kind === 'clip' ? 'video' : 'text';
  const trackId = target?.kind === expectedKind ? target.id : item.trackId;
  return {
    trackId,
    start: findFreePlacement(
      itemsOnTrack(project, trackId, itemId),
      desiredStart,
      spanDuration(item),
    ),
  };
}
