import type { VideoCodec } from 'mediabunny';

/** 거의 모든 플레이어에서 재생되는 H.264를 우선하고, 인코더가 없으면 VP9 → AV1 */
export const PREFERRED_CODECS: VideoCodec[] = ['avc', 'vp9', 'av1'];

export const CODEC_LABEL: Record<string, string> = {
  avc: 'H.264',
  vp9: 'VP9',
  av1: 'AV1',
};

/** 이 브라우저에서 해당 해상도로 인코딩할 수 있는 첫 코덱. 없으면 null */
export async function pickExportCodec(
  width: number,
  height: number,
  frameRate: number,
): Promise<VideoCodec | null> {
  if (typeof VideoEncoder === 'undefined') {
    return null;
  }
  const { getFirstEncodableVideoCodec, QUALITY_HIGH } = await import('mediabunny');
  return getFirstEncodableVideoCodec(PREFERRED_CODECS, {
    width,
    height,
    frameRate,
    quality: QUALITY_HIGH,
  });
}
