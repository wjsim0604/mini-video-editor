import { describe, expect, it } from 'vitest';
import { ClipFrameReader } from './ClipFrameReader.ts';

interface FakeFrame {
  time: number;
  closed: boolean;
  close(): void;
}

function source(times: number[]) {
  const produced: FakeFrame[] = [];
  let finished = false;
  async function* frames(): AsyncGenerator<FakeFrame, void, unknown> {
    try {
      for (const time of times) {
        // 디코딩이 느린 상황을 흉내 낸다
        await new Promise((resolve) => setTimeout(resolve, 0));
        const frame: FakeFrame = {
          time,
          closed: false,
          close() {
            this.closed = true;
          },
        };
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
    reader: new ClipFrameReader(frames(), (frame: FakeFrame) => frame.time),
  };
}

describe('ClipFrameReader', () => {
  it('디코딩을 기다려 시각에 맞는 프레임을 순서대로 돌려준다', async () => {
    const { reader } = source([0, 40, 80, 120]);

    expect((await reader.frameAt(0))?.time).toBe(0);
    expect((await reader.frameAt(33))?.time).toBe(0);
    expect((await reader.frameAt(66))?.time).toBe(40);
    expect((await reader.frameAt(100))?.time).toBe(80);
  });

  it('건너뛴 프레임은 해제한다', async () => {
    const { reader, produced } = source([0, 10, 20, 30]);

    await reader.frameAt(25);

    expect(produced.slice(0, 2).every((frame) => frame.closed)).toBe(true);
    expect(produced[2]?.closed).toBe(false);
  });

  it('첫 프레임이 요청 시각보다 늦으면 첫 프레임을 쓴다', async () => {
    const { reader } = source([5, 45]);

    expect((await reader.frameAt(0))?.time).toBe(5);
  });

  it('끝난 뒤에는 마지막 프레임을 유지한다', async () => {
    const { reader } = source([0, 40]);

    expect((await reader.frameAt(500))?.time).toBe(40);
    expect((await reader.frameAt(600))?.time).toBe(40);
  });

  it('dispose하면 프레임을 해제하고 디코딩을 멈춘다', async () => {
    const { reader, produced, isFinished } = source([0, 40, 80]);
    await reader.frameAt(0);

    reader.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(produced.every((frame) => frame.closed)).toBe(true);
    expect(isFinished()).toBe(true);
  });
});
