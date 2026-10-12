import { usToPx } from '@/core/timeline/coords.ts';
import { useTimelineStore } from '@/store/timelineStore.ts';

interface SnapLineProps {
  pxPerSecond: number;
}

/** 드래그 중 스냅된 기준점을 가로지르는 세로 안내선 */
export function SnapLine({ pxPerSecond }: SnapLineProps) {
  const time = useTimelineStore((state) => state.snapLine);
  if (time === null) {
    return null;
  }
  return (
    <div
      data-testid="snap-line"
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-20 w-px bg-amber-300"
      style={{ left: usToPx(time, pxPerSecond) }}
    />
  );
}
