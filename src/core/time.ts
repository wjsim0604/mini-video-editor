/**
 * 내부 시간 단위. WebCodecs의 timestamp와 동일하게 마이크로초 정수를 사용한다.
 * 초 단위 부동소수점 값은 외부 API 경계(입력)와 화면 표시(출력)에서만 다룬다.
 */
export type Microseconds = number;

export const US_PER_SECOND = 1_000_000;

/** 외부 API(예: HTMLMediaElement.duration)의 초 단위 값을 내부 시간으로 변환한다. */
export function secondsToUs(seconds: number): Microseconds {
  return Math.round(seconds * US_PER_SECOND);
}

/** 내부 시간을 초 단위로 변환한다. 표시나 외부 API 호출 용도로만 사용한다. */
export function usToSeconds(us: Microseconds): number {
  return us / US_PER_SECOND;
}

/** 프레임 번호의 시작 시각. 30fps처럼 나누어떨어지지 않는 경우 가장 가까운 정수로 반올림한다. */
export function frameToUs(frame: number, fps: number): Microseconds {
  return Math.round((frame * US_PER_SECOND) / fps);
}

/**
 * 주어진 시각이 속한 프레임 번호. frameToUs의 역함수로,
 * `frameToUs(f) <= us < frameToUs(f + 1)`을 만족하는 f를 반환한다.
 */
export function usToFrame(us: Microseconds, fps: number): number {
  const frame = Math.floor((us * fps) / US_PER_SECOND);
  // frameToUs의 반올림 때문에 다음 프레임 경계가 us 이하일 수 있다 (예: 30fps에서 33_333us는 1번 프레임)
  return frameToUs(frame + 1, fps) <= us ? frame + 1 : frame;
}

/** `HH:MM:SS:FF` 형식의 타임코드. 정수 fps를 가정한다. */
export function formatTimecode(us: Microseconds, fps: number): string {
  if (!Number.isInteger(us) || us < 0) {
    throw new RangeError(`Invalid time: ${String(us)}`);
  }

  const totalSeconds = Math.floor(us / US_PER_SECOND);
  const frames = usToFrame(us % US_PER_SECOND, fps);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds, frames].map((n) => String(n).padStart(2, '0')).join(':');
}

/** 에셋·클립 길이 표시용 `M:SS` (1시간 이상이면 `H:MM:SS`). 가장 가까운 초로 반올림한다. */
export function formatDuration(us: Microseconds): string {
  if (!Number.isFinite(us) || us < 0) {
    throw new RangeError(`Invalid duration: ${String(us)}`);
  }

  const totalSeconds = Math.round(us / US_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${String(minutes)}:${seconds}`;
}
