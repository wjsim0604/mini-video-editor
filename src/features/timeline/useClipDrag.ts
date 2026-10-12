import { useEffect, useRef, type PointerEvent } from 'react';
import { clipDuration } from '@/core/clip.ts';
import { buildMoveClipCommand } from '@/core/commands/moveClip.ts';
import type { Clip } from '@/core/project.ts';
import { pxToUs } from '@/core/timeline/coords.ts';
import { resolveClipMove } from '@/core/timeline/moveClip.ts';
import type { Microseconds } from '@/core/time.ts';
import { sortTracksForDisplay } from '@/core/track.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';
import { createAutoScroller, type AutoScroller } from './autoScroll.ts';
import { createPositionerForEdit, type EditPositioner } from './editPosition.ts';
import { rowAtY } from './layout.ts';

/** 이 거리 이상 움직여야 드래그로 본다. 그보다 작으면 클릭(선택) */
const DRAG_THRESHOLD_PX = 3;

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  /** 포인터가 클립 시작에서 얼마나 떨어진 곳을 잡았는지 (스크롤·줌과 무관하게 시간으로 보관) */
  grabOffset: Microseconds;
  /** 마지막 포인터 상태. 자동 스크롤 중 포인터가 멈춰 있어도 위치를 다시 계산하는 데 쓴다 */
  pointer: { clientX: number; clientY: number; altKey: boolean };
  dragging: boolean;
  /** 좌표 기준이 되는 타임라인 내용 영역 */
  content: HTMLElement;
  /** 드래그 시작 시 만든 스냅·프레임 정렬 보정기 */
  positioner: EditPositioner | null;
  autoScroller: AutoScroller | null;
}

/** 타임라인 내용 영역 기준 포인터 x의 시각 (스크롤 위치가 반영된다) */
function pointerTime(content: HTMLElement, clientX: number): Microseconds {
  const { pxPerSecond } = timelineStore.getState();
  return pxToUs(clientX - content.getBoundingClientRect().left, pxPerSecond);
}

/**
 * 클립을 포인터로 끌어 옮긴다. 드래그 중에는 timelineStore.clipDrag만 갱신하고
 * (끌고 있는 클립과 미리보기만 다시 그려진다), 놓을 때 커맨드를 한 번 실행한다.
 * 포인터가 가장자리에 가면 타임라인을 자동 스크롤한다.
 */
export function useClipDrag(clip: Clip) {
  const session = useRef<DragSession | null>(null);
  const isDragging = useTimelineStore((state) => state.clipDrag?.clipId === clip.id);

  const endSession = () => {
    session.current?.autoScroller?.stop();
    session.current = null;
    const timeline = timelineStore.getState();
    timeline.setClipDrag(null);
    timeline.setSnapLine(null);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        session.current?.autoScroller?.stop();
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

  /** 마지막 포인터 위치로 놓일 자리를 계산해 미리보기를 갱신한다 */
  const updateTarget = (current: DragSession) => {
    const { clientX, clientY, altKey } = current.pointer;
    const { project } = projectStore.getState();
    const tracks = sortTracksForDisplay(project.tracks);
    const row = rowAtY(clientY - current.content.getBoundingClientRect().top, tracks.length);
    const targetTrackId = row.kind === 'track' ? (tracks[row.index]?.id ?? null) : null;

    // 시작·끝 중 기준점에 가까운 쪽으로 스냅하고(Alt를 누르면 해제), 그다음 빈자리 배치를 적용한다
    const duration = clipDuration(clip);
    const desiredStart = pointerTime(current.content, clientX) - current.grabOffset;
    const position = current.positioner?.([desiredStart, desiredStart + duration], altKey);
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
      grabOffset: pointerTime(content, event.clientX) - clip.start,
      pointer: { clientX: event.clientX, clientY: event.clientY, altKey: event.altKey },
      dragging: false,
      content,
      positioner: null,
      autoScroller: null,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    current.pointer = { clientX: event.clientX, clientY: event.clientY, altKey: event.altKey };
    if (!current.dragging) {
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
        return;
      }
      current.dragging = true;
      current.positioner = createPositionerForEdit(clip.id);
      const scroller = current.content.closest<HTMLElement>('[data-timeline-scroll]');
      current.autoScroller = scroller
        ? createAutoScroller(scroller, () => {
            updateTarget(current);
          })
        : null;
    }
    current.autoScroller?.update(event.clientX);
    updateTarget(current);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = session.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    const timeline = timelineStore.getState();
    const drag = timeline.clipDrag;
    endSession();

    if (!current.dragging) {
      timeline.selectClip(clip.id);
      return;
    }
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

  return {
    isDragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: endSession },
  };
}
