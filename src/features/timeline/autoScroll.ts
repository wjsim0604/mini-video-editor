import { autoScrollSpeed } from '@/core/timeline/viewport.ts';

export interface AutoScroller {
  /** 포인터 위치로 스크롤 속도를 갱신한다. 가장자리 근처면 rAF 루프로 계속 스크롤한다 */
  update: (clientX: number) => void;
  stop: () => void;
}

/**
 * 드래그 중 포인터가 스크롤 영역 가장자리에 머물면 계속 스크롤한다.
 * 포인터가 멈춰 있어도 스크롤된 만큼 드래그 위치를 다시 계산하도록 onScroll을 부른다.
 */
export function createAutoScroller(scroller: HTMLElement, onScroll: () => void): AutoScroller {
  let speed = 0;
  let frame: number | null = null;

  const tick = () => {
    frame = null;
    if (speed === 0) {
      return;
    }
    const before = scroller.scrollLeft;
    scroller.scrollLeft = before + speed;
    if (scroller.scrollLeft !== before) {
      onScroll();
    }
    frame = requestAnimationFrame(tick);
  };

  return {
    update: (clientX) => {
      const rect = scroller.getBoundingClientRect();
      // 레이아웃이 없는 환경(테스트 등)에서는 스크롤하지 않는다
      speed = rect.width > 0 ? autoScrollSpeed(clientX - rect.left, rect.width) : 0;
      if (speed !== 0 && frame === null) {
        frame = requestAnimationFrame(tick);
      }
    },
    stop: () => {
      speed = 0;
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
  };
}
