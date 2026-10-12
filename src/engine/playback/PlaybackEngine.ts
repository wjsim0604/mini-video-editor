import { projectDuration } from '@/core/composition.ts';
import type { Project } from '@/core/project.ts';
import type { Microseconds } from '@/core/time.ts';
import type { FrameRenderer } from '../render/PreviewRenderer.ts';

export interface PlaybackState {
  currentTime: Microseconds;
  isPlaying: boolean;
}

export interface PlaybackEngineDeps {
  renderer: FrameRenderer;
  getProject: () => Project;
  /** 밀리초 단위 단조 증가 시계 (performance.now) */
  now: () => number;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (id: number) => void;
  onStateChange: (state: PlaybackState) => void;
}

/**
 * 재생 시계와 requestAnimationFrame 루프를 관리한다.
 * React와 무관하며, 시계·rAF·렌더러를 주입받으므로 가짜 구현으로 테스트할 수 있다.
 */
export class PlaybackEngine {
  private readonly deps: PlaybackEngineDeps;
  private currentTime: Microseconds = 0;
  private playing = false;
  private frameId: number | null = null;
  /** 재생 시작(또는 재생 중 탐색) 시점의 타임라인 시각과 시계 값 */
  private anchor = { time: 0, nowMs: 0 };
  private stillInFlight = false;
  private stillPending = false;

  constructor(deps: PlaybackEngineDeps) {
    this.deps = deps;
  }

  get state(): PlaybackState {
    return { currentTime: this.currentTime, isPlaying: this.playing };
  }

  play(): void {
    if (this.playing) {
      return;
    }
    const duration = projectDuration(this.deps.getProject());
    if (duration === 0) {
      return;
    }
    if (this.currentTime >= duration) {
      this.currentTime = 0;
    }
    this.playing = true;
    this.anchor = { time: this.currentTime, nowMs: this.deps.now() };
    this.deps.renderer.startPlayback();
    this.emit();
    this.scheduleTick();
  }

  pause(): void {
    if (!this.playing) {
      return;
    }
    this.stopLoop();
    this.emit();
    // 재생 중에는 준비된 프레임만 그리므로, 멈춘 위치의 정확한 프레임을 다시 그린다
    this.requestStill();
  }

  toggle(): void {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time: Microseconds): void {
    const duration = projectDuration(this.deps.getProject());
    this.currentTime = Math.min(Math.max(0, Math.round(time)), duration);
    if (this.playing) {
      this.anchor = { time: this.currentTime, nowMs: this.deps.now() };
    } else {
      this.requestStill();
    }
    this.emit();
  }

  /** 프로젝트나 캔버스 크기가 바뀌었을 때 현재 화면을 다시 그린다 */
  refresh(): void {
    const duration = projectDuration(this.deps.getProject());
    if (this.currentTime > duration) {
      this.currentTime = duration;
      this.emit();
    }
    if (!this.playing) {
      this.requestStill();
    }
  }

  dispose(): void {
    if (this.playing) {
      this.stopLoop();
    }
  }

  private tick = (): void => {
    this.frameId = null;
    if (!this.playing) {
      return;
    }
    const project = this.deps.getProject();
    const duration = projectDuration(project);
    // 경과 시간(ms, 부동소수점)은 여기서 한 번만 정수 μs로 변환한다
    const elapsed = Math.round((this.deps.now() - this.anchor.nowMs) * 1000);
    const time = this.anchor.time + elapsed;

    if (time >= duration) {
      this.currentTime = duration;
      this.stopLoop();
      this.emit();
      this.requestStill();
      return;
    }

    this.currentTime = time;
    this.deps.renderer.renderPlaying(project, time);
    this.emit();
    this.scheduleTick();
  };

  private scheduleTick(): void {
    this.frameId = this.deps.requestFrame(this.tick);
  }

  private stopLoop(): void {
    this.playing = false;
    if (this.frameId !== null) {
      this.deps.cancelFrame(this.frameId);
      this.frameId = null;
    }
    this.deps.renderer.stopPlayback();
  }

  /**
   * 정지 화면 렌더 요청. 디코딩 중에 요청이 또 오면 마지막 요청 하나만 이어서 처리한다
   * (빠른 연속 탐색 시 중간 위치를 모두 디코딩하지 않기 위해).
   */
  private requestStill(): void {
    if (this.stillInFlight) {
      this.stillPending = true;
      return;
    }
    this.stillInFlight = true;
    const project = this.deps.getProject();
    const duration = projectDuration(project);
    // 끝 위치(구간 밖)에서는 마지막 프레임을 보여준다
    const time = duration > 0 ? Math.min(this.currentTime, duration - 1) : 0;

    this.deps.renderer
      .renderAt(project, time)
      .catch((error: unknown) => {
        console.error('Failed to render preview', error);
      })
      .finally(() => {
        this.stillInFlight = false;
        if (this.stillPending && !this.playing) {
          this.stillPending = false;
          this.requestStill();
        }
        this.stillPending = false;
      });
  }

  private emit(): void {
    this.deps.onStateChange(this.state);
  }
}
