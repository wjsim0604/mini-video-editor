import { useEffect, useRef } from 'react';
import { usToPx } from '@/core/timeline/coords.ts';
import { playbackStore } from '@/store/playbackStore.ts';

interface PlayheadProps {
  pxPerSecond: number;
}

/** 재생 중 플레이헤드가 화면 밖으로 나가면, 화면 왼쪽에서 이 비율 위치로 오도록 넘긴다 */
const FOLLOW_OFFSET_RATIO = 0.1;

/** 재생 중 매 프레임 움직이므로 React 렌더 없이 transform만 직접 갱신한다 */
export function Playhead({ pxPerSecond }: PlayheadProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = (time: number, isPlaying: boolean) => {
      const element = ref.current;
      if (!element) {
        return;
      }
      const x = usToPx(time, pxPerSecond);
      element.style.transform = `translateX(${String(x)}px)`;

      // 재생 중 화면 밖으로 나가면 한 화면씩 넘겨 따라간다
      const scroller = element.closest<HTMLElement>('[data-timeline-scroll]');
      if (isPlaying && scroller && scroller.clientWidth > 0) {
        const { scrollLeft, clientWidth } = scroller;
        if (x < scrollLeft || x > scrollLeft + clientWidth) {
          scroller.scrollLeft = x - clientWidth * FOLLOW_OFFSET_RATIO;
        }
      }
    };
    const initial = playbackStore.getState();
    update(initial.currentTime, initial.isPlaying);
    return playbackStore.subscribe((state, previous) => {
      if (state.currentTime !== previous.currentTime) {
        update(state.currentTime, state.isPlaying);
      }
    });
  }, [pxPerSecond]);

  return (
    <div
      ref={ref}
      data-testid="playhead"
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-red-500 will-change-transform"
    >
      <div className="absolute -top-px -left-1.5 h-0 w-0 border-x-[6px] border-t-8 border-x-transparent border-t-red-500" />
    </div>
  );
}
