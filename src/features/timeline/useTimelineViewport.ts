import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  renderTimeRange,
  sameRange,
  UNBOUNDED_RANGE,
  type TimeRange,
} from '@/core/timeline/viewport.ts';

/**
 * 가로 스크롤 영역에서 렌더링할 시간 범위. 범위는 덩어리 단위로 바뀌므로
 * 스크롤할 때마다가 아니라 경계를 넘을 때만 리렌더된다.
 * (scroll 이벤트는 브라우저가 프레임당 한 번만 보내므로 별도 rAF 조절이 필요 없다)
 */
export function useTimelineViewport(
  scrollRef: RefObject<HTMLElement | null>,
  pxPerSecond: number,
): TimeRange {
  const [range, setRange] = useState<TimeRange>(UNBOUNDED_RANGE);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const update = () => {
      const next = renderTimeRange({
        scrollLeft: scroller.scrollLeft,
        viewportWidth: scroller.clientWidth,
        pxPerSecond,
      });
      setRange((current) => (sameRange(current, next) ? current : next));
    };

    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [scrollRef, pxPerSecond]);

  return range;
}
