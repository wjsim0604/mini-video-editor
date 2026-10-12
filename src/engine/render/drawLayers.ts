import type { VideoSample } from 'mediabunny';
import type { ClipTransform, TextOverlay } from '@/core/project.ts';
import { containRect } from '@/core/render/fit.ts';
import { drawTextOverlay } from './textLayout.ts';

/** 그릴 준비가 된 레이어 (아래부터 위 순서) */
export type DrawableLayer =
  | { kind: 'video'; sample: VideoSample; transform?: ClipTransform }
  | { kind: 'image'; bitmap: ImageBitmap; transform?: ClipTransform }
  | { kind: 'text'; overlay: TextOverlay };

/** 클립 레이어의 위치·크기를 그릴 레이어로 옮긴다 (없으면 기본 배치라 넘기지 않는다) */
export function placement(layer: { transform?: ClipTransform }): { transform?: ClipTransform } {
  return layer.transform ? { transform: layer.transform } : {};
}

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
  const scale = width / outputWidth;
  for (const layer of layers) {
    if (layer.kind === 'text') {
      drawTextOverlay(context, layer.overlay, scale);
      continue;
    }
    context.save();
    if (layer.transform) {
      // 꽉 맞춘 기본 배치(중심 = 화면 중심)를 transform의 중심·배율로 옮긴다. core/render/fit.ts의 clipRect와 같은 결과
      const { x, y, scale: zoom } = layer.transform;
      context.translate(x * scale, y * scale);
      context.scale(zoom, zoom);
      context.translate(-width / 2, -height / 2);
    }
    if (layer.kind === 'video') {
      // 회전 메타데이터까지 처리하는 drawWithFit은 현재 변환 위에 그린다
      layer.sample.drawWithFit(context, { fit: 'contain' });
    } else {
      const rect = containRect(layer.bitmap.width, layer.bitmap.height, width, height);
      context.drawImage(layer.bitmap, rect.x, rect.y, rect.width, rect.height);
    }
    context.restore();
  }
}
