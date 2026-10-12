import { useEffect, useRef } from 'react';
import { usToPx } from '@/core/timeline/coords.ts';
import { playbackStore } from '@/store/playbackStore.ts';

interface PlayheadProps {
  pxPerSecond: number;
}

/** 재생 중 매 프레임 움직이므로 React 렌더 없이 transform만 직접 갱신한다 */
export function Playhead({ pxPerSecond }: PlayheadProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = (time: number) => {
      if (ref.current) {
        ref.current.style.transform = `translateX(${String(usToPx(time, pxPerSecond))}px)`;
      }
    };
    update(playbackStore.getState().currentTime);
    return playbackStore.subscribe((state, previous) => {
      if (state.currentTime !== previous.currentTime) {
        update(state.currentTime);
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
