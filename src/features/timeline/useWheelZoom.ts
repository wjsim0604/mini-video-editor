import { useEffect, type RefObject } from 'react';
import { timelineStore } from '@/store/timelineStore.ts';

/** 휠 한 칸(deltaY 100)에 약 1.22배. 트랙패드 핀치는 작은 delta가 연속으로 와서 부드럽게 줌된다 */
const WHEEL_ZOOM_SENSITIVITY = 0.002;

/**
 * Ctrl/Cmd + 휠, 트랙패드 핀치(브라우저가 ctrlKey 휠로 보낸다)로 포인터 위치 기준 줌.
 * 브라우저 페이지 확대를 막으려면 preventDefault가 필요해 passive: false로 직접 등록한다.
 */
export function useWheelZoom(
  scrollRef: RefObject<HTMLElement | null>,
  zoomTo: (pxPerSecond: number, anchorX?: number) => void,
): void {
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      const { pxPerSecond } = timelineStore.getState();
      const anchorX = event.clientX - scroller.getBoundingClientRect().left;
      zoomTo(pxPerSecond * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY), anchorX);
    };
    scroller.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      scroller.removeEventListener('wheel', handleWheel);
    };
  }, [scrollRef, zoomTo]);
}
