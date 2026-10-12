import type { Project } from '../project.ts';
import { rescaleProject, type Resolution } from '../resolution.ts';
import type { Command } from './command.ts';

/**
 * 해상도 변경. 반올림 때문에 역변환으로는 원래 값이 정확히 돌아오지 않으므로,
 * undo는 바꾸기 전의 텍스트 스타일·클립 배치를 id별로 되돌린다.
 */
export function buildSetResolutionCommand(project: Project, next: Resolution): Command | null {
  if (project.width === next.width && project.height === next.height) {
    return null;
  }
  if (![next.width, next.height].every((value) => Number.isInteger(value) && value > 0)) {
    throw new RangeError(`Invalid resolution: ${String(next.width)}x${String(next.height)}`);
  }
  const before: Resolution = { width: project.width, height: project.height };
  const styles = new Map(project.overlays.map((overlay) => [overlay.id, overlay.style]));
  const transforms = new Map(project.clips.map((clip) => [clip.id, clip.transform]));
  return {
    label: '해상도 변경',
    execute: (current) => rescaleProject(current, next),
    undo: (current) => ({
      ...current,
      ...before,
      overlays: current.overlays.map((overlay) => {
        const style = styles.get(overlay.id);
        return style ? { ...overlay, style } : overlay;
      }),
      clips: current.clips.map((clip) => {
        const transform = transforms.get(clip.id);
        return transform ? { ...clip, transform } : clip;
      }),
    }),
  };
}
