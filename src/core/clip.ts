import type { Asset, Clip } from './project.ts';
import type { Microseconds } from './time.ts';

export function clipDuration(clip: Clip): Microseconds {
  return clip.outPoint - clip.inPoint;
}

export function clipEnd(clip: Clip): Microseconds {
  return clip.start + clipDuration(clip);
}

/** time이 클립 구간 [start, end) 안에 있는지 */
export function isClipActiveAtTime(clip: Clip, time: Microseconds): boolean {
  return clip.start <= time && time < clipEnd(clip);
}

/** 두 클립의 구간 [start, end)가 겹치는지 검사한다. 끝과 시작이 맞닿는 것은 겹침이 아니다. */
export function clipsOverlap(a: Clip, b: Clip): boolean {
  return a.start < clipEnd(b) && b.start < clipEnd(a);
}

/** 에셋 전체 길이를 사용하는 클립을 만든다. */
export function createClipFromAsset(
  asset: Asset,
  params: { id: string; trackId: string; start: Microseconds },
): Clip {
  return {
    id: params.id,
    assetId: asset.id,
    trackId: params.trackId,
    start: params.start,
    inPoint: 0,
    outPoint: asset.duration,
  };
}
