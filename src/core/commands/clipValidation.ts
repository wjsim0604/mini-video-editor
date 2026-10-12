import type { Clip, Project } from '../project.ts';
import { itemsOnTrack, spansOverlap, trackKindFor, type TimelineItem } from '../timelineItem.ts';

/** 클립의 시간 값이 정수 μs이고 구간이 유효한지 검사한다 */
export function assertValidClipTiming(clip: Clip): void {
  const { start, inPoint, outPoint } = clip;
  if (![start, inPoint, outPoint].every(Number.isSafeInteger)) {
    throw new RangeError(`Clip timing must be integer microseconds: ${clip.id}`);
  }
  if (start < 0 || inPoint < 0 || outPoint <= inPoint) {
    throw new RangeError(`Invalid clip range: ${clip.id}`);
  }
}

/** 항목 구간이 정수 μs이고 0 이상, 길이가 양수인지 검사한다 */
export function assertValidSpan(item: Pick<TimelineItem, 'id' | 'start' | 'end'>): void {
  if (!Number.isSafeInteger(item.start) || !Number.isSafeInteger(item.end)) {
    throw new RangeError(`Timing must be integer microseconds: ${item.id}`);
  }
  if (item.start < 0 || item.end <= item.start) {
    throw new RangeError(`Invalid range: ${item.id}`);
  }
}

/** 항목이 놓일 트랙이 존재하고 종류가 맞으며, 같은 트랙의 다른 항목과 겹치지 않는지 검사한다 */
export function assertItemPlaceable(
  project: Project,
  item: Pick<TimelineItem, 'id' | 'kind' | 'trackId' | 'start' | 'end'>,
): void {
  const track = project.tracks.find((candidate) => candidate.id === item.trackId);
  if (!track) {
    throw new Error(`Track not found: ${item.trackId}`);
  }
  if (track.kind !== trackKindFor(item)) {
    throw new Error(`Cannot place ${item.kind} on ${track.kind} track: ${item.id}`);
  }
  const overlapping = itemsOnTrack(project, item.trackId, item.id).find((other) =>
    spansOverlap(other, item),
  );
  if (overlapping) {
    throw new Error(`Item overlaps with ${overlapping.id}`);
  }
}

/** 영상 클립이 원본 길이를 넘는 구간을 쓰지 않는지 검사한다 (이미지는 원본 길이 제한이 없다) */
export function assertWithinSource(project: Project, clip: Clip): void {
  const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
  if (!asset) {
    throw new Error(`Asset not found: ${clip.assetId}`);
  }
  if (asset.type !== 'image' && clip.outPoint > asset.duration) {
    throw new RangeError(`Clip exceeds source duration: ${clip.id}`);
  }
}
