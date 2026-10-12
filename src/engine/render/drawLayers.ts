import type { VideoSample } from 'mediabunny';
import type { TextOverlay } from '@/core/project.ts';
import { containRect } from '@/core/render/fit.ts';
import { drawTextOverlay } from './textLayout.ts';

/** 그릴 준비가 된 레이어 (아래부터 위 순서) */
export type DrawableLayer =
  | { kind: 'video'; sample: VideoSample }
  | { kind: 'image'; bitmap: ImageBitmap }
  | { kind: 'text'; overlay: TextOverlay };

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * 레이어를 캔버스에 합성한다. 프리뷰와 내보내기가 같은 함수를 써서 결과가 같게 그려진다.
 * outputWidth는 Project의 출력 폭: 텍스트 좌표·크기(출력 해상도 기준)를 캔버스 크기에 맞게 바꾸는 데 쓴다.
 */
export function drawLayers(
  context: Context2D,
  layers: readonly DrawableLayer[],
  outputWidth: number,
): void {
  const { width, height } = context.canvas;
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);
  for (const layer of layers) {
    if (layer.kind === 'video') {
      layer.sample.drawWithFit(context, { fit: 'contain' });
    } else if (layer.kind === 'text') {
      drawTextOverlay(context, layer.overlay, width / outputWidth);
    } else {
      const rect = containRect(layer.bitmap.width, layer.bitmap.height, width, height);
      context.drawImage(layer.bitmap, rect.x, rect.y, rect.width, rect.height);
    }
  }
}
