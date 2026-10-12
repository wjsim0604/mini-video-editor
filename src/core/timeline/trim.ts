import { clipEnd } from '../clip.ts';
import type { Clip, Project } from '../project.ts';
import { frameToUs, type Microseconds } from '../time.ts';

export type TrimEdge = 'start' | 'end';

export interface ClipTiming {
  start: Microseconds;
  inPoint: Microseconds;
  outPoint: Microseconds;
}

export function timingOf(clip: Clip): ClipTiming {
  return { start: clip.start, inPoint: clip.inPoint, outPoint: clip.outPoint };
}

/** 클립의 최소 길이 = 1프레임 */
export function minClipDuration(project: Project): Microseconds {
  return frameToUs(1, project.fps);
}

/**
 * 클립의 한쪽 끝을 desiredTime(타임라인 시각)으로 옮길 때의 결과 타이밍.
 * - 영상: 원본 범위 [0, 원본 길이]를 벗어나지 않는다
 * - 이미지: 원본 길이 제한이 없으며 항상 inPoint 0, outPoint = 길이로 정규화한다
 * - 최소 1프레임, 같은 트랙의 이웃 클립 경계와 타임라인 시작(0)에서 멈춘다
 */
export function resolveTrim(
  project: Project,
  clipId: string,
  edge: TrimEdge,
  desiredTime: Microseconds,
): ClipTiming | null {
  const clip = project.clips.find((candidate) => candidate.id === clipId);
  const asset = project.assets.find((candidate) => candidate.id === clip?.assetId);
  if (!clip || !asset) {
    return null;
  }
  const isImage = asset.type === 'image';
  const minDuration = minClipDuration(project);
  const start = clip.start;
  const end = clipEnd(clip);

  const neighbors = project.clips.filter(
    (candidate) => candidate.trackId === clip.trackId && candidate.id !== clip.id,
  );
  const previousEnd = neighbors
    .filter((candidate) => candidate.start < start)
    .reduce((max, candidate) => Math.max(max, clipEnd(candidate)), 0);
  const nextStart = neighbors
    .filter((candidate) => candidate.start >= end)
    .reduce((min, candidate) => Math.min(min, candidate.start), Number.POSITIVE_INFINITY);

  if (edge === 'start') {
    // 원본의 0 지점이 놓이는 타임라인 시각보다 앞으로는 늘릴 수 없다 (이미지는 제한 없음)
    const sourceZeroAt = isImage ? Number.NEGATIVE_INFINITY : start - clip.inPoint;
    const lower = Math.max(0, previousEnd, sourceZeroAt);
    const upper = end - minDuration;
    const newStart = clamp(Math.round(desiredTime), lower, upper);
    return isImage
      ? { start: newStart, inPoint: 0, outPoint: end - newStart }
      : { start: newStart, inPoint: clip.inPoint + (newStart - start), outPoint: clip.outPoint };
  }

  // 원본의 끝 지점이 놓이는 타임라인 시각보다 뒤로는 늘릴 수 없다 (이미지는 제한 없음)
  const sourceEndAt = isImage ? Number.POSITIVE_INFINITY : start + (asset.duration - clip.inPoint);
  const lower = start + minDuration;
  const upper = Math.min(nextStart, sourceEndAt);
  const newEnd = clamp(Math.round(desiredTime), lower, upper);
  return isImage
    ? { start, inPoint: 0, outPoint: newEnd - start }
    : { start, inPoint: clip.inPoint, outPoint: clip.inPoint + (newEnd - start) };
}

/** value를 [lower, upper]로 제한한다. lower > upper(범위가 비어 있음)이면 lower */
function clamp(value: number, lower: number, upper: number): number {
  return Math.min(Math.max(value, lower), Math.max(lower, upper));
}
