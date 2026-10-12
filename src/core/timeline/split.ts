import { clipEnd, isClipActiveAtTime } from '../clip.ts';
import type { Clip, Project } from '../project.ts';
import type { Microseconds } from '../time.ts';
import { minClipDuration } from './trim.ts';

/** time에서 잘랐을 때 양쪽 조각이 모두 최소 길이 이상이 되는지 */
export function canSplitAt(clip: Clip, time: Microseconds, minDuration: Microseconds): boolean {
  return time - clip.start >= minDuration && clipEnd(clip) - time >= minDuration;
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
    const duration = clipEnd(clip) - clip.start;
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

/**
 * 자르기 대상. 선택한 클립 위에 플레이헤드가 있으면 그 클립만(경계 근처라 자를 수 없으면 없음),
 * 그렇지 않으면 플레이헤드 아래의 모든 클립.
 */
export function findSplitTargets(
  project: Project,
  time: Microseconds,
  selectedClipId: string | null,
): Clip[] {
  const minDuration = minClipDuration(project);
  const selected = project.clips.find((clip) => clip.id === selectedClipId);
  if (selected && isClipActiveAtTime(selected, time)) {
    return canSplitAt(selected, time, minDuration) ? [selected] : [];
  }
  return project.clips.filter(
    (clip) => isClipActiveAtTime(clip, time) && canSplitAt(clip, time, minDuration),
  );
}
