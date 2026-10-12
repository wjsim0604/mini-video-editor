import type { ProfilerOnRenderCallback } from 'react';

export interface RenderRecord {
  phase: string;
  /** 이 커밋에서 React가 렌더에 쓴 시간(ms) */
  duration: number;
  at: number;
}

const MAX_RECORDS = 5_000;

/** 개발 모드에서 타임라인 렌더 시간을 기록한다 (E2E 성능 측정용). 프로덕션 빌드에서는 호출되지 않는다. */
export const timelineRenders: RenderRecord[] = [];

export const onTimelineRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
  if (!import.meta.env.DEV) {
    return;
  }
  timelineRenders.push({ phase, duration: actualDuration, at: performance.now() });
  if (timelineRenders.length > MAX_RECORDS) {
    timelineRenders.splice(0, timelineRenders.length - MAX_RECORDS);
  }
};
