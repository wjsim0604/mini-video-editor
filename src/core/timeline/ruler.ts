import { US_PER_SECOND, type Microseconds } from '../time.ts';
import { usToPx } from './coords.ts';

const S = US_PER_SECOND;
const RULER_STEPS: readonly Microseconds[] = [
  S / 10,
  S / 5,
  S / 2,
  S,
  2 * S,
  5 * S,
  10 * S,
  15 * S,
  30 * S,
  60 * S,
  120 * S,
  300 * S,
  600 * S,
  1800 * S,
  3600 * S,
];

/** 라벨 간격이 minSpacingPx 이상이 되는 가장 촘촘한 눈금 간격을 고른다. */
export function pickRulerStep(pxPerSecond: number, minSpacingPx = 80): Microseconds {
  return (
    RULER_STEPS.find((step) => usToPx(step, pxPerSecond) >= minSpacingPx) ?? RULER_STEPS.at(-1) ?? S
  );
}

/** 눈금 라벨. 초 단위로 떨어지면 `M:SS`, 아니면 소수 첫째 자리까지 `M:SS.f` */
export function formatRulerLabel(us: Microseconds): string {
  const tenths = Math.round(us / (S / 10));
  const totalSeconds = Math.floor(tenths / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const fraction = tenths % 10;

  return fraction === 0
    ? `${String(minutes)}:${seconds}`
    : `${String(minutes)}:${seconds}.${String(fraction)}`;
}
