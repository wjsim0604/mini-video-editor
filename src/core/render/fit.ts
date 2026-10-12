import type { ClipTransform } from '../project.ts';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 원본 비율을 유지한 채 대상 영역 안에 꽉 차게 들어가는 사각형 (letterbox / pillarbox) */
export function containRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Rect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

interface Size {
  width: number;
  height: number;
}

/** transform이 없는 클립의 배치: 화면 가운데, 꽉 맞춘 크기 */
export function defaultClipTransform(output: Size): ClipTransform {
  return { x: output.width / 2, y: output.height / 2, scale: 1 };
}

/**
 * 클립이 차지하는 영역(출력 해상도 기준). 그리기와 프리뷰 클릭 판정이 같은 계산을 쓴다.
 * 원본 크기를 모르면 출력 화면 전체를 기준으로 한다.
 */
export function clipRect(
  source: Partial<Size> | undefined,
  output: Size,
  transform: ClipTransform = defaultClipTransform(output),
): Rect {
  const base =
    source?.width && source.height
      ? containRect(source.width, source.height, output.width, output.height)
      : { x: 0, y: 0, width: output.width, height: output.height };
  const width = base.width * transform.scale;
  const height = base.height * transform.scale;
  return { x: transform.x - width / 2, y: transform.y - height / 2, width, height };
}
