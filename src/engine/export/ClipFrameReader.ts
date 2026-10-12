import type { Microseconds } from '@/core/time.ts';
import type { TimedFrame } from '../decode/FrameStream.ts';

/**
 * 내보내기용 순차 프레임 리더. 재생용 FrameStream은 늦으면 프레임을 건너뛰지만,
 * 내보내기는 한 프레임도 건너뛰면 안 되므로 필요한 프레임이 디코딩될 때까지 기다린다.
 * frameAt은 시간 순서대로 호출해야 한다.
 */
export class ClipFrameReader<T extends TimedFrame> {
  private readonly frames: AsyncGenerator<T, void, unknown>;
  private readonly timeOf: (frame: T) => Microseconds;
  private current: T | null = null;
  private next: T | null = null;
  private ended = false;

  constructor(frames: AsyncGenerator<T, void, unknown>, timeOf: (frame: T) => Microseconds) {
    this.frames = frames;
    this.timeOf = timeOf;
  }

  /**
   * time에 보여야 할 프레임(표시 시각 ≤ time 중 가장 늦은 것). 지나간 프레임은 해제한다.
   * 첫 프레임이 time보다 늦으면 그 첫 프레임을 쓴다. 반환된 프레임은 리더가 소유한다.
   */
  async frameAt(time: Microseconds): Promise<T | null> {
    for (;;) {
      if (this.next === null && !this.ended) {
        const result = await this.frames.next();
        if (result.done) {
          this.ended = true;
        } else {
          this.next = result.value;
        }
      }
      if (this.next === null || (this.current !== null && this.timeOf(this.next) > time)) {
        break;
      }
      if (this.current === null && this.timeOf(this.next) > time) {
        // 아직 time에 해당하는 프레임이 없으면 가장 가까운 첫 프레임을 쓴다
        this.current = this.next;
        this.next = null;
        break;
      }
      this.current?.close();
      this.current = this.next;
      this.next = null;
    }
    return this.current;
  }

  dispose(): void {
    this.current?.close();
    this.next?.close();
    this.current = null;
    this.next = null;
    void this.frames.return(undefined);
  }
}
