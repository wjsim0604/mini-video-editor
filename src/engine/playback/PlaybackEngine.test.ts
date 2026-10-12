import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyProject, type Project } from '@/core/project.ts';
import type { Microseconds } from '@/core/time.ts';
import type { FrameRenderer } from '../render/PreviewRenderer.ts';
import { PlaybackEngine, type PlaybackState } from './PlaybackEngine.ts';

const S = 1_000_000;

function makeProject(duration: Microseconds): Project {
  const project = createEmptyProject('p', 'test');
  const trackId = project.tracks[0]?.id ?? '';
  return {
    ...project,
    clips:
      duration > 0
        ? [{ id: 'c', assetId: 'a', trackId, start: 0, inPoint: 0, outPoint: duration }]
        : [],
  };
}

/** 렌더 완료 시점을 테스트가 제어할 수 있는 가짜 렌더러 */
function createFakeRenderer() {
  const pendingRenders: { time: Microseconds; resolve: () => void }[] = [];
  const renderer = {
    renderAt: vi.fn(
      (_project: Project, time: Microseconds) =>
        new Promise<void>((resolve) => {
          pendingRenders.push({ time, resolve });
        }),
    ),
    renderPlaying: vi.fn(),
    startPlayback: vi.fn(),
    stopPlayback: vi.fn(),
  } satisfies FrameRenderer;
  return { renderer, pendingRenders };
}

function setup(duration: Microseconds = 10 * S) {
  let nowMs = 1000;
  let nextFrame: (() => void) | null = null;
  const states: PlaybackState[] = [];
  const { renderer, pendingRenders } = createFakeRenderer();
  let project = makeProject(duration);

  const engine = new PlaybackEngine({
    renderer,
    getProject: () => project,
    now: () => nowMs,
    requestFrame: (callback) => {
      nextFrame = callback;
      return 1;
    },
    cancelFrame: () => {
      nextFrame = null;
    },
    onStateChange: (state) => states.push(state),
  });

  return {
    engine,
    renderer,
    pendingRenders,
    states,
    setProject: (next: Project) => {
      project = next;
    },
    /** 시계를 ms만큼 진행시키고 예약된 애니메이션 프레임을 실행한다 */
    advance(ms: number) {
      nowMs += ms;
      const callback = nextFrame;
      nextFrame = null;
      callback?.();
    },
    hasScheduledFrame: () => nextFrame !== null,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PlaybackEngine', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  it('재생하면 경과 시간만큼 시각이 정수 μs로 진행된다', () => {
    ctx.engine.play();
    ctx.advance(16.6667);
    ctx.advance(16.6667);

    expect(ctx.engine.state).toEqual({ currentTime: 33_333, isPlaying: true });
    expect(Number.isInteger(ctx.engine.state.currentTime)).toBe(true);
    expect(ctx.renderer.startPlayback).toHaveBeenCalledOnce();
    expect(ctx.renderer.renderPlaying).toHaveBeenLastCalledWith(expect.anything(), 33_333);
  });

  it('일시정지하면 루프를 멈추고 멈춘 위치를 정확히 다시 그린다', () => {
    ctx.engine.play();
    ctx.advance(500);

    ctx.engine.pause();

    expect(ctx.engine.state).toEqual({ currentTime: 500_000, isPlaying: false });
    expect(ctx.hasScheduledFrame()).toBe(false);
    expect(ctx.renderer.stopPlayback).toHaveBeenCalledOnce();
    expect(ctx.renderer.renderAt).toHaveBeenLastCalledWith(expect.anything(), 500_000);
  });

  it('끝에 도달하면 끝 시각에서 멈추고 마지막 프레임을 그린다', () => {
    ctx.engine.play();
    ctx.advance(11_000);

    expect(ctx.engine.state).toEqual({ currentTime: 10 * S, isPlaying: false });
    expect(ctx.renderer.renderAt).toHaveBeenLastCalledWith(expect.anything(), 10 * S - 1);
  });

  it('끝에서 다시 재생하면 처음부터 시작한다', () => {
    ctx.engine.seek(10 * S);
    ctx.engine.play();
    ctx.advance(100);

    expect(ctx.engine.state.currentTime).toBe(100_000);
  });

  it('빈 프로젝트는 재생하지 않는다', () => {
    const empty = setup(0);

    empty.engine.play();

    expect(empty.engine.state.isPlaying).toBe(false);
    expect(empty.renderer.startPlayback).not.toHaveBeenCalled();
  });

  it('탐색 시각을 프로젝트 범위로 제한한다', () => {
    ctx.engine.seek(-5 * S);
    expect(ctx.engine.state.currentTime).toBe(0);

    ctx.engine.seek(99 * S);
    expect(ctx.engine.state.currentTime).toBe(10 * S);
  });

  it('재생 중 탐색하면 그 위치부터 이어서 재생한다', () => {
    ctx.engine.play();
    ctx.advance(100);

    ctx.engine.seek(5 * S);
    ctx.advance(100);

    expect(ctx.engine.state).toEqual({ currentTime: 5_100_000, isPlaying: true });
  });

  it('렌더 중 연속 탐색은 마지막 위치만 이어서 렌더한다', async () => {
    ctx.engine.seek(1 * S);
    ctx.engine.seek(2 * S);
    ctx.engine.seek(3 * S);

    expect(ctx.renderer.renderAt).toHaveBeenCalledOnce();

    ctx.pendingRenders[0]?.resolve();
    await flush();

    expect(ctx.renderer.renderAt).toHaveBeenCalledTimes(2);
    expect(ctx.renderer.renderAt).toHaveBeenLastCalledWith(expect.anything(), 3 * S);
  });

  it('상태가 바뀔 때마다 알린다', () => {
    ctx.engine.play();
    ctx.advance(100);
    ctx.engine.pause();

    expect(ctx.states.map((state) => state.isPlaying)).toEqual([true, true, false]);
  });

  it('프로젝트가 짧아지면 현재 시각을 끝으로 당긴다', () => {
    ctx.engine.seek(8 * S);

    ctx.setProject(makeProject(5 * S));
    ctx.engine.refresh();

    expect(ctx.engine.state.currentTime).toBe(5 * S);
  });
});
