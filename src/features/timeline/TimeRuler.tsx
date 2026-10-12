import { usToPx } from '@/core/timeline/coords.ts';
import { formatRulerLabel, pickRulerStep } from '@/core/timeline/ruler.ts';
import type { TimeRange } from '@/core/timeline/viewport.ts';
import type { Microseconds } from '@/core/time.ts';
import { RULER_HEIGHT } from './layout.ts';

interface TimeRulerProps {
  duration: Microseconds;
  pxPerSecond: number;
  /** 렌더링할 시간 범위. 이 범위의 눈금만 그린다 */
  range: TimeRange;
}

export function TimeRuler({ duration, pxPerSecond, range }: TimeRulerProps) {
  const step = pickRulerStep(pxPerSecond);
  const ticks: Microseconds[] = [];
  const last = Math.min(duration, range.end);
  for (let time = Math.floor(range.start / step) * step; time <= last; time += step) {
    ticks.push(time);
  }

  return (
    <div
      aria-hidden="true"
      className="relative border-b border-neutral-800 select-none"
      style={{ height: RULER_HEIGHT }}
    >
      {ticks.map((time) => (
        <span
          key={time}
          data-testid="ruler-tick"
          className="absolute top-0 h-full border-l border-neutral-700 pl-1 text-[10px] leading-6 text-neutral-500 tabular-nums"
          style={{ left: usToPx(time, pxPerSecond) }}
        >
          {formatRulerLabel(time)}
        </span>
      ))}
    </div>
  );
}
