import type { Track } from './project.ts';

/** 새 트랙은 기존 트랙들 위에 쌓인다 (order가 클수록 위, 프리뷰에서도 위에 그려진다) */
export function nextTrackOrder(tracks: readonly Track[]): number {
  return tracks.reduce((max, track) => Math.max(max, track.order + 1), 0);
}

/** 타임라인 표시 순서. 프리뷰 합성 순서와 맞추기 위해 위에 그려지는 트랙(order가 큰 트랙)을 위에 둔다. */
export function sortTracksForDisplay(tracks: readonly Track[]): Track[] {
  return [...tracks].sort((a, b) => b.order - a.order);
}

const LABEL_PREFIX: Record<Track['kind'], string> = { video: 'V', text: 'T', audio: 'A' };

/** 종류별로 아래(order가 작은 트랙)부터 번호를 매긴 라벨 (V1, V2, ...) */
export function trackLabels(tracks: readonly Track[]): Map<string, string> {
  const counts: Record<Track['kind'], number> = { video: 0, text: 0, audio: 0 };
  const labels = new Map<string, string>();
  for (const track of [...tracks].sort((a, b) => a.order - b.order)) {
    counts[track.kind] += 1;
    labels.set(track.id, `${LABEL_PREFIX[track.kind]}${String(counts[track.kind])}`);
  }
  return labels;
}
