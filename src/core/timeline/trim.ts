import { findItem, itemsOnTrack, type Span } from '../timelineItem.ts';
import type { Project } from '../project.ts';
import { frameToUs, type Microseconds } from '../time.ts';

export type TrimEdge = 'start' | 'end';

/** 항목의 최소 길이 = 1프레임 */
export function minItemDuration(project: Project): Microseconds {
  return frameToUs(1, project.fps);
}

/**
 * 항목의 한쪽 끝을 desiredTime(타임라인 시각)으로 옮길 때의 결과 구간.
 * - 영상 클립: 원본 범위 [0, 원본 길이]를 벗어나지 않는다
 * - 이미지 클립·텍스트: 원본 길이 제한이 없다
 * - 최소 1프레임, 같은 트랙의 이웃 항목 경계와 타임라인 시작(0)에서 멈춘다
 */
export function resolveTrim(
  project: Project,
  itemId: string,
  edge: TrimEdge,
  desiredTime: Microseconds,
): Span | null {
  const item = findItem(project, itemId);
  if (!item) {
    return null;
  }
  // 원본 길이 제한은 영상 클립에만 있다
  let sourceZeroAt = Number.NEGATIVE_INFINITY;
  let sourceEndAt = Number.POSITIVE_INFINITY;
  if (item.kind === 'clip') {
    const { clip } = item;
    const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
    if (!asset) {
      return null;
    }
    if (asset.type !== 'image') {
      sourceZeroAt = clip.start - clip.inPoint;
      sourceEndAt = clip.start + (asset.duration - clip.inPoint);
    }
  }

  const minDuration = minItemDuration(project);
  const neighbors = itemsOnTrack(project, item.trackId, item.id);
  const previousEnd = neighbors
    .filter((other) => other.start < item.start)
    .reduce((max, other) => Math.max(max, other.end), 0);
  const nextStart = neighbors
    .filter((other) => other.start >= item.end)
    .reduce((min, other) => Math.min(min, other.start), Number.POSITIVE_INFINITY);

  if (edge === 'start') {
    const lower = Math.max(0, previousEnd, sourceZeroAt);
    const upper = item.end - minDuration;
    return { start: clamp(Math.round(desiredTime), lower, upper), end: item.end };
  }
  const lower = item.start + minDuration;
  const upper = Math.min(nextStart, sourceEndAt);
  return { start: item.start, end: clamp(Math.round(desiredTime), lower, upper) };
}

/** value를 [lower, upper]로 제한한다. lower > upper(범위가 비어 있음)이면 lower */
function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), Math.max(lower, upper));
}
