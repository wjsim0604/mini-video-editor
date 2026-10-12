import { usToPx } from '@/core/timeline/coords.ts';
import type { Microseconds } from '@/core/time.ts';

interface PlacementGhostProps {
  start: Microseconds;
  duration: Microseconds;
  pxPerSecond: number;
}

/** 드래그 중 클립이 실제로 놓일 자리 */
export function PlacementGhost({ start, duration, pxPerSecond }: PlacementGhostProps) {
  return (
    <div
      data-testid="drop-preview"
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-1 rounded border border-dashed border-sky-300 bg-sky-300/15"
      style={{ left: usToPx(start, pxPerSecond), width: usToPx(duration, pxPerSecond) }}
    />
  );
}
