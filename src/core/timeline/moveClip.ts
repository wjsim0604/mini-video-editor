import { clipDuration } from '../clip.ts';
import type { Project } from '../project.ts';
import type { Microseconds } from '../time.ts';
import { findFreePlacement } from './placement.ts';

export interface ClipMoveTarget {
  /** null이면 새 트랙 */
  trackId: string | null;
  start: Microseconds;
}

/**
 * 클립을 desiredStart, targetTrackId로 옮길 때 실제로 놓일 위치.
 * 옮기는 클립 자신을 제외한 같은 트랙 클립과 겹치지 않는 가장 가까운 자리를 고른다.
 * (스냅은 desiredStart를 보정하는 단계로 이 함수 앞에 추가한다)
 */
export function resolveClipMove(
  project: Project,
  clipId: string,
  desiredStart: Microseconds,
  targetTrackId: string | null,
): ClipMoveTarget | null {
  const clip = project.clips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    return null;
  }
  if (targetTrackId === null) {
    return { trackId: null, start: Math.max(0, desiredStart) };
  }
  const others = project.clips.filter(
    (candidate) => candidate.trackId === targetTrackId && candidate.id !== clipId,
  );
  return {
    trackId: targetTrackId,
    start: findFreePlacement(others, desiredStart, clipDuration(clip)),
  };
}
