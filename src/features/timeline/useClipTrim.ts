import { useEffect, useRef, type PointerEvent } from 'react';
import { clipEnd } from '@/core/clip.ts';
import { createSetClipTimingCommand } from '@/core/commands/setClipTiming.ts';
import type { Clip, Project } from '@/core/project.ts';
import { pxToUs } from '@/core/timeline/coords.ts';
import { resolveTrim, timingOf, type ClipTiming, type TrimEdge } from '@/core/timeline/trim.ts';
import type { Microseconds } from '@/core/time.ts';
import { playbackEngine } from '@/features/preview/playback.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore, useTimelineStore } from '@/store/timelineStore.ts';
import { createAutoScroller, type AutoScroller } from './autoScroll.ts';
import { createPositionerForEdit, type EditPositioner } from './editPosition.ts';

interface TrimSession {
  pointerId: number;
  edge: TrimEdge;
  /** 잡은 지점과 클립 끝 사이의 시간 차 (스크롤·줌과 무관) */
  grabOffset: Microseconds;
  pointer: { clientX: number; altKey: boolean };
  content: HTMLElement;
  moved: boolean;
  positioner: EditPositioner;
  autoScroller: AutoScroller | null;
}

function withTiming(project: Project, clipId: string, timing: ClipTiming): Project {
  return {
    ...project,
    clips: project.clips.map((clip) => (clip.id === clipId ? { ...clip, ...timing } : clip)),
  };
}

function pointerTime(content: HTMLElement, clientX: number): Microseconds {
  const { pxPerSecond } = timelineStore.getState();
  return pxToUs(clientX - content.getBoundingClientRect().left, pxPerSecond);
}

/**
 * 클립 양 끝 손잡이로 트리밍한다. 드래그 중에는 timelineStore.clipTrim으로 클립을 미리 보여주고,
 * 프리뷰에는 잘리는 지점의 프레임을 표시한다. 놓을 때 커맨드를 한 번 실행한다.
 */
export function useClipTrim(clip: Clip) {
  const session = useRef<TrimSession | null>(null);
  const trim = useTimelineStore((state) =>
    state.clipTrim?.clipId === clip.id ? state.clipTrim : null,
  );
  const isTrimming = trim !== null;

  const cancel = () => {
    session.current?.autoScroller?.stop();
    session.current = null;
    timelineStore.getState().setClipTrim(null);
    timelineStore.getState().setSnapLine(null);
    playbackEngine.endPreview();
  };

  useEffect(() => {
    if (!isTrimming) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        session.current?.autoScroller?.stop();
        session.current = null;
        timelineStore.getState().setClipTrim(null);
        timelineStore.getState().setSnapLine(null);
        playbackEngine.endPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTrimming]);

  /** 마지막 포인터 위치로 트리밍 결과를 계산해 클립과 프리뷰를 갱신한다 */
  const updateTrim = (current: TrimSession) => {
    const { project } = projectStore.getState();
    const desired = pointerTime(current.content, current.pointer.clientX) + current.grabOffset;
    // 끌고 있는 끝을 스냅(Alt를 누르면 해제)한 뒤 원본 범위·이웃 클립 제한을 적용한다
    const position = current.positioner([desired], current.pointer.altKey);
    const timing = resolveTrim(project, clip.id, current.edge, desired + position.delta);
    if (!timing) {
      return;
    }
    const timeline = timelineStore.getState();
    timeline.setClipTrim({ clipId: clip.id, edge: current.edge, timing });

    const trimmedEnd = timing.start + (timing.outPoint - timing.inPoint);
    const resultEdge = current.edge === 'start' ? timing.start : trimmedEnd;
    timeline.setSnapLine(position.snappedTo === resultEdge ? resultEdge : null);

    // 프리뷰에 잘리는 지점의 프레임을 보여준다 (끝 쪽은 마지막으로 보이는 프레임)
    const draft = withTiming(project, clip.id, timing);
    playbackEngine.previewFrame(draft, current.edge === 'start' ? timing.start : trimmedEnd - 1);
  };

  // 두 손잡이가 같은 핸들러를 쓰고, 어느 쪽 끝인지는 data-edge 속성으로 구분한다
  const handleProps = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const edge = event.currentTarget.dataset['edge'];
      const content = event.currentTarget.closest<HTMLElement>('[data-timeline-content]');
      if (event.button !== 0 || (edge !== 'start' && edge !== 'end') || !content) {
        return;
      }
      // 클립 이동과 타임라인 탐색으로 전파되지 않게 한다
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const edgeTime = edge === 'start' ? clip.start : clipEnd(clip);
      const current: TrimSession = {
        pointerId: event.pointerId,
        edge,
        grabOffset: edgeTime - pointerTime(content, event.clientX),
        pointer: { clientX: event.clientX, altKey: event.altKey },
        content,
        moved: false,
        positioner: createPositionerForEdit(clip.id),
        autoScroller: null,
      };
      const scroller = content.closest<HTMLElement>('[data-timeline-scroll]');
      current.autoScroller = scroller
        ? createAutoScroller(scroller, () => {
            updateTrim(current);
          })
        : null;
      session.current = current;
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = session.current;
      if (current?.pointerId !== event.pointerId) {
        return;
      }
      event.stopPropagation();
      current.moved = true;
      current.pointer = { clientX: event.clientX, altKey: event.altKey };
      current.autoScroller?.update(event.clientX);
      updateTrim(current);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const current = session.current;
      if (current?.pointerId !== event.pointerId) {
        return;
      }
      event.stopPropagation();
      const pending = timelineStore.getState().clipTrim;
      cancel();
      timelineStore.getState().selectClip(clip.id);
      if (!current.moved || pending?.clipId !== clip.id) {
        return;
      }

      const { project, dispatch } = projectStore.getState();
      const latest = project.clips.find((candidate) => candidate.id === clip.id);
      if (!latest) {
        return;
      }
      const from = timingOf(latest);
      const to = pending.timing;
      if (from.start !== to.start || from.inPoint !== to.inPoint || from.outPoint !== to.outPoint) {
        dispatch(createSetClipTimingCommand(clip.id, from, to));
      }
    },
    onPointerCancel: cancel,
  };

  return { trim, handleProps };
}
