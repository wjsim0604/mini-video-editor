/** 타임라인 세로 배치. 헤더 열과 내용 영역, 드래그 시 y → 트랙 계산이 같은 값을 쓴다. */
export const RULER_HEIGHT = 24;
export const NEW_TRACK_ZONE_HEIGHT = 32;
export const TRACK_HEIGHT = 56;

const TRACKS_TOP = RULER_HEIGHT + NEW_TRACK_ZONE_HEIGHT;

export type RowHit = { kind: 'new-track' } | { kind: 'track'; index: number };

/**
 * 타임라인 내용 영역 기준 y 좌표가 가리키는 행 (index는 표시 순서, 0이 맨 위 트랙).
 * 트랙 영역 위(눈금·새 트랙 영역)는 새 트랙, 마지막 트랙 아래는 마지막 트랙으로 본다.
 */
export function rowAtY(y: number, trackCount: number): RowHit {
  if (y < TRACKS_TOP || trackCount === 0) {
    return { kind: 'new-track' };
  }
  return {
    kind: 'track',
    index: Math.min(Math.floor((y - TRACKS_TOP) / TRACK_HEIGHT), trackCount - 1),
  };
}
