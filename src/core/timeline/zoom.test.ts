import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  fitZoom,
  MAX_PX_PER_SECOND,
  MIN_PX_PER_SECOND,
  scrollLeftForAnchor,
  sliderToZoom,
  stepZoom,
  zoomToSlider,
} from './zoom.ts';

describe('clampZoom / stepZoom', () => {
  it('범위 안으로 제한한다', () => {
    expect(clampZoom(0.1)).toBe(MIN_PX_PER_SECOND);
    expect(clampZoom(1e6)).toBe(MAX_PX_PER_SECOND);
  });

  it('한 단계에 1.25배씩 바꾼다', () => {
    expect(stepZoom(50, 1)).toBe(62.5);
    expect(stepZoom(50, -1)).toBe(40);
    expect(stepZoom(MAX_PX_PER_SECOND, 1)).toBe(MAX_PX_PER_SECOND);
  });
});

describe('scrollLeftForAnchor', () => {
  it('기준점 아래의 시각이 같은 화면 위치에 머문다', () => {
    // 스크롤 100 + 기준점 200 = 내용 300px (50px/s에서 6초)
    const next = scrollLeftForAnchor({
      scrollLeft: 100,
      anchorX: 200,
      fromPxPerSecond: 50,
      toPxPerSecond: 100,
    });

    // 100px/s에서 6초 = 600px, 화면 200px 위치에 오려면 스크롤 400
    expect(next).toBe(400);
  });

  it('스크롤은 0보다 작아지지 않는다', () => {
    expect(
      scrollLeftForAnchor({ scrollLeft: 0, anchorX: 300, fromPxPerSecond: 100, toPxPerSecond: 10 }),
    ).toBe(0);
  });
});

describe('fitZoom', () => {
  it('프로젝트 전체가 화면의 90%에 들어오는 배율', () => {
    expect(fitZoom(60_000_000, 1000)).toBe(15);
  });

  it('범위를 넘으면 제한하고, 빈 프로젝트면 null', () => {
    expect(fitZoom(100_000, 1000)).toBe(MAX_PX_PER_SECOND);
    expect(fitZoom(0, 1000)).toBeNull();
  });
});

describe('zoomToSlider / sliderToZoom', () => {
  it('양 끝과 왕복 변환이 일치한다', () => {
    expect(zoomToSlider(MIN_PX_PER_SECOND)).toBe(0);
    expect(zoomToSlider(MAX_PX_PER_SECOND)).toBe(1);
    expect(sliderToZoom(zoomToSlider(50))).toBeCloseTo(50, 9);
  });
});
