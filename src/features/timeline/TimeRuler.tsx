import { usToPx } from '@/core/timeline/coords.ts';
import { formatRulerLabel, pickRulerStep } from '@/core/timeline/ruler.ts';
import type { Microseconds } from '@/core/time.ts';

interface TimeRulerProps {
  duration: Microseconds;
  pxPerSecond: number;
}

export function TimeRuler({ duration, pxPerSecond }: TimeRulerProps) {
  const step = pickRulerStep(pxPerSecond);
  const ticks: Microseconds[] = [];
  for (let time = 0; time <= duration; time += step) {
    ticks.push(time);
  }

  return (
    <div aria-hidden="true" className="relative h-6 border-b border-neutral-800 select-none">
      {ticks.map((time) => (
        <span
          key={time}
          className="absolute top-0 h-full border-l border-neutral-700 pl-1 text-[10px] leading-6 text-neutral-500 tabular-nums"
          style={{ left: usToPx(time, pxPerSecond) }}
        >
          {formatRulerLabel(time)}
        </span>
      ))}
    </div>
  );
}
