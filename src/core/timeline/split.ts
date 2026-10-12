import type { Clip, Project, TextOverlay } from '../project.ts';
import {
  findItem,
  isSpanActiveAt,
  timelineItems,
  type Span,
  type TimelineItem,
} from '../timelineItem.ts';
import type { Microseconds } from '../time.ts';
import { minItemDuration } from './trim.ts';

/** time에서 잘랐을 때 양쪽 조각이 모두 최소 길이 이상이 되는지 */
export function canSplitAt(span: Span, time: Microseconds, minDuration: Microseconds): boolean {
  return time - span.start >= minDuration && span.end - time >= minDuration;
}

/**
 * 클립을 time에서 두 조각으로 나눈다. 왼쪽은 기존 id, 오른쪽은 newId를 갖는다.
 * 이미지 클립은 inPoint 0, outPoint = 길이로 정규화한다.
 */
export function splitClipAt(
  clip: Clip,
  time: Microseconds,
  newId: string,
  isImage: boolean,
): [Clip, Clip] {
  const offset = time - clip.start;
  if (isImage) {
    const duration = clip.outPoint - clip.inPoint;
    return [
      { ...clip, inPoint: 0, outPoint: offset },
      { ...clip, id: newId, start: time, inPoint: 0, outPoint: duration - offset },
    ];
  }
  return [
    { ...clip, outPoint: clip.inPoint + offset },
    { ...clip, id: newId, start: time, inPoint: clip.inPoint + offset },
  ];
}

/** 텍스트를 time에서 두 조각으로 나눈다. 내용과 스타일은 그대로 복사한다. */
export function splitOverlayAt(
  overlay: TextOverlay,
  time: Microseconds,
  newId: string,
): [TextOverlay, TextOverlay] {
  const offset = time - overlay.start;
  return [
    { ...overlay, duration: offset },
    { ...overlay, id: newId, start: time, duration: overlay.duration - offset },
  ];
}

/**
 * 자르기 대상. 선택한 항목 위에 플레이헤드가 있으면 그 항목만(경계 근처라 자를 수 없으면 없음),
 * 그렇지 않으면 플레이헤드 아래의 모든 항목.
 */
export function findSplitTargets(
  project: Project,
  time: Microseconds,
  selectedItemId: string | null,
): TimelineItem[] {
  const minDuration = minItemDuration(project);
  const selected = findItem(project, selectedItemId);
  if (selected && isSpanActiveAt(selected, time)) {
    return canSplitAt(selected, time, minDuration) ? [selected] : [];
  }
  return timelineItems(project).filter(
    (item) => isSpanActiveAt(item, time) && canSplitAt(item, time, minDuration),
  );
}
