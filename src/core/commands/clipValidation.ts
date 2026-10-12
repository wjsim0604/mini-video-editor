import { clipsOverlap } from '../clip.ts';
import type { Clip, Project } from '../project.ts';

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

/** 클립이 놓일 트랙이 존재하고, 같은 트랙의 다른 클립과 겹치지 않는지 검사한다 */
export function assertClipPlaceable(project: Project, clip: Clip): void {
  if (!project.tracks.some((track) => track.id === clip.trackId)) {
    throw new Error(`Track not found: ${clip.trackId}`);
  }
  const overlapping = project.clips.find(
    (existing) =>
      existing.id !== clip.id && existing.trackId === clip.trackId && clipsOverlap(existing, clip),
  );
  if (overlapping) {
    throw new Error(`Clip overlaps with ${overlapping.id}`);
  }
}
