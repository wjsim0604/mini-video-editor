import { describe, expect, it } from 'vitest';
import { FrameStream } from './FrameStream.ts';

const MS = 1000;

interface FakeFrame {
  time: number;
  closed: boolean;
  close(): void;
}

function makeFrame(time: number): FakeFrame {
  return {
    time,
    closed: false,
    close() {
      this.closed = true;
    },
  };
}

/** 33ms 간격 프레임을 생성하고, 생성된 프레임과 요청 횟수를 기록한다 */
function makeSource(count: number) {
  const produced: FakeFrame[] = [];
  let finished = false;
  async function* frames(): AsyncGenerator<FakeFrame, void, unknown> {
    try {
      for (let index = 0; index < count; index++) {
        await Promise.resolve();
        const frame = makeFrame(index * 33 * MS);
        produced.push(frame);
        yield frame;
      }
    } finally {
      finished = true;
    }
  }
  return {
    produced,
    isFinished: () => finished,
    stream: (capacity = 4) =>
      new FrameStream<FakeFrame>({
        frames: frames(),
        timeOf: (frame) => frame.time,
        startTime: 0,
        capacity,
      }),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('FrameStream', () => {
  it('용량만큼만 미리 디코딩한다', async () => {
    const source = makeSource(100);
    source.stream(3);

    await flush();

    expect(source.produced).toHaveLength(3);
  });

  it('디코딩 전에는 null을 반환한다', () => {
    const source = makeSource(10);

    expect(source.stream().frameAt(0)).toBeNull();
  });

  it('표시 시각이 지난 프레임 중 가장 늦은 프레임을 반환하고 건너뛴 프레임은 해제한다', async () => {
    const source = makeSource(10);
    const stream = source.stream();
    await flush();

    const frame = stream.frameAt(70 * MS);

    expect(frame?.time).toBe(66 * MS);
    expect(source.produced.slice(0, 2).every((f) => f.closed)).toBe(true);
    expect(frame?.closed).toBe(false);
  });

  it('프레임을 꺼내면 빈 자리만큼 다시 디코딩한다', async () => {
    const source = makeSource(100);
    const stream = source.stream(3);
    await flush();

    stream.frameAt(70 * MS);
    await flush();

    expect(source.produced).toHaveLength(6);
  });

  it('뒤로 돌아가거나 디코딩이 너무 뒤처지면 이어서 제공할 수 없다', async () => {
    const source = makeSource(100);
    const stream = source.stream(3);
    await flush();
    stream.frameAt(40 * MS);

    expect(stream.canServe(50 * MS)).toBe(true);
    expect(stream.canServe(10 * MS)).toBe(false);
    expect(stream.canServe(5_000 * MS)).toBe(false);
  });

  it('dispose하면 모든 프레임을 해제하고 디코딩을 중단한다', async () => {
    const source = makeSource(100);
    const stream = source.stream(3);
    await flush();
    stream.frameAt(40 * MS);

    stream.dispose();
    await flush();

    expect(source.produced.every((frame) => frame.closed)).toBe(true);
    expect(source.isFinished()).toBe(true);
  });
});
