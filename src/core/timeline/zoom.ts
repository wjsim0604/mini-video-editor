import { US_PER_SECOND, type Microseconds } from '../time.ts';

/** 약 10분이 한 화면(1200px)에 들어가는 배율 */
export const MIN_PX_PER_SECOND = 2;
/** 1프레임(30fps)이 약 33px가 되는 배율 */
export const MAX_PX_PER_SECOND = 1000;
/** 줌 버튼·슬라이더 한 단계의 배율 */
export const ZOOM_STEP = 1.25;

export function clampZoom(pxPerSecond: number): number {
  return Math.min(Math.max(pxPerSecond, MIN_PX_PER_SECOND), MAX_PX_PER_SECOND);
}

/** 한 단계 확대(1) 또는 축소(-1) */
export function stepZoom(pxPerSecond: number, direction: 1 | -1): number {
  return clampZoom(pxPerSecond * ZOOM_STEP ** direction);
}

/**
 * 줌 후 스크롤 위치. 화면의 anchorX(스크롤 영역 기준 px)에 있던 시각이 줌 후에도 같은 화면 위치에 오도록 한다.
 */
export function scrollLeftForAnchor(params: {
  scrollLeft: number;
  anchorX: number;
  fromPxPerSecond: number;
  toPxPerSecond: number;
}): number {
  const { scrollLeft, anchorX, fromPxPerSecond, toPxPerSecond } = params;
  const contentX = scrollLeft + anchorX;
  return Math.max(0, (contentX * toPxPerSecond) / fromPxPerSecond - anchorX);
}

/** 프로젝트 전체가 화면 폭에 들어오는 배율 (양쪽 5% 여백). 빈 프로젝트면 null */
export function fitZoom(duration: Microseconds, viewportWidth: number): number | null {
  if (duration <= 0 || viewportWidth <= 0) {
    return null;
  }
  return clampZoom((viewportWidth * 0.9) / (duration / US_PER_SECOND));
}

/** 줌 슬라이더용 로그 스케일 변환: 배율 ↔ [0, 1] */
export function zoomToSlider(pxPerSecond: number): number {
  return (
    Math.log(clampZoom(pxPerSecond) / MIN_PX_PER_SECOND) /
    Math.log(MAX_PX_PER_SECOND / MIN_PX_PER_SECOND)
  );
}

export function sliderToZoom(value: number): number {
  const ratio = Math.min(Math.max(value, 0), 1);
  return clampZoom(MIN_PX_PER_SECOND * (MAX_PX_PER_SECOND / MIN_PX_PER_SECOND) ** ratio);
}
