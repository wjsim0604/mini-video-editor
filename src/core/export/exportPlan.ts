import { projectDuration } from '../composition.ts';
import type { Project } from '../project.ts';
import { frameToUs, usToFrame, type Microseconds } from '../time.ts';

/** 프로젝트 전체 [0, 길이)를 덮는 프레임 수. 마지막 프레임이 길이 끝에 걸쳐도 포함한다 */
export function exportFrameCount(project: Project): number {
  const duration = projectDuration(project);
  return duration > 0 ? usToFrame(duration - 1, project.fps) + 1 : 0;
}

/** i번째 출력 프레임의 시각과 길이 */
export function exportFrameTiming(
  index: number,
  fps: number,
): { time: Microseconds; duration: Microseconds } {
  const time = frameToUs(index, fps);
  return { time, duration: frameToUs(index + 1, fps) - time };
}

/** 파일 이름으로 쓸 수 없는 문자를 바꾸고 .mp4를 붙인다 */
export function exportFileName(projectName: string): string {
  const safe = projectName.replace(/[\\/:*?"<>|]/g, '_').trim();
  return `${safe || 'project'}.mp4`;
}

/** 지금까지의 속도로 계산한 남은 시간(ms). 처음 몇 프레임은 추정이 불안정하므로 null */
export function estimateRemainingMs(done: number, total: number, elapsedMs: number): number | null {
  if (done < 5 || elapsedMs <= 0) {
    return null;
  }
  return Math.max(0, Math.round((elapsedMs / done) * (total - done)));
}
