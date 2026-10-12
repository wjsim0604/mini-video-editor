import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { projectDuration } from '@/core/composition.ts';
import { usToPx } from '@/core/timeline/coords.ts';
import { clampZoom, fitZoom, scrollLeftForAnchor } from '@/core/timeline/zoom.ts';
import { playbackStore } from '@/store/playbackStore.ts';
import { projectStore } from '@/store/projectStore.ts';
import { timelineStore } from '@/store/timelineStore.ts';

export interface ZoomController {
  /** anchorX(스크롤 영역 기준 px)에 있는 시각을 고정한 채 배율을 바꾼다. 생략하면 플레이헤드 또는 화면 가운데 */
  zoomTo: (pxPerSecond: number, anchorX?: number) => void;
  /** 프로젝트 전체가 화면에 들어오게 한다 */
  fitAll: () => void;
}

/**
 * 줌 배율 변경과 스크롤 보정을 묶는다. 배율이 바뀌면 내용 폭이 바뀐 뒤(레이아웃 후)
 * 미리 계산한 스크롤 위치를 적용해 기준점이 화면에서 움직이지 않게 한다.
 */
export function useZoomController(
  scrollRef: RefObject<HTMLElement | null>,
  pxPerSecond: number,
): ZoomController {
  const pendingScrollLeft = useRef<number | null>(null);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && pendingScrollLeft.current !== null) {
      scroller.scrollLeft = pendingScrollLeft.current;
      pendingScrollLeft.current = null;
    }
  }, [scrollRef, pxPerSecond]);

  const zoomTo = useCallback(
    (next: number, anchorX?: number) => {
      const { pxPerSecond: from, setPxPerSecond } = timelineStore.getState();
      const to = clampZoom(next);
      if (to === from) {
        return;
      }
      const scroller = scrollRef.current;
      if (scroller) {
        pendingScrollLeft.current = scrollLeftForAnchor({
          scrollLeft: scroller.scrollLeft,
          anchorX: anchorX ?? defaultAnchorX(scroller, from),
          fromPxPerSecond: from,
          toPxPerSecond: to,
        });
      }
      setPxPerSecond(to);
    },
    [scrollRef],
  );

  const fitAll = useCallback(() => {
    const scroller = scrollRef.current;
    const fitted = fitZoom(
      projectDuration(projectStore.getState().project),
      scroller?.clientWidth ?? 0,
    );
    if (fitted === null) {
      return;
    }
    if (fitted === timelineStore.getState().pxPerSecond) {
      // 배율이 같으면 레이아웃 효과가 실행되지 않으므로 바로 스크롤한다
      if (scroller) {
        scroller.scrollLeft = 0;
      }
      return;
    }
    pendingScrollLeft.current = 0;
    timelineStore.getState().setPxPerSecond(fitted);
  }, [scrollRef]);

  return { zoomTo, fitAll };
}

/** 플레이헤드가 화면 안에 있으면 플레이헤드, 아니면 화면 가운데 */
function defaultAnchorX(scroller: HTMLElement, pxPerSecond: number): number {
  const playheadX = usToPx(playbackStore.getState().currentTime, pxPerSecond) - scroller.scrollLeft;
  return playheadX >= 0 && playheadX <= scroller.clientWidth ? playheadX : scroller.clientWidth / 2;
}
