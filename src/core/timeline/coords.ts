import { US_PER_SECOND, type Microseconds } from '../time.ts';

/** 타임라인상의 시간을 x 좌표(px)로 변환한다. 화면 좌표는 소수점을 허용한다. */
export function usToPx(us: Microseconds, pxPerSecond: number): number {
  return (us * pxPerSecond) / US_PER_SECOND;
}

/** x 좌표(px)를 타임라인상의 시간으로 변환한다. 내부 시간 규칙에 맞춰 정수로 반올림한다. */
export function pxToUs(px: number, pxPerSecond: number): Microseconds {
  return Math.round((px * US_PER_SECOND) / pxPerSecond);
}
