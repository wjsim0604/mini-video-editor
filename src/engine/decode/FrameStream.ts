import type { Microseconds } from '@/core/time.ts';

/** 표시 시각을 가진, 해제가 필요한 프레임 (mediabunny VideoSample 등) */
export interface TimedFrame {
  close(): void;
}

export interface FrameStreamOptions<T extends TimedFrame> {
  frames: AsyncGenerator<T, void, unknown>;
  /** 프레임의 원본 기준 표시 시각 */
  timeOf: (frame: T) => Microseconds;
  startTime: Microseconds;
  /** 미리 디코딩해 둘 프레임 수. 1080p 프레임은 장당 수 MB이므로 작게 유지한다. */
  capacity?: number;
  /** 이 시간 이상 디코딩이 뒤처지면 이어서 읽지 않고 새로 탐색하는 편이 빠르다 */
  maxLag?: Microseconds;
  onError?: (error: unknown) => void;
}

const DEFAULT_CAPACITY = 4;
const DEFAULT_MAX_LAG: Microseconds = 1_000_000;

/**
 * 재생용 순차 프레임 버퍼. 백그라운드에서 몇 프레임 앞서 디코딩해 두고,
 * 재생 루프는 frameAt()으로 현재 시각에 맞는 프레임을 동기적으로 꺼낸다.
 */
export class FrameStream<T extends TimedFrame> {
  readonly startTime: Microseconds;
  private readonly frames: AsyncGenerator<T, void, unknown>;
  private readonly timeOf: (frame: T) => Microseconds;
  private readonly capacity: number;
  private readonly maxLag: Microseconds;
  private readonly buffer: T[] = [];
  private current: T | null = null;
  private disposed = false;
  private ended = false;
  private wakeProducer: (() => void) | null = null;

  constructor(options: FrameStreamOptions<T>) {
    this.frames = options.frames;
    this.timeOf = options.timeOf;
    this.startTime = options.startTime;
    this.capacity = options.capacity ?? DEFAULT_CAPACITY;
    this.maxLag = options.maxLag ?? DEFAULT_MAX_LAG;
    void this.produce(options.onError);
  }

  /** 버퍼가 차 있을 때까지 다음 프레임을 디코딩한다 */
  private async produce(onError?: (error: unknown) => void): Promise<void> {
    try {
      while (!this.disposed) {
        if (this.buffer.length >= this.capacity) {
          await new Promise<void>((resolve) => {
            this.wakeProducer = resolve;
          });
          continue;
        }
        const result = await this.frames.next();
        if (result.done) {
          this.ended = true;
          return;
        }
        // await 동안 dispose될 수 있다 (TS의 좁히기는 await 너머의 변경을 모르므로 메서드로 확인)
        if (this.isDisposed()) {
          result.value.close();
          return;
        }
        this.buffer.push(result.value);
      }
    } catch (error) {
      this.ended = true;
      onError?.(error);
    }
  }

  /**
   * time에 표시해야 할 프레임(표시 시각 ≤ time 중 가장 늦은 것). 아직 디코딩되지 않았으면 null.
   * 반환된 프레임은 스트림이 소유하므로 호출자가 close()하면 안 된다.
   */
  frameAt(time: Microseconds): T | null {
    let next = this.buffer[0];
    while (next !== undefined && this.timeOf(next) <= time) {
      this.current?.close();
      this.current = next;
      this.buffer.shift();
      next = this.buffer[0];
    }
    this.wakeProducer?.();
    this.wakeProducer = null;
    return this.current;
  }

  /** 이 스트림을 계속 읽어서 time을 제공할 수 있는지. 뒤로 돌아갔거나 너무 뒤처졌으면 false. */
  canServe(time: Microseconds): boolean {
    if (time < this.startTime) {
      return false;
    }
    if (this.current && this.timeOf(this.current) > time) {
      return false;
    }
    const latest = this.buffer.at(-1) ?? this.current;
    const decodedUpTo = latest ? this.timeOf(latest) : this.startTime;
    return this.ended || time - decodedUpTo < this.maxLag;
  }

  private isDisposed(): boolean {
    return this.disposed;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.wakeProducer?.();
    this.current?.close();
    this.current = null;
    for (const frame of this.buffer.splice(0)) {
      frame.close();
    }
    void this.frames.return(undefined);
  }
}
