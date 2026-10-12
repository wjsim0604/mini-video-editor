import { pxToUs } from '@/core/timeline/coords.ts';
import { collectSnapTargets, createEditPositioner } from '@/core/timeline/snap.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';

/** 화면 기준 스냅 거리. 줌 배율과 관계없이 같은 손맛을 주기 위해 px로 정하고 매번 시간으로 바꾼다. */
export const SNAP_DISTANCE_PX = 8;

/**
 * 현재 상태(프로젝트, 플레이헤드, 줌, 스냅 설정)로 편집 위치 보정기를 만든다.
 * 기준점 수집·정렬은 여기서 한 번만 하므로 드래그 시작 시 만들어 두고 재사용한다.
 */
export function createPositionerForEdit(excludeItemId: string | null) {
  const { project } = projectStore.getState();
  const { pxPerSecond, snapEnabled } = timelineStore.getState();
  return createEditPositioner({
    targets: collectSnapTargets(project, {
      playhead: playbackStore.getState().currentTime,
      excludeItemId,
    }),
    threshold: pxToUs(SNAP_DISTANCE_PX, pxPerSecond),
    fps: project.fps,
    snapEnabled,
  });
}

export type EditPositioner = ReturnType<typeof createPositionerForEdit>;
