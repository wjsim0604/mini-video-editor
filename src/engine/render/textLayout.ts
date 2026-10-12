import type { TextOverlay } from '@/core/project.ts';

/** 시스템 한글 글꼴 우선. 프리뷰와 내보내기가 같은 컴퓨터에서 그려지므로 결과가 같다 */
export const TEXT_FONT_FAMILY =
  '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
export const TEXT_FONT_WEIGHT = 700;
export const TEXT_LINE_HEIGHT = 1.25;
/** 밝은 배경에서도 읽히도록 글자 크기에 비례한 외곽선 */
const OUTLINE_RATIO = 0.08;

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** 출력 해상도 기준 사각형 */
export interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function fontFor(fontSize: number): string {
  return `${String(TEXT_FONT_WEIGHT)} ${String(fontSize)}px ${TEXT_FONT_FAMILY}`;
}

function linesOf(overlay: TextOverlay): string[] {
  return overlay.text.split('\n');
}

let measureContext: Context2D | null | undefined;

/** 측정 전용 컨텍스트. 캔버스를 쓸 수 없는 환경(테스트)이면 null */
function getMeasureContext(): Context2D | null {
  if (measureContext === undefined) {
    measureContext =
      typeof OffscreenCanvas === 'undefined'
        ? document.createElement('canvas').getContext('2d')
        : new OffscreenCanvas(1, 1).getContext('2d');
  }
  return measureContext;
}

/**
 * 텍스트가 차지하는 영역(출력 해상도 기준). 그리기와 프리뷰 클릭 판정이 같은 계산을 쓴다.
 * 캔버스가 없으면 글자 수로 근사한다.
 */
export function measureTextBox(overlay: TextOverlay): TextBox {
  const { fontSize, x, y } = overlay.style;
  const lines = linesOf(overlay);
  const context = getMeasureContext();
  let width: number;
  if (context) {
    context.font = fontFor(fontSize);
    width = Math.max(...lines.map((line) => context.measureText(line).width));
  } else {
    width = Math.max(...lines.map((line) => line.length)) * fontSize * 0.6;
  }
  const height = lines.length * fontSize * TEXT_LINE_HEIGHT;
  return { x: x - width / 2, y: y - height / 2, width, height };
}

/**
 * 텍스트를 그린다. 좌표·크기는 출력 해상도 기준이므로 scale(= 캔버스 폭 / 출력 폭)로 축소해 그린다.
 * 중심 (x, y)를 기준으로 여러 줄을 가운데 정렬한다.
 */
export function drawTextOverlay(context: Context2D, overlay: TextOverlay, scale: number): void {
  const { fontSize, color, x, y } = overlay.style;
  const lines = linesOf(overlay);
  const lineHeight = fontSize * TEXT_LINE_HEIGHT;
  const top = y - (lines.length * lineHeight) / 2;

  context.save();
  context.scale(scale, scale);
  context.font = fontFor(fontSize);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = fontSize * OUTLINE_RATIO * 2;
  context.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  context.fillStyle = color;
  lines.forEach((line, index) => {
    const lineY = top + lineHeight * (index + 0.5);
    context.strokeText(line, x, lineY);
    context.fillText(line, x, lineY);
  });
  context.restore();
}
