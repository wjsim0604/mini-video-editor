import { useEffect, useRef, type PointerEvent } from 'react';
import { clipDuration } from '@/core/clip.ts';
import { buildMoveClipCommand } from '@/core/commands/moveClip.ts';
import type { Clip } from '@/core/project.ts';
import { pxToUs } from '@/core/timeline/coords.ts';
import { resolveClipMove } from '@/core/timeline/moveClip.ts';
import { sortTracksForDisplay } from '@/core/track.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';
import { createPositionerForEdit, type EditPositioner } from './editPosition.ts';
import { rowAtY } from './layout.ts';

/** 이 거리 이상 움직여야 드래그로 본다. 그보다 작으면 클릭(선택) */
const DRAG_THRESHOLD_PX = 3;

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  /** 좌표 기준이 되는 타임라인 내용 영역 */
  content: HTMLElement;
  /** 드래그 시작 시 만든 스냅·프레임 정렬 보정기 */
  positioner: EditPositioner | null;
}

/**
 * 클립을 포인터로 끌어 옮긴다. 드래그 중에는 timelineStore.clipDrag만 갱신하고
 * (끌고 있는 클립과 미리보기만 다시 그려진다), 놓을 때 커맨드를 한 번 실행한다.
 */
export function useClipDrag(clip: Clip, pxPerSecond: number) {
  const session = useRef<DragSession | null>(null);
  const isDragging = useTimelineStore((state) => state.clipDrag?.clipId === clip.id);

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        session.current = null;
        timelineStore.getState().setClipDrag(null);
        timelineStore.getState().setSnapLine(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    // 타임라인 빈 곳 클릭(탐색)으로 전파되지 않게 한다
    event.stopPropagation();
    const content = event.currentTarget.closest<HTMLElement>('[data-timeline-content]');
    if (!content) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      content,
      positioner: null,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
        return;
      }
      current.dragging = true;
      current.positioner = createPositionerForEdit(clip.id);
    }

    const { project } = projectStore.getState();
    const tracks = sortTracksForDisplay(project.tracks);
    const row = rowAtY(event.clientY - current.content.getBoundingClientRect().top, tracks.length);
    const targetTrackId = row.kind === 'track' ? (tracks[row.index]?.id ?? null) : null;

    // 시작·끝 중 기준점에 가까운 쪽으로 스냅하고(Alt를 누르면 해제), 그다음 빈자리 배치를 적용한다
    const duration = clipDuration(clip);
    const desiredStart = clip.start + pxToUs(dx, pxPerSecond);
    const position = current.positioner?.([desiredStart, desiredStart + duration], event.altKey);
    const target = resolveClipMove(
      project,
      clip.id,
      desiredStart + (position?.delta ?? 0),
      targetTrackId,
    );
    if (!target) {
      return;
    }
    const timeline = timelineStore.getState();
    timeline.setClipDrag({ clipId: clip.id, duration, target });
    // 빈자리 배치로 위치가 바뀌었으면 스냅이 적용되지 않은 것이므로 안내선을 숨긴다
    const snapped = position?.snappedTo;
    timeline.setSnapLine(
      snapped !== undefined && (snapped === target.start || snapped === target.start + duration)
        ? snapped
        : null,
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    session.current = null;
    const timeline = timelineStore.getState();

    if (!current.dragging) {
      timeline.selectClip(clip.id);
      return;
    }
    const drag = timeline.clipDrag;
    timeline.setClipDrag(null);
    timeline.setSnapLine(null);
    if (drag?.clipId !== clip.id) {
      return;
    }
    const { project, dispatch } = projectStore.getState();
    const command = buildMoveClipCommand(project, clip.id, drag.target, () => crypto.randomUUID());
    if (command) {
      dispatch(command);
      timeline.selectClip(clip.id);
    }
  };

  const onPointerCancel = () => {
    session.current = null;
    timelineStore.getState().setClipDrag(null);
    timelineStore.getState().setSnapLine(null);
  };

  return { isDragging, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}
